"""Connector for RSS/Atom feeds."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

try:
    import httpx
except Exception:  # pragma: no cover - optional dependency
    httpx = None

try:
    import feedparser
except Exception:  # pragma: no cover - optional dependency
    feedparser = None

try:
    from bs4 import BeautifulSoup
except Exception:  # pragma: no cover - optional dependency
    BeautifulSoup = None

from ragkit.connectors.base import (
    BaseConnector,
    ConnectorChangeDetection,
    ConnectorDocument,
    ConnectorValidationResult,
)
from ragkit.connectors.registry import register_connector
from ragkit.desktop.models import SourceType


logger = logging.getLogger(__name__)


@register_connector(SourceType.RSS_FEED)
class RssFeedConnector(BaseConnector):
    """Parse RSS/Atom feeds and expose articles as documents."""

    def __init__(self, source_id: str, config: dict[str, Any], credential: dict[str, Any] | None = None) -> None:
        super().__init__(source_id, config, credential)
        self._doc_cache: dict[str, ConnectorDocument] = {}

    def _feed_urls(self) -> list[str]:
        urls = self.config.get("feed_urls", [])
        return [str(url).strip() for url in urls if str(url).strip()]

    def _max_articles(self) -> int:
        return max(1, int(self.config.get("max_articles", 50)))

    def _fetch_full_content(self) -> bool:
        return bool(self.config.get("fetch_full_content", False))

    def _content_selectors(self) -> list[str]:
        return [str(s).strip() for s in self.config.get("content_selectors", []) if str(s).strip()]

    def _max_age_days(self) -> int | None:
        value = self.config.get("max_age_days")
        if value is None:
            return None
        try:
            return max(1, int(value))
        except Exception:
            return None

    # ------------------------------------------------------------------
    # BaseConnector implementation
    # ------------------------------------------------------------------

    async def validate_config(self) -> ConnectorValidationResult:
        errors: list[str] = []
        if feedparser is None:
            errors.append("Le package feedparser est requis pour les sources RSS.")

        feed_urls = self._feed_urls()
        if not feed_urls:
            errors.append("Au moins une URL de flux doit etre fournie.")

        for url in feed_urls:
            parsed = urlparse(url)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                errors.append(f"URL de flux invalide: {url}")

        if self._fetch_full_content() and (httpx is None or BeautifulSoup is None):
            errors.append("Le contenu complet requiert httpx et beautifulsoup4.")

        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors)

    async def test_connection(self) -> ConnectorValidationResult:
        validation = await self.validate_config()
        if not validation.valid or feedparser is None:
            return validation

        errors = list(validation.errors)
        for url in self._feed_urls():
            try:
                feed = feedparser.parse(url)
                if feed.bozo:
                    errors.append(f"Flux invalide: {url}")
            except Exception as exc:  # pragma: no cover - network issues
                errors.append(f"Erreur lors du parsing de {url}: {exc}")

        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors)

    async def list_documents(self) -> list[ConnectorDocument]:
        validation = await self.validate_config()
        if not validation.valid or feedparser is None:
            if validation.errors:
                logger.warning("RssFeedConnector validation failed: %s", validation.errors)
            return []

        documents: list[ConnectorDocument] = []
        self._doc_cache = {}

        for feed_url in self._feed_urls():
            feed = feedparser.parse(feed_url)
            entries = list(feed.entries)[: self._max_articles()]
            for entry in entries:
                published = self._entry_datetime(entry)
                if self._is_too_old(published):
                    continue

                title = entry.get("title") or "Untitled"
                link = entry.get("link") or ""
                entry_id = entry.get("id") or entry.get("guid") or link or title

                content = entry.get("summary") or entry.get("description") or ""
                if self._fetch_full_content() and link:
                    content = await self._fetch_full_article(link, content)

                content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
                doc_id = hashlib.sha256(f"{self.source_id}:{entry_id}".encode("utf-8")).hexdigest()
                last_modified = published or datetime.now(timezone.utc).isoformat()

                document = ConnectorDocument(
                    id=doc_id,
                    source_id=self.source_id,
                    title=title,
                    content=content,
                    content_type="text",
                    url=link or None,
                    file_path=None,
                    file_type="html",
                    file_size_bytes=len(content.encode("utf-8")),
                    last_modified=last_modified,
                    metadata={"feed_url": feed_url},
                    content_hash=content_hash,
                )
                documents.append(document)
                self._doc_cache[doc_id] = document

        return documents

    async def fetch_document_content(self, doc_id: str) -> str:
        cached = self._doc_cache.get(doc_id)
        if cached is not None:
            return cached.content
        docs = await self.list_documents()
        for doc in docs:
            if doc.id == doc_id:
                return doc.content
        raise FileNotFoundError(f"Document ID {doc_id} not found in RSS source.")

    async def detect_changes(self, known_hashes: dict[str, str]) -> ConnectorChangeDetection:
        docs = await self.list_documents()
        current_by_id = {doc.id: doc for doc in docs}
        added = [doc for doc in docs if doc.id not in known_hashes]
        modified = [doc for doc in docs if doc.id in known_hashes and doc.content_hash != known_hashes[doc.id]]
        removed_ids = [doc_id for doc_id in known_hashes if doc_id not in current_by_id]
        return ConnectorChangeDetection(added=added, modified=modified, removed_ids=removed_ids)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _entry_datetime(self, entry: Any) -> str | None:
        for key in ("published_parsed", "updated_parsed"):
            parsed = entry.get(key)
            if parsed:
                try:
                    dt = datetime(*parsed[:6], tzinfo=timezone.utc)
                    return dt.isoformat()
                except Exception:
                    continue
        return None

    def _is_too_old(self, published_iso: str | None) -> bool:
        max_age = self._max_age_days()
        if not max_age or not published_iso:
            return False
        try:
            published = datetime.fromisoformat(published_iso)
            if published.tzinfo is None:
                published = published.replace(tzinfo=timezone.utc)
        except Exception:
            return False
        threshold = datetime.now(timezone.utc) - timedelta(days=max_age)
        return published < threshold

    async def _fetch_full_article(self, url: str, fallback: str) -> str:
        if httpx is None or BeautifulSoup is None:
            return fallback
        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                response = await client.get(url)
                if response.status_code >= 400:
                    return fallback
                html = response.text
        except Exception:
            return fallback

        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()

        selectors = self._content_selectors()
        if selectors:
            for selector in selectors:
                node = soup.select_one(selector)
                if node:
                    text = node.get_text(" ", strip=True)
                    if text:
                        return text
        text = soup.get_text(" ", strip=True)
        return text or fallback
