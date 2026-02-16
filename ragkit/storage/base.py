"""Vector store abstraction with lightweight local persistence implementations."""

from __future__ import annotations

import json
import math
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

from ragkit.config.vector_store_schema import CollectionStats, ConnectionTestResult, VectorStoreConfig


@dataclass
class VectorPoint:
    id: str
    vector: list[float]
    payload: dict


class BaseVectorStore(ABC):
    def __init__(self, config: VectorStoreConfig):
        self.config = config

    @abstractmethod
    async def initialize(self, dimensions: int) -> None: ...

    @abstractmethod
    async def upsert(self, points: list[VectorPoint]) -> int: ...

    @abstractmethod
    async def delete_by_doc_id(self, doc_id: str) -> int: ...

    @abstractmethod
    async def delete_collection(self) -> None: ...

    @abstractmethod
    async def collection_stats(self) -> CollectionStats: ...

    @abstractmethod
    async def test_connection(self) -> ConnectionTestResult: ...

    @abstractmethod
    async def create_snapshot(self, version: str) -> str: ...

    @abstractmethod
    async def restore_snapshot(self, version: str) -> None: ...

    @abstractmethod
    async def search(self, vector: list[float], top_k: int) -> list[tuple[VectorPoint, float]]: ...

    @abstractmethod
    async def all_points(self) -> list[VectorPoint]: ...




def _cosine_similarity(a: list[float], b: list[float]) -> float:
    denom_a = math.sqrt(sum(x * x for x in a))
    denom_b = math.sqrt(sum(x * x for x in b))
    if denom_a == 0 or denom_b == 0:
        return 0.0
    return max(-1.0, min(1.0, sum(x * y for x, y in zip(a, b)) / (denom_a * denom_b)))


class LocalJsonVectorStore(BaseVectorStore):
    def __init__(self, config: VectorStoreConfig):
        super().__init__(config)
        self._dimensions = 0
        self._points: dict[str, VectorPoint] = {}

    @property
    def _root(self) -> Path:
        base = Path(self.config.path).expanduser()
        return base if self.config.mode.value == "persistent" else Path.home() / ".ragkit" / "data" / "memory"

    @property
    def _db_file(self) -> Path:
        return self._root / f"{self.config.collection_name}.json"

    def _load(self) -> None:
        if not self._db_file.exists():
            return
        payload = json.loads(self._db_file.read_text(encoding="utf-8"))
        self._dimensions = payload.get("dimensions", 0)
        self._points = {
            p["id"]: VectorPoint(id=p["id"], vector=p["vector"], payload=p.get("payload", {}))
            for p in payload.get("points", [])
        }

    def _save(self) -> None:
        if self.config.mode.value != "persistent":
            return
        self._root.mkdir(parents=True, exist_ok=True)
        self._db_file.write_text(
            json.dumps(
                {
                    "dimensions": self._dimensions,
                    "points": [
                        {"id": p.id, "vector": p.vector, "payload": p.payload}
                        for p in self._points.values()
                    ],
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

    async def initialize(self, dimensions: int) -> None:
        self._dimensions = dimensions
        self._load()

    async def upsert(self, points: list[VectorPoint]) -> int:
        for point in points:
            self._points[point.id] = point
        self._save()
        return len(points)

    async def delete_by_doc_id(self, doc_id: str) -> int:
        to_delete = [pid for pid, point in self._points.items() if point.payload.get("doc_id") == doc_id]
        for pid in to_delete:
            self._points.pop(pid, None)
        self._save()
        return len(to_delete)

    async def delete_collection(self) -> None:
        self._points = {}
        if self._db_file.exists():
            self._db_file.unlink()

    async def collection_stats(self) -> CollectionStats:
        size_bytes = self._db_file.stat().st_size if self._db_file.exists() else 0
        return CollectionStats(
            name=self.config.collection_name,
            vectors_count=len(self._points),
            dimensions=self._dimensions,
            size_bytes=size_bytes,
            status="ready",
        )

    async def test_connection(self) -> ConnectionTestResult:
        try:
            self._root.mkdir(parents=True, exist_ok=True)
            return ConnectionTestResult(success=True, status="success", message="Vector store accessible")
        except Exception as exc:
            return ConnectionTestResult(success=False, status="error", message=str(exc))

    async def create_snapshot(self, version: str) -> str:
        snap_root = Path.home() / ".ragkit" / "data" / "snapshots" / version
        snap_root.mkdir(parents=True, exist_ok=True)
        if self._db_file.exists():
            target = snap_root / self._db_file.name
            target.write_bytes(self._db_file.read_bytes())
            return str(target)
        return str(snap_root)

    async def restore_snapshot(self, version: str) -> None:
        snap_file = Path.home() / ".ragkit" / "data" / "snapshots" / version / self._db_file.name
        if not snap_file.exists():
            raise FileNotFoundError(f"Snapshot {version} not found")
        self._root.mkdir(parents=True, exist_ok=True)
        self._db_file.write_bytes(snap_file.read_bytes())
        self._load()

    async def search(self, vector: list[float], top_k: int) -> list[tuple[VectorPoint, float]]:
        if not self._points:
            self._load()
        scored = [(point, _cosine_similarity(vector, point.vector)) for point in self._points.values()]
        scored.sort(key=lambda item: item[1], reverse=True)
        return scored[:top_k]

    async def all_points(self) -> list[VectorPoint]:
        if not self._points:
            self._load()
        return list(self._points.values())


class QdrantVectorStore(LocalJsonVectorStore):
    pass


class ChromaVectorStore(LocalJsonVectorStore):
    pass


STORE_REGISTRY = {"qdrant": QdrantVectorStore, "chroma": ChromaVectorStore}


def create_vector_store(config: VectorStoreConfig) -> BaseVectorStore:
    return STORE_REGISTRY[config.provider.value](config)
