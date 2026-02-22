"""Pydantic schemas for reranking configuration and APIs."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field, model_validator


class RerankProvider(str, Enum):
    NONE = "none"
    COHERE = "cohere"
    LOCAL = "local"


class RerankConfig(BaseModel):
    enabled: bool = False
    provider: RerankProvider = RerankProvider.NONE
    model: str | None = None
    api_key_set: bool = False

    # Selection parameters.
    candidates: int = Field(default=40, ge=5, le=200)
    top_n: int = Field(default=5, ge=1, le=50)
    relevance_threshold: float = Field(default=0.0, ge=0.0, le=1.0)

    # Runtime behavior.
    batch_size: int = Field(default=10, ge=1, le=64)
    timeout: int = Field(default=30, ge=5, le=120)
    max_retries: int = Field(default=2, ge=0, le=10)
    debug_default: bool = False

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_fields(cls, data):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)

        raw_provider = str(normalized.get("provider", "none")).strip().lower()
        aliases = {
            "": RerankProvider.NONE.value,
            "none": RerankProvider.NONE.value,
            "disabled": RerankProvider.NONE.value,
            "cohere": RerankProvider.COHERE.value,
            "local": RerankProvider.LOCAL.value,
            "huggingface": RerankProvider.LOCAL.value,
        }
        normalized["provider"] = aliases.get(raw_provider, raw_provider)

        if normalized["provider"] == RerankProvider.NONE.value:
            normalized["enabled"] = False

        if normalized.get("candidates") is None:
            normalized["candidates"] = 40
        if normalized.get("top_n") is None:
            normalized["top_n"] = 5
        if normalized.get("relevance_threshold") is None:
            normalized["relevance_threshold"] = 0.0
        if normalized.get("batch_size") is None:
            normalized["batch_size"] = 10
        if normalized.get("timeout") is None:
            normalized["timeout"] = 30
        if normalized.get("max_retries") is None:
            normalized["max_retries"] = 2
        if normalized.get("debug_default") is None:
            normalized["debug_default"] = False

        model = normalized.get("model")
        if isinstance(model, str):
            normalized["model"] = model.strip() or None

        return normalized

    @model_validator(mode="after")
    def validate_top_n_vs_candidates(self) -> "RerankConfig":
        if self.top_n > self.candidates:
            raise ValueError(f"top_n ({self.top_n}) must be <= candidates ({self.candidates})")
        if self.enabled and self.provider == RerankProvider.NONE:
            raise ValueError("provider cannot be 'none' when reranking is enabled")
        if self.enabled and self.provider != RerankProvider.NONE and not self.model:
            raise ValueError("model is required when reranking is enabled")
        return self


class RerankCandidateInput(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)

    @model_validator(mode="after")
    def normalize_text(self) -> "RerankCandidateInput":
        self.text = self.text.strip()
        if not self.text:
            raise ValueError("document text cannot be empty")
        return self


class RerankTestQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    documents: list[str] = Field(..., min_length=2, max_length=10)

    @model_validator(mode="after")
    def normalize_payload(self) -> "RerankTestQuery":
        self.query = self.query.strip()
        self.documents = [doc.strip() for doc in self.documents if doc and doc.strip()]
        if not self.query:
            raise ValueError("query must not be empty")
        if len(self.documents) < 2:
            raise ValueError("at least two non-empty documents are required")
        return self


class RerankTestResultItem(BaseModel):
    text: str
    score: float
    rank: int


class RerankTestResult(BaseModel):
    success: bool
    results: list[RerankTestResultItem] = Field(default_factory=list)
    latency_ms: int = 0
    model: str
    error: str | None = None


class RerankModelInfo(BaseModel):
    id: str
    name: str
    provider: RerankProvider
    max_context: int
    languages: str
    quality_rating: int = Field(ge=1, le=5)
    size_mb: int | None = None
    cost_per_1k: str | None = None
    latency_hint: str | None = None


COHERE_RERANK_MODELS: list[RerankModelInfo] = [
    RerankModelInfo(
        id="rerank-v3.5",
        name="Cohere Rerank v3.5",
        provider=RerankProvider.COHERE,
        max_context=4096,
        languages="multilingual",
        quality_rating=5,
        cost_per_1k="~$1 / 1k searches",
        latency_hint="~200-500 ms for 40 docs",
    ),
    RerankModelInfo(
        id="rerank-v3.0",
        name="Cohere Rerank v3.0",
        provider=RerankProvider.COHERE,
        max_context=4096,
        languages="english",
        quality_rating=4,
        cost_per_1k="~$1 / 1k searches",
        latency_hint="~200-500 ms for 40 docs",
    ),
    RerankModelInfo(
        id="rerank-multilingual-v3.0",
        name="Cohere Rerank Multilingual v3.0",
        provider=RerankProvider.COHERE,
        max_context=4096,
        languages="multilingual",
        quality_rating=4,
        cost_per_1k="~$1 / 1k searches",
        latency_hint="~200-500 ms for 40 docs",
    ),
]

LOCAL_RERANK_MODELS: list[RerankModelInfo] = [
    RerankModelInfo(
        id="BAAI/bge-reranker-v2-m3",
        name="BGE Reranker v2 m3",
        provider=RerankProvider.LOCAL,
        max_context=512,
        languages="multilingual",
        quality_rating=4,
        size_mb=600,
        latency_hint="~500-2000 ms CPU, ~100-300 ms GPU",
    ),
    RerankModelInfo(
        id="cross-encoder/ms-marco-MiniLM-L-6-v2",
        name="MS MARCO MiniLM L6 v2",
        provider=RerankProvider.LOCAL,
        max_context=512,
        languages="english",
        quality_rating=3,
        size_mb=90,
        latency_hint="~200-1000 ms CPU",
    ),
]


def default_model_for_provider(provider: RerankProvider) -> str | None:
    if provider == RerankProvider.COHERE:
        return COHERE_RERANK_MODELS[0].id
    if provider == RerankProvider.LOCAL:
        return LOCAL_RERANK_MODELS[0].id
    return None


def model_catalog_for_provider(provider: RerankProvider) -> list[RerankModelInfo]:
    if provider == RerankProvider.COHERE:
        return COHERE_RERANK_MODELS
    if provider == RerankProvider.LOCAL:
        return LOCAL_RERANK_MODELS
    return []
