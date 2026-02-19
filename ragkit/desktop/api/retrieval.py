from __future__ import annotations

import asyncio
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ragkit.chunking.tokenizer import TokenCounter
from ragkit.config.rerank_schema import RerankConfig, RerankProvider
from ragkit.config.embedding_schema import EmbeddingConfig
from ragkit.config.retrieval_schema import (
    BM25IndexStats,
    HybridSearchConfig,
    LexicalDebugInfo,
    LexicalSearchConfig,
    LexicalSearchQuery,
    LexicalSearchResponseAPI,
    LexicalSearchResultItem,
    SearchDebugInfo,
    SearchFilters,
    SearchQuery,
    SearchResultItem,
    SearchType,
    SemanticSearchConfig,
    SemanticSearchResponse,
    UnifiedSearchQuery,
    UnifiedSearchResponse,
    UnifiedSearchResultItem,
)
from ragkit.config.vector_store_schema import GeneralSettings, VectorStoreConfig
from ragkit.desktop.profiles import build_full_config
from ragkit.desktop.rerank_service import get_rerank_config, resolve_reranker
from ragkit.desktop.settings_store import get_data_dir, load_settings, save_settings
from ragkit.embedding.engine import EmbeddingEngine, cosine_similarity
from ragkit.retrieval import BM25Index, LexicalSearchEngine
from ragkit.retrieval.hybrid_engine import HybridSearchEngine
from ragkit.retrieval.reranker.base import RerankCandidate
from ragkit.retrieval.search_router import SearchRouter
from ragkit.storage.base import VectorPoint, create_vector_store

router = APIRouter(prefix="/api", tags=["retrieval"])

_LEXICAL_INDEX: BM25Index | None = None
_LEXICAL_INDEX_MTIME: float | None = None
_LEXICAL_INDEX_FILE = "bm25_index.json"
_TEXT_PREVIEW_SIZE = 300


@dataclass
class _RankedPoint:
    point: VectorPoint
    raw_score: float
    normalized_score: float


@dataclass
class _HybridSourceCandidate:
    chunk_id: str
    score: float
    text: str
    metadata: dict[str, Any]
    matched_terms: dict[str, int]
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
    keywords: list[str] | None = None
    ingestion_version: str | None = None


def _profile_retrieval_payload() -> dict[str, Any]:
    settings = load_settings()
    profile_name = settings.profile or "general"
    full_config = build_full_config(profile_name, settings.calibration_answers)
    retrieval_payload = full_config.get("retrieval", {})
    if isinstance(retrieval_payload, dict):
        return retrieval_payload
    return {}


def _default_search_type_from_profile() -> SearchType:
    retrieval_payload = _profile_retrieval_payload()
    architecture = str(retrieval_payload.get("architecture") or "").strip().lower()
    semantic_payload = retrieval_payload.get("semantic", {}) if isinstance(retrieval_payload, dict) else {}
    lexical_payload = retrieval_payload.get("lexical", {}) if isinstance(retrieval_payload, dict) else {}

    semantic_enabled = bool(
        semantic_payload.get("enabled", True) if isinstance(semantic_payload, dict) else True
    )
    lexical_enabled = bool(
        lexical_payload.get("enabled", True) if isinstance(lexical_payload, dict) else True
    )

    if not semantic_enabled and lexical_enabled:
        return SearchType.LEXICAL
    if not lexical_enabled and semantic_enabled:
        return SearchType.SEMANTIC
    if architecture == "semantic":
        return SearchType.SEMANTIC
    if architecture == "lexical":
        return SearchType.LEXICAL
    return SearchType.HYBRID


def _resolve_general_settings() -> GeneralSettings:
    settings = load_settings()
    payload = settings.general if isinstance(settings.general, dict) else {}
    if payload:
        try:
            return GeneralSettings.model_validate(payload)
        except Exception:
            pass
    return GeneralSettings(search_type=_default_search_type_from_profile())


def _default_semantic_config() -> SemanticSearchConfig:
    retrieval_payload = _profile_retrieval_payload()
    semantic_payload = retrieval_payload.get("semantic", {}) if isinstance(retrieval_payload, dict) else {}
    return SemanticSearchConfig.model_validate(semantic_payload)


def _default_lexical_config() -> LexicalSearchConfig:
    retrieval_payload = _profile_retrieval_payload()
    lexical_payload = retrieval_payload.get("lexical", {}) if isinstance(retrieval_payload, dict) else {}
    return LexicalSearchConfig.model_validate(lexical_payload)


def _default_hybrid_config() -> HybridSearchConfig:
    retrieval_payload = _profile_retrieval_payload()
    hybrid_payload = retrieval_payload.get("hybrid", {}) if isinstance(retrieval_payload, dict) else {}
    return HybridSearchConfig.model_validate(hybrid_payload)


def _get_semantic_config() -> SemanticSearchConfig:
    settings = load_settings()
    retrieval_payload = settings.retrieval if isinstance(settings.retrieval, dict) else {}
    semantic_payload = retrieval_payload.get("semantic", {}) if isinstance(retrieval_payload, dict) else {}
    if semantic_payload:
        return SemanticSearchConfig.model_validate(semantic_payload)
    return _default_semantic_config()


def _get_lexical_config() -> LexicalSearchConfig:
    settings = load_settings()
    retrieval_payload = settings.retrieval if isinstance(settings.retrieval, dict) else {}
    lexical_payload = retrieval_payload.get("lexical", {}) if isinstance(retrieval_payload, dict) else {}
    if lexical_payload:
        return LexicalSearchConfig.model_validate(lexical_payload)
    return _default_lexical_config()


