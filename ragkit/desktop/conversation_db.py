"""SQLite storage for conversations — single source of truth."""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ragkit.desktop.settings_store import get_conversations_dir, get_data_root

logger = logging.getLogger(__name__)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ConversationDB:
    """Synchronous SQLite store for conversations and messages.

    Follows the same pattern as ``QueryLogger`` (``ragkit/monitoring/query_logger.py``).
    """

    def __init__(self, db_path: Path | None = None):
        self.db_path = db_path or (get_data_root() / "data" / "conversations.db")
        self._ensure_db()

    # ------------------------------------------------------------------
    # Connection helpers
    # ------------------------------------------------------------------

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_db(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    summary TEXT,
                    total_messages INTEGER NOT NULL DEFAULT 0,
                    archived INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_conversations_updated
                    ON conversations(updated_at);

                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT NOT NULL
                        REFERENCES conversations(id) ON DELETE CASCADE,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    intent TEXT,
                    sources TEXT,
                    query_log_id TEXT,
                    feedback TEXT,
                    timestamp TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_messages_conversation
                    ON messages(conversation_id, timestamp);
                """
            )
            conn.commit()

    # ------------------------------------------------------------------
    # Conversation CRUD
    # ------------------------------------------------------------------

    def list_conversations(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, title, created_at, updated_at, total_messages, archived
                FROM conversations
                ORDER BY updated_at DESC
                """
            ).fetchall()
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "createdAt": r["created_at"],
                "updatedAt": r["updated_at"],
                "messageCount": r["total_messages"],
                "archived": bool(r["archived"]),
            }
            for r in rows
        ]

    def get_conversation(self, conversation_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM conversations WHERE id = ?", (conversation_id,)
            ).fetchone()
        if not row:
            return None
        return dict(row)

    def create_conversation(self, conversation_id: str, title: str = "") -> None:
        now = _utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (conversation_id, title, now, now),
            )
            conn.commit()

    def delete_conversation(self, conversation_id: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
            conn.commit()

    def update_title(self, conversation_id: str, title: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
                (title, _utc_now_iso(), conversation_id),
            )
            conn.commit()

    def set_archived(self, conversation_id: str, archived: bool) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE conversations SET archived = ?, updated_at = ? WHERE id = ?",
                (int(archived), _utc_now_iso(), conversation_id),
            )
            conn.commit()

    # ------------------------------------------------------------------
    # Messages
    # ------------------------------------------------------------------

    def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        *,
        intent: str | None = None,
        sources: list[dict[str, Any]] | None = None,
        query_log_id: str | None = None,
        feedback: str | None = None,
        timestamp: str | None = None,
    ) -> None:
        ts = timestamp or _utc_now_iso()
        sources_json = json.dumps(sources, ensure_ascii=False) if sources else None
        with self._connect() as conn:
            # Ensure conversation exists
            conn.execute(
                """
                INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at)
                VALUES (?, '', ?, ?)
                """,
                (conversation_id, ts, ts),
            )
            conn.execute(
                """
                INSERT INTO messages
                    (conversation_id, role, content, intent, sources, query_log_id, feedback, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (conversation_id, role, content, intent, sources_json, query_log_id, feedback, ts),
            )
            conn.execute(
                """
                UPDATE conversations
                SET total_messages = total_messages + 1, updated_at = ?
                WHERE id = ?
                """,
                (ts, conversation_id),
            )
            conn.commit()

    def get_messages(self, conversation_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT role, content, intent, sources, query_log_id, feedback, timestamp
                FROM messages
                WHERE conversation_id = ?
                ORDER BY timestamp ASC, id ASC
                """,
                (conversation_id,),
            ).fetchall()
        result = []
        for r in rows:
            sources = None
            if r["sources"]:
                try:
                    sources = json.loads(r["sources"])
                except (json.JSONDecodeError, TypeError):
                    pass
            result.append(
                {
                    "role": r["role"],
                    "content": r["content"],
                    "intent": r["intent"],
                    "sources": sources,
                    "query_log_id": r["query_log_id"],
                    "feedback": r["feedback"],
                    "timestamp": r["timestamp"],
                }
            )
        return result

    def set_feedback(
        self, conversation_id: str, query_log_id: str, feedback: str
    ) -> bool:
        with self._connect() as conn:
            cursor = conn.execute(
                """
                UPDATE messages SET feedback = ?
                WHERE conversation_id = ? AND query_log_id = ?
                """,
                (feedback, conversation_id, query_log_id),
            )
            conn.commit()
        return cursor.rowcount > 0

    def update_summary(self, conversation_id: str, summary: str | None) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE conversations SET summary = ? WHERE id = ?",
                (summary, conversation_id),
            )
            conn.commit()

    def get_summary(self, conversation_id: str) -> str | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT summary FROM conversations WHERE id = ?",
                (conversation_id,),
            ).fetchone()
        return row["summary"] if row else None

    def clear_conversation(self, conversation_id: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM messages WHERE conversation_id = ?",
                (conversation_id,),
            )
            conn.execute(
                """
                UPDATE conversations
                SET total_messages = 0, summary = NULL, updated_at = ?
                WHERE id = ?
                """,
                (_utc_now_iso(), conversation_id),
            )
            conn.commit()

    # ------------------------------------------------------------------
    # Migration from JSON files
    # ------------------------------------------------------------------

    def migrate_json_files(self) -> int:
        """Import existing JSON conversation files into SQLite.

        Renames successfully imported files to ``*.json.migrated``.
        Returns the number of conversations migrated.
        """
        conversations_dir = get_conversations_dir()
        if not conversations_dir.exists():
            return 0

        migrated = 0
        for json_path in sorted(conversations_dir.glob("*.json")):
            cid = json_path.stem
            if cid == "default":
                # Skip the transient default conversation
                continue
            try:
                data = json.loads(json_path.read_text(encoding="utf-8"))
            except Exception:
                logger.warning("Skipping corrupt conversation file: %s", json_path)
                continue

            messages = data.get("messages", [])
            summary = data.get("summary")
            total = data.get("total_messages", len(messages))

            # Determine timestamps from messages
            timestamps = [m.get("timestamp", "") for m in messages if m.get("timestamp")]
            created_at = min(timestamps) if timestamps else _utc_now_iso()
            updated_at = max(timestamps) if timestamps else created_at

            with self._connect() as conn:
                # Skip if already migrated (conversation exists in DB)
                existing = conn.execute(
                    "SELECT id FROM conversations WHERE id = ?", (cid,)
                ).fetchone()
                if existing:
                    json_path.rename(json_path.with_suffix(".json.migrated"))
                    continue

                conn.execute(
                    """
                    INSERT INTO conversations (id, title, created_at, updated_at, summary, total_messages)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (cid, "", created_at, updated_at, summary, total),
                )
                for m in messages:
                    sources_json = (
                        json.dumps(m.get("sources"), ensure_ascii=False)
                        if m.get("sources")
                        else None
                    )
                    conn.execute(
                        """
                        INSERT INTO messages
                            (conversation_id, role, content, intent, sources,
                             query_log_id, feedback, timestamp)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            cid,
                            m.get("role", "user"),
                            m.get("content", ""),
                            m.get("intent"),
                            sources_json,
                            m.get("query_log_id"),
                            m.get("feedback"),
                            m.get("timestamp", created_at),
                        ),
                    )
                conn.commit()

            json_path.rename(json_path.with_suffix(".json.migrated"))
            migrated += 1
            logger.info(
                "Migrated conversation %s (%d messages) from JSON to SQLite",
                cid,
                len(messages),
            )

        if migrated:
            logger.info("Migration complete: %d conversations imported", migrated)
        return migrated


# ------------------------------------------------------------------
# Singleton
# ------------------------------------------------------------------

_db: ConversationDB | None = None


def get_conversation_db() -> ConversationDB:
    global _db
    if _db is None:
        _db = ConversationDB()
    return _db
