"""Vector store abstraction with lightweight local persistence implementations."""

from __future__ import annotations

import json
import math
import uuid
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
    if len(a) != len(b):
        raise ValueError(f"Vector dimensions mismatch: {len(a)} != {len(b)}")
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

    def _ensure_vector_dimensions(self, vector: list[float]) -> None:
        if not vector:
            raise ValueError("Vector must not be empty.")
        if self._dimensions == 0:
            self._dimensions = len(vector)
            return
        if len(vector) != self._dimensions:
            raise ValueError(f"Vector dimensions mismatch: expected {self._dimensions}, got {len(vector)}")

    async def initialize(self, dimensions: int) -> None:
        if dimensions < 0:
            raise ValueError("Vector dimensions must be >= 0.")
        self._load()
        if self._dimensions:
            if dimensions and self._dimensions != dimensions:
                raise ValueError(
                    f"Collection dimensions mismatch: existing {self._dimensions}, requested {dimensions}. "
                    "Re-ingest the collection after changing embedding dimensions."
                )
            return
        if dimensions <= 0:
            raise ValueError("Vector dimensions must be > 0 for a new collection.")
        self._dimensions = dimensions

    async def upsert(self, points: list[VectorPoint]) -> int:
        if not points:
            return 0
        for point in points:
            self._ensure_vector_dimensions(point.vector)
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
        if not vector:
            raise ValueError("Query vector must not be empty.")
        if self._dimensions == 0 and self._points:
            first_point = next(iter(self._points.values()))
            self._dimensions = len(first_point.vector)
        if self._dimensions and len(vector) != self._dimensions:
            raise ValueError(
                f"Query vector dimensions mismatch: expected {self._dimensions}, got {len(vector)}. "
                "Verify document/query embedding models and dimensions."
            )
        scored = [(point, _cosine_similarity(vector, point.vector)) for point in self._points.values()]
        scored.sort(key=lambda item: item[1], reverse=True)
        return scored[:top_k]

    async def all_points(self) -> list[VectorPoint]:
        if not self._points:
            self._load()
        return list(self._points.values())


