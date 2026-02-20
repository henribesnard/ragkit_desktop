"""API routes for security, export/import, conversation export, and UX features."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException

from ragkit.config.security_schema import APIKeyStatus, SecurityConfig
from ragkit.desktop.settings_store import load_settings, save_settings

router = APIRouter(prefix="/api", tags=["security"])

_SECURITY_CONFIG: SecurityConfig | None = None

# --- Providers that may have API keys ---
_KEY_PROVIDERS = ["openai", "anthropic", "cohere", "mistral", "voyageai"]
_KEY_PREFIX = "ragkit"


def _get_security_config() -> SecurityConfig:
    global _SECURITY_CONFIG
    if _SECURITY_CONFIG is None:
        settings = load_settings()
        raw = settings.security if isinstance(settings.security, dict) else {}
        _SECURITY_CONFIG = SecurityConfig.model_validate(raw)
    return _SECURITY_CONFIG


def _save_security_config(config: SecurityConfig) -> SecurityConfig:
    global _SECURITY_CONFIG
    _SECURITY_CONFIG = config
    settings = load_settings()
    settings.security = config.model_dump(mode="json")
    save_settings(settings)
    return config


# --- Security Config ---


@router.get("/security/config", response_model=SecurityConfig)
async def get_security_configuration() -> SecurityConfig:
    return _get_security_config()


@router.put("/security/config", response_model=SecurityConfig)
async def update_security_configuration(payload: dict[str, Any]) -> SecurityConfig:
    current = _get_security_config().model_dump(mode="json")
    merged = {**current, **payload}
    try:
        config = SecurityConfig.model_validate(merged)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _save_security_config(config)


@router.post("/security/config/reset", response_model=SecurityConfig)
async def reset_security_configuration() -> SecurityConfig:
    return _save_security_config(SecurityConfig())


# --- API Keys Status ---


@router.get("/security/keys", response_model=list[APIKeyStatus])
async def get_api_keys_status() -> list[APIKeyStatus]:
    from ragkit.security.secrets import secrets_manager

    statuses: list[APIKeyStatus] = []
    for provider in _KEY_PROVIDERS:
        # Check multiple key name patterns
        key_names = [
            f"{_KEY_PREFIX}.embedding.{provider}.api_key",
            f"{_KEY_PREFIX}.llm.{provider}.api_key",
            f"{_KEY_PREFIX}.rerank.{provider}.api_key",
        ]
        configured = any(secrets_manager.exists(k) for k in key_names)
        statuses.append(APIKeyStatus(provider=provider, configured=configured))
    return statuses


# --- Purge All Data ---


@router.post("/security/purge-all")
async def purge_all_data() -> dict[str, Any]:
    from ragkit.desktop.settings_store import get_data_root

    import shutil

    data_root = get_data_root()
    deleted: list[str] = []

    # Delete logs
    logs_dir = data_root / "logs"
    if logs_dir.exists():
        shutil.rmtree(logs_dir, ignore_errors=True)
        deleted.append("logs")

    # Delete data (documents, vectors)
    data_dir = data_root / "data"
    if data_dir.exists():
        shutil.rmtree(data_dir, ignore_errors=True)
        deleted.append("data")

    # Delete query logs DB
    db_path = data_root / "query_logs.db"
    if db_path.exists():
        db_path.unlink(missing_ok=True)
        deleted.append("query_logs")

    return {"success": True, "deleted": deleted}


# --- Config Export/Import ---


@router.post("/config/export")
async def export_config(payload: dict[str, str]) -> dict[str, Any]:
    path = payload.get("path", "")
    if not path:
        raise HTTPException(status_code=400, detail="Export path is required")

    from ragkit.config.config_export import ConfigExporter

    try:
        result_path = ConfigExporter().export(path)
        return {"success": True, "path": result_path}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/config/import/validate")
async def validate_import(payload: dict[str, str]) -> dict[str, Any]:
    path = payload.get("path", "")
    if not path:
        raise HTTPException(status_code=400, detail="Import path is required")

    from ragkit.config.config_export import ConfigImporter

    try:
        preview = ConfigImporter().validate(path)
        return preview
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/config/import")
async def import_config(payload: dict[str, str]) -> dict[str, bool]:
    path = payload.get("path", "")
    mode = payload.get("mode", "replace")
    if not path:
        raise HTTPException(status_code=400, detail="Import path is required")

    from ragkit.config.config_export import ConfigImporter

    try:
        importer = ConfigImporter()
        if mode == "merge":
            importer.import_merge(path)
        else:
            importer.import_replace(path)
        return {"success": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# --- Conversation Export ---


@router.post("/conversation/export")
async def export_conversation(payload: dict[str, str]) -> dict[str, Any]:
    fmt = payload.get("format", "md")
    path = payload.get("path", "")
    if not path:
        raise HTTPException(status_code=400, detail="Export path is required")

    from ragkit.desktop.api.chat import _get_conversation_memory
    from ragkit.export.conversation_export import ConversationExporter

    memory = _get_conversation_memory()
    messages = [
        {"role": msg.role, "content": msg.content, "sources": msg.sources}
        for msg in memory.list_messages()
    ]

    settings = load_settings()
    profile = settings.profile or "general"
    exporter = ConversationExporter()

    try:
        if fmt == "pdf":
            result_path = exporter.to_pdf(messages, profile, path)
        else:
            md_content = exporter.to_markdown(messages, profile)
            with open(path, "w", encoding="utf-8") as f:
                f.write(md_content)
            result_path = path
        return {"success": True, "path": result_path}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# --- Test Question ---


@router.post("/test-question")
async def generate_test_question() -> dict[str, str]:
    default_question = "Quels sont les principaux themes abordes dans les documents ?"
    try:
        from ragkit.desktop.llm_service import get_llm_config, resolve_llm_provider

        llm_config = get_llm_config()
        provider = resolve_llm_provider(llm_config)
        # Generate a relevant test question from document metadata
        settings = load_settings()
        if settings.ingestion and settings.ingestion.source.path:
            prompt = (
                "Generate a single relevant test question in French for a RAG system "
                "that indexes documents. The question should test basic retrieval. "
                "Reply with ONLY the question, no other text."
            )
            response = await provider.generate(prompt)
            question = response.strip().strip('"')
            if question:
                return {"question": question}
    except Exception:
        pass
    return {"question": default_question}


# --- Expertise Level ---


@router.put("/general/expertise")
async def set_expertise_level(payload: dict[str, str]) -> dict[str, bool]:
    level = payload.get("level", "simple")
    if level not in ("simple", "intermediate", "expert"):
        raise HTTPException(status_code=400, detail=f"Invalid expertise level: {level}")
    settings = load_settings()
    general = settings.general if isinstance(settings.general, dict) else {}
    general["expertise_level"] = level
    settings.general = general
    save_settings(settings)
    return {"success": True}
