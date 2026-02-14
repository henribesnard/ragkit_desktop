# ragkit/config/ingestion_schema.py
"""Pydantic schemas for ingestion & preprocessing configuration."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ParsingEngine(str, Enum):
    AUTO = "auto"
    UNSTRUCTURED = "unstructured"
    PYPDF = "pypdf"
    DOCLING = "docling"


class TableExtractionStrategy(str, Enum):
    PRESERVE = "preserve"
    MARKDOWN = "markdown"
    SEPARATE = "separate"
    IGNORE = "ignore"


class OcrEngine(str, Enum):
    TESSERACT = "tesseract"
    EASYOCR = "easyocr"


class DeduplicationStrategy(str, Enum):
    EXACT = "exact"
    FUZZY = "fuzzy"
    SEMANTIC = "semantic"
    NONE = "none"


class SourceConfig(BaseModel):
    path: str = Field(description="Absolute path to documents folder")
    recursive: bool = True
    excluded_dirs: list[str] = Field(default_factory=list)
    file_types: list[str] = Field(
        default=["pdf", "docx", "md", "txt"])
    exclusion_patterns: list[str] = Field(default_factory=list)
    max_file_size_mb: int = Field(default=50, ge=1, le=500)


class FolderNode(BaseModel):
    name: str
    path: str
    is_dir: bool = True
    children: list[FolderNode] = Field(default_factory=list)
    file_count: int = 0


class ParsingConfig(BaseModel):
    engine: ParsingEngine = ParsingEngine.AUTO
    ocr_enabled: bool = False
    ocr_language: list[str] = Field(default=["fra", "eng"])
    ocr_engine: OcrEngine = OcrEngine.TESSERACT
    table_extraction_strategy: TableExtractionStrategy = (
        TableExtractionStrategy.PRESERVE)
    image_captioning_enabled: bool = False
    header_detection: bool = True


class PreprocessingConfig(BaseModel):
    lowercase: bool = False
    remove_punctuation: bool = False
    normalize_unicode: bool = True
    remove_urls: bool = False
    language_detection: bool = True
    deduplication_strategy: DeduplicationStrategy = (
        DeduplicationStrategy.EXACT)
    deduplication_threshold: float = Field(
        default=0.95, ge=0.0, le=1.0)


class IngestionConfig(BaseModel):
    """Complete ingestion & preprocessing configuration."""
    source: SourceConfig
    parsing: ParsingConfig = Field(default_factory=ParsingConfig)
    preprocessing: PreprocessingConfig = Field(
        default_factory=PreprocessingConfig)
