"""Connector for Dropbox sources."""

from __future__ import annotations

import hashlib
import logging
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

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

try:  # optional dependency
    import dropbox
    from dropbox.files import FileMetadata, DeletedMetadata, FolderMetadata
except Exception:  # pragma: no cover - optional dependency
    dropbox = None
    FileMetadata = DeletedMetadata = FolderMetadata = object


logger = logging.getLogger(__name__)


@register_connector(SourceType.DROPBOX)
class DropboxConnector(BaseConnector):
    """Connector for Dropbox API."""

    def __init__(self, source_id: str, config: dict[str, Any], credential: dict[str, Any] | None = None) -> None:
        super().__init__(source_id, config, credential)
        self._doc_cache: dict[str, FileMetadata] = {}
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

    # ------------------------------------------------------------------
    # BaseConnector implementation
    # ------------------------------------------------------------------

    async def validate_config(self) -> ConnectorValidationResult:
        errors: list[str] = []
        if dropbox is None:
            errors.append("Le package dropbox est requis pour les sources Dropbox.")
        if not self._folder_paths():
            errors.append("Au moins un dossier Dropbox doit etre configure.")
        if not self.credential or not self.credential.get("access_token"):
            errors.append("Credential Dropbox manquant.")
        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors)

    async def test_connection(self) -> ConnectorValidationResult:
        validation = await self.validate_config()
        if not validation.valid:
            return validation
        try:
            client = self._client()
            client.users_get_current_account()
            return ConnectorValidationResult(valid=True)
        except Exception as exc:
            return ConnectorValidationResult(valid=False, errors=[str(exc)])

    async def list_documents(self) -> list[ConnectorDocument]:
        validation = await self.validate_config()
        if not validation.valid:
            return []

        allowed_ext = set(self._file_types())
        max_size = self._max_file_size_mb() * 1024 * 1024
        client = self._client()
        docs: list[ConnectorDocument] = []
        self._doc_cache = {}

        for path in self._folder_paths():
            for entry in self._list_folder(client, path):
                if not isinstance(entry, FileMetadata):
                    continue
                name = entry.name
                ext = Path(name).suffix.lower().lstrip(".")
                if allowed_ext and ext not in allowed_ext:
                    continue
                size = int(entry.size or 0)
                if size and size > max_size:
                    continue
                last_modified = (
                    entry.server_modified.replace(tzinfo=timezone.utc).isoformat()
                    if getattr(entry, "server_modified", None)
                    else datetime.now(timezone.utc).isoformat()
                )
                content_hash = entry.content_hash or hashlib.sha256(
                    f"{entry.id}:{last_modified}".encode("utf-8")
                ).hexdigest()

                doc = ConnectorDocument(
                    id=entry.id,
                    source_id=self.source_id,
                    title=name,
                    content="",
                    content_type="text",
                    url=None,
                    file_path=entry.path_lower or entry.path_display or name,
                    file_type=ext or None,
                    file_size_bytes=size,
                    last_modified=last_modified,
                    metadata={"rev": getattr(entry, "rev", None)},
                    content_hash=content_hash,
                )
                docs.append(doc)
                self._doc_cache[entry.id] = entry

        return docs

    async def fetch_document_content(self, doc_id: str) -> str:
        validation = await self.validate_config()
        if not validation.valid:
            raise FileNotFoundError("Invalid Dropbox configuration.")

        entry = self._doc_cache.get(doc_id)
        if entry is None:
            await self.list_documents()
            entry = self._doc_cache.get(doc_id)
        if entry is None:
            raise FileNotFoundError(f"Document {doc_id} not found in Dropbox.")

        client = self._client()
        _, res = client.files_download(entry.path_lower or entry.path_display or "")
        data = res.content
        return self._parse_binary(data, entry.name)

    async def detect_changes(self, known_hashes: dict[str, str]) -> ConnectorChangeDetection:
        validation = await self.validate_config()
        if not validation.valid:
            return ConnectorChangeDetection()

        cursor = None
        if self.credential:
            cursor = self.credential.get("cursor")

        if cursor:
            return await self._detect_changes_with_cursor(cursor, known_hashes)

        docs = await self.list_documents()
        current_by_id = {doc.id: doc for doc in docs}
        added = [doc for doc in docs if doc.id not in known_hashes]
        modified = [doc for doc in docs if doc.id in known_hashes and doc.content_hash != known_hashes[doc.id]]
        removed_ids = [doc_id for doc_id in known_hashes if doc_id not in current_by_id]
        return ConnectorChangeDetection(added=added, modified=modified, removed_ids=removed_ids)

    def supported_file_types(self) -> list[str]:
        return ["pdf", "docx", "md", "txt"]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _client(self):
        if dropbox is None:
            raise RuntimeError("Dropbox SDK not installed.")
        token = self.credential.get("access_token") if self.credential else None
        if not token:
            raise RuntimeError("Missing Dropbox access token.")
        return dropbox.Dropbox(token)

    def _list_folder(self, client, path: str) -> Iterable[FileMetadata]:
        result = client.files_list_folder(path, recursive=self._recursive(), include_non_downloadable_files=False)
        for entry in result.entries:
            yield entry
        while result.has_more:
            result = client.files_list_folder_continue(result.cursor)
            for entry in result.entries:
                yield entry

    async def _detect_changes_with_cursor(
        self,
        cursor: str,
        known_hashes: dict[str, str],
    ) -> ConnectorChangeDetection:
        client = self._client()
        result = client.files_list_folder_continue(cursor)
        added: list[ConnectorDocument] = []
        modified: list[ConnectorDocument] = []
        removed_ids: list[str] = []

        for entry in result.entries:
            if isinstance(entry, DeletedMetadata):
                if getattr(entry, "id", None):
                    removed_ids.append(entry.id)
                elif getattr(entry, "path_lower", None):
                    removed_ids.append(entry.path_lower)
                continue
            if not isinstance(entry, FileMetadata):
                continue

            name = entry.name
            ext = Path(name).suffix.lower().lstrip(".")
            last_modified = (
                entry.server_modified.replace(tzinfo=timezone.utc).isoformat()
                if getattr(entry, "server_modified", None)
                else datetime.now(timezone.utc).isoformat()
            )
            content_hash = entry.content_hash or hashlib.sha256(
                f"{entry.id}:{last_modified}".encode("utf-8")
            ).hexdigest()

            doc = ConnectorDocument(
                id=entry.id,
                source_id=self.source_id,
                title=name,
                content="",
                content_type="text",
                url=None,
                file_path=entry.path_lower or entry.path_display or name,
                file_type=ext or None,
                file_size_bytes=int(entry.size or 0),
                last_modified=last_modified,
                metadata={"rev": getattr(entry, "rev", None)},
                content_hash=content_hash,
            )

            if doc.id in known_hashes:
                if known_hashes[doc.id] != content_hash:
                    modified.append(doc)
            else:
                added.append(doc)

        new_cursor = result.cursor
        if self.credential:
            key = self.credential.get("credential_key") or self.source_id
            updated = {**self.credential, "cursor": new_cursor}
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
