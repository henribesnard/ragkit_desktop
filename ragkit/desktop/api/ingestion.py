# ragkit/desktop/api/ingestion.py
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

from ragkit.config.ingestion_schema import IngestionConfig, SourceConfig
from ragkit.config.manager import config_manager

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])

# In-memory cache – populated lazily from disk
_CURRENT_CONFIG: IngestionConfig | None = None
_DOCUMENTS = []

class DocumentInfo(BaseModel):
    id: str
    filename: str
    file_path: str
    file_type: str
    file_size_bytes: int
    page_count: Optional[int] = None
    language: Optional[str] = None
    last_modified: str
    word_count: Optional[int] = None
    title: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None
    keywords: List[str] = []
    creation_date: Optional[str] = None


def _get_current_config() -> IngestionConfig:
    global _CURRENT_CONFIG
    if _CURRENT_CONFIG is None:
        saved = config_manager.load_config()
        _CURRENT_CONFIG = saved or IngestionConfig(source=SourceConfig(path=""))
    return _CURRENT_CONFIG


@router.get("/config", response_model=IngestionConfig)
async def get_config():
    return _get_current_config()

@router.put("/config", response_model=IngestionConfig)
async def update_config(config: IngestionConfig):
    global _CURRENT_CONFIG
    _CURRENT_CONFIG = config
    config_manager.save_config(config)
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
async def update_document_metadata(id: str, metadata: dict):
    # Logic to update
    doc = next((d for d in _DOCUMENTS if d.id == id), None)
    if not doc:
        # Mock for now
        return DocumentInfo(id=id, filename="mock.pdf", file_path="mock.pdf", file_type="pdf", file_size_bytes=0, last_modified="", keywords=[])
    return doc

@router.post("/analyze")
async def analyze_documents():
    # Trigger analysis logic
    return {"status": "started"}
