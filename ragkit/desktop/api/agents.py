from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ragkit.config.agents_schema import AgentsConfig
from ragkit.desktop.agents_service import default_agents_config, get_agents_config, save_agents_config

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("/config", response_model=AgentsConfig)
async def get_config() -> AgentsConfig:
    return get_agents_config()


@router.put("/config", response_model=AgentsConfig)
async def update_config(payload: dict[str, Any]) -> AgentsConfig:
    current = get_agents_config().model_dump(mode="json")
    merged = {**current, **payload}
    try:
        config = AgentsConfig.model_validate(merged)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return save_agents_config(config)


@router.post("/config/reset", response_model=AgentsConfig)
async def reset_config() -> AgentsConfig:
    return save_agents_config(default_agents_config())