def _get_hybrid_config() -> HybridSearchConfig:
    settings = load_settings()
    retrieval_payload = settings.retrieval if isinstance(settings.retrieval, dict) else {}
    hybrid_payload = retrieval_payload.get("hybrid", {}) if isinstance(retrieval_payload, dict) else {}
    if hybrid_payload:
        return HybridSearchConfig.model_validate(hybrid_payload)
    return _default_hybrid_config()


def _save_semantic_config(config: SemanticSearchConfig) -> SemanticSearchConfig:
    settings = load_settings()
    retrieval_payload = settings.retrieval if isinstance(settings.retrieval, dict) else {}
    retrieval_payload["semantic"] = config.model_dump(mode="json")
    settings.retrieval = retrieval_payload
    save_settings(settings)
    return config


def _save_lexical_config(config: LexicalSearchConfig) -> LexicalSearchConfig:
    settings = load_settings()
    retrieval_payload = settings.retrieval if isinstance(settings.retrieval, dict) else {}
    retrieval_payload["lexical"] = config.model_dump(mode="json")
    settings.retrieval = retrieval_payload
    save_settings(settings)
    if _LEXICAL_INDEX is not None:
        _LEXICAL_INDEX.configure_preprocessor(config)
    return config


def _save_hybrid_config(config: HybridSearchConfig) -> HybridSearchConfig:
    settings = load_settings()
    retrieval_payload = settings.retrieval if isinstance(settings.retrieval, dict) else {}
    retrieval_payload["hybrid"] = config.model_dump(mode="json")
    settings.retrieval = retrieval_payload
    save_settings(settings)
    return config


def _merge_filters(default_filters: SearchFilters, runtime_filters: SearchFilters | None) -> SearchFilters:
    if runtime_filters is None:
        return default_filters

    def merge_values(default_values: list[str], runtime_values: list[str]) -> list[str]:
        if default_values and runtime_values:
            default_set = set(default_values)
            return [value for value in runtime_values if value in default_set]
        if runtime_values:
            return runtime_values
        return default_values

    return SearchFilters(
        doc_ids=merge_values(default_filters.doc_ids, runtime_filters.doc_ids),
        doc_types=merge_values(default_filters.doc_types, runtime_filters.doc_types),
        languages=merge_values(default_filters.languages, runtime_filters.languages),
        categories=merge_values(default_filters.categories, runtime_filters.categories),
    )


