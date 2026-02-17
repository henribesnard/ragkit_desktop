from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ragkit.config.rerank_schema import (
    RerankConfig,
    RerankProvider,
    RerankTestQuery,
    RerankTestResult,
    RerankTestResultItem,
)
from ragkit.desktop.rerank_service import (
    default_rerank_config,
    get_rerank_config,
    get_rerank_models,
    resolve_reranker,
    save_rerank_config,
)
from ragkit.retrieval.reranker.base import RerankCandidate

router = APIRouter(prefix="/api/rerank", tags=["rerank"])


def _active_runtime_config() -> RerankConfig:
    config = get_rerank_config()
    if config.provider == RerankProvider.NONE:
        raise HTTPException(status_code=400, detail="Reranking provider is not configured.")
    if not config.enabled:
        # Testing is allowed even when the feature is currently disabled.
        config.enabled = True
    return config


def _resolve_configured_reranker(config: RerankConfig):
    try:
        reranker = resolve_reranker(config)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if reranker is None:
        raise HTTPException(status_code=400, detail="Reranking is disabled in settings.")
    return reranker


@router.get("/config", response_model=RerankConfig)
async def get_config() -> RerankConfig:
    return get_rerank_config()


@router.put("/config", response_model=RerankConfig)
async def update_config(payload: dict[str, Any]) -> RerankConfig:
    current = get_rerank_config().model_dump(mode="json", exclude={"api_key_set"})
    merged = {**current, **payload}
    try:
        config = RerankConfig.model_validate(merged)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return save_rerank_config(config)


@router.post("/config/reset", response_model=RerankConfig)
async def reset_config() -> RerankConfig:
    return save_rerank_config(default_rerank_config())


@router.get("/models")
async def list_models(provider: RerankProvider = Query(...)) -> list[dict[str, Any]]:
    return [model.model_dump(mode="json") for model in get_rerank_models(provider)]


@router.post("/test-connection", response_model=RerankTestResult)
async def test_connection() -> RerankTestResult:
    config = _active_runtime_config()
    reranker = _resolve_configured_reranker(config)
    result = await reranker.test_connection()
    result.model = config.model or ""
    return result


@router.post("/test", response_model=RerankTestResult)
async def test_rerank(payload: RerankTestQuery) -> RerankTestResult:
    config = _active_runtime_config()
    reranker = _resolve_configured_reranker(config)

    candidates = [
        RerankCandidate(
            chunk_id=str(index + 1),
            text=document,
            original_rank=index + 1,
            original_score=float(max(len(payload.documents) - index, 1)) / float(len(payload.documents)),
            metadata={},
        )
        for index, document in enumerate(payload.documents)
    ]

    started = time.perf_counter()
    try:
        reranked = await reranker.rerank(
            query=payload.query,
            candidates=candidates,
            top_n=min(config.top_n, len(candidates)),
            relevance_threshold=config.relevance_threshold,
        )
        latency_ms = max(1, int((time.perf_counter() - started) * 1000))
        return RerankTestResult(
            success=True,
            results=[
                RerankTestResultItem(
                    text=result.text[:160],
                    score=result.rerank_score,
                    rank=index + 1,
                )
                for index, result in enumerate(reranked)
            ],
            latency_ms=latency_ms,
            model=config.model or "",
        )
    except Exception as exc:
        return RerankTestResult(
            success=False,
            results=[],
            latency_ms=0,
            model=config.model or "",
            error=str(exc),
        )
