from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ragkit.config.llm_schema import LLMConfig, LLMProvider, LLMTestResult
from ragkit.desktop.llm_service import default_llm_config, get_llm_config, list_llm_models, resolve_llm_provider, save_llm_config

router = APIRouter(prefix="/api/llm", tags=["llm"])


@router.get("/config", response_model=LLMConfig)
async def get_config() -> LLMConfig:
    return get_llm_config()


@router.put("/config", response_model=LLMConfig)
async def update_config(payload: dict[str, Any]) -> LLMConfig:
    current = get_llm_config().model_dump(mode="json", exclude={"api_key_set"})
    merged = {**current, **payload}
    try:
        config = LLMConfig.model_validate(merged)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return save_llm_config(config)


@router.post("/config/reset", response_model=LLMConfig)
async def reset_config() -> LLMConfig:
    return save_llm_config(default_llm_config())


@router.get("/models")
async def get_models(provider: LLMProvider = Query(...)) -> list[dict[str, Any]]:
    return [model.model_dump(mode="json") for model in list_llm_models(provider)]


@router.post("/test-connection", response_model=LLMTestResult)
async def test_connection() -> LLMTestResult:
    config = get_llm_config()
    try:
        provider = resolve_llm_provider(config)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    result = await provider.test_connection()
    return LLMTestResult(
        success=result.success,
        model=result.model,
        response_text=result.response_text,
        latency_ms=result.latency_ms,
        error=result.error,
    )
