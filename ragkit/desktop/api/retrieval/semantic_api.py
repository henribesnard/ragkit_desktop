"""Semantic search API endpoints and execution logic."""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException

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
from ragkit.desktop.settings_store import load_settings
from ragkit.embedding.engine import EmbeddingEngine, cosine_similarity
from ragkit.storage.base import create_vector_store

from .config_helpers import (
    RankedPoint,
    default_semantic_config,
    get_semantic_config,
    match_filters,
    merge_filters,
    normalize_semantic_score,
    payload_value,
    save_semantic_config,
    text_preview,
)

router = APIRouter(prefix="/api", tags=["retrieval-semantic"])


# ------------------------------------------------------------------ #
#  MMR diversification                                                 #
# ------------------------------------------------------------------ #

def apply_mmr(candidates: list[RankedPoint], top_k: int, mmr_lambda: float) -> list[RankedPoint]:
    if top_k <= 0 or not candidates:
        return []

    remaining = list(candidates)
    selected: list[RankedPoint] = []

    while remaining and len(selected) < top_k:
        if not selected:
            best = max(remaining, key=lambda item: item.raw_score)
        else:
            def mmr_score(item: RankedPoint) -> float:
                max_similarity = max(
                    cosine_similarity(item.point.vector, chosen.point.vector) for chosen in selected
                )
                return (mmr_lambda * item.raw_score) - ((1.0 - mmr_lambda) * max_similarity)

            best = max(remaining, key=mmr_score)

        selected.append(best)
        remaining = [item for item in remaining if item.point.id != best.point.id]

    return selected


# ------------------------------------------------------------------ #
#  Result conversion                                                   #
# ------------------------------------------------------------------ #

def to_semantic_result_item(item: RankedPoint) -> SearchResultItem:
    payload = item.point.payload or {}
    text = str(payload.get("chunk_text") or "")
    raw_keywords = payload.get("keywords", [])
    keywords = [str(value).strip() for value in raw_keywords] if isinstance(raw_keywords, list) else []

    return SearchResultItem(
        chunk_id=item.point.id,
        score=round(item.normalized_score, 4),
        text=text,
        text_preview=text_preview(text),
        doc_title=payload_value(payload, ("doc_title", "document_title", "filename")),
        doc_path=payload_value(payload, ("doc_path", "source")),
        doc_type=payload_value(payload, ("doc_type", "file_type")),
        page_number=payload.get("page_number") or payload.get("page"),
        chunk_index=payload.get("chunk_index"),
        chunk_total=payload.get("chunk_total"),
        chunk_tokens=payload.get("chunk_tokens"),
        section_header=payload_value(payload, ("section_header",)),
        doc_language=payload_value(payload, ("doc_language", "language")),
        category=payload_value(payload, ("category",)),
        keywords=keywords,
        ingestion_version=payload_value(payload, ("ingestion_version",)),
    )


# ------------------------------------------------------------------ #
#  Semantic search execution                                           #
# ------------------------------------------------------------------ #

async def execute_semantic_search(payload: SearchQuery) -> SemanticSearchResponse:
    total_started = time.perf_counter()
    config = get_semantic_config()
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
        RankedPoint(
            point=point,
            raw_score=score,
            normalized_score=normalize_semantic_score(score),
        )
        for point, score in raw_results
    ]
    results_from_db = len(ranked)

    thresholded = [item for item in ranked if item.normalized_score >= threshold]
    results_after_threshold = len(thresholded)

    effective_filters = payload.filters or SearchFilters()
    if config.default_filters_enabled:
        effective_filters = merge_filters(config.default_filters, payload.filters)

    filtered = [item for item in thresholded if match_filters(item.point.payload or {}, effective_filters)]
    results_after_filters = len(filtered)

    mmr_latency_ms = 0
    if mmr_enabled:
        mmr_started = time.perf_counter()
        selected = apply_mmr(filtered, top_k=top_k, mmr_lambda=mmr_lambda)
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
        results=[to_semantic_result_item(item) for item in paged_results],
        total_results=len(selected),
        page=page,
        page_size=page_size,
        has_more=has_more,
        debug=debug,
    )


# ------------------------------------------------------------------ #
#  API endpoints                                                       #
# ------------------------------------------------------------------ #

@router.get("/retrieval/semantic/config", response_model=SemanticSearchConfig)
async def get_semantic_config_endpoint() -> SemanticSearchConfig:
    return get_semantic_config()


@router.put("/retrieval/semantic/config", response_model=SemanticSearchConfig)
async def update_semantic_config(config: SemanticSearchConfig) -> SemanticSearchConfig:
    return save_semantic_config(config)


@router.post("/retrieval/semantic/config/reset", response_model=SemanticSearchConfig)
async def reset_semantic_config() -> SemanticSearchConfig:
    return save_semantic_config(default_semantic_config())


@router.post("/retrieval/semantic/search", response_model=SemanticSearchResponse)
async def semantic_search(payload: SearchQuery) -> SemanticSearchResponse:
    return await execute_semantic_search(payload)


@router.post("/search/semantic", response_model=SemanticSearchResponse)
async def semantic_search_alias(payload: SearchQuery) -> SemanticSearchResponse:
    return await execute_semantic_search(payload)
