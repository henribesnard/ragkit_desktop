"""Pydantic schemas for semantic retrieval settings and chat search APIs."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator


class SearchFilters(BaseModel):
    """Metadata filters available in chat and semantic search APIs."""

    doc_ids: list[str] = Field(default_factory=list)
    doc_types: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)

    @field_validator("doc_ids", "doc_types", "languages", "categories")
    @classmethod
    def strip_values(cls, values: list[str]) -> list[str]:
        return [value.strip() for value in values if value and value.strip()]


class SemanticSearchConfig(BaseModel):
    enabled: bool = True
    top_k: int = Field(default=10, ge=1, le=100)
    threshold: float = Field(default=0.0, ge=0.0, le=1.0)
    weight: float = Field(default=1.0, ge=0.0, le=1.0)

    mmr_enabled: bool = False
    mmr_lambda: float = Field(default=0.5, ge=0.0, le=1.0)

    default_filters_enabled: bool = False
    default_filters: SearchFilters = Field(default_factory=SearchFilters)

    prefetch_multiplier: int = Field(default=3, ge=1, le=10)
    debug_default: bool = False

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_fields(cls, data):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        if "similarity_threshold" in normalized and "threshold" not in normalized:
            normalized["threshold"] = normalized["similarity_threshold"]
        if "filters" in normalized and "default_filters" not in normalized:
            normalized["default_filters"] = normalized["filters"]
        return normalized

    @property
    def similarity_threshold(self) -> float:
        # Backward compatibility accessor used by existing UI code.
        return self.threshold


class SearchQuery(BaseModel):
    """Search query from the chat interface."""

    query: str = Field(..., min_length=1, max_length=2000)
    top_k: int | None = Field(default=None, ge=1, le=100)
    threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    filters: SearchFilters | None = None
    mmr_enabled: bool | None = None
    mmr_lambda: float | None = Field(default=None, ge=0.0, le=1.0)
    include_debug: bool = False
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=5, ge=1, le=50)

    @field_validator("query")
    @classmethod
    def validate_query(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Query must not be empty.")
        return cleaned


class SearchResultItem(BaseModel):
    chunk_id: str
    score: float
    text: str
    text_preview: str
    doc_title: str | None = None
    doc_path: str | None = None
    doc_type: str | None = None
    page_number: int | None = None
    chunk_index: int | None = None
    chunk_total: int | None = None
    chunk_tokens: int | None = None
    section_header: str | None = None
    doc_language: str | None = None
    category: str | None = None
    keywords: list[str] = Field(default_factory=list)
    ingestion_version: str | None = None


class SearchDebugInfo(BaseModel):
    query_text: str
    query_tokens: int
    embedding_latency_ms: int
    search_latency_ms: int
    mmr_latency_ms: int
    total_latency_ms: int
    results_from_db: int
    results_after_threshold: int
    results_after_filters: int
    results_after_mmr: int


class SemanticSearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem] = Field(default_factory=list)
    total_results: int
    page: int
    page_size: int
    has_more: bool
    debug: SearchDebugInfo | None = None

