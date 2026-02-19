"""Unified (hybrid + wrapper) search, reranking, and general retrieval endpoints."""

from __future__ import annotations

import asyncio
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ragkit.config.embedding_schema import EmbeddingConfig
from ragkit.config.rerank_schema import RerankProvider
from ragkit.config.retrieval_schema import (
    HybridSearchConfig,
    LexicalSearchQuery,
    LexicalSearchResultItem,
    SearchQuery,
    SearchResultItem,
    SearchType,
    UnifiedSearchQuery,
    UnifiedSearchResponse,
    UnifiedSearchResultItem,
)
from ragkit.config.vector_store_schema import VectorStoreConfig
from ragkit.desktop.rerank_service import get_rerank_config, resolve_reranker
from ragkit.desktop.settings_store import load_settings
from ragkit.embedding.engine import EmbeddingEngine
from ragkit.retrieval.hybrid_engine import HybridSearchEngine
from ragkit.retrieval.reranker.base import RerankCandidate
from ragkit.retrieval.search_router import SearchRouter
from ragkit.storage.base import create_vector_store

from .config_helpers import (
    HybridSourceCandidate,
    default_hybrid_config,
    filters_field_value,
    get_hybrid_config,
    get_lexical_config,
    get_semantic_config,
    load_or_create_lexical_index,
    payload_value,
    resolve_general_settings,
    save_hybrid_config,
    text_preview,
)
from .lexical_api import execute_lexical_search, to_lexical_result_item
from .semantic_api import execute_semantic_search, to_semantic_result_item

router = APIRouter(prefix="/api", tags=["retrieval-unified"])


# ------------------------------------------------------------------ #
#  Conversion helpers                                                  #
# ------------------------------------------------------------------ #

def _hybrid_candidate_from_semantic(item: SearchResultItem) -> HybridSourceCandidate:
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
    return HybridSourceCandidate(
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


def _hybrid_candidate_from_lexical(item: LexicalSearchResultItem) -> HybridSourceCandidate:
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
    return HybridSourceCandidate(
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
        text_preview=text_preview(text),
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


# ------------------------------------------------------------------ #
#  Reranking                                                           #
# ------------------------------------------------------------------ #

async def _rerank_unified_results(
    *,
    query: str,
    results: list[UnifiedSearchResultItem],
    rerank_config: Any,
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


# ------------------------------------------------------------------ #
#  Hybrid search execution                                             #
# ------------------------------------------------------------------ #

async def _execute_hybrid_search(*, payload: UnifiedSearchQuery) -> UnifiedSearchResponse:
    started = time.perf_counter()

    semantic_cfg = get_semantic_config()
    lexical_cfg = get_lexical_config()
    hybrid_cfg = get_hybrid_config()

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
        execute_semantic_search(semantic_query),
        execute_lexical_search(lexical_query),
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


# ------------------------------------------------------------------ #
#  Unified (semantic-only or lexical-only wrappers)                    #
# ------------------------------------------------------------------ #

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
    semantic_response = await execute_semantic_search(semantic_payload)
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
    lexical_response = await execute_lexical_search(lexical_payload)
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


async def execute_unified_search(payload: UnifiedSearchQuery) -> UnifiedSearchResponse:
    general_settings = resolve_general_settings()
    semantic_cfg = get_semantic_config()
    lexical_cfg = get_lexical_config()
    hybrid_cfg = get_hybrid_config()
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


# ------------------------------------------------------------------ #
#  API endpoints                                                       #
# ------------------------------------------------------------------ #

@router.get("/retrieval/hybrid/config", response_model=HybridSearchConfig)
async def get_hybrid_config_endpoint() -> HybridSearchConfig:
    return get_hybrid_config()


@router.put("/retrieval/hybrid/config", response_model=HybridSearchConfig)
async def update_hybrid_config(config: HybridSearchConfig) -> HybridSearchConfig:
    return save_hybrid_config(config)


@router.post("/retrieval/hybrid/config/reset", response_model=HybridSearchConfig)
async def reset_hybrid_config() -> HybridSearchConfig:
    return save_hybrid_config(default_hybrid_config())


@router.post("/search", response_model=UnifiedSearchResponse)
async def unified_search(payload: UnifiedSearchQuery) -> UnifiedSearchResponse:
    return await execute_unified_search(payload)


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
        value = filters_field_value(point.payload or {}, field)
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
    lexical_cfg = get_lexical_config()
    lexical_index = load_or_create_lexical_index(lexical_cfg)
    return {
        "ready": stats.vectors_count > 0,
        "vectors_count": stats.vectors_count,
        "lexical_chunks": lexical_index.num_documents,
    }
