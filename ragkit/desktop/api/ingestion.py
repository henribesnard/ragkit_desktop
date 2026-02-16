from __future__ import annotations

import json
import logging
import re
from typing import List

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse

from ragkit.config.manager import config_manager
from ragkit.config.vector_store_schema import GeneralSettings, VectorStoreConfig
from ragkit.desktop import documents, settings_store
from ragkit.desktop.analysis_progress import AnalysisProgress
from ragkit.desktop.ingestion_runtime import runtime
from ragkit.desktop.models import (
    AnalysisResult,
    ChangeDetectionResult,
    DocumentInfo,
    DocumentMetadataUpdate,
    IngestionConfig,
    SettingsPayload,
    SourceConfig,
)
from ragkit.storage.base import create_vector_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])
settings_router = APIRouter(prefix="/api/settings", tags=["settings"])

_CURRENT_CONFIG: IngestionConfig | None = None
_DOCUMENTS: List[DocumentInfo] = []
_DOCUMENTS_LOADED: bool = False


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
    return GeneralSettings.model_validate(settings.general or {}).model_dump(mode="json")


@router.put("/settings/general")
async def update_general_settings(payload: GeneralSettings):
    runtime.ensure_background_tasks()
    settings = settings_store.load_settings()
    settings.general = payload.model_dump(mode="json")
    settings_store.save_settings(settings)
    return payload.model_dump(mode="json")


@settings_router.get("/general")
async def get_general_settings_alias():
    return await get_general_settings()


@settings_router.put("/general")
async def update_general_settings_alias(payload: GeneralSettings):
    return await update_general_settings(payload)
