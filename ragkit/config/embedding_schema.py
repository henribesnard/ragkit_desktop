"""Pydantic schemas for embedding configuration and APIs."""

from __future__ import annotations

from enum import Enum
from pydantic import BaseModel, Field, model_validator


class EmbeddingProvider(str, Enum):
    OPENAI = "openai"
    OLLAMA = "ollama"
    HUGGINGFACE = "huggingface"
    COHERE = "cohere"
    VOYAGEAI = "voyageai"
    MISTRAL = "mistral"


class CacheBackend(str, Enum):
    MEMORY = "memory"
    DISK = "disk"


class TruncationStrategy(str, Enum):
    START = "start"
    END = "end"
    MIDDLE = "middle"


class QueryModelConfig(BaseModel):
    same_as_document: bool = True
    provider: EmbeddingProvider | None = None
    model: str | None = None


class EmbeddingConfig(BaseModel):
    provider: EmbeddingProvider = EmbeddingProvider.HUGGINGFACE
    model: str = "intfloat/multilingual-e5-large"
    api_key_set: bool = False

    query_model: QueryModelConfig = Field(default_factory=QueryModelConfig)

    dimensions: int | None = Field(default=None, ge=64, le=4096)
    batch_size: int = Field(default=100, ge=1, le=2048)
    normalize: bool = True

    cache_enabled: bool = True
    cache_backend: CacheBackend = CacheBackend.DISK

    timeout: int = Field(default=30, ge=5, le=120)
    max_retries: int = Field(default=3, ge=0, le=10)
    rate_limit_rpm: int = Field(default=3000, ge=0, le=10000)
    truncation: TruncationStrategy = TruncationStrategy.END

    @model_validator(mode="after")
    def validate_query_model(self) -> "EmbeddingConfig":
        if not self.query_model.same_as_document:
            if self.query_model.provider is None or not self.query_model.model:
                raise ValueError("query_model.provider and query_model.model are required when same_as_document is false")
        return self


class ModelInfo(BaseModel):
    provider: EmbeddingProvider
    id: str
    display_name: str
    dimensions_default: int
    dimensions_supported: list[int] = Field(default_factory=list)
    max_input_tokens: int | None = None
    pricing_hint: str | None = None
    languages: str = "multilingue"
    description: str
    local: bool = False


class ConnectionTestResult(BaseModel):
    success: bool
    status: str
    message: str
    latency_ms: int | None = None
    dimensions: int | None = None


class EmbeddingTestRequest(BaseModel):
    text_a: str
    text_b: str


class EmbeddingTestResult(BaseModel):
    dimensions: int
    tokens_a: int
    tokens_b: int
    latency_ms_a: int
    latency_ms_b: int
    cosine_similarity: float


class EnvironmentInfo(BaseModel):
    gpu_available: bool
    gpu_name: str | None = None
    gpu_backend: str | None = None
    ollama_available: bool
    ollama_version: str | None = None
    ollama_models: list[str] = Field(default_factory=list)
    local_cached_models: list[str] = Field(default_factory=list)
    keyring_available: bool


class CacheStats(BaseModel):
    entries: int
    size_mb: float
    backend: str
    model_id: str | None = None