def _directory_size(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(file.stat().st_size for file in path.rglob("*") if file.is_file())


_QDRANT_CLIENTS: dict[str, object] = {}


class QdrantVectorStore(BaseVectorStore):
    def __init__(self, config: VectorStoreConfig):
        super().__init__(config)
        self._dimensions = 0
        self._client = None
        self._client_key: str | None = None

    @property
    def _root(self) -> Path:
        return Path(self.config.path).expanduser()

    def _point_id(self, raw_id: str) -> str:
        return str(uuid.uuid5(uuid.NAMESPACE_URL, raw_id))

    def _distance_metric(self):
        from qdrant_client.models import Distance

        mapping = {
            "cosine": Distance.COSINE,
            "euclidean": Distance.EUCLID,
            "dot": Distance.DOT,
        }
        return mapping[self.config.distance_metric.value]

    def _ensure_client(self):
        if self._client is not None:
            return self._client
        from qdrant_client import QdrantClient

        if self.config.mode.value == "persistent":
            self._client_key = str(self._root)
        else:
            self._client_key = f"memory:{self.config.collection_name}"
        if self._client_key in _QDRANT_CLIENTS:
            self._client = _QDRANT_CLIENTS[self._client_key]
            return self._client

        if self.config.mode.value == "persistent":
            self._root.mkdir(parents=True, exist_ok=True)
            self._client = QdrantClient(path=str(self._root))
        else:
            self._client = QdrantClient(path=":memory:")
        _QDRANT_CLIENTS[self._client_key] = self._client
        return self._client

    def _close_client(self) -> None:
        if self._client is None:
            return
        close = getattr(self._client, "close", None)
        if callable(close):
            close()
        if self._client_key:
            _QDRANT_CLIENTS.pop(self._client_key, None)
        self._client = None
        self._client_key = None

    def _extract_dimensions(self, collection_info) -> int:
        vectors = collection_info.config.params.vectors
        if hasattr(vectors, "size"):
            return int(vectors.size)
        if isinstance(vectors, dict):
            first = next(iter(vectors.values()))
            return int(first.size)
        raise ValueError("Unable to infer vector dimensions from Qdrant collection.")

    async def initialize(self, dimensions: int) -> None:
        if dimensions < 0:
            raise ValueError("Vector dimensions must be >= 0.")

        client = self._ensure_client()
        name = self.config.collection_name
        if client.collection_exists(name):
            info = client.get_collection(name)
            existing_dimensions = self._extract_dimensions(info)
            self._dimensions = existing_dimensions
            if dimensions and existing_dimensions != dimensions:
                raise ValueError(
                    f"Collection dimensions mismatch: existing {existing_dimensions}, requested {dimensions}. "
                    "Re-ingest the collection after changing embedding dimensions."
                )
            return

        if dimensions <= 0:
            raise ValueError("Vector dimensions must be > 0 for a new collection.")
        self._dimensions = dimensions

        from qdrant_client.models import VectorParams

        client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=dimensions, distance=self._distance_metric()),
        )

    async def upsert(self, points: list[VectorPoint]) -> int:
        if not points:
            return 0
        if self._dimensions == 0:
            await self.initialize(len(points[0].vector))

        from qdrant_client.models import PointStruct

        qdrant_points: list[PointStruct] = []
        for point in points:
            if not point.vector:
                raise ValueError("Vector must not be empty.")
            if len(point.vector) != self._dimensions:
                raise ValueError(f"Vector dimensions mismatch: expected {self._dimensions}, got {len(point.vector)}")
            payload = dict(point.payload or {})
            payload["__ragkit_point_id"] = point.id
            qdrant_points.append(
                PointStruct(
                    id=self._point_id(point.id),
                    vector=[float(value) for value in point.vector],
                    payload=payload,
                )
            )

        self._ensure_client().upsert(collection_name=self.config.collection_name, points=qdrant_points, wait=True)
        return len(points)

    def _scroll(self, query_filter=None, with_vectors: bool = False):
        from qdrant_client.models import Filter

        client = self._ensure_client()
        if not client.collection_exists(self.config.collection_name):
            return []

        all_points = []
        offset = None
        while True:
            points, next_offset = client.scroll(
                collection_name=self.config.collection_name,
                scroll_filter=query_filter if isinstance(query_filter, Filter) else query_filter,
                limit=256,
                offset=offset,
                with_payload=True,
                with_vectors=with_vectors,
            )
            if not points:
                break
            all_points.extend(points)
            if next_offset is None:
                break
            offset = next_offset
        return all_points

    async def delete_by_doc_id(self, doc_id: str) -> int:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        query_filter = Filter(must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))])
        to_delete = self._scroll(query_filter=query_filter, with_vectors=False)
        count = len(to_delete)
        if count:
            self._ensure_client().delete(
                collection_name=self.config.collection_name,
                points_selector=query_filter,
                wait=True,
            )
        return count

    async def delete_collection(self) -> None:
        client = self._ensure_client()
        if client.collection_exists(self.config.collection_name):
            client.delete_collection(self.config.collection_name)
        self._dimensions = 0

    async def collection_stats(self) -> CollectionStats:
        client = self._ensure_client()
        name = self.config.collection_name
        if not client.collection_exists(name):
            return CollectionStats(
                name=name,
                vectors_count=0,
                dimensions=self._dimensions,
                size_bytes=_directory_size(self._root) if self.config.mode.value == "persistent" else 0,
                status="ready",
            )

        info = client.get_collection(name)
        self._dimensions = self._extract_dimensions(info)
        count = int(client.count(collection_name=name, exact=True).count)
        size_bytes = _directory_size(self._root) if self.config.mode.value == "persistent" else 0
        return CollectionStats(
            name=name,
            vectors_count=count,
            dimensions=self._dimensions,
            size_bytes=size_bytes,
            status="ready",
        )

    async def test_connection(self) -> ConnectionTestResult:
        try:
            self._ensure_client()
            return ConnectionTestResult(success=True, status="success", message="Vector store accessible")
        except Exception as exc:
            return ConnectionTestResult(success=False, status="error", message=str(exc))

    async def create_snapshot(self, version: str) -> str:
        snap_root = Path.home() / ".ragkit" / "data" / "snapshots" / version / "qdrant"
        snap_root.mkdir(parents=True, exist_ok=True)
        target = snap_root / f"{self.config.collection_name}.json"
        points = await self.all_points()
        payload = {
            "dimensions": self._dimensions,
            "points": [
                {"id": point.id, "vector": point.vector, "payload": point.payload}
                for point in points
            ],
        }
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return str(target)

    async def restore_snapshot(self, version: str) -> None:
        snapshot_file = Path.home() / ".ragkit" / "data" / "snapshots" / version / "qdrant" / f"{self.config.collection_name}.json"
        if not snapshot_file.exists():
            raise FileNotFoundError(f"Snapshot {version} not found")
        payload = json.loads(snapshot_file.read_text(encoding="utf-8"))
        dimensions = int(payload.get("dimensions") or 0)
        raw_points = payload.get("points", [])

        self._close_client()
        await self.delete_collection()
        points = [
            VectorPoint(id=str(item["id"]), vector=list(item.get("vector", [])), payload=item.get("payload", {}))
            for item in raw_points
        ]
        if not points:
            return
        init_dimensions = dimensions if dimensions > 0 else len(points[0].vector)
        await self.initialize(init_dimensions)
        await self.upsert(points)

    async def search(self, vector: list[float], top_k: int) -> list[tuple[VectorPoint, float]]:
        if not vector:
            raise ValueError("Query vector must not be empty.")
        if self._dimensions and len(vector) != self._dimensions:
            raise ValueError(
                f"Query vector dimensions mismatch: expected {self._dimensions}, got {len(vector)}. "
                "Verify document/query embedding models and dimensions."
            )

        client = self._ensure_client()
        if not client.collection_exists(self.config.collection_name):
            return []

        results = client.search(
            collection_name=self.config.collection_name,
            query_vector=[float(value) for value in vector],
            limit=top_k,
            with_payload=True,
            with_vectors=True,
        )
        hits: list[tuple[VectorPoint, float]] = []
        for hit in results:
            payload = dict(hit.payload or {})
            point_id = str(payload.pop("__ragkit_point_id", hit.id))
            point_vector = [float(value) for value in (hit.vector or [])]
            if self._dimensions == 0 and point_vector:
                self._dimensions = len(point_vector)
            score = float(hit.score)
            if self.config.distance_metric.value == "euclidean":
                score = -score
            hits.append((VectorPoint(id=point_id, vector=point_vector, payload=payload), score))
        return hits

    async def all_points(self) -> list[VectorPoint]:
        points = self._scroll(with_vectors=True)
        result: list[VectorPoint] = []
        for point in points:
            payload = dict(point.payload or {})
            point_id = str(payload.pop("__ragkit_point_id", point.id))
            point_vector = [float(value) for value in (point.vector or [])]
            if self._dimensions == 0 and point_vector:
                self._dimensions = len(point_vector)
            result.append(VectorPoint(id=point_id, vector=point_vector, payload=payload))
        return result


