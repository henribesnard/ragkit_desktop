"""Connector for Notion databases and pages."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any

try:
    import httpx
except Exception:  # pragma: no cover - optional dependency
    httpx = None

from ragkit.connectors.base import (
    BaseConnector,
    ConnectorChangeDetection,
    ConnectorDocument,
    ConnectorValidationResult,
)
from ragkit.connectors.registry import register_connector
from ragkit.desktop.models import SourceType


logger = logging.getLogger(__name__)


@register_connector(SourceType.NOTION)
class NotionConnector(BaseConnector):
    """Fetch Notion pages and database items via REST API."""

    API_BASE = "https://api.notion.com/v1"
    API_VERSION = "2022-06-28"

    def __init__(self, source_id: str, config: dict[str, Any], credential: dict[str, Any] | None = None) -> None:
        super().__init__(source_id, config, credential)
        self._doc_cache: dict[str, ConnectorDocument] = {}

    # ------------------------------------------------------------------
    # Config helpers
    # ------------------------------------------------------------------

    def _database_ids(self) -> list[str]:
        return [str(db).strip() for db in self.config.get("database_ids", []) if str(db).strip()]

    def _page_ids(self) -> list[str]:
        return [str(pid).strip() for pid in self.config.get("page_ids", []) if str(pid).strip()]

    def _include_subpages(self) -> bool:
        return bool(self.config.get("include_subpages", False))

    def _property_filters(self) -> dict[str, Any] | None:
        filters = self.config.get("property_filters")
        return filters if isinstance(filters, dict) and filters else None

    def _max_pages(self) -> int:
        return max(1, int(self.config.get("max_pages", 200)))

    # ------------------------------------------------------------------
    # BaseConnector implementation
    # ------------------------------------------------------------------

    async def validate_config(self) -> ConnectorValidationResult:
        errors: list[str] = []

        if httpx is None:
            errors.append("Le package httpx est requis pour Notion.")

        if not self._database_ids() and not self._page_ids():
            errors.append("Au moins un database_id ou page_id doit etre fourni.")

        if not self.credential or not self.credential.get("token"):
            errors.append("Le token Notion est requis.")

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
                logger.warning("NotionConnector validation failed: %s", validation.errors)
            return []

        documents: list[ConnectorDocument] = []
        self._doc_cache = {}
        max_docs = self._max_pages()
        seen_page_ids: set[str] = set()

        for db_id in self._database_ids():
            if len(documents) >= max_docs:
                break
            pages = await self._query_database(db_id, max_docs - len(documents))
            for page in pages:
                page_id = str(page.get("id", "")).strip()
                if not page_id or page_id in seen_page_ids:
                    continue
                doc = await self._page_to_document(page)
                documents.append(doc)
                self._doc_cache[doc.id] = doc
                seen_page_ids.add(page_id)
                if len(documents) >= max_docs:
                    break

        for page_id in self._page_ids():
            if len(documents) >= max_docs:
                break
            if page_id in seen_page_ids:
                continue
            page = await self._get_page(page_id)
            doc = await self._page_to_document(page)
            documents.append(doc)
            self._doc_cache[doc.id] = doc
            seen_page_ids.add(page_id)

        return documents

    async def fetch_document_content(self, doc_id: str) -> str:
        cached = self._doc_cache.get(doc_id)
        if cached is not None:
            return cached.content
        docs = await self.list_documents()
        for doc in docs:
            if doc.id == doc_id:
                return doc.content
        raise FileNotFoundError(f"Document ID {doc_id} not found in Notion source.")

    async def detect_changes(self, known_hashes: dict[str, str]) -> ConnectorChangeDetection:
        docs = await self.list_documents()
        current_by_id = {doc.id: doc for doc in docs}
        added = [doc for doc in docs if doc.id not in known_hashes]
        modified = [doc for doc in docs if doc.id in known_hashes and doc.content_hash != known_hashes[doc.id]]
        removed_ids = [doc_id for doc_id in known_hashes if doc_id not in current_by_id]
        return ConnectorChangeDetection(added=added, modified=modified, removed_ids=removed_ids)

    def supported_file_types(self) -> list[str]:
        return ["notion", "txt", "md"]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _headers(self) -> dict[str, str]:
        token = (self.credential or {}).get("token", "")
        return {
            "Authorization": f"Bearer {token}",
            "Notion-Version": self.API_VERSION,
            "Content-Type": "application/json",
        }

    async def _api_get(self, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        if httpx is None:
            return {}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, headers=self._headers(), params=params)
        response.raise_for_status()
        return response.json()

    async def _api_post(self, url: str, json: dict[str, Any] | None = None) -> dict[str, Any]:
        if httpx is None:
            return {}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers=self._headers(), json=json or {})
        response.raise_for_status()
        return response.json()

    async def _query_database(self, db_id: str, max_pages: int | None = None) -> list[dict[str, Any]]:
        url = f"{self.API_BASE}/databases/{db_id}/query"
        results: list[dict[str, Any]] = []
        cursor: str | None = None
        limit = max_pages or self._max_pages()
        while len(results) < limit:
            payload: dict[str, Any] = {}
            filters = self._property_filters()
            if filters:
                payload["filter"] = filters
            if cursor:
                payload["start_cursor"] = cursor
            response = await self._api_post(url, json=payload)
            batch = response.get("results", [])
            if batch:
                results.extend(batch)
            if not response.get("has_more"):
                break
            cursor = response.get("next_cursor")
            if not cursor:
                break
        return results[:limit]

    async def _get_page(self, page_id: str) -> dict[str, Any]:
        url = f"{self.API_BASE}/pages/{page_id}"
        return await self._api_get(url)

    async def _get_page_blocks(self, page_id: str) -> dict[str, Any]:
        url = f"{self.API_BASE}/blocks/{page_id}/children"
        blocks: list[dict[str, Any]] = []
        cursor: str | None = None
        while True:
            params = {"start_cursor": cursor} if cursor else None
            response = await self._api_get(url, params=params)
            batch = response.get("results", [])
            if batch:
                blocks.extend(batch)
            if not response.get("has_more"):
                break
            cursor = response.get("next_cursor")
            if not cursor:
                break
        return {"results": blocks, "has_more": False}

    async def _page_to_document(self, page: dict[str, Any]) -> ConnectorDocument:
        page_id = str(page.get("id", "")).strip()
        title = self._extract_title(page) or page_id or "Notion page"
        blocks_response = await self._get_page_blocks(page_id)
        blocks = blocks_response.get("results", []) if isinstance(blocks_response, dict) else blocks_response
        content = self._blocks_to_text(blocks)

        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        doc_id = hashlib.sha256(f"{self.source_id}:{page_id}".encode("utf-8")).hexdigest()

        last_modified = page.get("last_edited_time") or datetime.now(timezone.utc).isoformat()

        metadata = {
            "page_id": page_id,
            "properties": page.get("properties", {}),
        }

        return ConnectorDocument(
            id=doc_id,
            source_id=self.source_id,
            title=title,
            content=content,
            content_type="text",
            url=page.get("url"),
            file_path=page_id,
            file_type="notion",
            file_size_bytes=len(content.encode("utf-8")),
            last_modified=last_modified,
            metadata=metadata,
            content_hash=content_hash,
        )

    def _extract_title(self, page: dict[str, Any]) -> str | None:
        properties = page.get("properties", {})
        if not isinstance(properties, dict):
            return None
        for prop in properties.values():
            if not isinstance(prop, dict):
                continue
            title_entries = prop.get("title")
            if isinstance(title_entries, list):
                text = "".join(item.get("plain_text", "") for item in title_entries if isinstance(item, dict))
                if text.strip():
                    return text.strip()
        return None

    def _extract_rich_text(self, items: list[dict[str, Any]] | None) -> str:
        if not items:
            return ""
        return "".join(item.get("plain_text", "") for item in items if isinstance(item, dict)).strip()

    def _blocks_to_text(self, blocks: list[dict[str, Any]]) -> str:
        lines: list[str] = []
        for block in blocks:
            block_type = block.get("type")
            data = block.get(block_type, {}) if isinstance(block, dict) and block_type else {}
            text = self._extract_rich_text(data.get("rich_text")) if isinstance(data, dict) else ""

            if block_type == "paragraph":
                if text:
                    lines.append(text)
            elif block_type == "heading_1":
                if text:
                    lines.append(f"# {text}")
            elif block_type == "heading_2":
                if text:
                    lines.append(f"## {text}")
            elif block_type == "heading_3":
                if text:
                    lines.append(f"### {text}")
            elif block_type == "bulleted_list_item":
                if text:
                    lines.append(f"- {text}")
            elif block_type == "numbered_list_item":
                if text:
                    lines.append(f"1. {text}")
            elif block_type == "code":
                lang = data.get("language") if isinstance(data, dict) else None
                code = self._extract_rich_text(data.get("rich_text")) if isinstance(data, dict) else ""
                if code:
                    fence = f"```{lang}" if lang else "```"
                    lines.append(f"{fence}\n{code}\n```")
            elif block_type == "quote":
                if text:
                    lines.append(f"> {text}")
            elif block_type == "callout":
                if text:
                    lines.append(text)
            elif block_type == "toggle":
                if text:
                    lines.append(text)
            elif block_type == "child_page":
                title = data.get("title") if isinstance(data, dict) else None
                if title:
                    lines.append(f"## {title}")

        return "\n".join(lines).strip()
