"""Connector for Confluence pages and attachments."""

from __future__ import annotations

import base64
import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode, urljoin

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


@register_connector(SourceType.CONFLUENCE)
class ConfluenceConnector(BaseConnector):
    """Fetch Confluence pages via REST API."""

    def __init__(self, source_id: str, config: dict[str, Any], credential: dict[str, Any] | None = None) -> None:
        super().__init__(source_id, config, credential)
        self._doc_cache: dict[str, ConnectorDocument] = {}

    # ------------------------------------------------------------------
    # Config helpers
    # ------------------------------------------------------------------

    def _base_url(self) -> str:
        return str(self.config.get("base_url", "")).strip().rstrip("/")

    def _space_keys(self) -> list[str]:
        return [str(key).strip() for key in self.config.get("space_keys", []) if str(key).strip()]

    def _include_attachments(self) -> bool:
        return bool(self.config.get("include_attachments", False))

    def _include_comments(self) -> bool:
        return bool(self.config.get("include_comments", False))

    def _page_limit(self) -> int:
        return max(1, int(self.config.get("page_limit", 500)))

    def _label_filter(self) -> list[str]:
        return [str(label).strip() for label in self.config.get("label_filter", []) if str(label).strip()]

    def _exclude_archived(self) -> bool:
        return bool(self.config.get("exclude_archived", True))

    def _expand_macros(self) -> bool:
        return bool(self.config.get("expand_macros", True))

    # ------------------------------------------------------------------
    # BaseConnector implementation
    # ------------------------------------------------------------------

    async def validate_config(self) -> ConnectorValidationResult:
        errors: list[str] = []

        if httpx is None:
            errors.append("Le package httpx est requis pour Confluence.")

        if not self._base_url():
            errors.append("L'URL de base Confluence est requise.")

        if not self._space_keys():
            errors.append("Au moins un space key doit etre fourni.")

        if not self.credential:
            errors.append("Les credentials Confluence sont requis.")

        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors)

    async def test_connection(self) -> ConnectorValidationResult:
        validation = await self.validate_config()
        if not validation.valid or httpx is None:
            return validation
        return validation

    async def list_documents(self) -> list[ConnectorDocument]:
        validation = await self.validate_config()
        if not validation.valid or httpx is None:
            if validation.errors:
                logger.warning("ConfluenceConnector validation failed: %s", validation.errors)
            return []

        documents: list[ConnectorDocument] = []
        self._doc_cache = {}
        total_limit = self._page_limit()

        for space_key in self._space_keys():
            if len(documents) >= total_limit:
                break
            start = 0
            while len(documents) < total_limit:
                limit = min(100, total_limit - len(documents))
                query = {
                    "spaceKey": space_key,
                    "type": "page",
                    "start": start,
                    "limit": limit,
                    "expand": "body.storage,version,history,metadata.labels",
                }
                if self._exclude_archived():
                    query["status"] = "current"
                labels = self._label_filter()
                if labels:
                    query["label"] = labels

                url = self._build_url("/rest/api/content", query)
                payload = await self._api_get(url)
                results = payload.get("results", []) if isinstance(payload, dict) else []
                if not results:
                    break

                for page in results:
                    doc = self._page_to_document(page, space_key)
                    documents.append(doc)
                    self._doc_cache[doc.id] = doc
                    if len(documents) >= total_limit:
                        break

                fetched = len(results)
                if fetched < limit:
                    break
                start += fetched

        return documents

    async def fetch_document_content(self, doc_id: str) -> str:
        cached = self._doc_cache.get(doc_id)
        if cached is not None:
            return cached.content

        docs = await self.list_documents()
        for doc in docs:
            if doc.id == doc_id:
                return doc.content
        raise FileNotFoundError(f"Document ID {doc_id} not found in Confluence source.")

    async def detect_changes(self, known_hashes: dict[str, str]) -> ConnectorChangeDetection:
        docs = await self.list_documents()
        current_by_id = {doc.id: doc for doc in docs}
        added = [doc for doc in docs if doc.id not in known_hashes]
        modified = [doc for doc in docs if doc.id in known_hashes and doc.content_hash != known_hashes[doc.id]]
        removed_ids = [doc_id for doc_id in known_hashes if doc_id not in current_by_id]
        return ConnectorChangeDetection(added=added, modified=modified, removed_ids=removed_ids)

    def supported_file_types(self) -> list[str]:
        return ["confluence", "html", "txt", "md"]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _build_url(self, path: str, query: dict[str, Any] | None = None) -> str:
        base = self._base_url().rstrip("/")
        if not path.startswith("/"):
            path = "/" + path
        url = f"{base}{path}"
        if query:
            url = f"{url}?{urlencode(query, doseq=True)}"
        return url

    async def _api_get(self, url: str) -> dict[str, Any]:
        if httpx is None:
            return {}
        headers = self._auth_headers()
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.json()

    def _auth_headers(self) -> dict[str, str]:
        cred = self.credential or {}
        if "token" in cred and cred.get("token"):
            return {"Authorization": f"Bearer {cred['token']}"}
        if cred.get("email") and cred.get("api_token"):
            token = f"{cred['email']}:{cred['api_token']}"
            return {"Authorization": f"Basic {base64.b64encode(token.encode('utf-8')).decode('utf-8')}"}
        if cred.get("username") and cred.get("password"):
            token = f"{cred['username']}:{cred['password']}"
            return {"Authorization": f"Basic {base64.b64encode(token.encode('utf-8')).decode('utf-8')}"}
        return {}

    def _page_to_document(self, page: dict[str, Any], space_key: str) -> ConnectorDocument:
        page_id = str(page.get("id", "")).strip()
        title = str(page.get("title", "")).strip() or page_id or "Confluence page"
        storage_html = (
            page.get("body", {}).get("storage", {}).get("value", "") if isinstance(page, dict) else ""
        )
        content = self._clean_confluence_html(storage_html)

        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        doc_id = hashlib.sha256(f"{self.source_id}:{page_id}".encode("utf-8")).hexdigest()

        links = page.get("_links", {}) if isinstance(page, dict) else {}
        page_url = links.get("webui")
        if page_url:
            page_url = urljoin(self._base_url() + "/", page_url)

        history = page.get("history", {}) if isinstance(page, dict) else {}
        last_updated = history.get("lastUpdated", {}) if isinstance(history, dict) else {}
        last_modified = last_updated.get("when") or page.get("version", {}).get("when")
        if not last_modified:
            last_modified = datetime.now(timezone.utc).isoformat()

        labels = []
        label_results = page.get("metadata", {}).get("labels", {}).get("results", [])
        for item in label_results:
            name = item.get("name") if isinstance(item, dict) else None
            if name:
                labels.append(name)

        metadata = {
            "space_key": space_key,
            "labels": labels,
            "author": last_updated.get("by", {}).get("displayName"),
            "version": page.get("version", {}).get("number"),
            "page_id": page_id,
        }

        return ConnectorDocument(
            id=doc_id,
            source_id=self.source_id,
            title=title,
            content=content,
            content_type="text",
            url=page_url,
            file_path=f"{space_key}/{title}",
            file_type="confluence",
            file_size_bytes=len(content.encode("utf-8")),
            last_modified=last_modified,
            metadata=metadata,
            content_hash=content_hash,
        )

    def _clean_confluence_html(self, html: str) -> str:
        if not html:
            return ""
        if BeautifulSoup is not None:
            soup = BeautifulSoup(html, "lxml" if _LXML_AVAILABLE else "html.parser")
            for tag in soup.find_all(lambda t: t.name and (t.name.startswith("ac:") or t.name.startswith("ri:"))):
                tag.decompose()
            return soup.get_text(" ", strip=True)

        cleaned = re.sub(r"<ac:[^>]+>.*?</ac:[^>]+>", " ", html, flags=re.IGNORECASE | re.DOTALL)
        cleaned = re.sub(r"<ri:[^>]+/?>", " ", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"<[^>]+>", " ", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned
