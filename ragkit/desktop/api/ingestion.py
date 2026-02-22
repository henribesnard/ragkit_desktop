from __future__ import annotations

import json
import logging
import re
from typing import List

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse

from ragkit.config.manager import config_manager
from ragkit.config.retrieval_schema import SearchType
from ragkit.config.vector_store_schema import GeneralSettings, VectorStoreConfig
from ragkit.desktop import documents, settings_store
from ragkit.desktop.analysis_progress import AnalysisProgress
from ragkit.desktop.ingestion_runtime import runtime
from ragkit.desktop.llm_service import sync_llm_from_general_fields
from ragkit.desktop.models import (
    AnalysisResult,
    ChangeDetectionResult,
    DocumentInfo,
    DocumentMetadataUpdate,
    IngestionConfig,
    SettingsPayload,
    SourceConfig,
)
from ragkit.desktop.profiles import build_full_config
from ragkit.storage.base import create_vector_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])
settings_router = APIRouter(prefix="/api/settings", tags=["settings"])

_CURRENT_CONFIG: IngestionConfig | None = None
_DOCUMENTS: List[DocumentInfo] = []
_DOCUMENTS_LOADED: bool = False


def _default_general_settings_from_profile(settings: SettingsPayload) -> GeneralSettings:
    profile_name = settings.profile or "general"
    full_config = build_full_config(profile_name, settings.calibration_answers)
    retrieval_payload = full_config.get("retrieval", {})
    retrieval_payload = retrieval_payload if isinstance(retrieval_payload, dict) else {}
    profile_llm = full_config.get("llm", {})
    profile_llm = profile_llm if isinstance(profile_llm, dict) else {}
    user_llm = settings.llm if isinstance(settings.llm, dict) else {}

    architecture = str(retrieval_payload.get("architecture") or "").strip().lower()
    semantic_payload = retrieval_payload.get("semantic", {})
    lexical_payload = retrieval_payload.get("lexical", {})
    semantic_enabled = bool(
        semantic_payload.get("enabled", True) if isinstance(semantic_payload, dict) else True
    )
    lexical_enabled = bool(
        lexical_payload.get("enabled", True) if isinstance(lexical_payload, dict) else True
    )

    if not semantic_enabled and lexical_enabled:
        search_type = SearchType.LEXICAL
    elif not lexical_enabled and semantic_enabled:
        search_type = SearchType.SEMANTIC
    elif architecture == "semantic":
        search_type = SearchType.SEMANTIC
    elif architecture == "lexical":
        search_type = SearchType.LEXICAL
    else:
        search_type = SearchType.HYBRID

    defaults = GeneralSettings()
    llm_provider = str(user_llm.get("provider") or profile_llm.get("provider") or "openai").strip().lower() or "openai"
    llm_model = str(user_llm.get("model") or profile_llm.get("model") or "gpt-4o-mini").strip() or "gpt-4o-mini"
    llm_temperature = float(user_llm.get("temperature", profile_llm.get("temperature", defaults.llm_temperature)))
    response_language = str(user_llm.get("response_language") or defaults.response_language).strip().lower()
    if response_language not in {"auto", "fr", "en"}:
        response_language = "auto"
    return GeneralSettings(
        ingestion_mode=defaults.ingestion_mode,
        auto_ingestion_delay=defaults.auto_ingestion_delay,
        search_type=search_type,
        llm_model=f"{llm_provider}/{llm_model}",
        llm_temperature=llm_temperature,
        response_language=response_language,
    )


def _get_documents() -> List[DocumentInfo]:
    global _DOCUMENTS, _DOCUMENTS_LOADED
    if not _DOCUMENTS_LOADED:
        _DOCUMENTS = settings_store.load_documents()
        _DOCUMENTS_LOADED = True
    return _DOCUMENTS


def _save_documents() -> None:
    settings_store.save_documents(_DOCUMENTS)


def _get_current_config() -> IngestionConfig:
    global _CURRENT_CONFIG
    if _CURRENT_CONFIG is None:
        saved = config_manager.load_config()
        if saved and saved.ingestion:
            _CURRENT_CONFIG = saved.ingestion
        else:
            _CURRENT_CONFIG = IngestionConfig(source=SourceConfig(path=""))
    return _CURRENT_CONFIG


@router.get("/setup-status")
async def get_setup_status():
    saved = config_manager.load_config()
    return {"setup_completed": bool(saved and saved.setup_completed)}


@router.get("/config", response_model=IngestionConfig)
async def get_config():
    return _get_current_config()


@router.put("/config", response_model=IngestionConfig)
async def update_config(config: IngestionConfig):
    global _CURRENT_CONFIG
    _CURRENT_CONFIG = config
    current_settings = config_manager.load_config() or SettingsPayload()
    current_settings.ingestion = config
    config_manager.save_config(current_settings)
    return _CURRENT_CONFIG


