"""Shared LLM settings and provider helpers for desktop APIs."""

from __future__ import annotations

from typing import Any

from ragkit.config.llm_schema import (
    LLMConfig,
    LLMModelInfo,
    LLMProvider,
    ResponseLanguage,
    default_model_for_provider,
    model_catalog_for_provider,
)
from ragkit.desktop.profiles import build_full_config
from ragkit.desktop.settings_store import load_settings, save_settings
from ragkit.llm import create_llm_provider
from ragkit.llm.base import BaseLLMProvider
from ragkit.security.secrets import secrets_manager


def api_key_secret_name(provider: LLMProvider) -> str | None:
    if provider in {LLMProvider.OPENAI, LLMProvider.ANTHROPIC, LLMProvider.MISTRAL}:
        return f"ragkit.llm.{provider.value}.api_key"
    return None


def _profile_llm_payload() -> dict[str, Any]:
    settings = load_settings()
    profile_name = settings.profile or "general"
    full_config = build_full_config(profile_name, settings.calibration_answers)
    payload = full_config.get("llm", {})
    return payload if isinstance(payload, dict) else {}


def default_llm_config() -> LLMConfig:
    config = LLMConfig.model_validate(_profile_llm_payload())
    if not config.model:
        config.model = default_model_for_provider(config.provider)
    secret_name = api_key_secret_name(config.provider)
    config.api_key_set = bool(secret_name and secrets_manager.exists(secret_name))
    return config


def get_llm_config() -> LLMConfig:
    settings = load_settings()
    payload = settings.llm if isinstance(settings.llm, dict) else {}
    config = LLMConfig.model_validate(payload) if payload else default_llm_config()
    if not config.model:
        config.model = default_model_for_provider(config.provider)
    secret_name = api_key_secret_name(config.provider)
    config.api_key_set = bool(secret_name and secrets_manager.exists(secret_name))
    return config


def save_llm_config(config: LLMConfig) -> LLMConfig:
    if not config.model:
        config.model = default_model_for_provider(config.provider)

    settings = load_settings()
    settings.llm = config.model_dump(mode="json", exclude={"api_key_set"})

    general_payload = settings.general if isinstance(settings.general, dict) else {}
    general_payload["llm_model"] = f"{config.provider.value}/{config.model}"
    general_payload["llm_temperature"] = config.temperature
    general_payload["response_language"] = config.response_language.value
    settings.general = general_payload
    save_settings(settings)

    secret_name = api_key_secret_name(config.provider)
    config.api_key_set = bool(secret_name and secrets_manager.exists(secret_name))
    return config


def list_llm_models(provider: LLMProvider) -> list[LLMModelInfo]:
    if provider == LLMProvider.OLLAMA:
        import httpx
        try:
            # Short timeout so we don't hang if Ollama is not running
            response = httpx.get("http://127.0.0.1:11434/api/tags", timeout=1.0)
            response.raise_for_status()
            data = response.json()
            models_list = data.get("models", [])
            local_models = []
            for m in models_list:
                m_name = m.get("name")
                if not m_name:
                    continue
                    
                family = m.get("details", {}).get("family", "").lower()
                is_llm = family in ["llama", "qwen2", "gemma", "mixtral", "command-r", "phi3"]
                if not is_llm:
                    is_llm = not any(x in m_name.lower() for x in ["embed", "bge", "minilm"])
                    
                if is_llm:
                        local_models.append(
                            LLMModelInfo(
                                id=m_name,
                                name=f"{m_name} (Ollama)",
                                provider=LLMProvider.OLLAMA,
                                context_window=8192,
                                languages="multilingual",
                                quality_rating=3,
                                latency_hint="local inference",
                                local=True
                            )
                        )
            if local_models:
                return local_models
        except Exception:
            pass # fallback to catalog
    return model_catalog_for_provider(provider)


def resolve_llm_provider(config: LLMConfig) -> BaseLLMProvider:
    secret_name = api_key_secret_name(config.provider)
    api_key: str | None = None
    if secret_name:
        api_key = secrets_manager.retrieve(secret_name)
        
    if not api_key:
        import os
        if config.provider == LLMProvider.OPENAI:
            api_key = os.getenv("OPENAI_API_KEY")
        elif config.provider == LLMProvider.ANTHROPIC:
            api_key = os.getenv("ANTHROPIC_API_KEY")
        elif config.provider == LLMProvider.COHERE:
            api_key = os.getenv("COHERE_API_KEY")
        elif config.provider == LLMProvider.MISTRAL:
            api_key = os.getenv("MISTRAL_API_KEY")
            
    return create_llm_provider(config, api_key=api_key)


def sync_llm_from_general_fields(
    *,
    llm_payload: dict[str, Any],
    llm_model: str | None,
    llm_temperature: float | None,
    response_language: str | None,
) -> dict[str, Any]:
    merged = dict(llm_payload)
    if llm_model:
        text = str(llm_model).strip()
        if "/" in text:
            provider_raw, model = text.split("/", 1)
            provider_raw = provider_raw.strip().lower()
            model = model.strip()
            if provider_raw in {item.value for item in LLMProvider} and model:
                merged["provider"] = provider_raw
                merged["model"] = model
        elif text:
            merged["model"] = text
    if llm_temperature is not None:
        merged["temperature"] = float(llm_temperature)
    if response_language is not None:
        try:
            merged["response_language"] = ResponseLanguage(str(response_language).strip().lower()).value
        except Exception:
            pass
    return merged
