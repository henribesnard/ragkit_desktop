from __future__ import annotations

from fastapi import APIRouter

from ragkit.config.vector_store_schema import VectorStoreConfig
from ragkit.desktop.profiles import build_full_config
from ragkit.desktop.settings_store import load_settings, save_settings
from ragkit.storage.base import create_vector_store

router = APIRouter(prefix="/api/vector-store", tags=["vector-store"])


def _default_config_from_profile() -> VectorStoreConfig:
    settings = load_settings()
    profile_name = settings.profile or "general"
    full_config = build_full_config(profile_name, settings.calibration_answers)
    return VectorStoreConfig.model_validate(full_config.get("vector_store", {}))


def _default_config() -> VectorStoreConfig:
    settings = load_settings()
    if settings.vector_store:
        return VectorStoreConfig.model_validate(settings.vector_store)
    return _default_config_from_profile()


@router.get("/config")
async def get_vector_store_config():
    return _default_config().model_dump(mode="json")


@router.put("/config")
async def update_vector_store_config(config: VectorStoreConfig):
    settings = load_settings()
    settings.vector_store = config.model_dump(mode="json")
    save_settings(settings)
    return config.model_dump(mode="json")


@router.post("/config/reset")
async def reset_vector_store_config():
    config = _default_config_from_profile()
    settings = load_settings()
    settings.vector_store = config.model_dump(mode="json")
    save_settings(settings)
    return config.model_dump(mode="json")


@router.post("/test-connection")
async def test_vector_store_connection():
    config = _default_config()
    store = create_vector_store(config)
    return (await store.test_connection()).model_dump(mode="json")


@router.get("/collection/stats")
async def get_collection_stats():
    settings = load_settings()
    store = create_vector_store(_default_config())
    dims = int((settings.embedding or {}).get("dimensions") or 768)
    await store.initialize(dims)
    return (await store.collection_stats()).model_dump(mode="json")


@router.delete("/collection/delete")
async def delete_collection():
    store = create_vector_store(_default_config())
    await store.delete_collection()
    return {"success": True}