@router.post("/config/reset", response_model=IngestionConfig)
async def reset_config():
    global _CURRENT_CONFIG
    _CURRENT_CONFIG = None
    return _get_current_config()


@router.get("/documents", response_model=List[DocumentInfo])
async def get_documents():
    return _get_documents()


@router.put("/documents/{id}/metadata", response_model=DocumentInfo)
async def update_document_metadata(id: str, metadata: DocumentMetadataUpdate):
    if not re.fullmatch(r"[a-f0-9]{40}", id):
        raise HTTPException(status_code=400, detail="Invalid document id format")
    docs = _get_documents()
    for doc in docs:
        if doc.id == id:
            for field_name in metadata.model_fields_set:
                value = getattr(metadata, field_name)
                if value is not None:
                    setattr(doc, field_name, value)
            _save_documents()
            return doc
    raise HTTPException(status_code=404, detail="Document not found")


@router.get("/analyze/progress")
async def get_analysis_progress():
    return AnalysisProgress.get_instance().get_snapshot()


def _run_analysis_background(config: IngestionConfig):
    try:
        docs, _errors = documents.analyze_documents(config)
        global _DOCUMENTS, _DOCUMENTS_LOADED
        _DOCUMENTS = docs
        _DOCUMENTS_LOADED = True
        _save_documents()
    except Exception as e:
        logger.error("Background analysis failed: %s", e)
        AnalysisProgress.get_instance().set_error()


@router.post("/analyze", response_model=AnalysisResult)
async def analyze_documents(background_tasks: BackgroundTasks) -> AnalysisResult:
    config = _get_current_config()
    if not config.source.path:
        return AnalysisResult(success=False, analyzed_count=0, errors=["No source path configured"])
    background_tasks.add_task(_run_analysis_background, config)
    return AnalysisResult(success=True, analyzed_count=0, errors=[])


@router.post("/start")
async def start_ingestion(payload: dict | None = None):
    payload = payload or {}
    return await runtime.start(incremental=bool(payload.get("incremental", False)))


@router.post("/pause")
async def pause_ingestion():
    return await runtime.pause()


@router.post("/resume")
async def resume_ingestion():
    return await runtime.resume()


@router.post("/cancel")
async def cancel_ingestion():
    return await runtime.cancel()


@router.get("/status")
async def ingestion_status():
    runtime.ensure_background_tasks()
    return runtime.progress


@router.get("/changes", response_model=ChangeDetectionResult)
async def ingestion_changes():
    runtime.ensure_background_tasks()
    return runtime.detect_changes()


@router.get("/history")
async def ingestion_history(limit: int = 10):
    return [h.model_dump(mode="json") for h in runtime.get_history(limit)]


@router.get("/log")
async def ingestion_log(version: str | None = None):
    return [entry.model_dump(mode="json") for entry in runtime.logs]


@router.get("/log/export")
async def export_ingestion_log(version: str | None = None):
    data = "\n".join(f"{e.timestamp} [{e.level}] {e.message}" for e in runtime.logs)
    out = settings_store.get_data_dir() / "ingestion-last.log"
    out.write_text(data, encoding="utf-8")
    return {"path": str(out)}


@router.post("/history/{version}/restore")
async def restore_ingestion_version(version: str):
    settings = settings_store.load_settings()
    store = create_vector_store(VectorStoreConfig.model_validate(settings.vector_store or {}))
    await store.restore_snapshot(version)
    return {"success": True}


@router.get("/progress/stream")
async def progress_stream():
    queue = runtime.subscribe()

    async def event_generator():
        try:
            yield f"event: progress\ndata: {runtime.progress.model_dump_json()}\n\n"
            while True:
                item = await queue.get()
                yield f"event: {item['event']}\ndata: {json.dumps(item['data'])}\n\n"
        finally:
            runtime.unsubscribe(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/settings/general")
async def get_general_settings():
    runtime.ensure_background_tasks()
    settings = settings_store.load_settings()
    payload = settings.general if isinstance(settings.general, dict) else {}
    defaults = _default_general_settings_from_profile(settings).model_dump(mode="json")
    if payload:
        merged = {**defaults, **payload}
        return GeneralSettings.model_validate(merged).model_dump(mode="json")
    return defaults


@router.put("/settings/general")
async def update_general_settings(payload: GeneralSettings):
    runtime.ensure_background_tasks()
    settings = settings_store.load_settings()
    settings.general = payload.model_dump(mode="json")
    llm_payload = settings.llm if isinstance(settings.llm, dict) else {}
    settings.llm = sync_llm_from_general_fields(
        llm_payload=llm_payload,
        llm_model=payload.llm_model,
        llm_temperature=payload.llm_temperature,
        response_language=payload.response_language,
    )
    settings_store.save_settings(settings)
    return payload.model_dump(mode="json")


@settings_router.get("/general")
async def get_general_settings_alias():
    return await get_general_settings()


@settings_router.put("/general")
async def update_general_settings_alias(payload: GeneralSettings):
    return await update_general_settings(payload)
