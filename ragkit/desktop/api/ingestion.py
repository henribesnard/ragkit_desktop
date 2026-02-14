# ragkit/desktop/api/ingestion.py
from __future__ import annotations

import logging
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])

# In-memory cache – populated lazily from disk
_CURRENT_CONFIG: IngestionConfig | None = None
_DOCUMENTS: List[DocumentInfo] = []


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
    return _DOCUMENTS


@router.put("/documents/{id}/metadata", response_model=DocumentInfo)
async def update_document_metadata(id: str, metadata: DocumentMetadataUpdate):
    # Logic to update
    # Find doc
    for doc in _DOCUMENTS:
        if doc.id == id:
            if metadata.title is not None:
                doc.title = metadata.title
            if metadata.author is not None:
                doc.author = metadata.author
            if metadata.description is not None:
                doc.description = metadata.description
            if metadata.keywords is not None:
                doc.keywords = metadata.keywords
            if metadata.creation_date is not None:
                doc.creation_date = metadata.creation_date
            return doc
            
    raise HTTPException(status_code=404, detail="Document not found")


@router.post("/analyze", response_model=AnalysisResult)
async def analyze_documents() -> AnalysisResult:
    config = _get_current_config()
    if not config.source.path:
        return AnalysisResult(success=False, analyzed_count=0, errors=["No source path configured"])
        
    try:
        # Trigger analysis logic
        docs, errors = documents.analyze_documents(config)
        
        # Update cache
        global _DOCUMENTS
        _DOCUMENTS = docs
        
        return AnalysisResult(
            success=len(docs) > 0,
            analyzed_count=len(docs),
            errors=errors
        )
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        return AnalysisResult(success=False, analyzed_count=0, errors=[str(e)])
