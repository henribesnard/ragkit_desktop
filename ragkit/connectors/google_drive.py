"""Connector for Google Drive sources."""

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

try:  # optional dependencies
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    from google.oauth2.credentials import Credentials
except Exception:  # pragma: no cover - optional dependency
    build = None
    HttpError = Exception
    Credentials = None


logger = logging.getLogger(__name__)

GOOGLE_MIME_EXPORT = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
}


@register_connector(SourceType.GOOGLE_DRIVE)
class GoogleDriveConnector(BaseConnector):
    """Connector for Google Drive via Drive API v3."""

    def __init__(self, source_id: str, config: dict[str, Any], credential: dict[str, Any] | None = None) -> None:
        super().__init__(source_id, config, credential)
        self._doc_cache: dict[str, dict[str, Any]] = {}
        self._credential_manager = CredentialManager()

    # ------------------------------------------------------------------
    # Config helpers
    # ------------------------------------------------------------------

    def _folder_ids(self) -> list[str]:
        return [str(fid).strip() for fid in self.config.get("folder_ids", []) if str(fid).strip()]

    def _include_shared(self) -> bool:
        return bool(self.config.get("include_shared", False))

    def _file_types(self) -> list[str]:
        return [str(ft).strip() for ft in self.config.get("file_types", []) if str(ft).strip()]

    def _recursive(self) -> bool:
        return bool(self.config.get("recursive", True))

    def _max_file_size_mb(self) -> int:
        return int(self.config.get("max_file_size_mb", 50))

    # ------------------------------------------------------------------
    # BaseConnector implementation
    # ------------------------------------------------------------------

    async def validate_config(self) -> ConnectorValidationResult:
        errors: list[str] = []
        warnings: list[str] = []
        if build is None or Credentials is None:
            warnings.append("Les dependances Google Drive ne sont pas installees.")

        if not self._folder_ids():
            errors.append("Au moins un dossier Google Drive doit etre selectionne.")

        if not self.credential:
            errors.append("Credential Google Drive manquant.")

        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors, warnings=warnings)

    async def test_connection(self) -> ConnectorValidationResult:
        validation = await self.validate_config()
        if not validation.valid:
            return validation
        try:
            service = self._build_service()
            service.files().list(pageSize=1).execute()
            return ConnectorValidationResult(valid=True)
        except Exception as exc:
            if self._is_unauthorized(exc):
                try:
                    self._refresh_token()
                    service = self._build_service()
                    service.files().list(pageSize=1).execute()
                    return ConnectorValidationResult(valid=True)
                except Exception as refresh_exc:
                    logger.warning("Google Drive connection refresh failed: %s", refresh_exc)
                    return ConnectorValidationResult(valid=False, errors=[str(refresh_exc)])
            logger.warning("Google Drive connection test failed: %s", exc)
            return ConnectorValidationResult(valid=False, errors=[str(exc)])

    async def list_documents(self) -> list[ConnectorDocument]:
        validation = await self.validate_config()
        if not validation.valid:
            return []

        try:
            service = self._build_service()
        except Exception as exc:
            logger.warning("Google Drive build failed: %s", exc)
            return []
        files: list[dict[str, Any]] = []
        for folder_id in self._folder_ids():
            files.extend(self._list_files_recursive(service, folder_id))

        selected_mimes = set(self._file_types())
        max_size = self._max_file_size_mb() * 1024 * 1024
        docs: list[ConnectorDocument] = []
        self._doc_cache = {}

        for file in files:
            mime_type = file.get("mimeType", "")
            if mime_type == "application/vnd.google-apps.folder":
                continue
            if selected_mimes and mime_type not in selected_mimes:
                continue

            size_str = file.get("size")
            size_bytes = int(size_str) if size_str else 0
            if size_bytes and size_bytes > max_size:
                continue

            doc_id = file["id"]
            name = file.get("name") or doc_id
            modified = file.get("modifiedTime") or datetime.now(timezone.utc).isoformat()
            content_hash = file.get("md5Checksum") or hashlib.sha256(
                f"{doc_id}:{modified}".encode("utf-8")
            ).hexdigest()

            file_type = self._infer_file_type(name, mime_type)
            docs.append(
                ConnectorDocument(
                    id=doc_id,
                    source_id=self.source_id,
                    title=name,
                    content="",
                    content_type="text",
                    url=file.get("webViewLink") or file.get("webContentLink"),
                    file_path=name,
                    file_type=file_type,
                    file_size_bytes=size_bytes,
                    last_modified=modified,
                    metadata={"mime_type": mime_type},
                    content_hash=content_hash,
                )
            )
            self._doc_cache[doc_id] = file

        return docs

    async def fetch_document_content(self, doc_id: str) -> str:
        validation = await self.validate_config()
        if not validation.valid:
            raise FileNotFoundError("Invalid Google Drive configuration.")

        file = self._doc_cache.get(doc_id)
        if file is None:
            docs = await self.list_documents()
            file = self._doc_cache.get(doc_id)
            if not file:
                raise FileNotFoundError(f"Document {doc_id} not found in Google Drive.")

        mime_type = file.get("mimeType", "")
        service = self._build_service()

        if mime_type in GOOGLE_MIME_EXPORT:
            return self._export_google_doc(service, doc_id, GOOGLE_MIME_EXPORT[mime_type])

        data = self._download_binary(service, doc_id)
        return self._parse_binary(data, file.get("name") or doc_id)

    async def detect_changes(self, known_hashes: dict[str, str]) -> ConnectorChangeDetection:
        docs = await self.list_documents()
        current_by_id = {doc.id: doc for doc in docs}
        added = [doc for doc in docs if doc.id not in known_hashes]
        modified = [doc for doc in docs if doc.id in known_hashes and doc.content_hash != known_hashes[doc.id]]
        removed_ids = [doc_id for doc_id in known_hashes if doc_id not in current_by_id]
        return ConnectorChangeDetection(added=added, modified=modified, removed_ids=removed_ids)

    def supported_file_types(self) -> list[str]:
        return ["pdf", "docx", "doc", "txt", "md", "csv"]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_access_token(self) -> dict[str, Any]:
        if not self.credential:
            raise RuntimeError("Missing Google Drive credential.")
        if not CredentialManager.is_expired(self.credential):
            return self.credential

        refresh_url = self.credential.get("token_url") or "https://oauth2.googleapis.com/token"
        client_id = self.credential.get("client_id")
        client_secret = self.credential.get("client_secret")
        if not client_id or not client_secret:
            raise RuntimeError("Missing OAuth client credentials for refresh.")

        key = self.credential.get("credential_key") or self.source_id
        refreshed = self._credential_manager.refresh_oauth2_token(key, refresh_url, client_id, client_secret)
        self.credential = refreshed
        return refreshed

    def _refresh_token(self) -> dict[str, Any]:
        if not self.credential:
            raise RuntimeError("Missing Google Drive credential.")
        refresh_url = self.credential.get("token_url") or "https://oauth2.googleapis.com/token"
        client_id = self.credential.get("client_id")
        client_secret = self.credential.get("client_secret")
        if not client_id or not client_secret:
            raise RuntimeError("Missing OAuth client credentials for refresh.")
        key = self.credential.get("credential_key") or self.source_id
        refreshed = self._credential_manager.refresh_oauth2_token(key, refresh_url, client_id, client_secret)
        self.credential = refreshed
        return refreshed

    def _build_service(self):
        if build is None or Credentials is None:
            raise RuntimeError("Google Drive dependencies not installed.")

        creds = self._ensure_access_token()
        scopes = creds.get("scopes") or ["https://www.googleapis.com/auth/drive.readonly"]
        credentials = Credentials(
            token=creds.get("access_token"),
            refresh_token=creds.get("refresh_token"),
            token_uri=creds.get("token_url") or "https://oauth2.googleapis.com/token",
            client_id=creds.get("client_id"),
            client_secret=creds.get("client_secret"),
            scopes=scopes,
        )
        return build("drive", "v3", credentials=credentials, cache_discovery=False)

    def _list_files_recursive(self, service, folder_id: str) -> list[dict[str, Any]]:
        files: list[dict[str, Any]] = []
        queue = [folder_id]
        while queue:
            current = queue.pop(0)
            for item in self._list_files_in_folder(service, current):
                files.append(item)
                if self._recursive() and item.get("mimeType") == "application/vnd.google-apps.folder":
                    queue.append(item["id"])
        return files

    def _list_files_in_folder(self, service, folder_id: str) -> Iterable[dict[str, Any]]:
        page_token = None
        query = f"'{folder_id}' in parents and trashed=false"
        while True:
            req = service.files().list(
                q=query,
                fields="nextPageToken, files(id,name,mimeType,size,modifiedTime,md5Checksum,parents,webViewLink,webContentLink)",
                pageToken=page_token,
                supportsAllDrives=self._include_shared(),
                includeItemsFromAllDrives=self._include_shared(),
            )
            try:
                resp = req.execute()
            except Exception as exc:
                if self._is_unauthorized(exc):
                    self._refresh_token()
                    service = self._build_service()
                    req = service.files().list(
                        q=query,
                        fields="nextPageToken, files(id,name,mimeType,size,modifiedTime,md5Checksum,parents,webViewLink,webContentLink)",
                        pageToken=page_token,
                        supportsAllDrives=self._include_shared(),
                        includeItemsFromAllDrives=self._include_shared(),
                    )
                    resp = req.execute()
                else:
                    raise
            for item in resp.get("files", []):
                yield item
            page_token = resp.get("nextPageToken")
            if not page_token:
                break

    def _export_google_doc(self, service, file_id: str, export_mime: str) -> str:
        try:
            request = service.files().export_media(fileId=file_id, mimeType=export_mime)
            data = request.execute()
        except Exception as exc:  # pragma: no cover - external API
            if self._is_unauthorized(exc):
                self._refresh_token()
                service = self._build_service()
                request = service.files().export_media(fileId=file_id, mimeType=export_mime)
                data = request.execute()
            else:
                raise RuntimeError(f"Google export failed: {exc}") from exc
        if isinstance(data, bytes):
            return data.decode("utf-8", errors="ignore")
        return str(data)

    def _download_binary(self, service, file_id: str) -> bytes:
        try:
            request = service.files().get_media(fileId=file_id)
            return request.execute()
        except Exception as exc:  # pragma: no cover - external API
            if self._is_unauthorized(exc):
                self._refresh_token()
                service = self._build_service()
                request = service.files().get_media(fileId=file_id)
                return request.execute()
            raise RuntimeError(f"Google download failed: {exc}") from exc

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

    def _infer_file_type(self, name: str, mime_type: str) -> str | None:
        if mime_type in GOOGLE_MIME_EXPORT:
            if mime_type.endswith("document"):
                return "gdoc"
            if mime_type.endswith("spreadsheet"):
                return "gsheet"
            if mime_type.endswith("presentation"):
                return "gslides"
        ext = Path(name).suffix.lower().lstrip(".")
        return ext or None

    def _is_unauthorized(self, exc: Exception) -> bool:
        status = None
        if HttpError and isinstance(exc, HttpError):
            status = getattr(exc, "status_code", None)
            if status is None:
                resp = getattr(exc, "resp", None)
                status = getattr(resp, "status", None)
        if status is None:
            text = str(exc)
            return "401" in text or "unauthorized" in text.lower()
        return status == 401
