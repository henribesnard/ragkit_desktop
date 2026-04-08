"""Connector for SQL databases (PostgreSQL/MySQL/SQLite)."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import asyncpg  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    asyncpg = None

try:
    import aiomysql  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    aiomysql = None

from ragkit.connectors.base import (
    BaseConnector,
    ConnectorChangeDetection,
    ConnectorDocument,
    ConnectorValidationResult,
)
from ragkit.connectors.registry import register_connector
from ragkit.desktop.models import SourceType


logger = logging.getLogger(__name__)


@register_connector(SourceType.SQL_DATABASE)
class SqlDatabaseConnector(BaseConnector):
    """Extracts documents from SQL queries."""

    def __init__(self, source_id: str, config: dict[str, Any], credential: dict[str, Any] | None = None) -> None:
        super().__init__(source_id, config, credential)
        self._doc_cache: dict[str, ConnectorDocument] = {}

    # ------------------------------------------------------------------
    # Config helpers
    # ------------------------------------------------------------------

    def _db_type(self) -> str:
        return str(self.config.get("db_type", "sqlite")).strip().lower()

    def _sqlite_path(self) -> str | None:
        value = self.config.get("sqlite_path")
        return str(value).strip() if value else None

    def _query(self) -> str:
        return str(self.config.get("query", "")).strip()

    def _id_column(self) -> str:
        return str(self.config.get("id_column", "")).strip()

    def _content_column(self) -> str:
        return str(self.config.get("content_column", "")).strip()

    def _title_column(self) -> str | None:
        value = self.config.get("title_column")
        return str(value).strip() if value else None

    def _metadata_columns(self) -> list[str]:
        return [str(col).strip() for col in self.config.get("metadata_columns", []) if str(col).strip()]

    def _incremental_column(self) -> str | None:
        value = self.config.get("incremental_column")
        return str(value).strip() if value else None

    def _max_rows(self) -> int:
        return max(1, int(self.config.get("max_rows", 10000)))

    # ------------------------------------------------------------------
    # BaseConnector implementation
    # ------------------------------------------------------------------

    async def validate_config(self) -> ConnectorValidationResult:
        errors: list[str] = []

        db_type = self._db_type()
        if db_type not in {"sqlite", "postgresql", "mysql"}:
            errors.append("Type de base de donnees invalide.")

        query = self._query()
        if not query:
            errors.append("La requete SQL est requise.")
        elif not self._is_select_query(query):
            errors.append("Seules les requetes SELECT sont autorisees.")

        if not self._id_column() or not self._content_column():
            errors.append("Les colonnes id_column et content_column sont requises.")

        if db_type == "sqlite":
            sqlite_path = self._sqlite_path()
            if not sqlite_path:
                errors.append("Le chemin SQLite est requis.")
            elif not Path(sqlite_path).exists():
                errors.append("Le fichier SQLite est introuvable.")

        if db_type == "postgresql" and asyncpg is None:
            errors.append("Le package asyncpg est requis pour PostgreSQL.")
        if db_type == "mysql" and aiomysql is None:
            errors.append("Le package aiomysql est requis pour MySQL.")

        if errors:
            return ConnectorValidationResult(valid=False, errors=errors)

        if db_type == "sqlite":
            try:
                columns = await asyncio.to_thread(self._probe_sqlite_columns)
                if columns is None:
                    errors.append("Impossible de verifier les colonnes.")
                else:
                    missing = self._missing_columns(columns)
                    if missing:
                        errors.append(f"Colonnes manquantes dans le resultat: {', '.join(missing)}")
            except Exception as exc:
                errors.append(f"Erreur lors de la validation SQL: {exc}")

        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors)

    async def test_connection(self) -> ConnectorValidationResult:
        validation = await self.validate_config()
        return validation

    async def list_documents(self) -> list[ConnectorDocument]:
        validation = await self.validate_config()
        if not validation.valid:
            if validation.errors:
                logger.warning("SqlDatabaseConnector validation failed: %s", validation.errors)
            return []

        db_type = self._db_type()
        rows: list[dict[str, Any]] = []
        if db_type == "sqlite":
            rows = await asyncio.to_thread(self._fetch_sqlite_rows)
        else:
            rows = await self._fetch_remote_rows()

        documents: list[ConnectorDocument] = []
        self._doc_cache = {}
        max_rows = self._max_rows()
        id_col = self._id_column()
        content_col = self._content_column()
        title_col = self._title_column()
        metadata_cols = self._metadata_columns()
        incremental_col = self._incremental_column()

        for row in rows[:max_rows]:
            raw_id = row.get(id_col)
            content = row.get(content_col)
            if raw_id is None:
                continue
            raw_id_str = str(raw_id)
            content_text = "" if content is None else str(content)
            title = str(row.get(title_col)) if title_col and row.get(title_col) is not None else f"Row {raw_id_str}"

            metadata = {col: row.get(col) for col in metadata_cols if col in row}
            last_modified = row.get(incremental_col) if incremental_col and incremental_col in row else None
            if not last_modified:
                last_modified = datetime.now(timezone.utc).isoformat()

            doc_id = hashlib.sha256(f"{self.source_id}:{raw_id_str}".encode("utf-8")).hexdigest()
            content_hash = hashlib.sha256(content_text.encode("utf-8")).hexdigest()

            doc = ConnectorDocument(
                id=doc_id,
                source_id=self.source_id,
                title=title,
                content=content_text,
                content_type="text",
                url=None,
                file_path=raw_id_str,
                file_type="sql",
                file_size_bytes=len(content_text.encode("utf-8")),
                last_modified=str(last_modified),
                metadata=metadata,
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
        raise FileNotFoundError(f"Document ID {doc_id} not found in SQL source.")

    async def detect_changes(self, known_hashes: dict[str, str]) -> ConnectorChangeDetection:
        docs = await self.list_documents()
        current_by_id = {doc.id: doc for doc in docs}
        added = [doc for doc in docs if doc.id not in known_hashes]
        modified = [doc for doc in docs if doc.id in known_hashes and doc.content_hash != known_hashes[doc.id]]
        removed_ids = [doc_id for doc_id in known_hashes if doc_id not in current_by_id]
        return ConnectorChangeDetection(added=added, modified=modified, removed_ids=removed_ids)

    def supported_file_types(self) -> list[str]:
        return ["sql"]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _is_select_query(self, query: str) -> bool:
        lowered = query.strip().lower()
        if not lowered:
            return False
        if lowered.startswith("with"):
            return "select" in lowered
        if not lowered.startswith("select"):
            return False
        forbidden = ["insert", "update", "delete", "drop", "alter", "create", "truncate"]
        return not any(re.search(rf"\\b{word}\\b", lowered) for word in forbidden)

    def _missing_columns(self, columns: list[str]) -> list[str]:
        col_set = {c.lower() for c in columns}
        missing = []
        for name in [self._id_column(), self._content_column(), self._title_column() or ""]:
            if name and name.lower() not in col_set:
                missing.append(name)
        for meta in self._metadata_columns():
            if meta.lower() not in col_set:
                missing.append(meta)
        return missing

    def _probe_sqlite_columns(self) -> list[str] | None:
        sqlite_path = self._sqlite_path()
        if not sqlite_path:
            return None
        query = self._query()
        probe_query = self._apply_limit(query, 1)
        with sqlite3.connect(sqlite_path) as con:
            cur = con.execute(probe_query)
            if not cur.description:
                return None
            return [desc[0] for desc in cur.description]

    def _fetch_sqlite_rows(self) -> list[dict[str, Any]]:
        sqlite_path = self._sqlite_path()
        if not sqlite_path:
            return []
        query = self._apply_limit(self._query(), self._max_rows())
        with sqlite3.connect(sqlite_path) as con:
            con.row_factory = sqlite3.Row
            cur = con.execute(query)
            return [dict(row) for row in cur.fetchall()]

    async def _fetch_remote_rows(self) -> list[dict[str, Any]]:
        db_type = self._db_type()
        if db_type == "postgresql":
            if asyncpg is None:
                return []
            return await self._fetch_postgres_rows()
        if db_type == "mysql":
            if aiomysql is None:
                return []
            return await self._fetch_mysql_rows()
        return []

    async def _fetch_postgres_rows(self) -> list[dict[str, Any]]:
        query = self._apply_limit(self._query(), self._max_rows())
        cred = self.credential or {}
        conn = await asyncpg.connect(
            user=cred.get("username"),
            password=cred.get("password"),
            host=self.config.get("host"),
            port=self.config.get("port"),
            database=self.config.get("database"),
        )
        try:
            records = await conn.fetch(query)
            return [dict(record) for record in records]
        finally:
            await conn.close()

    async def _fetch_mysql_rows(self) -> list[dict[str, Any]]:
        query = self._apply_limit(self._query(), self._max_rows())
        cred = self.credential or {}
        conn = await aiomysql.connect(
            user=cred.get("username"),
            password=cred.get("password"),
            host=self.config.get("host"),
            port=int(self.config.get("port", 3306)),
            db=self.config.get("database"),
        )
        try:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(query)
                return list(await cur.fetchall())
        finally:
            conn.close()

    def _apply_limit(self, query: str, limit: int | None) -> str:
        base = query.rstrip().rstrip(";")
        if limit is None:
            return base
        return f"SELECT * FROM ({base}) LIMIT {int(limit)}"
