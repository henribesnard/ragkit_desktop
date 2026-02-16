from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ragkit.chunking.tokenizer import TokenCounter
from ragkit.config.embedding_schema import EmbeddingConfig
from ragkit.config.retrieval_schema import (
    SearchDebugInfo,
    SearchFilters,
    SearchQuery,
    SearchResultItem,
    SemanticSearchConfig,
    SemanticSearchResponse,
)
from ragkit.config.vector_store_schema import VectorStoreConfig
from ragkit.desktop.profiles import build_full_config
from ragkit.desktop.settings_store import load_settings, save_settings
from ragkit.embedding.engine import EmbeddingEngine, cosine_similarity
from ragkit.storage.base import VectorPoint, create_vector_store

router = APIRouter(prefix="/api", tags=["retrieval"])


@dataclass
class _RankedPoint:
    point: VectorPoint
    raw_score: float
    normalized_score: float


def _default_semantic_config() -> SemanticSearchConfig:
    settings = load_settings()
    profile_name = settings.profile or "general"
    full_config = build_full_config(profile_name, settings.calibration_answers)
    retrieval_payload = full_config.get("retrieval", {})
    semantic_payload = retrieval_payload.get("semantic", {}) if isinstance(retrieval_payload, dict) else {}
    return SemanticSearchConfig.model_validate(semantic_payload)


def _get_semantic_config() -> SemanticSearchConfig:
    settings = load_settings()
    retrieval_payload = settings.retrieval if isinstance(settings.retrieval, dict) else {}
    semantic_payload = retrieval_payload.get("semantic", {}) if isinstance(retrieval_payload, dict) else {}
    if semantic_payload:
        return SemanticSearchConfig.model_validate(semantic_payload)
    return _default_semantic_config()


def _save_semantic_config(config: SemanticSearchConfig) -> SemanticSearchConfig:
    settings = load_settings()
    retrieval_payload = settings.retrieval if isinstance(settings.retrieval, dict) else {}
    retrieval_payload["semantic"] = config.model_dump(mode="json")
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


def _to_result_item(item: _RankedPoint) -> SearchResultItem:
    payload = item.point.payload or {}
    text = str(payload.get("chunk_text") or "")
    text_preview = text[:300] + ("..." if len(text) > 300 else "")
    raw_keywords = payload.get("keywords", [])
    keywords = [str(value).strip() for value in raw_keywords] if isinstance(raw_keywords, list) else []

    return SearchResultItem(
        chunk_id=item.point.id,
        score=round(item.normalized_score, 4),
        text=text,
        text_preview=text_preview,
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


async def _execute_search(payload: SearchQuery) -> SemanticSearchResponse:
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
    await store.initialize(embed_cfg.dimensions or len(embed_output.vector))

    search_started = time.perf_counter()
    raw_results = await store.search(embed_output.vector, candidate_count)
    search_latency_ms = max(1, int((time.perf_counter() - search_started) * 1000))

    ranked = [
        _RankedPoint(
            point=point,
            raw_score=score,
            normalized_score=max(0.0, min(1.0, (score + 1.0) / 2.0)),
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
        results=[_to_result_item(item) for item in paged_results],
        total_results=len(selected),
        page=page,
        page_size=page_size,
        has_more=has_more,
        debug=debug,
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


@router.post("/retrieval/semantic/search", response_model=SemanticSearchResponse)
async def semantic_search(payload: SearchQuery) -> SemanticSearchResponse:
    return await _execute_search(payload)


@router.post("/search/semantic", response_model=SemanticSearchResponse)
async def semantic_search_alias(payload: SearchQuery) -> SemanticSearchResponse:
    return await _execute_search(payload)


@router.get("/search/filters/values")
async def search_filter_values(field: str = Query(..., pattern="^(doc_type|language|category|doc_id)$")):
    settings = load_settings()
    embed_cfg = EmbeddingConfig.model_validate(settings.embedding or {})
    vec_cfg = VectorStoreConfig.model_validate(settings.vector_store or {})
    store = create_vector_store(vec_cfg)
    await store.initialize(embed_cfg.dimensions or 768)
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
    await store.initialize(embed_cfg.dimensions or 768)
    stats = await store.collection_stats()
    return {"ready": stats.vectors_count > 0, "vectors_count": stats.vectors_count}
