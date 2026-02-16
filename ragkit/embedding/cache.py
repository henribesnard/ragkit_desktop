from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path

from ragkit.config.embedding_schema import CacheBackend, CacheStats


class BaseEmbeddingCache:
    @staticmethod
    def cache_key(text: str, model_id: str) -> str:
        return hashlib.sha256(f"{model_id}::{text}".encode("utf-8")).hexdigest()

    def get(self, text: str, model_id: str) -> list[float] | None: ...
    def put(self, text: str, model_id: str, vector: list[float]) -> None: ...
    def clear(self) -> None: ...
    def stats(self, model_id: str | None = None) -> CacheStats: ...


class MemoryEmbeddingCache(BaseEmbeddingCache):
    def __init__(self) -> None:
        self._store: dict[str, list[float]] = {}

    def get(self, text: str, model_id: str) -> list[float] | None:
        return self._store.get(self.cache_key(text, model_id))

    def put(self, text: str, model_id: str, vector: list[float]) -> None:
        self._store[self.cache_key(text, model_id)] = vector

    def clear(self) -> None:
        self._store.clear()

    def stats(self, model_id: str | None = None) -> CacheStats:
        return CacheStats(entries=len(self._store), size_mb=0.0, backend="memory", model_id=model_id)


class DiskEmbeddingCache(BaseEmbeddingCache):
    DB_PATH = Path.home() / ".ragkit" / "cache" / "embeddings.db"

    def __init__(self) -> None:
        self.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.DB_PATH))
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS embeddings (
              key TEXT PRIMARY KEY,
              model_id TEXT NOT NULL,
              vector TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        self._conn.commit()

    def get(self, text: str, model_id: str) -> list[float] | None:
        key = self.cache_key(text, model_id)
        cur = self._conn.execute("SELECT vector FROM embeddings WHERE key = ?", (key,))
        row = cur.fetchone()
        return json.loads(row[0]) if row else None

    def put(self, text: str, model_id: str, vector: list[float]) -> None:
        key = self.cache_key(text, model_id)
        self._conn.execute(
            "INSERT OR REPLACE INTO embeddings(key, model_id, vector) VALUES (?, ?, ?)",
            (key, model_id, json.dumps(vector)),
        )
        self._conn.commit()

    def clear(self) -> None:
        self._conn.execute("DELETE FROM embeddings")
        self._conn.commit()

    def stats(self, model_id: str | None = None) -> CacheStats:
        cur = self._conn.execute("SELECT COUNT(*) FROM embeddings")
        entries = int(cur.fetchone()[0])
        size_mb = self.DB_PATH.stat().st_size / (1024 * 1024) if self.DB_PATH.exists() else 0.0
        return CacheStats(entries=entries, size_mb=round(size_mb, 3), backend="disk", model_id=model_id)


def create_cache(backend: CacheBackend) -> BaseEmbeddingCache:
    if backend == CacheBackend.MEMORY:
        return MemoryEmbeddingCache()
    return DiskEmbeddingCache()
