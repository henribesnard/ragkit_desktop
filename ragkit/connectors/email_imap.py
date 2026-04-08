"""Connector for IMAP email sources."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any

try:
    import aioimaplib  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    aioimaplib = None

from ragkit.connectors.base import (
    BaseConnector,
    ConnectorChangeDetection,
    ConnectorDocument,
    ConnectorValidationResult,
)
from ragkit.connectors.registry import register_connector
from ragkit.desktop.models import SourceType


logger = logging.getLogger(__name__)


@register_connector(SourceType.EMAIL_IMAP)
class EmailImapConnector(BaseConnector):
    """Indexes emails from an IMAP server."""

    def __init__(self, source_id: str, config: dict[str, Any], credential: dict[str, Any] | None = None) -> None:
        super().__init__(source_id, config, credential)
        self._doc_cache: dict[str, ConnectorDocument] = {}

    # ------------------------------------------------------------------
    # Config helpers
    # ------------------------------------------------------------------

    def _server(self) -> str:
        return str(self.config.get("server", "")).strip()

    def _port(self) -> int:
        return int(self.config.get("port", 993))

    def _use_ssl(self) -> bool:
        return bool(self.config.get("use_ssl", True))

    def _folders(self) -> list[str]:
        return [str(folder).strip() for folder in self.config.get("folders", []) if str(folder).strip()]

    def _max_emails(self) -> int:
        return max(1, int(self.config.get("max_emails", 500)))

    def _date_from(self) -> str | None:
        value = self.config.get("date_from")
        return str(value).strip() if value else None

    def _subject_filter(self) -> str | None:
        value = self.config.get("subject_filter")
        return str(value).strip() if value else None

    def _sender_filter(self) -> list[str]:
        return [str(addr).strip() for addr in self.config.get("sender_filter", []) if str(addr).strip()]

    # ------------------------------------------------------------------
    # BaseConnector implementation
    # ------------------------------------------------------------------

    async def validate_config(self) -> ConnectorValidationResult:
        errors: list[str] = []

        if not self._server():
            errors.append("Le serveur IMAP est requis.")
        if not self._folders():
            errors.append("Au moins un dossier doit etre selectionne.")
        if not self.credential or not self.credential.get("username") or not self.credential.get("password"):
            errors.append("Les credentials IMAP sont requis.")

        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors)

    async def test_connection(self) -> ConnectorValidationResult:
        validation = await self.validate_config()
        return validation

    async def list_documents(self) -> list[ConnectorDocument]:
        validation = await self.validate_config()
        if not validation.valid:
            if validation.errors:
                logger.warning("EmailImapConnector validation failed: %s", validation.errors)
            return []

        emails = await self._fetch_emails()
        documents: list[ConnectorDocument] = []
        self._doc_cache = {}

        for email in emails[: self._max_emails()]:
            uid = str(email.get("uid", ""))
            subject = str(email.get("subject", "")) or "Email"
            body = str(email.get("body", "")) or ""
            date_value = email.get("date") or datetime.now(timezone.utc).isoformat()

            doc_id = hashlib.sha256(f"{self.source_id}:{uid}".encode("utf-8")).hexdigest()
            content_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()

            doc = ConnectorDocument(
                id=doc_id,
                source_id=self.source_id,
                title=subject,
                content=body,
                content_type="text",
                url=None,
                file_path=uid,
                file_type="email",
                file_size_bytes=len(body.encode("utf-8")),
                last_modified=str(date_value),
                metadata={
                    "from": email.get("from"),
                    "subject": subject,
                },
                content_hash=content_hash,
            )
            documents.append(doc)
            self._doc_cache[doc_id] = doc

        return documents

    async def fetch_document_content(self, doc_id: str) -> str:
        cached = self._doc_cache.get(doc_id)
        if cached is not None:
            return cached.content
        docs = await self.list_documents()
        for doc in docs:
            if doc.id == doc_id:
                return doc.content
        raise FileNotFoundError(f"Document ID {doc_id} not found in IMAP source.")

    async def detect_changes(self, known_hashes: dict[str, str]) -> ConnectorChangeDetection:
        docs = await self.list_documents()
        current_by_id = {doc.id: doc for doc in docs}
        added = [doc for doc in docs if doc.id not in known_hashes]
        modified = [doc for doc in docs if doc.id in known_hashes and doc.content_hash != known_hashes[doc.id]]
        removed_ids = [doc_id for doc_id in known_hashes if doc_id not in current_by_id]
        return ConnectorChangeDetection(added=added, modified=modified, removed_ids=removed_ids)

    def supported_file_types(self) -> list[str]:
        return ["email", "txt"]

    # ------------------------------------------------------------------
    # IMAP helpers
    # ------------------------------------------------------------------

    async def _fetch_emails(self) -> list[dict[str, Any]]:
        if aioimaplib is None:
            raise RuntimeError("aioimaplib is required to fetch IMAP emails.")
        # Placeholder implementation. Real IMAP integration should be implemented
        # with aioimaplib in production.
        return []
