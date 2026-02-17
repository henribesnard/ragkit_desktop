"""Pydantic schemas for vector store configuration and runtime statistics."""

from __future__ import annotations

from enum import Enum
from pathlib import Path

from pydantic import BaseModel, Field, field_validator

from ragkit.config.retrieval_schema import SearchType


class VectorStoreProvider(str, Enum):
    QDRANT = "qdrant"
    CHROMA = "chroma"


class VectorStoreMode(str, Enum):
    MEMORY = "memory"
    PERSISTENT = "persistent"


class DistanceMetric(str, Enum):
    COSINE = "cosine"
    EUCLIDEAN = "euclidean"
    DOT = "dot"


class HNSWConfig(BaseModel):
    ef_construction: int = Field(default=128, ge=4, le=512)
    m: int = Field(default=16, ge=2, le=64)
    ef_search: int = Field(default=128, ge=1, le=512)


class VectorStoreConfig(BaseModel):
    provider: VectorStoreProvider = VectorStoreProvider.QDRANT
    mode: VectorStoreMode = VectorStoreMode.PERSISTENT
    path: str = "~/.ragkit/data/qdrant"
    collection_name: str = Field(default="ragkit_default", pattern=r"^[a-z0-9_-]{1,63}$")
    distance_metric: DistanceMetric = DistanceMetric.COSINE
    hnsw: HNSWConfig = Field(default_factory=HNSWConfig)
    snapshot_retention: int = Field(default=5, ge=1, le=30)

    @field_validator("path")
    @classmethod
    def expand_path(cls, value: str) -> str:
        return str(Path(value).expanduser())


class CollectionStats(BaseModel):
    name: str
    vectors_count: int = 0
    dimensions: int = 0
    size_bytes: int = 0
    status: str = "ready"


class ConnectionTestResult(BaseModel):
    success: bool
    status: str
    message: str


class IngestionMode(str, Enum):
    MANUAL = "manual"
    AUTOMATIC = "automatic"


class GeneralSettings(BaseModel):
    ingestion_mode: IngestionMode = IngestionMode.MANUAL
    auto_ingestion_delay: int = Field(default=30, ge=5, le=300)
    search_type: SearchType = SearchType.HYBRID
    llm_model: str = "openai/gpt-4o-mini"
    llm_temperature: float = Field(default=0.1, ge=0.0, le=2.0)
    response_language: str = Field(default="auto", pattern=r"^(auto|fr|en)$")
