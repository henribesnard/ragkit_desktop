"""Connector for crawling and extracting content from web URLs."""

from __future__ import annotations

import asyncio
import fnmatch
import hashlib
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any, Iterable
from urllib.parse import urljoin, urldefrag, urlparse
from urllib.robotparser import RobotFileParser

try:
    import httpx
except Exception:  # pragma: no cover - optional dependency
    httpx = None

try:
    from bs4 import BeautifulSoup
except Exception:  # pragma: no cover - optional dependency
    BeautifulSoup = None

try:
    import lxml  # noqa: F401
    _LXML_AVAILABLE = True
except Exception:  # pragma: no cover - optional dependency
    _LXML_AVAILABLE = False

from ragkit.connectors.base import (
    BaseConnector,
    ConnectorChangeDetection,
    ConnectorDocument,
    ConnectorValidationResult,
)
from ragkit.connectors.registry import register_connector
from ragkit.desktop.models import SourceType


logger = logging.getLogger(__name__)


@register_connector(SourceType.WEB_URL)
class WebUrlConnector(BaseConnector):
    """Crawl and extract documents from web pages."""

    def __init__(self, source_id: str, config: dict[str, Any], credential: dict[str, Any] | None = None) -> None:
        super().__init__(source_id, config, credential)
        self._doc_cache: dict[str, ConnectorDocument] = {}
        self._robots_cache: dict[str, RobotFileParser | None] = {}

    # ------------------------------------------------------------------
    # Config helpers
    # ------------------------------------------------------------------

    def _urls(self) -> list[str]:
        urls = self.config.get("urls", [])
        return [str(url).strip() for url in urls if str(url).strip()]

    def _crawl_depth(self) -> int:
        return max(0, int(self.config.get("crawl_depth", 0)))

    def _same_domain_only(self) -> bool:
        return bool(self.config.get("crawl_same_domain_only", True))

    def _include_patterns(self) -> list[str]:
        return [str(p).strip() for p in self.config.get("include_patterns", []) if str(p).strip()]

    def _exclude_patterns(self) -> list[str]:
        return [str(p).strip() for p in self.config.get("exclude_patterns", []) if str(p).strip()]

    def _max_pages(self) -> int:
        return max(1, int(self.config.get("max_pages", 100)))

    def _extract_mode(self) -> str:
        mode = str(self.config.get("extract_mode", "text")).strip().lower()
        return mode if mode in {"text", "markdown", "html_clean"} else "text"

    def _respect_robots(self) -> bool:
        return bool(self.config.get("respect_robots_txt", True))

    def _user_agent(self) -> str:
        return str(self.config.get("user_agent", "LOKO-RAG/1.0"))

    def _request_delay_ms(self) -> int:
        return max(0, int(self.config.get("request_delay_ms", 0)))

    def _timeout_seconds(self) -> float:
        return max(1.0, float(self.config.get("timeout_seconds", 30)))

    def _concurrency(self) -> int:
        return max(1, int(self.config.get("concurrency", 5)))

    def _use_sitemap(self) -> bool:
        return bool(self.config.get("use_sitemap", False))

    # ------------------------------------------------------------------
    # BaseConnector implementation
    # ------------------------------------------------------------------

    async def validate_config(self) -> ConnectorValidationResult:
        errors: list[str] = []

        if httpx is None:
            errors.append("Le package httpx est requis pour les sources web.")
        if BeautifulSoup is None:
            errors.append("Le package beautifulsoup4 est requis pour les sources web.")

        urls = self._urls()
        if not urls:
            errors.append("Au moins une URL doit etre fournie.")

        for url in urls:
            parsed = urlparse(url)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                errors.append(f"URL invalide: {url}")

        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors)

    async def test_connection(self) -> ConnectorValidationResult:
        validation = await self.validate_config()
        if not validation.valid or httpx is None:
            return validation

        errors = list(validation.errors)
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout_seconds(),
                headers={"User-Agent": self._user_agent()},
                follow_redirects=True,
            ) as client:
                for url in self._urls():
                    try:
                        response = await client.get(url)
                    except Exception as exc:  # pragma: no cover - network errors
                        errors.append(f"Impossible d'acceder a {url}: {exc}")
                        continue
                    if response.status_code >= 400:
                        errors.append(f"Erreur HTTP {response.status_code} pour {url}")
        except Exception as exc:  # pragma: no cover - client errors
            errors.append(f"Erreur lors du test de connexion: {exc}")

        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors)

    async def list_documents(self) -> list[ConnectorDocument]:
        validation = await self.validate_config()
        if not validation.valid or httpx is None or BeautifulSoup is None:
            if validation.errors:
                logger.warning("WebUrlConnector validation failed: %s", validation.errors)
            return []

        seed_urls = self._urls()
        allowed_domains = {urlparse(url).netloc.lower() for url in seed_urls}
        include_patterns = self._include_patterns()
        exclude_patterns = self._exclude_patterns()

        seen: set[str] = set()
        queue: list[tuple[str, int]] = [(url, 0) for url in seed_urls]
        result_docs: list[ConnectorDocument] = []
        self._doc_cache = {}
        semaphore = asyncio.Semaphore(self._concurrency())

        async with httpx.AsyncClient(
            timeout=self._timeout_seconds(),
            headers={"User-Agent": self._user_agent()},
            follow_redirects=True,
        ) as client:
            # Discover additional URLs from sitemap.xml
            if self._use_sitemap():
                sitemap_urls = await self._parse_sitemaps(client, seed_urls)
                for surl in sitemap_urls:
                    normalized = self._normalize_url(surl)
                    if normalized not in seen and self._is_allowed_url(
                        normalized, allowed_domains, include_patterns, exclude_patterns
                    ):
                        queue.append((normalized, 0))

            # Process queue with parallel fetching
            while queue and len(result_docs) < self._max_pages():
                # Grab a batch from the queue
                batch_size = min(self._concurrency(), self._max_pages() - len(result_docs), len(queue))
                batch: list[tuple[str, int]] = []
                while len(batch) < batch_size and queue:
                    current_url, depth = queue.pop(0)
                    normalized_url = self._normalize_url(current_url)
                    if normalized_url in seen:
                        continue
                    seen.add(normalized_url)
                    if not self._is_allowed_url(normalized_url, allowed_domains, include_patterns, exclude_patterns):
                        continue
                    batch.append((normalized_url, depth))

                if not batch:
                    continue

                async def _process_url(url: str, depth: int) -> tuple[ConnectorDocument | None, list[tuple[str, int]]]:
                    async with semaphore:
                        if self._respect_robots():
                            if not await self._allowed_by_robots(client, url):
                                return None, []

                        response = await self._fetch_url(client, url)
                        if response is None:
                            return None, []

                        html = response.text
                        title, content = self._extract_content(html, url)
                        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
                        doc_id = hashlib.sha256(f"{self.source_id}:{url}".encode("utf-8")).hexdigest()
                        last_modified = response.headers.get("last-modified")
                        last_modified_iso = self._parse_http_date(last_modified) if last_modified else None

                        document = ConnectorDocument(
                            id=doc_id,
                            source_id=self.source_id,
                            title=title or url,
                            content=content,
                            content_type=self._content_type(),
                            url=url,
                            file_path=None,
                            file_type="html",
                            file_size_bytes=len(response.content or b""),
                            last_modified=last_modified_iso or datetime.now(timezone.utc).isoformat(),
                            metadata={"etag": response.headers.get("etag")},
                            content_hash=content_hash,
                        )

                        new_links: list[tuple[str, int]] = []
                        if depth < self._crawl_depth():
                            links = self._extract_links(html, url)
                            for link in links:
                                if self._same_domain_only() and urlparse(link).netloc.lower() not in allowed_domains:
                                    continue
                                new_links.append((link, depth + 1))

                        delay_ms = self._request_delay_ms()
                        if delay_ms:
                            await asyncio.sleep(delay_ms / 1000)

                        return document, new_links

                tasks = [_process_url(url, depth) for url, depth in batch]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for result in results:
                    if isinstance(result, Exception):
                        logger.warning("Crawl task failed: %s", result)
                        continue
                    doc, new_links = result
                    if doc is not None and len(result_docs) < self._max_pages():
                        result_docs.append(doc)
                        self._doc_cache[doc.id] = doc
                    for link, link_depth in new_links:
                        normalized = self._normalize_url(link)
                        if normalized not in seen:
                            queue.append((link, link_depth))

        return result_docs

    async def fetch_document_content(self, doc_id: str) -> str:
        cached = self._doc_cache.get(doc_id)
        if cached is not None:
            return cached.content

        docs = await self.list_documents()
        for doc in docs:
            if doc.id == doc_id:
                return doc.content
        raise FileNotFoundError(f"Document ID {doc_id} not found in web source.")

    async def detect_changes(self, known_hashes: dict[str, str]) -> ConnectorChangeDetection:
        docs = await self.list_documents()
        current_by_id = {doc.id: doc for doc in docs}
        added = [doc for doc in docs if doc.id not in known_hashes]
        modified = [doc for doc in docs if doc.id in known_hashes and doc.content_hash != known_hashes[doc.id]]
        removed_ids = [doc_id for doc_id in known_hashes if doc_id not in current_by_id]
        return ConnectorChangeDetection(added=added, modified=modified, removed_ids=removed_ids)

    def supported_file_types(self) -> list[str]:
        return ["html", "txt", "md"]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _normalize_url(self, url: str) -> str:
        normalized, _frag = urldefrag(url.strip())
        return normalized

    def _is_allowed_url(
        self,
        url: str,
        allowed_domains: set[str],
        include_patterns: list[str],
        exclude_patterns: list[str],
    ) -> bool:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return False
        if self._same_domain_only() and parsed.netloc.lower() not in allowed_domains:
            return False
        if exclude_patterns and any(fnmatch.fnmatch(url, pattern) for pattern in exclude_patterns):
            return False
        if include_patterns and not any(fnmatch.fnmatch(url, pattern) for pattern in include_patterns):
            return False
        return True

    async def _fetch_url(self, client: "httpx.AsyncClient", url: str) -> "httpx.Response | None":
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = await client.get(url)
            except (httpx.ConnectError, httpx.ReadTimeout, httpx.WriteTimeout) as exc:
                if attempt < max_retries - 1:
                    wait = (2 ** attempt) + (0.5 * attempt)
                    logger.warning("Fetch %s failed (%s), retry %d in %.1fs", url, exc, attempt + 1, wait)
                    await asyncio.sleep(wait)
                    continue
                logger.warning("Failed to fetch %s after %d attempts: %s", url, max_retries, exc)
                return None
            except Exception as exc:  # pragma: no cover - network issues
                logger.warning("Failed to fetch %s: %s", url, exc)
                return None

            if response.status_code == 429 and attempt < max_retries - 1:
                retry_after = float(response.headers.get("retry-after", 2 ** attempt))
                logger.warning("Rate limited on %s, waiting %.1fs", url, retry_after)
                await asyncio.sleep(retry_after)
                continue

            if response.status_code >= 500 and attempt < max_retries - 1:
                wait = 2 ** attempt
                logger.warning("Server error %d on %s, retry in %ds", response.status_code, url, wait)
                await asyncio.sleep(wait)
                continue

            if response.status_code >= 400:
                logger.warning("Skipping %s (HTTP %s)", url, response.status_code)
                return None

            content_type = response.headers.get("content-type", "").lower()
            if "text/html" not in content_type and "application/xhtml" not in content_type:
                return None

            return response

        return None

    async def _allowed_by_robots(self, client: "httpx.AsyncClient", url: str) -> bool:
        if not self._respect_robots():
            return True

        parsed = urlparse(url)
        domain_key = parsed.netloc.lower()
        parser = self._robots_cache.get(domain_key)
        if parser is None and domain_key not in self._robots_cache:
            parser = await self._load_robots(client, parsed)
            self._robots_cache[domain_key] = parser

        if parser is None:
            return True
        return parser.can_fetch(self._user_agent(), url)

    async def _load_robots(self, client: "httpx.AsyncClient", parsed: Any) -> RobotFileParser | None:
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        try:
            response = await client.get(robots_url)
        except Exception:  # pragma: no cover - network failures
            return None
        if response.status_code >= 400:
            return None
        parser = RobotFileParser()
        parser.parse(response.text.splitlines())
        return parser

    def _extract_links(self, html: str, base_url: str) -> Iterable[str]:
        if BeautifulSoup is None:
            return []
        soup = BeautifulSoup(html, "lxml" if _LXML_AVAILABLE else "html.parser")
        links: list[str] = []
        for tag in soup.find_all("a", href=True):
            href = tag.get("href")
            if not href:
                continue
            if href.startswith("mailto:") or href.startswith("tel:"):
                continue
            absolute = self._normalize_url(urljoin(base_url, href))
            parsed = urlparse(absolute)
            if parsed.scheme not in {"http", "https"}:
                continue
            links.append(absolute)
        return links

    def _extract_content(self, html: str, url: str) -> tuple[str | None, str]:
        if BeautifulSoup is None:
            return None, ""
        soup = BeautifulSoup(html, "lxml" if _LXML_AVAILABLE else "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()

        title = None
        if soup.title and soup.title.string:
            title = soup.title.string.strip()

        mode = self._extract_mode()
        if mode == "html_clean":
            return title, str(soup)
        if mode == "markdown":
            return title, self._html_to_markdown(soup)
        return title, soup.get_text(" ", strip=True)

    def _html_to_markdown(self, soup: Any) -> str:
        lines: list[str] = []
        for tag in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li"]):
            text = tag.get_text(" ", strip=True)
            if not text:
                continue
            if tag.name.startswith("h"):
                level = int(tag.name[1]) if len(tag.name) > 1 else 1
                lines.append(f"{'#' * level} {text}")
            elif tag.name == "li":
                lines.append(f"- {text}")
            else:
                lines.append(text)
        return "\n".join(lines) if lines else soup.get_text(" ", strip=True)

    def _content_type(self) -> str:
        mode = self._extract_mode()
        if mode == "markdown":
            return "markdown"
        if mode == "html_clean":
            return "html"
        return "text"

    def _parse_http_date(self, value: str) -> str | None:
        try:
            from email.utils import parsedate_to_datetime
            dt = parsedate_to_datetime(value)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).isoformat()
        except Exception:
            return None

    async def _parse_sitemaps(self, client: "httpx.AsyncClient", seed_urls: list[str]) -> list[str]:
        """Discover URLs from sitemap.xml for each seed domain."""
        urls: list[str] = []
        seen_sitemaps: set[str] = set()

        for seed in seed_urls:
            parsed = urlparse(seed)
            sitemap_url = f"{parsed.scheme}://{parsed.netloc}/sitemap.xml"
            if sitemap_url in seen_sitemaps:
                continue
            seen_sitemaps.add(sitemap_url)
            discovered = await self._fetch_sitemap(client, sitemap_url, seen_sitemaps)
            urls.extend(discovered)

        return urls

    async def _fetch_sitemap(self, client: "httpx.AsyncClient", sitemap_url: str, seen: set[str]) -> list[str]:
        """Fetch and parse a single sitemap or sitemap index."""
        urls: list[str] = []
        try:
            response = await client.get(sitemap_url)
            if response.status_code >= 400:
                return urls
        except Exception:
            return urls

        try:
            root = ET.fromstring(response.text)
        except ET.ParseError:
            return urls

        # Strip namespace for easier parsing
        ns = ""
        if root.tag.startswith("{"):
            ns = root.tag.split("}")[0] + "}"

        # Check if this is a sitemap index
        for sitemap_elem in root.findall(f"{ns}sitemap"):
            loc = sitemap_elem.findtext(f"{ns}loc")
            if loc and loc not in seen:
                seen.add(loc)
                child_urls = await self._fetch_sitemap(client, loc, seen)
                urls.extend(child_urls)

        # Extract URLs from urlset
        for url_elem in root.findall(f"{ns}url"):
            loc = url_elem.findtext(f"{ns}loc")
            if loc:
                urls.append(loc.strip())

        return urls