def _payload_value(payload: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = payload.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def _match_filters(point_payload: dict[str, Any], filters: SearchFilters) -> bool:
    if filters.doc_ids:
        doc_id = _payload_value(point_payload, ("doc_id",))
        if doc_id not in set(filters.doc_ids):
            return False

    if filters.doc_types:
        doc_type = _payload_value(point_payload, ("doc_type", "file_type"))
        if doc_type not in set(filters.doc_types):
            return False

    if filters.languages:
        language = _payload_value(point_payload, ("doc_language", "language"))
        if language not in set(filters.languages):
            return False

    if filters.categories:
        category = _payload_value(point_payload, ("category",))
        if category not in set(filters.categories):
            return False

    return True


def _normalize_semantic_score(score: float) -> float:
    return max(0.0, min(1.0, (score + 1.0) / 2.0))


def _text_preview(text: str) -> str:
    return text[:_TEXT_PREVIEW_SIZE] + ("..." if len(text) > _TEXT_PREVIEW_SIZE else "")


def _apply_mmr(candidates: list[_RankedPoint], top_k: int, mmr_lambda: float) -> list[_RankedPoint]:
    if top_k <= 0 or not candidates:
        return []

    remaining = list(candidates)
    selected: list[_RankedPoint] = []

    while remaining and len(selected) < top_k:
        if not selected:
            best = max(remaining, key=lambda item: item.raw_score)
        else:

            def mmr_score(item: _RankedPoint) -> float:
                max_similarity = max(
                    cosine_similarity(item.point.vector, chosen.point.vector) for chosen in selected
                )
                return (mmr_lambda * item.raw_score) - ((1.0 - mmr_lambda) * max_similarity)

            best = max(remaining, key=mmr_score)

        selected.append(best)
        remaining = [item for item in remaining if item.point.id != best.point.id]

    return selected

def _to_semantic_result_item(item: _RankedPoint) -> SearchResultItem:
    payload = item.point.payload or {}
    text = str(payload.get("chunk_text") or "")
    raw_keywords = payload.get("keywords", [])
    keywords = [str(value).strip() for value in raw_keywords] if isinstance(raw_keywords, list) else []

    return SearchResultItem(
        chunk_id=item.point.id,
        score=round(item.normalized_score, 4),
        text=text,
        text_preview=_text_preview(text),
        doc_title=_payload_value(payload, ("doc_title", "document_title", "filename")),
        doc_path=_payload_value(payload, ("doc_path", "source")),
        doc_type=_payload_value(payload, ("doc_type", "file_type")),
        page_number=payload.get("page_number") or payload.get("page"),
        chunk_index=payload.get("chunk_index"),
        chunk_total=payload.get("chunk_total"),
        chunk_tokens=payload.get("chunk_tokens"),
        section_header=_payload_value(payload, ("section_header",)),
        doc_language=_payload_value(payload, ("doc_language", "language")),
        category=_payload_value(payload, ("category",)),
        keywords=keywords,
        ingestion_version=_payload_value(payload, ("ingestion_version",)),
    )


def _build_highlight_positions(text: str, matched_terms: dict[str, int]) -> list[dict[str, Any]]:
    if not text or not matched_terms:
        return []

    positions: list[dict[str, Any]] = []
    seen: set[tuple[int, int]] = set()
    for term in matched_terms.keys():
        normalized = str(term).strip()
        if not normalized:
            continue
        pattern = re.compile(rf"\b{re.escape(normalized)}\w*\b", flags=re.IGNORECASE)
        for match in pattern.finditer(text):
            key = (match.start(), match.end())
            if key in seen:
                continue
            seen.add(key)
            positions.append({"start": match.start(), "end": match.end(), "term": normalized})

    positions.sort(key=lambda item: (int(item["start"]), int(item["end"])))
    return positions


def _to_lexical_result_item(item: Any) -> LexicalSearchResultItem:
    text = str(getattr(item, "text", "") or "")
    matched_terms = dict(getattr(item, "matched_terms", {}) or {})
    keywords_raw = getattr(item, "keywords", [])
    keywords = [str(value) for value in keywords_raw] if isinstance(keywords_raw, list) else []

    return LexicalSearchResultItem(
        chunk_id=str(getattr(item, "chunk_id", "")),
        score=float(getattr(item, "score", 0.0)),
        text=text,
        text_preview=_text_preview(text),
        matched_terms=matched_terms,
        highlight_positions=_build_highlight_positions(text, matched_terms),
        doc_title=getattr(item, "doc_title", None),
        doc_path=getattr(item, "doc_path", None),
        doc_type=getattr(item, "doc_type", None),
        page_number=getattr(item, "page_number", None),
        chunk_index=getattr(item, "chunk_index", None),
        chunk_total=getattr(item, "chunk_total", None),
        chunk_tokens=getattr(item, "chunk_tokens", None),
        section_header=getattr(item, "section_header", None),
        doc_language=getattr(item, "doc_language", None),
        category=getattr(item, "category", None),
        keywords=keywords,
        ingestion_version=getattr(item, "ingestion_version", None),
    )


def _hybrid_candidate_from_semantic(item: SearchResultItem) -> _HybridSourceCandidate:
    metadata = {
        "doc_title": item.doc_title,
        "doc_path": item.doc_path,
        "doc_type": item.doc_type,
        "page_number": item.page_number,
        "chunk_index": item.chunk_index,
        "chunk_total": item.chunk_total,
        "chunk_tokens": item.chunk_tokens,
        "section_header": item.section_header,
        "doc_language": item.doc_language,
        "category": item.category,
        "keywords": list(item.keywords),
        "ingestion_version": item.ingestion_version,
    }
    return _HybridSourceCandidate(
        chunk_id=item.chunk_id,
        score=float(item.score),
        text=item.text,
        metadata=metadata,
        matched_terms={},
        doc_title=item.doc_title,
        doc_path=item.doc_path,
        doc_type=item.doc_type,
        page_number=item.page_number,
        chunk_index=item.chunk_index,
        chunk_total=item.chunk_total,
        chunk_tokens=item.chunk_tokens,
        section_header=item.section_header,
        doc_language=item.doc_language,
        category=item.category,
        keywords=list(item.keywords),
        ingestion_version=item.ingestion_version,
    )


def _hybrid_candidate_from_lexical(item: LexicalSearchResultItem) -> _HybridSourceCandidate:
    metadata = {
        "doc_title": item.doc_title,
        "doc_path": item.doc_path,
        "doc_type": item.doc_type,
        "page_number": item.page_number,
        "chunk_index": item.chunk_index,
        "chunk_total": item.chunk_total,
        "chunk_tokens": item.chunk_tokens,
        "section_header": item.section_header,
        "doc_language": item.doc_language,
        "category": item.category,
        "keywords": list(item.keywords),
        "ingestion_version": item.ingestion_version,
    }
    return _HybridSourceCandidate(
        chunk_id=item.chunk_id,
        score=float(item.score),
        text=item.text,
        metadata=metadata,
        matched_terms=dict(item.matched_terms),
        doc_title=item.doc_title,
        doc_path=item.doc_path,
        doc_type=item.doc_type,
        page_number=item.page_number,
        chunk_index=item.chunk_index,
        chunk_total=item.chunk_total,
        chunk_tokens=item.chunk_tokens,
        section_header=item.section_header,
        doc_language=item.doc_language,
        category=item.category,
        keywords=list(item.keywords),
        ingestion_version=item.ingestion_version,
    )


def _hybrid_result_to_unified(item: Any) -> UnifiedSearchResultItem:
    text = str(getattr(item, "text", "") or "")
    keywords_raw = getattr(item, "keywords", [])
    keywords = [str(value) for value in keywords_raw] if isinstance(keywords_raw, list) else []
    matched_terms = dict(getattr(item, "matched_terms", {}) or {})
    return UnifiedSearchResultItem(
        chunk_id=str(getattr(item, "chunk_id", "")),
        score=float(getattr(item, "score", 0.0)),
        text=text,
        text_preview=_text_preview(text),
        semantic_rank=getattr(item, "semantic_rank", None),
        semantic_score=getattr(item, "semantic_score", None),
        lexical_rank=getattr(item, "lexical_rank", None),
        lexical_score=getattr(item, "lexical_score", None),
        matched_terms=matched_terms or None,
        doc_title=getattr(item, "doc_title", None),
        doc_path=getattr(item, "doc_path", None),
        doc_type=getattr(item, "doc_type", None),
        page_number=getattr(item, "page_number", None),
        chunk_index=getattr(item, "chunk_index", None),
        chunk_total=getattr(item, "chunk_total", None),
        chunk_tokens=getattr(item, "chunk_tokens", None),
        section_header=getattr(item, "section_header", None),
        doc_language=getattr(item, "doc_language", None),
        category=getattr(item, "category", None),
        keywords=keywords,
        ingestion_version=getattr(item, "ingestion_version", None),
    )


def _semantic_item_to_unified(item: SearchResultItem) -> UnifiedSearchResultItem:
    return UnifiedSearchResultItem(
        chunk_id=item.chunk_id,
        score=item.score,
        text=item.text,
        text_preview=item.text_preview,
        doc_title=item.doc_title,
        doc_path=item.doc_path,
        doc_type=item.doc_type,
        page_number=item.page_number,
        chunk_index=item.chunk_index,
        chunk_total=item.chunk_total,
        chunk_tokens=item.chunk_tokens,
        section_header=item.section_header,
        doc_language=item.doc_language,
        category=item.category,
        keywords=item.keywords,
        ingestion_version=item.ingestion_version,
    )


def _lexical_item_to_unified(item: LexicalSearchResultItem) -> UnifiedSearchResultItem:
    return UnifiedSearchResultItem(
        chunk_id=item.chunk_id,
        score=item.score,
        text=item.text,
        text_preview=item.text_preview,
        matched_terms=item.matched_terms,
        doc_title=item.doc_title,
        doc_path=item.doc_path,
        doc_type=item.doc_type,
        page_number=item.page_number,
        chunk_index=item.chunk_index,
        chunk_total=item.chunk_total,
        chunk_tokens=item.chunk_tokens,
        section_header=item.section_header,
        doc_language=item.doc_language,
        category=item.category,
        keywords=item.keywords,
        ingestion_version=item.ingestion_version,
    )


def _unified_item_metadata(item: UnifiedSearchResultItem) -> dict[str, Any]:
    return {
        "semantic_rank": item.semantic_rank,
        "semantic_score": item.semantic_score,
        "lexical_rank": item.lexical_rank,
        "lexical_score": item.lexical_score,
        "matched_terms": dict(item.matched_terms or {}),
        "doc_title": item.doc_title,
        "doc_path": item.doc_path,
        "doc_type": item.doc_type,
        "page_number": item.page_number,
        "chunk_index": item.chunk_index,
        "chunk_total": item.chunk_total,
        "chunk_tokens": item.chunk_tokens,
        "section_header": item.section_header,
        "doc_language": item.doc_language,
        "category": item.category,
        "keywords": list(item.keywords),
        "ingestion_version": item.ingestion_version,
    }


async def _rerank_unified_results(
    *,
    query: str,
    results: list[UnifiedSearchResultItem],
    rerank_config: RerankConfig,
    candidates_limit: int,
    top_n: int,
    relevance_threshold: float,
) -> tuple[list[UnifiedSearchResultItem], list[dict[str, Any]], list[dict[str, Any]], int]:
    if not results:
        return [], [], [], 0

    reranker = resolve_reranker(rerank_config)
    if reranker is None:
        return results, [], [], 0

    selected = list(results[: max(candidates_limit, 0)])
    if not selected:
        return [], [], [], 0

    before = [
        {
            "chunk_id": item.chunk_id,
            "rank": index + 1,
            "score": item.score,
        }
        for index, item in enumerate(selected)
    ]

    candidates = [
        RerankCandidate(
            chunk_id=item.chunk_id,
            text=item.text,
            original_rank=index + 1,
            original_score=item.score,
            metadata=_unified_item_metadata(item),
        )
        for index, item in enumerate(selected)
    ]

    rerank_started = time.perf_counter()
    reranked = await reranker.rerank(
        query=query,
        candidates=candidates,
        top_n=min(max(top_n, 1), len(candidates)),
        relevance_threshold=relevance_threshold,
    )
    reranking_latency_ms = max(1, int((time.perf_counter() - rerank_started) * 1000))

    selected_map = {item.chunk_id: item for item in selected}
    reranked_items: list[UnifiedSearchResultItem] = []
    for result in reranked:
        source = selected_map.get(result.chunk_id)
        if source is None:
            continue
        item = source.model_copy(deep=True)
        item.score = result.rerank_score
        item.rerank_score = result.rerank_score
        item.original_rank = result.original_rank
        item.original_score = result.original_score
        item.rank_change = result.rank_change
        item.is_reranked = True
        reranked_items.append(item)

    after = [
        {
            "chunk_id": item.chunk_id,
            "rank": index + 1,
            "score": item.rerank_score,
            "original_rank": item.original_rank,
            "rank_change": item.rank_change,
        }
        for index, item in enumerate(reranked_items)
    ]

    return reranked_items, before, after, reranking_latency_ms


def _bm25_index_dir() -> Path:
    return get_data_dir() / "bm25_index"


def _bm25_index_path() -> Path:
    return _bm25_index_dir() / _LEXICAL_INDEX_FILE


def _bm25_index_mtime() -> float | None:
    path = _bm25_index_path()
    if not path.exists():
        return None
    return path.stat().st_mtime


def _load_or_create_lexical_index(config: LexicalSearchConfig) -> BM25Index:
    global _LEXICAL_INDEX, _LEXICAL_INDEX_MTIME

    current_mtime = _bm25_index_mtime()
    needs_reload = _LEXICAL_INDEX is None or _LEXICAL_INDEX_MTIME != current_mtime
    if needs_reload:
        index = BM25Index(config)
        index.load(_bm25_index_dir())
        _LEXICAL_INDEX = index
        _LEXICAL_INDEX_MTIME = current_mtime
    else:
        _LEXICAL_INDEX.configure_preprocessor(config)
    return _LEXICAL_INDEX


def _set_lexical_index(index: BM25Index) -> None:
    global _LEXICAL_INDEX, _LEXICAL_INDEX_MTIME
    _LEXICAL_INDEX = index
    _LEXICAL_INDEX_MTIME = _bm25_index_mtime()

async def _execute_semantic_search(payload: SearchQuery) -> SemanticSearchResponse:
    total_started = time.perf_counter()
    config = _get_semantic_config()
    if not config.enabled:
        raise HTTPException(status_code=400, detail="Semantic search is disabled in settings.")

    settings = load_settings()
    embed_cfg = EmbeddingConfig.model_validate(settings.embedding or {})
    query_embed_cfg = embed_cfg.model_copy(deep=True)
    if not embed_cfg.query_model.same_as_document:
        if embed_cfg.query_model.provider:
            query_embed_cfg.provider = embed_cfg.query_model.provider
        if embed_cfg.query_model.model:
            query_embed_cfg.model = embed_cfg.query_model.model
    vec_cfg = VectorStoreConfig.model_validate(settings.vector_store or {})

    top_k = payload.top_k or config.top_k
    threshold = config.threshold if payload.threshold is None else payload.threshold
    mmr_enabled = config.mmr_enabled if payload.mmr_enabled is None else payload.mmr_enabled
    mmr_lambda = config.mmr_lambda if payload.mmr_lambda is None else payload.mmr_lambda
    include_debug = payload.include_debug or config.debug_default
    page = payload.page
    page_size = payload.page_size
    candidate_count = max(top_k * max(config.prefetch_multiplier, 1), top_k)

    embedding_started = time.perf_counter()
    embedder = EmbeddingEngine(query_embed_cfg)
    embed_output = embedder.embed_text(payload.query)
    embedding_latency_ms = max(1, int((time.perf_counter() - embedding_started) * 1000))

    store = create_vector_store(vec_cfg)
    query_dims = len(embed_output.vector)
    try:
        await store.initialize(query_dims)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    search_started = time.perf_counter()
    try:
        raw_results = await store.search(embed_output.vector, candidate_count)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    search_latency_ms = max(1, int((time.perf_counter() - search_started) * 1000))

    ranked = [
        _RankedPoint(
            point=point,
            raw_score=score,
            normalized_score=_normalize_semantic_score(score),
        )
        for point, score in raw_results
    ]
    results_from_db = len(ranked)

    thresholded = [item for item in ranked if item.normalized_score >= threshold]
    results_after_threshold = len(thresholded)

    effective_filters = payload.filters or SearchFilters()
    if config.default_filters_enabled:
        effective_filters = _merge_filters(config.default_filters, payload.filters)

    filtered = [item for item in thresholded if _match_filters(item.point.payload or {}, effective_filters)]
    results_after_filters = len(filtered)

    mmr_latency_ms = 0
    if mmr_enabled:
        mmr_started = time.perf_counter()
        selected = _apply_mmr(filtered, top_k=top_k, mmr_lambda=mmr_lambda)
        mmr_latency_ms = max(1, int((time.perf_counter() - mmr_started) * 1000))
    else:
        selected = filtered[:top_k]
    results_after_mmr = len(selected)

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paged_results = selected[start_idx:end_idx]
    has_more = end_idx < len(selected)

    debug = None
    if include_debug:
        total_latency_ms = max(1, int((time.perf_counter() - total_started) * 1000))
        debug = SearchDebugInfo(
            query_text=payload.query,
            query_tokens=TokenCounter().count(payload.query),
            embedding_latency_ms=embedding_latency_ms,
            search_latency_ms=search_latency_ms,
            mmr_latency_ms=mmr_latency_ms,
            total_latency_ms=total_latency_ms,
            results_from_db=results_from_db,
            results_after_threshold=results_after_threshold,
            results_after_filters=results_after_filters,
            results_after_mmr=results_after_mmr,
        )

    return SemanticSearchResponse(
        query=payload.query,
        results=[_to_semantic_result_item(item) for item in paged_results],
        total_results=len(selected),
        page=page,
        page_size=page_size,
        has_more=has_more,
        debug=debug,
    )


async def _execute_lexical_search(payload: LexicalSearchQuery) -> LexicalSearchResponseAPI:
    config = _get_lexical_config()
    if not config.enabled:
        raise HTTPException(status_code=400, detail="Lexical search is disabled in settings.")

    page = payload.page
    page_size = payload.page_size
    configured_top_k = payload.top_k or config.top_k
    required_top_k = max(configured_top_k, page * page_size)

    index = _load_or_create_lexical_index(config)
    engine = LexicalSearchEngine(index)
    raw = engine.search(
        query=payload.query,
        config=config,
        top_k=required_top_k,
        threshold=payload.threshold,
        filters=payload.filters,
    )

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paged_results = raw.results[start_idx:end_idx]
    has_more = end_idx < len(raw.results)

    include_debug = payload.include_debug or config.debug_default
    debug = None
    if include_debug:
        debug = LexicalDebugInfo(
            query_text=raw.query,
            query_tokens=raw.query_tokens,
            tokenization_latency_ms=raw.tokenization_latency_ms,
            search_latency_ms=raw.search_latency_ms,
            total_latency_ms=raw.total_latency_ms,
            results_from_index=raw.results_from_index,
            results_after_threshold=raw.results_after_threshold,
            index_stats={
                "documents": index.num_documents,
                "unique_terms": index.num_unique_terms,
                "size_bytes": BM25Index.index_size_bytes(_bm25_index_dir()),
            },
        )

    return LexicalSearchResponseAPI(
        query=raw.query,
        results=[_to_lexical_result_item(item) for item in paged_results],
        total_results=len(raw.results),
        page=page,
        page_size=page_size,
        has_more=has_more,
        debug=debug,
    )


async def _execute_hybrid_search(*, payload: UnifiedSearchQuery) -> UnifiedSearchResponse:
    started = time.perf_counter()

    semantic_cfg = _get_semantic_config()
    lexical_cfg = _get_lexical_config()
    hybrid_cfg = _get_hybrid_config()

    if not semantic_cfg.enabled:
        raise HTTPException(status_code=400, detail="Semantic search is disabled; hybrid search is unavailable.")
    if not lexical_cfg.enabled:
        raise HTTPException(status_code=400, detail="Lexical search is disabled; hybrid search is unavailable.")

    page = payload.page
    page_size = payload.page_size
    configured_top_k = payload.top_k or hybrid_cfg.top_k
    required_top_k = max(configured_top_k, page * page_size)
    source_top_k = min(max(required_top_k * 2, semantic_cfg.top_k, lexical_cfg.top_k), 100)

    semantic_query = SearchQuery(
        query=payload.query,
        top_k=source_top_k,
        threshold=semantic_cfg.threshold,
        filters=payload.filters,
        mmr_enabled=False,
        mmr_lambda=semantic_cfg.mmr_lambda,
        include_debug=payload.include_debug,
        page=1,
        page_size=source_top_k,
    )
    lexical_query = LexicalSearchQuery(
        query=payload.query,
        top_k=source_top_k,
        threshold=lexical_cfg.threshold,
        filters=payload.filters,
        include_debug=payload.include_debug,
        page=1,
        page_size=source_top_k,
    )

    semantic_response, lexical_response = await asyncio.gather(
        _execute_semantic_search(semantic_query),
        _execute_lexical_search(lexical_query),
    )

    semantic_candidates = [_hybrid_candidate_from_semantic(item) for item in semantic_response.results]
    lexical_candidates = [_hybrid_candidate_from_lexical(item) for item in lexical_response.results]

    threshold = hybrid_cfg.threshold if payload.threshold is None else payload.threshold
    fusion_engine = HybridSearchEngine(hybrid_cfg)
    fused_results = fusion_engine.fuse(
        semantic_results=semantic_candidates,
        lexical_results=lexical_candidates,
        alpha=payload.alpha,
        top_k=required_top_k,
        threshold=threshold,
    )

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paged_results = fused_results[start_idx:end_idx]
    has_more = end_idx < len(fused_results)

    include_debug = payload.include_debug or hybrid_cfg.debug_default
    debug: dict[str, Any] | None = None
    if include_debug:
        debug = {
            "alpha": float(payload.alpha if payload.alpha is not None else hybrid_cfg.alpha),
            "fusion_method": hybrid_cfg.fusion_method.value,
            "rrf_k": hybrid_cfg.rrf_k,
            "normalize_scores": hybrid_cfg.normalize_scores,
            "normalization_method": hybrid_cfg.normalization_method.value,
            "threshold": threshold,
            "semantic_candidates": semantic_response.total_results,
            "lexical_candidates": lexical_response.total_results,
            "fused_candidates": len(fused_results),
            "fusion_latency_ms": max(1, int((time.perf_counter() - started) * 1000)),
            "semantic_debug": (
                semantic_response.debug.model_dump(mode="json") if semantic_response.debug else None
            ),
            "lexical_debug": (
                lexical_response.debug.model_dump(mode="json") if lexical_response.debug else None
            ),
            "provenance": [
                {
                    "chunk_id": result.chunk_id,
                    "semantic_rank": result.semantic_rank,
                    "semantic_score": result.semantic_score,
                    "semantic_contribution": result.semantic_contribution,
                    "lexical_rank": result.lexical_rank,
                    "lexical_score": result.lexical_score,
                    "lexical_contribution": result.lexical_contribution,
                    "final_score": result.score,
                }
                for result in paged_results
            ],
        }

    return UnifiedSearchResponse(
        query=payload.query,
        search_type=SearchType.HYBRID,
        results=[_hybrid_result_to_unified(result) for result in paged_results],
        total_results=len(fused_results),
        page=page,
        page_size=page_size,
        has_more=has_more,
        debug=debug,
    )


async def _execute_unified_semantic(*, payload: UnifiedSearchQuery) -> UnifiedSearchResponse:
    semantic_payload = SearchQuery(
        query=payload.query,
        top_k=payload.top_k,
        threshold=payload.threshold,
        filters=payload.filters,
        mmr_enabled=None,
        mmr_lambda=None,
        include_debug=payload.include_debug,
        page=payload.page,
        page_size=payload.page_size,
    )
    semantic_response = await _execute_semantic_search(semantic_payload)
    debug = semantic_response.debug.model_dump(mode="json") if semantic_response.debug else None
    return UnifiedSearchResponse(
        query=semantic_response.query,
        search_type=SearchType.SEMANTIC,
        results=[_semantic_item_to_unified(item) for item in semantic_response.results],
        total_results=semantic_response.total_results,
        page=semantic_response.page,
        page_size=semantic_response.page_size,
        has_more=semantic_response.has_more,
        debug=debug,
    )


async def _execute_unified_lexical(*, payload: UnifiedSearchQuery) -> UnifiedSearchResponse:
    lexical_payload = LexicalSearchQuery(
        query=payload.query,
        top_k=payload.top_k,
        threshold=payload.threshold,
        filters=payload.filters,
        include_debug=payload.include_debug,
        page=payload.page,
        page_size=payload.page_size,
    )
    lexical_response = await _execute_lexical_search(lexical_payload)
    debug = lexical_response.debug.model_dump(mode="json") if lexical_response.debug else None
    return UnifiedSearchResponse(
        query=lexical_response.query,
        search_type=SearchType.LEXICAL,
        results=[_lexical_item_to_unified(item) for item in lexical_response.results],
        total_results=lexical_response.total_results,
        page=lexical_response.page,
        page_size=lexical_response.page_size,
        has_more=lexical_response.has_more,
        debug=debug,
    )


async def _execute_unified_search(payload: UnifiedSearchQuery) -> UnifiedSearchResponse:
    general_settings = _resolve_general_settings()
    semantic_cfg = _get_semantic_config()
    lexical_cfg = _get_lexical_config()
    hybrid_cfg = _get_hybrid_config()
    resolved_search_type = payload.search_type or general_settings.search_type

    rerank_cfg = get_rerank_config()
    rerank_enabled = bool(rerank_cfg.enabled and rerank_cfg.provider != RerankProvider.NONE)

    configured_top_k = payload.top_k
    if configured_top_k is None:
        if resolved_search_type == SearchType.SEMANTIC:
            configured_top_k = semantic_cfg.top_k
        elif resolved_search_type == SearchType.LEXICAL:
            configured_top_k = lexical_cfg.top_k
        else:
            configured_top_k = hybrid_cfg.top_k

    minimum_for_pagination = payload.page * payload.page_size
    configured_top_k = max(int(configured_top_k), int(minimum_for_pagination), 1)

    warnings: list[str] = []
    routed_payload = payload
    if rerank_enabled:
        max_supported_candidates = 100
        candidate_budget = min(rerank_cfg.candidates, max_supported_candidates)
        if rerank_cfg.candidates > max_supported_candidates:
            warnings.append(
                f"rerank.candidates capped to {max_supported_candidates} due retrieval limits."
            )
        if configured_top_k < candidate_budget:
            warnings.append(
                f"top_k auto-adjusted from {configured_top_k} to {candidate_budget} to feed reranking."
            )
            configured_top_k = candidate_budget
        routed_payload = payload.model_copy(
            update={
                "top_k": configured_top_k,
                "page": 1,
                "page_size": configured_top_k,
                "include_debug": bool(payload.include_debug or rerank_cfg.debug_default),
            }
        )

    search_router = SearchRouter(
        semantic_handler=_execute_unified_semantic,
        lexical_handler=_execute_unified_lexical,
        hybrid_handler=_execute_hybrid_search,
        default_type=general_settings.search_type,
    )
    response = await search_router.search(search_type=resolved_search_type, payload=routed_payload)

    if not rerank_enabled:
        return response

    try:
        reranked_results, before_debug, after_debug, reranking_latency_ms = await _rerank_unified_results(
            query=payload.query,
            results=response.results,
            rerank_config=rerank_cfg,
            candidates_limit=rerank_cfg.candidates,
            top_n=rerank_cfg.top_n,
            relevance_threshold=rerank_cfg.relevance_threshold,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Reranking failed: {exc}") from exc

    start_idx = (payload.page - 1) * payload.page_size
    end_idx = start_idx + payload.page_size
    paged_results = reranked_results[start_idx:end_idx]
    has_more = end_idx < len(reranked_results)

    include_debug = bool(payload.include_debug or rerank_cfg.debug_default or response.debug or warnings)
    debug_payload = dict(response.debug or {}) if include_debug else None
    if debug_payload is not None:
        rerank_debug: dict[str, Any] = {
            "provider": rerank_cfg.provider.value,
            "model": rerank_cfg.model,
            "latency_ms": reranking_latency_ms,
            "candidates_requested": rerank_cfg.candidates,
            "candidates_used": min(rerank_cfg.candidates, len(response.results)),
            "top_n": rerank_cfg.top_n,
            "relevance_threshold": rerank_cfg.relevance_threshold,
        }
        if warnings:
            rerank_debug["warnings"] = warnings
        if payload.include_debug or rerank_cfg.debug_default:
            rerank_debug["before"] = before_debug
            rerank_debug["after"] = after_debug
        debug_payload["rerank"] = rerank_debug
        debug_payload["pipeline"] = f"{resolved_search_type.value} + reranking"

    return UnifiedSearchResponse(
        query=payload.query,
        search_type=resolved_search_type,
        results=paged_results,
        total_results=len(reranked_results),
        page=payload.page,
        page_size=payload.page_size,
        has_more=has_more,
        debug=debug_payload,
    )


def _filters_field_value(payload: dict[str, Any], field: str) -> str | None:
    field_map: dict[str, tuple[str, ...]] = {
        "doc_type": ("doc_type", "file_type"),
        "language": ("doc_language", "language"),
        "category": ("category",),
        "doc_id": ("doc_id",),
    }
    keys = field_map.get(field)
    if not keys:
        return None
    return _payload_value(payload, keys)


@router.get("/retrieval/semantic/config", response_model=SemanticSearchConfig)
async def get_semantic_config() -> SemanticSearchConfig:
    return _get_semantic_config()


@router.put("/retrieval/semantic/config", response_model=SemanticSearchConfig)
async def update_semantic_config(config: SemanticSearchConfig) -> SemanticSearchConfig:
    return _save_semantic_config(config)


@router.post("/retrieval/semantic/config/reset", response_model=SemanticSearchConfig)
async def reset_semantic_config() -> SemanticSearchConfig:
    return _save_semantic_config(_default_semantic_config())


@router.get("/retrieval/lexical/config", response_model=LexicalSearchConfig)
async def get_lexical_config() -> LexicalSearchConfig:
    return _get_lexical_config()


@router.put("/retrieval/lexical/config", response_model=LexicalSearchConfig)
async def update_lexical_config(config: LexicalSearchConfig) -> LexicalSearchConfig:
    return _save_lexical_config(config)


@router.post("/retrieval/lexical/config/reset", response_model=LexicalSearchConfig)
async def reset_lexical_config() -> LexicalSearchConfig:
    return _save_lexical_config(_default_lexical_config())


@router.get("/retrieval/hybrid/config", response_model=HybridSearchConfig)
async def get_hybrid_config() -> HybridSearchConfig:
    return _get_hybrid_config()


@router.put("/retrieval/hybrid/config", response_model=HybridSearchConfig)
async def update_hybrid_config(config: HybridSearchConfig) -> HybridSearchConfig:
    return _save_hybrid_config(config)


@router.post("/retrieval/hybrid/config/reset", response_model=HybridSearchConfig)
async def reset_hybrid_config() -> HybridSearchConfig:
    return _save_hybrid_config(_default_hybrid_config())


@router.post("/retrieval/semantic/search", response_model=SemanticSearchResponse)
async def semantic_search(payload: SearchQuery) -> SemanticSearchResponse:
    return await _execute_semantic_search(payload)


@router.post("/search/semantic", response_model=SemanticSearchResponse)
async def semantic_search_alias(payload: SearchQuery) -> SemanticSearchResponse:
    return await _execute_semantic_search(payload)


@router.post("/retrieval/lexical/search", response_model=LexicalSearchResponseAPI)
async def lexical_search(payload: LexicalSearchQuery) -> LexicalSearchResponseAPI:
    return await _execute_lexical_search(payload)


@router.post("/search/lexical", response_model=LexicalSearchResponseAPI)
async def lexical_search_alias(payload: LexicalSearchQuery) -> LexicalSearchResponseAPI:
    return await _execute_lexical_search(payload)


@router.post("/search", response_model=UnifiedSearchResponse)
async def unified_search(payload: UnifiedSearchQuery) -> UnifiedSearchResponse:
    return await _execute_unified_search(payload)


@router.get("/retrieval/lexical/index/stats", response_model=BM25IndexStats)
async def lexical_index_stats() -> BM25IndexStats:
    config = _get_lexical_config()
    index = _load_or_create_lexical_index(config)
    return BM25IndexStats(
        num_documents=index.num_documents,
        num_unique_terms=index.num_unique_terms,
        size_bytes=BM25Index.index_size_bytes(_bm25_index_dir()),
        last_updated_version=index.last_updated_version,
        last_updated_at=index.last_updated_at,
    )


@router.post("/retrieval/lexical/index/rebuild")
async def lexical_index_rebuild() -> dict[str, Any]:
    started = time.perf_counter()
    lexical_config = _get_lexical_config()

    settings = load_settings()
    vector_config = VectorStoreConfig.model_validate(settings.vector_store or {})
    embedding_config = EmbeddingConfig.model_validate(settings.embedding or {})
    embedder = EmbeddingEngine(embedding_config)
    store = create_vector_store(vector_config)
    try:
        await store.initialize(embedder.resolve_dimensions())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    points = await store.all_points()
    rebuilt = BM25Index(lexical_config)
    for point in points:
        payload = dict(point.payload or {})
        text = str(payload.get("chunk_text") or "")
        if not text:
            continue
        rebuilt.add_document(
            doc_id=point.id,
            text=text,
            metadata=payload,
            language=_payload_value(payload, ("doc_language", "language")),
        )
    rebuilt.save(_bm25_index_dir())
    _set_lexical_index(rebuilt)

    return {
        "status": "ok",
        "duration_s": round(time.perf_counter() - started, 4),
        "num_documents": rebuilt.num_documents,
        "num_unique_terms": rebuilt.num_unique_terms,
    }


@router.get("/search/filters/values")
async def search_filter_values(field: str = Query(..., pattern="^(doc_type|language|category|doc_id)$")):
    settings = load_settings()
    embed_cfg = EmbeddingConfig.model_validate(settings.embedding or {})
    vec_cfg = VectorStoreConfig.model_validate(settings.vector_store or {})
    store = create_vector_store(vec_cfg)
    embedder = EmbeddingEngine(embed_cfg)
    try:
        await store.initialize(embedder.resolve_dimensions())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    points = await store.all_points()

    values: set[str] = set()
    for point in points:
        value = _filters_field_value(point.payload or {}, field)
        if value:
            values.add(value)
    return {"values": sorted(values)}


@router.get("/chat/ready")
async def chat_ready():
    settings = load_settings()
    embed_cfg = EmbeddingConfig.model_validate(settings.embedding or {})
    vec_cfg = VectorStoreConfig.model_validate(settings.vector_store or {})
    store = create_vector_store(vec_cfg)
    embedder = EmbeddingEngine(embed_cfg)
    try:
        await store.initialize(embedder.resolve_dimensions())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    stats = await store.collection_stats()
    lexical_cfg = _get_lexical_config()
    lexical_index = _load_or_create_lexical_index(lexical_cfg)
    return {
        "ready": stats.vectors_count > 0,
        "vectors_count": stats.vectors_count,
        "lexical_chunks": lexical_index.num_documents,
    }
