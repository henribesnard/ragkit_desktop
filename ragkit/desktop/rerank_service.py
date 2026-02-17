"""Shared reranking settings and provider helpers for desktop APIs."""

from __future__ import annotations

from typing import Any

from ragkit.config.rerank_schema import (
    RerankConfig,
    RerankModelInfo,
    RerankProvider,
    default_model_for_provider,
    model_catalog_for_provider,
)
from ragkit.desktop.profiles import build_full_config
from ragkit.desktop.settings_store import load_settings, save_settings
from ragkit.retrieval.reranker import BaseReranker, create_reranker
from ragkit.security.secrets import secrets_manager

COHERE_API_KEY_SECRET = "cohere_api_key"


def _profile_rerank_payload() -> dict[str, Any]:
    settings = load_settings()
    profile_name = settings.profile or "general"
    full_config = build_full_config(profile_name, settings.calibration_answers)
    payload = full_config.get("rerank", {})
    return payload if isinstance(payload, dict) else {}


def default_rerank_config() -> RerankConfig:
    config = RerankConfig.model_validate(_profile_rerank_payload())
    if config.provider != RerankProvider.NONE and not config.model:
        config.model = default_model_for_provider(config.provider)
    config.api_key_set = secrets_manager.exists(COHERE_API_KEY_SECRET)
    return config


def get_rerank_config() -> RerankConfig:
    settings = load_settings()
    payload = settings.rerank if isinstance(settings.rerank, dict) else {}
    config = RerankConfig.model_validate(payload) if payload else default_rerank_config()
    if config.provider != RerankProvider.NONE and not config.model:
        config.model = default_model_for_provider(config.provider)
    config.api_key_set = secrets_manager.exists(COHERE_API_KEY_SECRET)
    return config


def save_rerank_config(config: RerankConfig) -> RerankConfig:
    if config.provider != RerankProvider.NONE and not config.model:
        config.model = default_model_for_provider(config.provider)
    settings = load_settings()
    settings.rerank = config.model_dump(mode="json", exclude={"api_key_set"})
    save_settings(settings)
    config.api_key_set = secrets_manager.exists(COHERE_API_KEY_SECRET)
    return config


def get_rerank_models(provider: RerankProvider) -> list[RerankModelInfo]:
    return model_catalog_for_provider(provider)


def resolve_reranker(config: RerankConfig) -> BaseReranker | None:
    api_key: str | None = None
    if config.provider == RerankProvider.COHERE:
        api_key = secrets_manager.retrieve(COHERE_API_KEY_SECRET)
    return create_reranker(config, api_key=api_key)
