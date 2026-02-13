# ragkit/desktop/api/ingestion.py
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

from ragkit.config.ingestion_schema import IngestionConfig, SourceConfig

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])

# In-memory storage mock for Step 1
_CURRENT_CONFIG = IngestionConfig(source=SourceConfig(path=""))
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


@router.get("/config", response_model=IngestionConfig)
async def get_config():
    return _CURRENT_CONFIG

@router.put("/config", response_model=IngestionConfig)
async def update_config(config: IngestionConfig):
    global _CURRENT_CONFIG
    _CURRENT_CONFIG = config
    return _CURRENT_CONFIG

@router.post("/config/reset", response_model=IngestionConfig)
async def reset_config():
    # Logic to reset to profile defaults
    return _CURRENT_CONFIG

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
