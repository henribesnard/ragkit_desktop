"""Connector for S3-compatible buckets."""

from __future__ import annotations

import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from typing import Any

try:
    import aiobotocore  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    aiobotocore = None

from ragkit.connectors.base import (
    BaseConnector,
    ConnectorChangeDetection,
    ConnectorDocument,
    ConnectorValidationResult,
)
from ragkit.connectors.registry import register_connector
from ragkit.desktop.models import SourceType


logger = logging.getLogger(__name__)


@register_connector(SourceType.S3_BUCKET)
class S3BucketConnector(BaseConnector):
    """Indexes files stored in S3 or S3-compatible storage."""

    def __init__(self, source_id: str, config: dict[str, Any], credential: dict[str, Any] | None = None) -> None:
        super().__init__(source_id, config, credential)
        self._doc_cache: dict[str, ConnectorDocument] = {}

    # ------------------------------------------------------------------
    # Config helpers
    # ------------------------------------------------------------------

    def _bucket(self) -> str:
        return str(self.config.get("bucket", "")).strip()

    def _prefix(self) -> str:
        return str(self.config.get("prefix", "")).lstrip("/")

    def _region(self) -> str:
        return str(self.config.get("region", "")).strip()

    def _endpoint_url(self) -> str | None:
        value = self.config.get("endpoint_url")
        return str(value).strip() if value else None

    def _file_types(self) -> list[str]:
        return [str(ft).strip().lower().lstrip(".") for ft in self.config.get("file_types", []) if str(ft).strip()]

    def _max_file_size_mb(self) -> int:
        return int(self.config.get("max_file_size_mb", 50))

    def _recursive(self) -> bool:
        return bool(self.config.get("recursive", True))

    # ------------------------------------------------------------------
    # BaseConnector implementation
    # ------------------------------------------------------------------

    async def validate_config(self) -> ConnectorValidationResult:
        errors: list[str] = []

        if not self._bucket():
            errors.append("Le nom du bucket est requis.")
        if not self._region():
            errors.append("La region S3 est requise.")
        if not self.credential:
            errors.append("Les credentials AWS sont requis.")

        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors)

    async def test_connection(self) -> ConnectorValidationResult:
        validation = await self.validate_config()
        return validation

    async def list_documents(self) -> list[ConnectorDocument]:
        validation = await self.validate_config()
        if not validation.valid:
            if validation.errors:
                logger.warning("S3BucketConnector validation failed: %s", validation.errors)
            return []

        try:
            objects = await self._list_objects()
        except Exception as exc:  # pragma: no cover - runtime failures
            logger.warning("Failed to list S3 objects: %s", exc)
            return []

        documents: list[ConnectorDocument] = []
        self._doc_cache = {}
        allowed_exts = set(self._file_types())
        max_bytes = self._max_file_size_mb() * 1024 * 1024

        for obj in objects:
            key = str(obj.get("Key", "")).lstrip("/")
            if not key:
                continue
            if not self._recursive() and "/" in key.strip("/"):
                continue
            file_type = key.split(".")[-1].lower() if "." in key else ""
            if allowed_exts and file_type not in allowed_exts:
                continue
            size = int(obj.get("Size") or 0)
            if size > max_bytes:
                continue
            etag = str(obj.get("ETag") or "").strip('"')
            last_modified = obj.get("LastModified")
            if isinstance(last_modified, datetime):
                last_modified = last_modified.astimezone(timezone.utc).isoformat()
            if not last_modified:
                last_modified = datetime.now(timezone.utc).isoformat()

            doc_id = hashlib.sha256(f"{self.source_id}:{key}".encode("utf-8")).hexdigest()
            doc = ConnectorDocument(
                id=doc_id,
                source_id=self.source_id,
                title=key.split("/")[-1],
                content="",
                content_type="text",
                url=None,
                file_path=key,
                file_type=file_type,
                file_size_bytes=size,
                last_modified=str(last_modified),
                metadata={"etag": etag},
                content_hash=etag or hashlib.sha256(key.encode("utf-8")).hexdigest(),
            )
            documents.append(doc)
            self._doc_cache[doc_id] = doc

        return documents

    async def fetch_document_content(self, doc_id: str) -> str:
        cached = self._doc_cache.get(doc_id)
        if cached is None:
            docs = await self.list_documents()
            cached = next((doc for doc in docs if doc.id == doc_id), None)
        if cached is None:
            raise FileNotFoundError(f"Document ID {doc_id} not found in S3 source.")
        try:
            data = await self._get_object(cached.file_path or "")
            return data.decode("utf-8", errors="ignore")
        except Exception as exc:  # pragma: no cover - network failures
            raise RuntimeError(f"Failed to fetch S3 object: {exc}") from exc

    async def detect_changes(self, known_hashes: dict[str, str]) -> ConnectorChangeDetection:
        docs = await self.list_documents()
        current_by_id = {doc.id: doc for doc in docs}
        added = [doc for doc in docs if doc.id not in known_hashes]
        modified = [doc for doc in docs if doc.id in known_hashes and doc.content_hash != known_hashes[doc.id]]
        removed_ids = [doc_id for doc_id in known_hashes if doc_id not in current_by_id]
        return ConnectorChangeDetection(added=added, modified=modified, removed_ids=removed_ids)

    def supported_file_types(self) -> list[str]:
        return ["pdf", "md", "txt", "docx", "csv"]

    # ------------------------------------------------------------------
    # S3 helpers
    # ------------------------------------------------------------------

    async def _list_objects(self) -> list[dict[str, Any]]:
        if aiobotocore is None:
            raise RuntimeError("aiobotocore is required to list S3 objects.")
        session = aiobotocore.get_session()
        cred = self.credential or {}
        async with session.create_client(
            "s3",
            region_name=self._region(),
            endpoint_url=self._endpoint_url(),
            aws_access_key_id=cred.get("aws_access_key_id"),
            aws_secret_access_key=cred.get("aws_secret_access_key"),
        ) as client:
            paginator = client.get_paginator("list_objects_v2")
            pages = paginator.paginate(Bucket=self._bucket(), Prefix=self._prefix())
            results: list[dict[str, Any]] = []
            async for page in pages:
                results.extend(page.get("Contents", []) or [])
        return results

    async def _get_object(self, key: str) -> bytes:
        if aiobotocore is None:
            raise RuntimeError("aiobotocore is required to fetch S3 objects.")
        session = aiobotocore.get_session()
        cred = self.credential or {}
        async with session.create_client(
            "s3",
            region_name=self._region(),
            endpoint_url=self._endpoint_url(),
            aws_access_key_id=cred.get("aws_access_key_id"),
            aws_secret_access_key=cred.get("aws_secret_access_key"),
        ) as client:
            response = await client.get_object(Bucket=self._bucket(), Key=key)
            async with response["Body"] as stream:
                return await stream.read()
