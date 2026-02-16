from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ragkit.chunking.tokenizer import TokenCounter
from ragkit.config.embedding_schema import EmbeddingConfig, EmbeddingProvider, EmbeddingTestRequest, EmbeddingTestResult
from ragkit.config.manager import config_manager
from ragkit.desktop.models import SettingsPayload
from ragkit.desktop.profiles import build_full_config
from ragkit.embedding.cache import BaseEmbeddingCache, create_cache
from ragkit.embedding.catalog import MODEL_CATALOG
from ragkit.embedding.engine import EmbeddingEngine, cosine_similarity
from ragkit.embedding.environment import detect_environment
from ragkit.security.secrets import secrets_manager

router = APIRouter(prefix="/api/embedding", tags=["embedding"])


class SecretStorePayload(BaseModel):
    key_name: str
    value: str | None = None


_CACHE: BaseEmbeddingCache | None = None
_CACHE_MODEL_ID: str | None = None


def _default_config_from_profile() -> EmbeddingConfig:
    settings = config_manager.load_config() or SettingsPayload()
    profile_name = settings.profile or "general"
    full_config = build_full_config(profile_name, settings.calibration_answers)
    return EmbeddingConfig.model_validate(full_config.get("embedding", {}))


def _get_current_config() -> EmbeddingConfig:
    settings = config_manager.load_config() or SettingsPayload()
    if settings.embedding:
        return EmbeddingConfig.model_validate(settings.embedding)
    return _default_config_from_profile()


def _save_config(config: EmbeddingConfig) -> EmbeddingConfig:
    global _CACHE, _CACHE_MODEL_ID
    settings = config_manager.load_config() or SettingsPayload()
    previous_model_id = _CACHE_MODEL_ID
    settings.embedding = config.model_dump(mode="json")
    config_manager.save_config(settings)
    if previous_model_id and previous_model_id != _model_id(config):
        if _CACHE:
            _CACHE.clear()
        _CACHE_MODEL_ID = _model_id(config)
    return config


def _model_id(config: EmbeddingConfig) -> str:
    return f"{config.provider}:{config.model}:{config.dimensions or 'default'}"


def _api_key_name(provider: EmbeddingProvider, query: bool = False) -> str:
    return f"ragkit.embedding{'.query' if query else ''}.{provider.value}.api_key"


def _get_cache(config: EmbeddingConfig) -> BaseEmbeddingCache:
    global _CACHE
    if _CACHE is None:
        _CACHE = create_cache(config.cache_backend)
    return _CACHE


@router.get("/config", response_model=EmbeddingConfig)
async def get_embedding_config() -> EmbeddingConfig:
    cfg = _get_current_config()
    cfg.api_key_set = secrets_manager.exists(_api_key_name(cfg.provider))
    return cfg


@router.put("/config", response_model=EmbeddingConfig)
async def update_embedding_config(config: EmbeddingConfig) -> EmbeddingConfig:
    key_set = secrets_manager.exists(_api_key_name(config.provider))
    config.api_key_set = key_set
    return _save_config(config)


@router.post("/config/reset", response_model=EmbeddingConfig)
async def reset_embedding_config() -> EmbeddingConfig:
    cfg = _default_config_from_profile()
    cfg.api_key_set = secrets_manager.exists(_api_key_name(cfg.provider))
    return _save_config(cfg)


@router.get("/models")
async def get_available_models(provider: EmbeddingProvider):
    return [m.model_dump(mode="json") for m in MODEL_CATALOG.get(provider, [])]


@router.get("/environment")
async def get_environment_info():
    return detect_environment()


@router.post("/test-connection")
async def test_embedding_connection(provider: EmbeddingProvider | None = None, model: str | None = None):
    cfg = _get_current_config()
    if provider:
        cfg.provider = provider
    if model:
        cfg.model = model
    api_key = secrets_manager.retrieve(_api_key_name(cfg.provider))
    engine = EmbeddingEngine(cfg, api_key=api_key)
    return engine.test_connection()


@router.post("/test-embedding", response_model=EmbeddingTestResult)
async def test_embedding(payload: EmbeddingTestRequest) -> EmbeddingTestResult:
    cfg = _get_current_config()
    api_key = secrets_manager.retrieve(_api_key_name(cfg.provider))
    engine = EmbeddingEngine(cfg, api_key=api_key)
    model_id = engine.model_id
    cache = _get_cache(cfg)

    def get_or_embed(text: str):
        if cfg.cache_enabled:
            cached = cache.get(text, model_id)
            if cached is not None:
                return cached, 1
        out = engine.embed_text(text)
        if cfg.cache_enabled:
            cache.put(text, model_id, out.vector)
        return out.vector, out.latency_ms

    vector_a, latency_a = get_or_embed(payload.text_a)
    vector_b, latency_b = get_or_embed(payload.text_b)
    token_counter = TokenCounter()

    return EmbeddingTestResult(
        dimensions=len(vector_a),
        tokens_a=token_counter.count(payload.text_a),
        tokens_b=token_counter.count(payload.text_b),
        latency_ms_a=latency_a,
        latency_ms_b=latency_b,
        cosine_similarity=round(cosine_similarity(vector_a, vector_b), 4),
    )


@router.get("/cache/stats")
async def get_cache_stats():
    cfg = _get_current_config()
    cache = _get_cache(cfg)
    return cache.stats(_model_id(cfg))


@router.post("/cache/clear")
async def clear_cache():
    cfg = _get_current_config()
    cache = _get_cache(cfg)
    cache.clear()
    return {"success": True}


@router.post("/secrets/store")
async def store_secret(payload: SecretStorePayload):
    if not payload.value:
        raise HTTPException(status_code=400, detail="value is required")
    secrets_manager.store(payload.key_name, payload.value)
    return {"success": True}


@router.post("/secrets/exists")
async def secret_exists(payload: SecretStorePayload):
    return {"exists": secrets_manager.exists(payload.key_name)}


@router.post("/secrets/delete")
async def delete_secret(payload: SecretStorePayload):
    secrets_manager.delete(payload.key_name)
    return {"success": True}
