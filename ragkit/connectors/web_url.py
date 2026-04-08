"""Connector for crawling and extracting content from web URLs."""

from __future__ import annotations

import asyncio
import fnmatch
import hashlib
import logging
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
        documents: list[ConnectorDocument] = []
        self._doc_cache = {}

        async with httpx.AsyncClient(
            timeout=self._timeout_seconds(),
            headers={"User-Agent": self._user_agent()},
            follow_redirects=True,
        ) as client:
            while queue and len(documents) < self._max_pages():
                current_url, depth = queue.pop(0)
                normalized_url = self._normalize_url(current_url)
                if normalized_url in seen:
                    continue
                seen.add(normalized_url)

                if not self._is_allowed_url(normalized_url, allowed_domains, include_patterns, exclude_patterns):
                    continue

                if self._respect_robots():
                    if not await self._allowed_by_robots(client, normalized_url):
                        continue

                response = await self._fetch_url(client, normalized_url)
                if response is None:
                    continue

                html = response.text
                title, content = self._extract_content(html, normalized_url)
                content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

                doc_id = hashlib.sha256(f"{self.source_id}:{normalized_url}".encode("utf-8")).hexdigest()
                last_modified = response.headers.get("last-modified")
                last_modified_iso = self._parse_http_date(last_modified) if last_modified else None

                document = ConnectorDocument(
                    id=doc_id,
                    source_id=self.source_id,
                    title=title or normalized_url,
                    content=content,
                    content_type=self._content_type(),
                    url=normalized_url,
                    file_path=None,
                    file_type="html",
                    file_size_bytes=len(response.content or b""),
                    last_modified=last_modified_iso or datetime.now(timezone.utc).isoformat(),
                    metadata={"etag": response.headers.get("etag")},
                    content_hash=content_hash,
                )
                documents.append(document)
                self._doc_cache[doc_id] = document

                if depth < self._crawl_depth():
                    links = self._extract_links(html, normalized_url)
                    for link in links:
                        if link in seen:
                            continue
                        if self._same_domain_only() and urlparse(link).netloc.lower() not in allowed_domains:
                            continue
                        queue.append((link, depth + 1))

                delay_ms = self._request_delay_ms()
                if delay_ms:
                    await asyncio.sleep(delay_ms / 1000)

        return documents

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
        try:
            response = await client.get(url)
        except Exception as exc:  # pragma: no cover - network issues
            logger.warning("Failed to fetch %s: %s", url, exc)
            return None

        if response.status_code >= 400:
            logger.warning("Skipping %s (HTTP %s)", url, response.status_code)
            return None

        content_type = response.headers.get("content-type", "").lower()
        if "text/html" not in content_type and "application/xhtml" not in content_type:
            return None

        return response

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

