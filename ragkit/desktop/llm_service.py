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
    if provider in {LLMProvider.OPENAI, LLMProvider.ANTHROPIC, LLMProvider.MISTRAL, LLMProvider.DEEPSEEK}:
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
            # Detect available RAM
            available_ram_gb = 0.0
            try:
                import psutil
                available_ram_gb = psutil.virtual_memory().available / (1024 ** 3)
            except ImportError:
                available_ram_gb = 999.0  # assume unlimited if psutil unavailable

            # Short timeout so we don't hang if Ollama is not running
            response = httpx.get("http://127.0.0.1:11434/api/tags", timeout=2.0)
            response.raise_for_status()
            data = response.json()
            models_list = data.get("models", [])
            local_models = []
            for m in models_list:
                m_name = m.get("name")
                if not m_name:
                    continue

                family = m.get("details", {}).get("family", "").lower()
                is_llm = family in ["llama", "qwen2", "qwen3", "gemma", "gemma2", "mixtral", "command-r", "phi3", "phi4", "mistral", "deepseek", "deepseek2"]
                if not is_llm:
                    is_llm = not any(x in m_name.lower() for x in ["embed", "bge", "minilm", "e5"])

                if not is_llm:
                    continue

                # Model file size from Ollama API (bytes)
                model_size_bytes = m.get("size", 0)
                # RAM required ≈ model file size × 1.2 (overhead for KV cache, etc.)
                ram_required_gb = round((model_size_bytes / (1024 ** 3)) * 1.2, 1) if model_size_bytes else None
                # A model is compatible if it fits in available RAM
                compatible = (ram_required_gb or 0) < available_ram_gb if ram_required_gb else True

                # Extract parameter size for quality estimate
                params = m.get("details", {}).get("parameter_size", "")
                quality = 3
                if params:
                    try:
                        param_num = float(params.lower().replace("b", ""))
                        if param_num >= 30:
                            quality = 5
                        elif param_num >= 7:
                            quality = 4
                        elif param_num >= 3:
                            quality = 3
                        else:
                            quality = 2
                    except (ValueError, AttributeError):
                        pass

                size_label = f" ({ram_required_gb:.1f} GB)" if ram_required_gb else ""
                compat_label = "" if compatible else " ⚠️ RAM insuffisante"

                local_models.append(
                    LLMModelInfo(
                        id=m_name,
                        name=f"{m_name}{size_label}{compat_label}",
                        provider=LLMProvider.OLLAMA,
                        context_window=int(m.get("details", {}).get("context_length", 8192) or 8192),
                        languages="multilingual",
                        quality_rating=quality,
                        latency_hint="local inference",
                        local=True,
                        ram_required_gb=ram_required_gb,
                        compatible=compatible,
                    )
                )
            if local_models:
                # Sort: compatible first, then by size ascending
                local_models.sort(key=lambda x: (not x.compatible, x.ram_required_gb or 0))
                return local_models
        except Exception:
            pass  # fallback to catalog
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
        elif config.provider == LLMProvider.MISTRAL:
            api_key = os.getenv("MISTRAL_API_KEY")
        elif config.provider == LLMProvider.DEEPSEEK:
            api_key = os.getenv("DEEPSEEK_API_KEY")
            
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
