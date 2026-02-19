"""Lexical (BM25) search API endpoints and execution logic."""

from __future__ import annotations

import re
import time
from typing import Any

from fastapi import APIRouter, HTTPException

from ragkit.config.embedding_schema import EmbeddingConfig
from ragkit.config.retrieval_schema import (
    BM25IndexStats,
    LexicalDebugInfo,
    LexicalSearchConfig,
    LexicalSearchQuery,
    LexicalSearchResponseAPI,
    LexicalSearchResultItem,
)
from ragkit.config.vector_store_schema import VectorStoreConfig
from ragkit.desktop.settings_store import load_settings
from ragkit.embedding.engine import EmbeddingEngine
from ragkit.retrieval import BM25Index, LexicalSearchEngine
from ragkit.storage.base import create_vector_store

from .config_helpers import (
    bm25_index_dir,
    default_lexical_config,
    get_lexical_config,
    load_or_create_lexical_index,
    payload_value,
    save_lexical_config,
    set_lexical_index,
    text_preview,
)

router = APIRouter(prefix="/api", tags=["retrieval-lexical"])


# ------------------------------------------------------------------ #
#  Result conversion                                                   #
# ------------------------------------------------------------------ #

def build_highlight_positions(text: str, matched_terms: dict[str, int]) -> list[dict[str, Any]]:
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


def to_lexical_result_item(item: Any) -> LexicalSearchResultItem:
    text = str(getattr(item, "text", "") or "")
    matched_terms = dict(getattr(item, "matched_terms", {}) or {})
    keywords_raw = getattr(item, "keywords", [])
    keywords = [str(value) for value in keywords_raw] if isinstance(keywords_raw, list) else []

    return LexicalSearchResultItem(
        chunk_id=str(getattr(item, "chunk_id", "")),
        score=float(getattr(item, "score", 0.0)),
        text=text,
        text_preview=text_preview(text),
        matched_terms=matched_terms,
        highlight_positions=build_highlight_positions(text, matched_terms),
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


# ------------------------------------------------------------------ #
#  Lexical search execution                                            #
# ------------------------------------------------------------------ #

async def execute_lexical_search(payload: LexicalSearchQuery) -> LexicalSearchResponseAPI:
    config = get_lexical_config()
    if not config.enabled:
        raise HTTPException(status_code=400, detail="Lexical search is disabled in settings.")

    page = payload.page
    page_size = payload.page_size
    configured_top_k = payload.top_k or config.top_k
    required_top_k = max(configured_top_k, page * page_size)

    index = load_or_create_lexical_index(config)
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
                "size_bytes": BM25Index.index_size_bytes(bm25_index_dir()),
            },
        )

    return LexicalSearchResponseAPI(
        query=raw.query,
        results=[to_lexical_result_item(item) for item in paged_results],
        total_results=len(raw.results),
        page=page,
        page_size=page_size,
        has_more=has_more,
        debug=debug,
    )


# ------------------------------------------------------------------ #
#  API endpoints                                                       #
# ------------------------------------------------------------------ #

@router.get("/retrieval/lexical/config", response_model=LexicalSearchConfig)
async def get_lexical_config_endpoint() -> LexicalSearchConfig:
    return get_lexical_config()


@router.put("/retrieval/lexical/config", response_model=LexicalSearchConfig)
async def update_lexical_config(config: LexicalSearchConfig) -> LexicalSearchConfig:
    return save_lexical_config(config)


@router.post("/retrieval/lexical/config/reset", response_model=LexicalSearchConfig)
async def reset_lexical_config() -> LexicalSearchConfig:
    return save_lexical_config(default_lexical_config())


@router.post("/retrieval/lexical/search", response_model=LexicalSearchResponseAPI)
async def lexical_search(payload: LexicalSearchQuery) -> LexicalSearchResponseAPI:
    return await execute_lexical_search(payload)


@router.post("/search/lexical", response_model=LexicalSearchResponseAPI)
async def lexical_search_alias(payload: LexicalSearchQuery) -> LexicalSearchResponseAPI:
    return await execute_lexical_search(payload)


@router.get("/retrieval/lexical/index/stats", response_model=BM25IndexStats)
async def lexical_index_stats() -> BM25IndexStats:
    config = get_lexical_config()
    index = load_or_create_lexical_index(config)
    return BM25IndexStats(
        num_documents=index.num_documents,
        num_unique_terms=index.num_unique_terms,
        size_bytes=BM25Index.index_size_bytes(bm25_index_dir()),
        last_updated_version=index.last_updated_version,
        last_updated_at=index.last_updated_at,
    )


@router.post("/retrieval/lexical/index/rebuild")
async def lexical_index_rebuild() -> dict[str, Any]:
    started = time.perf_counter()
    lexical_config = get_lexical_config()

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
            language=payload_value(payload, ("doc_language", "language")),
        )
    rebuilt.save(bm25_index_dir())
    set_lexical_index(rebuilt)

    return {
        "status": "ok",
        "duration_s": round(time.perf_counter() - started, 4),
        "num_documents": rebuilt.num_documents,
        "num_unique_terms": rebuilt.num_unique_terms,
    }
