# ragkit/desktop/api/ingestion.py
from __future__ import annotations

import logging
import re
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ragkit.desktop.models import (
    IngestionConfig,
    SourceConfig,
    DocumentInfo,
    DocumentMetadataUpdate,
    AnalysisResult,
    SettingsPayload
)
from ragkit.config.manager import config_manager
from ragkit.desktop import documents
from ragkit.desktop import settings_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])

# In-memory cache – populated lazily from disk
_CURRENT_CONFIG: IngestionConfig | None = None
_DOCUMENTS: List[DocumentInfo] = []
_DOCUMENTS_LOADED: bool = False


def _get_documents() -> List[DocumentInfo]:
    """Lazy-load documents from disk on first access."""
    global _DOCUMENTS, _DOCUMENTS_LOADED
    if not _DOCUMENTS_LOADED:
        _DOCUMENTS = settings_store.load_documents()
        _DOCUMENTS_LOADED = True
    return _DOCUMENTS


def _save_documents() -> None:
    """Persist current documents list to disk."""
    settings_store.save_documents(_DOCUMENTS)


def _get_current_config() -> IngestionConfig:
    global _CURRENT_CONFIG
    if _CURRENT_CONFIG is None:
        saved = config_manager.load_config()
        # saved is SettingsPayload
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
    
    # We need to save this into the full settings payload
    # This might overwrite other settings if we are not careful?
    # ConfigManager.save_config takes SettingsPayload.
    # We should load existing, update ingestion, and save.
    
    current_settings = config_manager.load_config()
    if not current_settings:
        current_settings = SettingsPayload()
    
    current_settings.ingestion = config
    config_manager.save_config(current_settings)
    
    return _CURRENT_CONFIG


@router.post("/config/reset", response_model=IngestionConfig)
async def reset_config():
    global _CURRENT_CONFIG
    _CURRENT_CONFIG = None  # Force reload from disk on next get
    return _get_current_config()


@router.get("/documents", response_model=List[DocumentInfo])
async def get_documents():
    return _get_documents()


@router.put("/documents/{id}/metadata", response_model=DocumentInfo)
async def update_document_metadata(id: str, metadata: DocumentMetadataUpdate):
    if not re.fullmatch(r"[a-f0-9]{40}", id):
        raise HTTPException(status_code=400, detail="Invalid document id format")

    # Logic to update
    # Find doc
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


from fastapi import BackgroundTasks
from ragkit.desktop.analysis_progress import AnalysisProgress

@router.get("/analyze/progress")
async def get_analysis_progress():
    return AnalysisProgress.get_instance().get_snapshot()

def _run_analysis_background(config: IngestionConfig):
    try:
        docs, errors = documents.analyze_documents(config)
        global _DOCUMENTS, _DOCUMENTS_LOADED
        _DOCUMENTS = docs
        _DOCUMENTS_LOADED = True
        _save_documents()
    except Exception as e:
        logger.error(f"Background analysis failed: {e}")
        AnalysisProgress.get_instance().set_error()

@router.post("/analyze", response_model=AnalysisResult)
async def analyze_documents(background_tasks: BackgroundTasks) -> AnalysisResult:
    config = _get_current_config()
    if not config.source.path:
        return AnalysisResult(success=False, analyzed_count=0, errors=["No source path configured"])
    
    # Reset progress
    # AnalysisProgress.start is called inside documents.analyze_documents but we might want to reset explicitly or rely on start()
    
    background_tasks.add_task(_run_analysis_background, config)
    
    return AnalysisResult(
        success=True,
        analyzed_count=0, # Indicates async start
        errors=[]
    )
