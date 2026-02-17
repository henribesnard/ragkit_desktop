"""Pydantic schemas for retrieval settings and chat search APIs."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator


class SearchFilters(BaseModel):
    """Metadata filters available in chat search APIs."""

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
    """Semantic search query from the chat interface."""

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


class BM25Algorithm(str, Enum):
    BM25 = "bm25"
    BM25_PLUS = "bm25_plus"


class LexicalLanguage(str, Enum):
    AUTO = "auto"
    FR = "fr"
    EN = "en"


class LexicalSearchConfig(BaseModel):
    """Lexical (BM25) search configuration."""

    enabled: bool = True
    algorithm: BM25Algorithm = BM25Algorithm.BM25
    top_k: int = Field(default=15, ge=1, le=100)
    weight: float = Field(default=0.5, ge=0.0, le=1.0)

    # BM25 parameters.
    bm25_k1: float = Field(default=1.5, ge=0.1, le=3.0)
    bm25_b: float = Field(default=0.75, ge=0.0, le=1.0)
    bm25_delta: float = Field(default=0.5, ge=0.0, le=2.0)

    # Lexical preprocessing.
    lowercase: bool = True
    remove_stopwords: bool = True
    stopwords_lang: LexicalLanguage = LexicalLanguage.AUTO
    stemming: bool = True
    stemmer_lang: LexicalLanguage = LexicalLanguage.AUTO

    # Advanced.
    threshold: float = Field(default=0.0, ge=0.0)
    ngram_range: tuple[int, int] = (1, 1)
    debug_default: bool = False

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_fields(cls, data):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        algorithm = str(normalized.get("algorithm", "bm25")).strip().lower()
        if algorithm in {"bm25+", "bm25plus"}:
            normalized["algorithm"] = "bm25_plus"
        elif algorithm:
            normalized["algorithm"] = algorithm
        if "min_score" in normalized and "threshold" not in normalized:
            normalized["threshold"] = normalized["min_score"]
        return normalized

    @field_validator("stopwords_lang", "stemmer_lang", mode="before")
    @classmethod
    def normalize_language(cls, value: object) -> str:
        if value is None:
            return LexicalLanguage.AUTO.value
        raw = str(value).strip().lower()
        aliases = {
            "auto": LexicalLanguage.AUTO.value,
            "fr": LexicalLanguage.FR.value,
            "fra": LexicalLanguage.FR.value,
            "fre": LexicalLanguage.FR.value,
            "french": LexicalLanguage.FR.value,
            "en": LexicalLanguage.EN.value,
            "eng": LexicalLanguage.EN.value,
            "english": LexicalLanguage.EN.value,
        }
        if raw not in aliases:
            raise ValueError("Language must be one of: auto, fr, en.")
        return aliases[raw]

    @field_validator("ngram_range", mode="before")
    @classmethod
    def normalize_ngram_range(cls, value: object) -> tuple[int, int]:
        if isinstance(value, list):
            value = tuple(value)
        if not isinstance(value, tuple) or len(value) != 2:
            raise ValueError("ngram_range must be a tuple/list with exactly two integers.")
        min_n = int(value[0])
        max_n = int(value[1])
        if min_n < 1 or max_n < 1:
            raise ValueError("ngram_range values must be >= 1.")
        if min_n > max_n:
            raise ValueError("ngram_range[0] must be <= ngram_range[1].")
        if max_n > 3:
            raise ValueError("ngram_range maximum is 3 for desktop BM25.")
        return (min_n, max_n)


class LexicalSearchQuery(BaseModel):
    """Lexical search query from the chat interface."""

    query: str = Field(..., min_length=1, max_length=2000)
    top_k: int | None = Field(default=None, ge=1, le=100)
    threshold: float | None = Field(default=None, ge=0.0)
    filters: SearchFilters | None = None
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


class HighlightPosition(BaseModel):
    start: int = Field(..., ge=0)
    end: int = Field(..., ge=1)
    term: str

    @model_validator(mode="after")
    def validate_bounds(self):
        if self.end <= self.start:
            raise ValueError("Highlight position end must be strictly greater than start.")
        return self


class LexicalSearchResultItem(BaseModel):
    chunk_id: str
    score: float
    text: str
    text_preview: str
    matched_terms: dict[str, int] = Field(default_factory=dict)
    highlight_positions: list[HighlightPosition] = Field(default_factory=list)
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


class LexicalDebugInfo(BaseModel):
    query_text: str
    query_tokens: list[str] = Field(default_factory=list)
    tokenization_latency_ms: int
    search_latency_ms: int
    total_latency_ms: int
    results_from_index: int
    results_after_threshold: int
    index_stats: dict[str, int]


class LexicalSearchResponseAPI(BaseModel):
    query: str
    results: list[LexicalSearchResultItem] = Field(default_factory=list)
    total_results: int
    page: int
    page_size: int
    has_more: bool
    debug: LexicalDebugInfo | None = None


class BM25IndexStats(BaseModel):
    num_documents: int = 0
    num_unique_terms: int = 0
    size_bytes: int = 0
    last_updated_version: str | None = None
    last_updated_at: str | None = None


class FusionMethod(str, Enum):
    RRF = "rrf"
    WEIGHTED_SUM = "weighted_sum"


class NormalizationMethod(str, Enum):
    MIN_MAX = "min_max"
    Z_SCORE = "z_score"


class SearchType(str, Enum):
    SEMANTIC = "semantic"
    LEXICAL = "lexical"
    HYBRID = "hybrid"


class HybridSearchConfig(BaseModel):
    """Hybrid search (semantic + lexical fusion) configuration."""

    alpha: float = Field(default=0.5, ge=0.0, le=1.0)
    fusion_method: FusionMethod = FusionMethod.RRF

    # RRF.
    rrf_k: int = Field(default=60, ge=1, le=200)

    # Weighted sum.
    normalize_scores: bool = True
    normalization_method: NormalizationMethod = NormalizationMethod.MIN_MAX

    # Advanced.
    top_k: int = Field(default=10, ge=1, le=100)
    threshold: float = Field(default=0.0, ge=0.0)
    deduplicate: bool = True
    debug_default: bool = False

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_fields(cls, data):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        method = str(normalized.get("fusion_method", "rrf")).strip().lower()
        aliases = {
            "rrf": FusionMethod.RRF.value,
            "weighted_sum": FusionMethod.WEIGHTED_SUM.value,
            "weighted": FusionMethod.WEIGHTED_SUM.value,
            "ws": FusionMethod.WEIGHTED_SUM.value,
            "sum": FusionMethod.WEIGHTED_SUM.value,
        }
        if method in aliases:
            normalized["fusion_method"] = aliases[method]
        if "min_score" in normalized and "threshold" not in normalized:
            normalized["threshold"] = normalized["min_score"]
        norm_method = str(normalized.get("normalization_method", "min_max")).strip().lower()
        norm_aliases = {
            "min_max": NormalizationMethod.MIN_MAX.value,
            "minmax": NormalizationMethod.MIN_MAX.value,
            "z_score": NormalizationMethod.Z_SCORE.value,
            "zscore": NormalizationMethod.Z_SCORE.value,
        }
        if norm_method in norm_aliases:
            normalized["normalization_method"] = norm_aliases[norm_method]
        return normalized


class UnifiedSearchQuery(BaseModel):
    """Unified search query dispatched to semantic, lexical, or hybrid engine."""

    query: str = Field(..., min_length=1, max_length=2000)
    search_type: SearchType | None = None
    alpha: float | None = Field(default=None, ge=0.0, le=1.0)
    top_k: int | None = Field(default=None, ge=1, le=100)
    threshold: float | None = Field(default=None, ge=0.0)
    filters: SearchFilters | None = None
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


class UnifiedSearchResultItem(BaseModel):
    chunk_id: str
    score: float
    text: str
    text_preview: str

    # Provenance for hybrid mode.
    semantic_rank: int | None = None
    semantic_score: float | None = None
    lexical_rank: int | None = None
    lexical_score: float | None = None
    matched_terms: dict[str, int] | None = None

    # Reranking metadata.
    rerank_score: float | None = None
    original_rank: int | None = None
    original_score: float | None = None
    rank_change: int | None = None
    is_reranked: bool = False

    # Common metadata.
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


class UnifiedSearchResponse(BaseModel):
    query: str
    search_type: SearchType
    results: list[UnifiedSearchResultItem] = Field(default_factory=list)
    total_results: int
    page: int
    page_size: int
    has_more: bool
    debug: dict[str, object] | None = None
