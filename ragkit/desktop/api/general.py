from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from ragkit.desktop import settings_store
from ragkit.desktop.ingestion_runtime import runtime

router = APIRouter(prefix="/api/general", tags=["general"])

@router.put("/expertise")
async def set_expertise(payload: dict[str, Any]):
    runtime.ensure_background_tasks()
    level = payload.get("level", "simple")
    settings = settings_store.load_settings()
    
    general_payload = settings.general if isinstance(settings.general, dict) else {}
    general_payload["expertise_level"] = level
    settings.general = general_payload
    
    settings_store.save_settings(settings)
    return {"expertise_level": level}
