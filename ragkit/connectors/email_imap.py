"""Connector for IMAP email sources."""

from __future__ import annotations

import email as email_lib
import email.header
import email.utils
import hashlib
import logging
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import aioimaplib  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    aioimaplib = None

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

    def _include_attachments(self) -> bool:
        return bool(self.config.get("include_attachments", False))

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

        if aioimaplib is None:
            errors.append("Le package aioimaplib est requis pour les sources email.")

        if not self._server():
            errors.append("Le serveur IMAP est requis.")
        if not self._folders():
            errors.append("Au moins un dossier doit etre selectionne.")
        if not self.credential or not self.credential.get("username") or not self.credential.get("password"):
            errors.append("Les credentials IMAP sont requis.")

        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors)

    async def test_connection(self) -> ConnectorValidationResult:
        validation = await self.validate_config()
        if not validation.valid or aioimaplib is None:
            return validation

        errors: list[str] = []
        try:
            imap = await self._connect()
            try:
                # Verify we can list folders
                status, data = await imap.list("", "*")
                if status != "OK":
                    errors.append("Impossible de lister les dossiers IMAP.")
                else:
                    # Verify requested folders exist
                    available = self._parse_folder_list(data)
                    for folder in self._folders():
                        if folder not in available:
                            errors.append(f"Dossier '{folder}' introuvable sur le serveur.")
            finally:
                try:
                    await imap.logout()
                except Exception:
                    pass
        except Exception as exc:
            errors.append(f"Erreur de connexion IMAP : {exc}")

        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors)

    async def list_documents(self) -> list[ConnectorDocument]:
        validation = await self.validate_config()
        if not validation.valid or aioimaplib is None:
            if validation.errors:
                logger.warning("EmailImapConnector validation failed: %s", validation.errors)
            return []

        emails = await self._fetch_emails()
        documents: list[ConnectorDocument] = []
        self._doc_cache = {}

        for mail in emails[: self._max_emails()]:
            uid = str(mail.get("uid", ""))
            subject = str(mail.get("subject", "")) or "Email"
            body = str(mail.get("body", "")) or ""
            date_value = mail.get("date") or datetime.now(timezone.utc).isoformat()

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
                    "from": mail.get("from"),
                    "to": mail.get("to"),
                    "subject": subject,
                    "folder": mail.get("folder"),
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
    # IMAP connection
    # ------------------------------------------------------------------

    async def _connect(self) -> "aioimaplib.IMAP4_SSL | aioimaplib.IMAP4":
        """Establish an authenticated IMAP connection."""
        host = self._server()
        port = self._port()

        if self._use_ssl():
            imap = aioimaplib.IMAP4_SSL(host=host, port=port)
        else:
            imap = aioimaplib.IMAP4(host=host, port=port)

        await imap.wait_hello_from_server()

        cred = self.credential or {}
        username = cred.get("username", "")
        password = cred.get("password", "")
        status, _ = await imap.login(username, password)
        if status != "OK":
            raise RuntimeError(f"IMAP login failed for {username}@{host}")

        return imap

    # ------------------------------------------------------------------
    # Email fetching
    # ------------------------------------------------------------------

    async def _fetch_emails(self) -> list[dict[str, Any]]:
        """Fetch emails from the configured IMAP folders."""
        if aioimaplib is None:
            raise RuntimeError("aioimaplib is required to fetch IMAP emails.")

        results: list[dict[str, Any]] = []

        imap = await self._connect()
        try:
            for folder in self._folders():
                if len(results) >= self._max_emails():
                    break

                status, _ = await imap.select(folder)
                if status != "OK":
                    logger.warning("Cannot select IMAP folder '%s', skipping.", folder)
                    continue

                criteria = self._build_search_criteria()
                status, data = await imap.search(criteria)
                if status != "OK" or not data or not data[0]:
                    continue

                uid_list = data[0].split()
                # Take the most recent UIDs (last N)
                remaining = self._max_emails() - len(results)
                uid_list = uid_list[-remaining:]

                for uid_bytes in uid_list:
                    uid_str = uid_bytes.decode() if isinstance(uid_bytes, bytes) else str(uid_bytes)
                    try:
                        parsed = await self._fetch_single_email(imap, uid_str, folder)
                        if parsed:
                            results.append(parsed)
                    except Exception as exc:
                        logger.warning("Failed to fetch email UID %s: %s", uid_str, exc)
                        continue
        finally:
            try:
                await imap.logout()
            except Exception:
                pass

        return results

    async def _fetch_single_email(
        self, imap: Any, uid: str, folder: str
    ) -> dict[str, Any] | None:
        """Fetch and parse a single email by UID."""
        status, data = await imap.uid("fetch", uid, "(RFC822)")
        if status != "OK" or not data:
            return None

        # aioimaplib returns data as a list; find the raw bytes
        raw_bytes: bytes | None = None
        for item in data:
            if isinstance(item, bytes):
                raw_bytes = item
                break
            if isinstance(item, (list, tuple)):
                for sub in item:
                    if isinstance(sub, bytes) and len(sub) > 100:
                        raw_bytes = sub
                        break
                if raw_bytes:
                    break

        if raw_bytes is None:
            return None

        msg = email_lib.message_from_bytes(raw_bytes)

        subject = self._decode_header_value(msg.get("Subject", ""))
        sender = self._decode_header_value(msg.get("From", ""))
        to = self._decode_header_value(msg.get("To", ""))
        date_str = msg.get("Date", "")
        date_iso = self._parse_email_date(date_str)

        body = self._extract_body(msg)

        # Optionally append attachment text
        if self._include_attachments():
            attachment_text = self._extract_attachment_text(msg)
            if attachment_text:
                body = body + "\n\n--- Pieces jointes ---\n\n" + attachment_text

        return {
            "uid": uid,
            "subject": subject,
            "from": sender,
            "to": to,
            "date": date_iso,
            "body": body,
            "folder": folder,
        }

    # ------------------------------------------------------------------
    # IMAP search criteria
    # ------------------------------------------------------------------

    def _build_search_criteria(self) -> str:
        """Build IMAP SEARCH criteria from config filters."""
        parts: list[str] = ["ALL"]

        date_from = self._date_from()
        if date_from:
            # IMAP expects dates as "DD-Mon-YYYY"
            imap_date = self._to_imap_date(date_from)
            if imap_date:
                parts = [f"SINCE {imap_date}"]

        subject_filter = self._subject_filter()
        if subject_filter:
            escaped = subject_filter.replace('"', '\\"')
            parts.append(f'SUBJECT "{escaped}"')

        senders = self._sender_filter()
        if senders:
            # IMAP OR syntax for multiple senders
            if len(senders) == 1:
                parts.append(f'FROM "{senders[0]}"')
            else:
                # Build nested OR: OR (FROM "a") (OR (FROM "b") (FROM "c"))
                from_clauses = [f'FROM "{s}"' for s in senders]
                combined = from_clauses[-1]
                for clause in reversed(from_clauses[:-1]):
                    combined = f"OR {clause} {combined}"
                parts.append(combined)

        if len(parts) == 1:
            return parts[0]

        # Combine: if we replaced ALL with SINCE, just chain the rest
        return " ".join(parts)

    def _to_imap_date(self, iso_date: str) -> str | None:
        """Convert an ISO date string to IMAP date format (DD-Mon-YYYY)."""
        try:
            dt = datetime.fromisoformat(iso_date.replace("Z", "+00:00"))
            return dt.strftime("%d-%b-%Y")
        except Exception:
            return None

    # ------------------------------------------------------------------
    # MIME parsing helpers
    # ------------------------------------------------------------------

    def _extract_body(self, msg: email_lib.message.Message) -> str:
        """Extract the text body from a MIME message."""
        if not msg.is_multipart():
            content_type = msg.get_content_type()
            payload = self._decode_payload(msg)
            if content_type == "text/plain":
                return payload
            if content_type == "text/html":
                return self._html_to_text(payload)
            return payload

        # Multipart: prefer text/plain, fallback to text/html
        plain_parts: list[str] = []
        html_parts: list[str] = []

        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition") or "")
            if "attachment" in disposition:
                continue

            if content_type == "text/plain":
                plain_parts.append(self._decode_payload(part))
            elif content_type == "text/html":
                html_parts.append(self._decode_payload(part))

        if plain_parts:
            return "\n".join(plain_parts)
        if html_parts:
            return self._html_to_text("\n".join(html_parts))
        return ""

    def _extract_attachment_text(self, msg: email_lib.message.Message) -> str:
        """Extract text from attachments using the document parser."""
        from ragkit.desktop import documents

        texts: list[str] = []
        for part in msg.walk():
            disposition = str(part.get("Content-Disposition") or "")
            if "attachment" not in disposition:
                continue

            filename = part.get_filename()
            if not filename:
                continue
            filename = self._decode_header_value(filename)

            ext = Path(filename).suffix.lower().lstrip(".")
            if ext not in {"pdf", "docx", "doc", "txt", "md", "csv", "html"}:
                continue

            payload = part.get_payload(decode=True)
            if not payload or not isinstance(payload, bytes):
                continue

            suffix = Path(filename).suffix or ".bin"
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    tmp.write(payload)
                    tmp_path = Path(tmp.name)
                parsed = documents._extract_content(tmp_path)
                if parsed.text.strip():
                    texts.append(f"[{filename}]\n{parsed.text}")
            except Exception as exc:
                logger.warning("Failed to parse attachment '%s': %s", filename, exc)
            finally:
                try:
                    tmp_path.unlink()
                except Exception:
                    pass

        return "\n\n".join(texts)

    def _decode_payload(self, part: email_lib.message.Message) -> str:
        """Decode a MIME part payload to a string."""
        payload = part.get_payload(decode=True)
        if payload is None:
            return ""
        charset = part.get_content_charset() or "utf-8"
        try:
            return payload.decode(charset)
        except (UnicodeDecodeError, LookupError):
            try:
                return payload.decode("utf-8", errors="replace")
            except Exception:
                return payload.decode("latin-1", errors="replace")

    def _html_to_text(self, html: str) -> str:
        """Convert HTML to plain text."""
        if BeautifulSoup is not None:
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style"]):
                tag.decompose()
            return soup.get_text(" ", strip=True)
        # Fallback: strip tags with regex
        cleaned = re.sub(r"<[^>]+>", " ", html)
        return re.sub(r"\s+", " ", cleaned).strip()

    def _decode_header_value(self, value: str | None) -> str:
        """Decode an RFC 2047 encoded header value."""
        if not value:
            return ""
        try:
            decoded_parts = email.header.decode_header(value)
            parts: list[str] = []
            for data, charset in decoded_parts:
                if isinstance(data, bytes):
                    parts.append(data.decode(charset or "utf-8", errors="replace"))
                else:
                    parts.append(str(data))
            return " ".join(parts)
        except Exception:
            return str(value)

    def _parse_email_date(self, date_str: str) -> str:
        """Parse an email Date header into ISO 8601."""
        if not date_str:
            return datetime.now(timezone.utc).isoformat()
        try:
            parsed = email.utils.parsedate_to_datetime(date_str)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc).isoformat()
        except Exception:
            return datetime.now(timezone.utc).isoformat()

    # ------------------------------------------------------------------
    # Folder helpers
    # ------------------------------------------------------------------

    def _parse_folder_list(self, data: list) -> set[str]:
        """Parse the output of IMAP LIST into a set of folder names."""
        folders: set[str] = set()
        for item in data:
            text = item.decode("utf-8", errors="replace") if isinstance(item, bytes) else str(item)
            # LIST response format: (\Flags) "delimiter" "folder_name"
            match = re.search(r'"([^"]+)"$', text.strip())
            if match:
                folders.add(match.group(1))
            else:
                # Fallback: take the last token
                parts = text.strip().split()
                if parts:
                    folders.add(parts[-1].strip('"'))
        return folders
