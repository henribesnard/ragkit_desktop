"""Connector for generic REST APIs returning JSON payloads."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin

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


@register_connector(SourceType.REST_API)
class RestApiConnector(BaseConnector):
    """Fetch documents from REST APIs with configurable JSON paths."""

    def __init__(self, source_id: str, config: dict[str, Any], credential: dict[str, Any] | None = None) -> None:
        super().__init__(source_id, config, credential)
        self._doc_cache: dict[str, ConnectorDocument] = {}

    # ------------------------------------------------------------------
    # Config helpers
    # ------------------------------------------------------------------

    def _base_url(self) -> str:
        return str(self.config.get("base_url", "")).strip().rstrip("/")

    def _endpoint(self) -> str:
        return str(self.config.get("endpoint", "")).strip()

    def _method(self) -> str:
        return str(self.config.get("method", "GET")).strip().upper()

    def _headers(self) -> dict[str, str]:
        headers = self.config.get("headers", {})
        return dict(headers) if isinstance(headers, dict) else {}

    def _query_params(self) -> dict[str, Any]:
        params = self.config.get("query_params", {})
        return dict(params) if isinstance(params, dict) else {}

    def _pagination_type(self) -> str:
        return str(self.config.get("pagination_type", "none")).strip().lower()

    def _pagination_param(self) -> str:
        return str(self.config.get("pagination_param", "offset")).strip() or "offset"

    def _pagination_size_param(self) -> str:
        return str(self.config.get("pagination_size_param", "limit")).strip() or "limit"

    def _page_size(self) -> int:
        return max(1, int(self.config.get("page_size", 50)))

    def _max_items(self) -> int:
        return max(1, int(self.config.get("max_items", 1000)))

    def _timeout_seconds(self) -> float:
        return max(1.0, float(self.config.get("timeout_seconds", 30)))

    def _items_path(self) -> str:
        return str(self.config.get("response_items_path", "")).strip()

    def _id_path(self) -> str:
        return str(self.config.get("response_id_path", "")).strip()

    def _content_path(self) -> str:
        return str(self.config.get("response_content_path", "")).strip()

    def _title_path(self) -> str:
        return str(self.config.get("response_title_path", "")).strip()

    def _date_path(self) -> str:
        return str(self.config.get("response_date_path", "")).strip()

    def _cursor_path(self) -> str:
        return str(self.config.get("response_cursor_path", "")).strip()

    # ------------------------------------------------------------------
    # BaseConnector implementation
    # ------------------------------------------------------------------

    async def validate_config(self) -> ConnectorValidationResult:
        errors: list[str] = []

        if httpx is None:
            errors.append("Le package httpx est requis pour les sources REST.")

        if not self._base_url():
            errors.append("base_url est requis.")
        if not self._endpoint():
            errors.append("endpoint est requis.")

        if not self._items_path() or not self._id_path() or not self._content_path():
            errors.append("response_items_path, response_id_path et response_content_path sont requis.")

        method = self._method()
        if method not in {"GET", "POST"}:
            errors.append("method doit etre GET ou POST.")

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
                logger.warning("RestApiConnector validation failed: %s", validation.errors)
            return []

        documents: list[ConnectorDocument] = []
        self._doc_cache = {}
        pagination = self._pagination_type()
        page_size = self._page_size()
        max_items = self._max_items()
        offset = 0
        page = 1
        cursor: str | None = None

        while len(documents) < max_items:
            params = dict(self._query_params())
            if pagination == "offset":
                params[self._pagination_param()] = offset
                params[self._pagination_size_param()] = page_size
            elif pagination == "page":
                params[self._pagination_param()] = page
                params[self._pagination_size_param()] = page_size
            elif pagination == "cursor":
                if cursor:
                    params[self._pagination_param()] = cursor
                params[self._pagination_size_param()] = page_size

            payload = await self._request(params=params)
            items = self._extract_items(payload)
            if not items:
                break

            for item in items:
                doc = self._item_to_document(item)
                documents.append(doc)
                self._doc_cache[doc.id] = doc
                if len(documents) >= max_items:
                    break

            if pagination == "none":
                break
            if pagination == "offset":
                if len(items) < page_size:
                    break
                offset += page_size
            elif pagination == "page":
                if len(items) < page_size:
                    break
                page += 1
            elif pagination == "cursor":
                cursor = self._extract_cursor(payload)
                if not cursor:
                    break
            else:
                break

        return documents

    async def fetch_document_content(self, doc_id: str) -> str:
        cached = self._doc_cache.get(doc_id)
        if cached is not None:
            return cached.content
        docs = await self.list_documents()
        for doc in docs:
            if doc.id == doc_id:
                return doc.content
        raise FileNotFoundError(f"Document ID {doc_id} not found in REST source.")

    async def detect_changes(self, known_hashes: dict[str, str]) -> ConnectorChangeDetection:
        docs = await self.list_documents()
        current_by_id = {doc.id: doc for doc in docs}
        added = [doc for doc in docs if doc.id not in known_hashes]
        modified = [doc for doc in docs if doc.id in known_hashes and doc.content_hash != known_hashes[doc.id]]
        removed_ids = [doc_id for doc_id in known_hashes if doc_id not in current_by_id]
        return ConnectorChangeDetection(added=added, modified=modified, removed_ids=removed_ids)

    def supported_file_types(self) -> list[str]:
        return ["json", "txt", "md"]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _request(self, params: dict[str, Any] | None = None) -> dict[str, Any]:
        if httpx is None:
            return {}
        url = urljoin(self._base_url() + "/", self._endpoint().lstrip("/"))
        headers = self._resolve_headers()
        method = self._method()
        timeout = self._timeout_seconds()
        async with httpx.AsyncClient(timeout=timeout) as client:
            if method == "POST":
                response = await client.post(url, headers=headers, params=params, json=self.config.get("body"))
            else:
                response = await client.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()

    def _resolve_headers(self) -> dict[str, str]:
        headers = dict(self._headers())
        if not headers:
            return headers
        cred = self.credential or {}
        pattern = re.compile(r"\$\{([^}]+)\}")
        resolved = {}
        for key, value in headers.items():
            text = str(value)
            def repl(match: re.Match) -> str:
                token = match.group(1)
                return str(cred.get(token, ""))
            resolved[key] = pattern.sub(repl, text)
        return resolved

    def _extract_items(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        items = self._extract_jsonpath(payload, self._items_path())
        if items is None:
            return []
        if isinstance(items, list):
            return [item for item in items if isinstance(item, dict)]
        if isinstance(items, dict):
            return [items]
        return []

    def _extract_cursor(self, payload: dict[str, Any]) -> str | None:
        if self._cursor_path():
            value = self._extract_jsonpath(payload, self._cursor_path())
            if isinstance(value, str):
                return value
        for key in ("next_cursor", "next", "cursor"):
            value = payload.get(key)
            if isinstance(value, str) and value:
                return value
        return None

    def _item_to_document(self, item: dict[str, Any]) -> ConnectorDocument:
        raw_id = self._extract_jsonpath(item, self._id_path())
        content = self._extract_jsonpath(item, self._content_path())
        title = self._extract_jsonpath(item, self._title_path()) if self._title_path() else None
        date_value = self._extract_jsonpath(item, self._date_path()) if self._date_path() else None

        raw_id_str = str(raw_id) if raw_id is not None else hashlib.sha256(str(item).encode("utf-8")).hexdigest()
        content_text = "" if content is None else str(content)
        title_text = str(title) if title is not None else f"Item {raw_id_str}"

        doc_id = hashlib.sha256(f"{self.source_id}:{raw_id_str}".encode("utf-8")).hexdigest()
        content_hash = hashlib.sha256(content_text.encode("utf-8")).hexdigest()
        last_modified = str(date_value) if date_value else datetime.now(timezone.utc).isoformat()

        return ConnectorDocument(
            id=doc_id,
            source_id=self.source_id,
            title=title_text,
            content=content_text,
            content_type="text",
            url=None,
            file_path=raw_id_str,
            file_type="json",
            file_size_bytes=len(content_text.encode("utf-8")),
            last_modified=last_modified,
            metadata={"raw_id": raw_id_str},
            content_hash=content_hash,
        )

    def _extract_jsonpath(self, data: Any, path: str) -> Any:
        if not path:
            return None
        if path in {"$", "$."}:
            return data
        normalized = path.strip()
        if normalized.startswith("$."):
            normalized = normalized[2:]
        if not normalized:
            return data
        parts = normalized.split(".")
        current: Any = data
        for part in parts:
            if part == "":
                continue
            match = re.match(r"^([^\[]+)(?:\[(\*|\d+)\])?$", part)
            key = match.group(1) if match else part
            if isinstance(current, list):
                current = [item.get(key) if isinstance(item, dict) else None for item in current]
            elif isinstance(current, dict):
                current = current.get(key)
            else:
                return None

            if match and match.group(2):
                index = match.group(2)
                if index == "*":
                    continue
                if isinstance(current, list):
                    idx = int(index)
                    current = current[idx] if idx < len(current) else None
                else:
                    return None
        return current