class ChromaVectorStore(BaseVectorStore):
    def __init__(self, config: VectorStoreConfig):
        super().__init__(config)
        self._dimensions = 0
        self._client = None
        self._collection = None

    @property
    def _root(self) -> Path:
        return Path(self.config.path).expanduser()

    def _space(self) -> str:
        mapping = {
            "cosine": "cosine",
            "euclidean": "l2",
            "dot": "ip",
        }
        return mapping[self.config.distance_metric.value]

    def _ensure_client(self):
        if self._client is not None:
            return self._client
        import chromadb

        if self.config.mode.value == "persistent":
            self._root.mkdir(parents=True, exist_ok=True)
            self._client = chromadb.PersistentClient(path=str(self._root))
        else:
            self._client = chromadb.Client()
        return self._client

    def _close_client(self) -> None:
        import gc

        if self._client is None:
            return
        close = getattr(self._client, "close", None)
        if callable(close):
            close()
        try:
            import chromadb

            chromadb.api.client.SharedSystemClient.clear_system_cache()
        except Exception:
            pass
        gc.collect()
        self._client = None
        self._collection = None

    def _ensure_collection(self):
        if self._collection is not None:
            return self._collection
        client = self._ensure_client()
        self._collection = client.get_or_create_collection(
            name=self.config.collection_name,
            metadata={"hnsw:space": self._space()},
        )
        return self._collection

    def _existing_dimension(self) -> int:
        collection = self._ensure_collection()
        sample = collection.get(limit=1, include=["embeddings"])
        embeddings = sample.get("embeddings") or []
        if not embeddings:
            return 0
        first = embeddings[0]
        return len(first or [])

    def _to_chroma_metadata(self, payload: dict, point_id: str) -> dict:
        metadata: dict[str, str | int | float | bool] = {
            "__ragkit_point_id": point_id,
            "__ragkit_payload": json.dumps(payload, ensure_ascii=False),
        }
        # Keep common scalar fields as native metadata for filtering.
        for field in (
            "doc_id",
            "doc_type",
            "doc_language",
            "category",
            "doc_path",
            "doc_title",
            "filename",
            "ingestion_version",
            "page_number",
            "chunk_index",
            "chunk_total",
            "chunk_tokens",
        ):
            value = payload.get(field)
            if isinstance(value, (str, int, float, bool)):
                metadata[field] = value
        return metadata

    def _from_chroma_metadata(self, metadata: dict | None, fallback_id: str, document: str | None) -> tuple[str, dict]:
        metadata = dict(metadata or {})
        point_id = str(metadata.get("__ragkit_point_id", fallback_id))
        payload: dict = {}
        raw_payload = metadata.get("__ragkit_payload")
        if isinstance(raw_payload, str):
            try:
                parsed = json.loads(raw_payload)
                if isinstance(parsed, dict):
                    payload = parsed
            except json.JSONDecodeError:
                payload = {}
        if not payload:
            payload = {key: value for key, value in metadata.items() if not str(key).startswith("__")}
        if "chunk_text" not in payload:
            payload["chunk_text"] = str(document or "")
        return point_id, payload

    async def initialize(self, dimensions: int) -> None:
        if dimensions < 0:
            raise ValueError("Vector dimensions must be >= 0.")

        self._ensure_collection()
        existing = self._existing_dimension()
        if existing:
            self._dimensions = existing
            if dimensions and existing != dimensions:
                raise ValueError(
                    f"Collection dimensions mismatch: existing {existing}, requested {dimensions}. "
                    "Re-ingest the collection after changing embedding dimensions."
                )
            return

        if dimensions <= 0:
            raise ValueError("Vector dimensions must be > 0 for a new collection.")
        self._dimensions = dimensions

    async def upsert(self, points: list[VectorPoint]) -> int:
        if not points:
            return 0
        if self._dimensions == 0:
            await self.initialize(len(points[0].vector))

        ids: list[str] = []
        embeddings: list[list[float]] = []
        metadatas: list[dict] = []
        documents: list[str] = []
        for point in points:
            if not point.vector:
                raise ValueError("Vector must not be empty.")
            if len(point.vector) != self._dimensions:
                raise ValueError(f"Vector dimensions mismatch: expected {self._dimensions}, got {len(point.vector)}")
            payload = dict(point.payload or {})
            ids.append(point.id)
            embeddings.append([float(value) for value in point.vector])
            metadatas.append(self._to_chroma_metadata(payload, point.id))
            documents.append(str(payload.get("chunk_text") or ""))

        self._ensure_collection().upsert(ids=ids, embeddings=embeddings, metadatas=metadatas, documents=documents)
        return len(points)

    async def delete_by_doc_id(self, doc_id: str) -> int:
        collection = self._ensure_collection()
        matches = collection.get(where={"doc_id": doc_id}, include=[])
        ids = [str(value) for value in (matches.get("ids") or [])]
        if ids:
            collection.delete(ids=ids)
        return len(ids)

    async def delete_collection(self) -> None:
        client = self._ensure_client()
        try:
            client.delete_collection(self.config.collection_name)
        except Exception:
            pass
        self._collection = None
        self._dimensions = 0

    async def collection_stats(self) -> CollectionStats:
        collection = self._ensure_collection()
        count = int(collection.count())
        if self._dimensions == 0:
            self._dimensions = self._existing_dimension()
        size_bytes = _directory_size(self._root) if self.config.mode.value == "persistent" else 0
        return CollectionStats(
            name=self.config.collection_name,
            vectors_count=count,
            dimensions=self._dimensions,
            size_bytes=size_bytes,
            status="ready",
        )

    async def test_connection(self) -> ConnectionTestResult:
        try:
            self._ensure_collection()
            return ConnectionTestResult(success=True, status="success", message="Vector store accessible")
        except Exception as exc:
            return ConnectionTestResult(success=False, status="error", message=str(exc))

    async def create_snapshot(self, version: str) -> str:
        snap_root = Path.home() / ".ragkit" / "data" / "snapshots" / version / "chroma"
        snap_root.mkdir(parents=True, exist_ok=True)
        target = snap_root / f"{self.config.collection_name}.json"
        points = await self.all_points()
        payload = {
            "dimensions": self._dimensions,
            "points": [
                {"id": point.id, "vector": point.vector, "payload": point.payload}
                for point in points
            ],
        }
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return str(target)

    async def restore_snapshot(self, version: str) -> None:
        snapshot_file = Path.home() / ".ragkit" / "data" / "snapshots" / version / "chroma" / f"{self.config.collection_name}.json"
        if not snapshot_file.exists():
            raise FileNotFoundError(f"Snapshot {version} not found")
        payload = json.loads(snapshot_file.read_text(encoding="utf-8"))
        dimensions = int(payload.get("dimensions") or 0)
        raw_points = payload.get("points", [])

        self._close_client()
        await self.delete_collection()
        points = [
            VectorPoint(id=str(item["id"]), vector=list(item.get("vector", [])), payload=item.get("payload", {}))
            for item in raw_points
        ]
        if not points:
            return
        init_dimensions = dimensions if dimensions > 0 else len(points[0].vector)
        await self.initialize(init_dimensions)
        await self.upsert(points)

    async def search(self, vector: list[float], top_k: int) -> list[tuple[VectorPoint, float]]:
        if not vector:
            raise ValueError("Query vector must not be empty.")
        if self._dimensions and len(vector) != self._dimensions:
            raise ValueError(
                f"Query vector dimensions mismatch: expected {self._dimensions}, got {len(vector)}. "
                "Verify document/query embedding models and dimensions."
            )

        collection = self._ensure_collection()
        if collection.count() == 0:
            return []

        result = collection.query(
            query_embeddings=[[float(value) for value in vector]],
            n_results=top_k,
            include=["metadatas", "documents", "distances", "embeddings"],
        )
        ids = result.get("ids", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        documents = result.get("documents", [[]])[0]
        distances = result.get("distances", [[]])[0]
        embeddings = result.get("embeddings", [[]])[0]

        hits: list[tuple[VectorPoint, float]] = []
        for index, point_id in enumerate(ids):
            metadata = metadatas[index] if index < len(metadatas) else None
            document = documents[index] if index < len(documents) else None
            decoded_id, payload = self._from_chroma_metadata(metadata, str(point_id), document)
            point_vector = [float(value) for value in (embeddings[index] if index < len(embeddings) else [])]
            if self._dimensions == 0 and point_vector:
                self._dimensions = len(point_vector)

            distance = float(distances[index]) if index < len(distances) else 0.0
            if self.config.distance_metric.value == "cosine":
                score = 1.0 - distance
            elif self.config.distance_metric.value == "euclidean":
                score = -distance
            else:
                score = -distance
            hits.append((VectorPoint(id=decoded_id, vector=point_vector, payload=payload), score))

        hits.sort(key=lambda item: item[1], reverse=True)
        return hits[:top_k]

    async def all_points(self) -> list[VectorPoint]:
        collection = self._ensure_collection()
        result = collection.get(include=["metadatas", "documents", "embeddings"])
        ids = result.get("ids", [])
        metadatas = result.get("metadatas", [])
        documents = result.get("documents", [])
        embeddings = result.get("embeddings", [])

        points: list[VectorPoint] = []
        for index, point_id in enumerate(ids):
            metadata = metadatas[index] if index < len(metadatas) else None
            document = documents[index] if index < len(documents) else None
            decoded_id, payload = self._from_chroma_metadata(metadata, str(point_id), document)
            point_vector = [float(value) for value in (embeddings[index] if index < len(embeddings) else [])]
            if self._dimensions == 0 and point_vector:
                self._dimensions = len(point_vector)
            points.append(VectorPoint(id=decoded_id, vector=point_vector, payload=payload))
        return points


STORE_REGISTRY = {"qdrant": QdrantVectorStore, "chroma": ChromaVectorStore}


def create_vector_store(config: VectorStoreConfig) -> BaseVectorStore:
    return STORE_REGISTRY[config.provider.value](config)
