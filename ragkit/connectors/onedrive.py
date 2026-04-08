"""Connector for OneDrive / SharePoint via Microsoft Graph."""

from __future__ import annotations

import hashlib
import logging
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import httpx

from ragkit.connectors.base import (
    BaseConnector,
    ConnectorChangeDetection,
    ConnectorDocument,
    ConnectorValidationResult,
)
from ragkit.connectors.credentials import CredentialManager
from ragkit.connectors.registry import register_connector
from ragkit.desktop import documents
from ragkit.desktop.models import SourceType


logger = logging.getLogger(__name__)


@register_connector(SourceType.ONEDRIVE)
class OneDriveConnector(BaseConnector):
    """Connector for OneDrive and SharePoint libraries."""

    GRAPH_BASE = "https://graph.microsoft.com/v1.0"

    def __init__(self, source_id: str, config: dict[str, Any], credential: dict[str, Any] | None = None) -> None:
        super().__init__(source_id, config, credential)
        self._doc_cache: dict[str, dict[str, Any]] = {}
        self._credential_manager = CredentialManager()

    # ------------------------------------------------------------------
    # Config helpers
    # ------------------------------------------------------------------

    def _folder_paths(self) -> list[str]:
        return [str(path).strip() for path in self.config.get("folder_paths", []) if str(path).strip()]

    def _file_types(self) -> list[str]:
        return [str(ft).strip().lstrip(".") for ft in self.config.get("file_types", []) if str(ft).strip()]

    def _recursive(self) -> bool:
        return bool(self.config.get("recursive", True))

    def _max_file_size_mb(self) -> int:
        return int(self.config.get("max_file_size_mb", 50))

    def _drive_root(self) -> str:
        drive_id = self.config.get("drive_id")
        site_id = self.config.get("site_id")
        if site_id:
            return f"/sites/{site_id}/drive"
        if drive_id:
            return f"/drives/{drive_id}"
        return "/me/drive"

    # ------------------------------------------------------------------
    # BaseConnector implementation
    # ------------------------------------------------------------------

    async def validate_config(self) -> ConnectorValidationResult:
        errors: list[str] = []
        if not self._folder_paths():
            errors.append("Au moins un dossier OneDrive doit etre configure.")
        if not self.credential or not self.credential.get("access_token"):
            errors.append("Credential OneDrive manquant.")
        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors)

    async def test_connection(self) -> ConnectorValidationResult:
        validation = await self.validate_config()
        if not validation.valid:
            return validation
        try:
            await self._graph_request("GET", f"{self._drive_root()}/root")
            return ConnectorValidationResult(valid=True)
        except Exception as exc:
            return ConnectorValidationResult(valid=False, errors=[str(exc)])

    async def list_documents(self) -> list[ConnectorDocument]:
        validation = await self.validate_config()
        if not validation.valid:
            return []

        max_size = self._max_file_size_mb() * 1024 * 1024
        allowed_ext = set(self._file_types())
        docs: list[ConnectorDocument] = []
        self._doc_cache = {}

        for folder_path in self._folder_paths():
            for item in await self._list_folder_recursive(folder_path):
                if "file" not in item:
                    continue
                name = item.get("name") or item.get("id")
                ext = Path(name).suffix.lower().lstrip(".")
                if allowed_ext and ext not in allowed_ext:
                    continue
                size = int(item.get("size") or 0)
                if size and size > max_size:
                    continue
                last_modified = item.get("lastModifiedDateTime") or datetime.now(timezone.utc).isoformat()
                hashes = (item.get("file") or {}).get("hashes") or {}
                content_hash = hashes.get("quickXorHash") or hashlib.sha256(
                    f"{item.get('id')}:{last_modified}".encode("utf-8")
                ).hexdigest()

                doc = ConnectorDocument(
                    id=item["id"],
                    source_id=self.source_id,
                    title=name,
                    content="",
                    content_type="text",
                    url=item.get("webUrl"),
                    file_path=name,
                    file_type=ext or None,
                    file_size_bytes=size,
                    last_modified=last_modified,
                    metadata={"mime_type": (item.get("file") or {}).get("mimeType")},
                    content_hash=content_hash,
                )
                docs.append(doc)
                self._doc_cache[item["id"]] = item

        return docs

    async def fetch_document_content(self, doc_id: str) -> str:
        validation = await self.validate_config()
        if not validation.valid:
            raise FileNotFoundError("Invalid OneDrive configuration.")

        item = self._doc_cache.get(doc_id)
        if item is None:
            await self.list_documents()
            item = self._doc_cache.get(doc_id)
        if item is None:
            raise FileNotFoundError(f"Document {doc_id} not found in OneDrive.")

        content = await self._download_item_content(doc_id)
        return self._parse_binary(content, item.get("name") or doc_id)

    async def detect_changes(self, known_hashes: dict[str, str]) -> ConnectorChangeDetection:
        delta_link = None
        if self.credential:
            delta_link = self.credential.get("delta_link")
        if delta_link:
            return await self._detect_changes_delta(delta_link, known_hashes)

        docs = await self.list_documents()
        current_by_id = {doc.id: doc for doc in docs}
        added = [doc for doc in docs if doc.id not in known_hashes]
        modified = [doc for doc in docs if doc.id in known_hashes and doc.content_hash != known_hashes[doc.id]]
        removed_ids = [doc_id for doc_id in known_hashes if doc_id not in current_by_id]
        return ConnectorChangeDetection(added=added, modified=modified, removed_ids=removed_ids)

    def supported_file_types(self) -> list[str]:
        return ["pdf", "docx", "xlsx", "pptx", "txt", "md"]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _graph_request(self, method: str, endpoint: str, params: dict[str, Any] | None = None) -> dict:
        token = await self._access_token()
        url = endpoint if endpoint.startswith("http") else f"{self.GRAPH_BASE}{endpoint}"
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.request(method, url, headers=headers, params=params)
        if resp.status_code >= 400:
            raise RuntimeError(f"Graph API error {resp.status_code}: {resp.text}")
        return resp.json()

    async def _access_token(self) -> str:
        if not self.credential:
            raise RuntimeError("Missing OneDrive credential.")
        if not CredentialManager.is_expired(self.credential):
            return self.credential.get("access_token", "")

        refresh_url = self.credential.get("token_url") or "https://login.microsoftonline.com/common/oauth2/v2.0/token"
        client_id = self.credential.get("client_id")
        client_secret = self.credential.get("client_secret")
        if not client_id or not client_secret:
            raise RuntimeError("Missing OAuth client credentials for refresh.")
        key = self.credential.get("credential_key") or self.source_id
        refreshed = self._credential_manager.refresh_oauth2_token(key, refresh_url, client_id, client_secret)
        self.credential = refreshed
        return refreshed.get("access_token", "")

    async def _list_folder_recursive(self, folder_path: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        queue = [folder_path]
        while queue:
            current_path = queue.pop(0)
            children = await self._list_folder_children(current_path)
            for item in children:
                items.append(item)
                if self._recursive() and "folder" in item:
                    nested_path = f"{current_path.rstrip('/')}/{item.get('name')}"
                    queue.append(nested_path)
        return items

    async def _list_folder_children(self, folder_path: str) -> Iterable[dict[str, Any]]:
        endpoint = f"{self._drive_root()}/root:{folder_path}:/children"
        response = await self._graph_request("GET", endpoint)
        return response.get("value", [])

    async def _download_item_content(self, item_id: str) -> bytes:
        token = await self._access_token()
        endpoint = f"{self.GRAPH_BASE}{self._drive_root()}/items/{item_id}/content"
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(endpoint, headers=headers)
        if resp.status_code >= 400:
            raise RuntimeError(f"Graph download failed: {resp.status_code} {resp.text}")
        return resp.content

    async def _detect_changes_delta(self, delta_link: str, known_hashes: dict[str, str]) -> ConnectorChangeDetection:
        response = await self._graph_request("GET", delta_link)
        added: list[ConnectorDocument] = []
        modified: list[ConnectorDocument] = []
        removed_ids: list[str] = []

        for item in response.get("value", []):
            if item.get("deleted"):
                removed_ids.append(item.get("id"))
                continue
            if "file" not in item:
                continue

            name = item.get("name") or item.get("id")
            ext = Path(name).suffix.lower().lstrip(".")
            last_modified = item.get("lastModifiedDateTime") or datetime.now(timezone.utc).isoformat()
            hashes = (item.get("file") or {}).get("hashes") or {}
            content_hash = hashes.get("quickXorHash") or hashlib.sha256(
                f"{item.get('id')}:{last_modified}".encode("utf-8")
            ).hexdigest()

            doc = ConnectorDocument(
                id=item["id"],
                source_id=self.source_id,
                title=name,
                content="",
                content_type="text",
                url=item.get("webUrl"),
                file_path=name,
                file_type=ext or None,
                file_size_bytes=int(item.get("size") or 0),
                last_modified=last_modified,
                metadata={"mime_type": (item.get("file") or {}).get("mimeType")},
                content_hash=content_hash,
            )

            if doc.id in known_hashes:
                if known_hashes[doc.id] != content_hash:
                    modified.append(doc)
            else:
                added.append(doc)

        new_delta = response.get("@odata.deltaLink")
        if new_delta and self.credential:
            key = self.credential.get("credential_key") or self.source_id
            updated = {**self.credential, "delta_link": new_delta}
            self._credential_manager.store(key, updated)
            self.credential = updated

        return ConnectorChangeDetection(added=added, modified=modified, removed_ids=removed_ids)

    def _parse_binary(self, data: bytes, filename: str) -> str:
        suffix = Path(filename).suffix or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(data)
            tmp_path = Path(tmp.name)
        try:
            parsed = documents._extract_content(tmp_path)
            return parsed.text
        finally:
            try:
                tmp_path.unlink()
            except Exception:
                pass
