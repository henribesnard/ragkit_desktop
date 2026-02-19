"""Shared data models for the desktop backend."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator

PROFILE_IDS = {
    "technical_documentation",
    "faq_support",
    "legal_compliance",
    "reports_analysis",
    "general",
}

SUPPORTED_FILE_TYPES = [
    "pdf",
    "docx",
    "doc",
    "md",
    "txt",
    "html",
    "csv",
    "rst",
    "xml",
    "json",
    "yaml",
]


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


class FolderEntry(BaseModel):
    path: str
    files: int


class SourceConfig(BaseModel):
    path: str = Field(default="", description="Absolute path to documents folder")
    recursive: bool = True
    excluded_dirs: list[str] = Field(default_factory=list)
    file_types: list[str] = Field(default_factory=lambda: ["pdf", "docx", "md", "txt"])
    exclusion_patterns: list[str] = Field(default_factory=list)
    max_file_size_mb: int = Field(default=50, ge=1, le=500)

    @field_validator("file_types")
    @classmethod
    def normalize_file_types(cls, values: list[str]) -> list[str]:
        normalized = [value.strip().lower().lstrip(".") for value in values if value.strip()]
        deduplicated = list(dict.fromkeys(normalized))
        if not deduplicated:
            raise ValueError("At least one file type must be selected.")
        unsupported = sorted(set(deduplicated) - set(SUPPORTED_FILE_TYPES))
        if unsupported:
            raise ValueError(f"Unsupported file types: {', '.join(unsupported)}")
        return deduplicated

    @field_validator("path")
    @classmethod
    def validate_path(cls, value: str) -> str:
        normalized = value.strip()
        if "\x00" in normalized:
            raise ValueError("Invalid source path.")
        return normalized

    @field_validator("excluded_dirs", "exclusion_patterns")
    @classmethod
    def strip_values(cls, values: list[str]) -> list[str]:
        return [value.strip() for value in values if value.strip()]


class ParsingConfig(BaseModel):
    engine: ParsingEngine = ParsingEngine.AUTO
    ocr_enabled: bool = False
    ocr_language: list[str] = Field(default_factory=lambda: ["fra", "eng"])
    ocr_engine: OcrEngine = OcrEngine.TESSERACT
    table_extraction_strategy: TableExtractionStrategy = TableExtractionStrategy.PRESERVE
    image_captioning_enabled: bool = False
    header_detection: bool = True


class PreprocessingConfig(BaseModel):
    lowercase: bool = False
    remove_punctuation: bool = False
    normalize_unicode: bool = True
    remove_urls: bool = False
    language_detection: bool = True
    deduplication_strategy: DeduplicationStrategy = DeduplicationStrategy.EXACT
    deduplication_threshold: float = Field(default=0.95, ge=0.0, le=1.0)


class IngestionConfig(BaseModel):
    source: SourceConfig
    parsing: ParsingConfig = Field(default_factory=ParsingConfig)
    preprocessing: PreprocessingConfig = Field(default_factory=PreprocessingConfig)


class SourceConfigPatch(BaseModel):
    path: str | None = None
    recursive: bool | None = None
    excluded_dirs: list[str] | None = None
    file_types: list[str] | None = None
    exclusion_patterns: list[str] | None = None
    max_file_size_mb: int | None = Field(default=None, ge=1, le=500)


class ParsingConfigPatch(BaseModel):
    engine: ParsingEngine | None = None
    ocr_enabled: bool | None = None
    ocr_language: list[str] | None = None
    ocr_engine: OcrEngine | None = None
    table_extraction_strategy: TableExtractionStrategy | None = None
    image_captioning_enabled: bool | None = None
    header_detection: bool | None = None


class PreprocessingConfigPatch(BaseModel):
    lowercase: bool | None = None
    remove_punctuation: bool | None = None
    normalize_unicode: bool | None = None
    remove_urls: bool | None = None
    language_detection: bool | None = None
    deduplication_strategy: DeduplicationStrategy | None = None
    deduplication_threshold: float | None = Field(default=None, ge=0.0, le=1.0)


class IngestionConfigPatch(BaseModel):
    source: SourceConfigPatch | None = None
    parsing: ParsingConfigPatch | None = None
    preprocessing: PreprocessingConfigPatch | None = None


class FolderValidationRequest(BaseModel):
    folder_path: str
    recursive: bool = True


class ScanFolderRequest(BaseModel):
    folder_path: str
    recursive: bool = True
    excluded_dirs: list[str] = Field(default_factory=list)
    exclusion_patterns: list[str] = Field(default_factory=list)
    max_file_size_mb: int = Field(default=50, ge=1, le=500)


class FolderStats(BaseModel):
    files: int
    size_mb: float
    extensions: list[str]
    extension_counts: dict[str, int]


class FolderNode(BaseModel):
    name: str
    path: str
    is_dir: bool = True
    children: list[FolderNode] = Field(default_factory=list)
    file_count: int = 0
    size_bytes: int = 0


class FolderValidationResult(BaseModel):
    valid: bool
    error: str | None = None
    error_code: str | None = None
    stats: FolderStats
    subdirectories: list[FolderEntry] = Field(default_factory=list)
    tree: FolderNode | None = None


class FileTypeInfo(BaseModel):
    extension: str
    display_name: str
    count: int
    size_mb: float
    supported: bool


class FolderScanResult(BaseModel):
    supported_types: list[FileTypeInfo]
    unsupported_types: list[FileTypeInfo]
    total_files: int
    total_size_mb: float


class WizardAnswers(BaseModel):
    profile: str
    calibration: dict[str, bool] = Field(default_factory=dict)

    @field_validator("profile")
    @classmethod
    def validate_profile(cls, value: str) -> str:
        if value not in PROFILE_IDS:
            raise ValueError(f"Unknown profile: {value}")
        return value


class WizardProfileResponse(BaseModel):
    profile_name: str
    profile_display_name: str
    icon: str
    description: str
    config_summary: dict[str, str]
    full_config: dict[str, Any]


class SetupStatusResponse(BaseModel):
    has_completed_setup: bool


class EnvironmentInfo(BaseModel):
    gpu_available: bool
    ollama_available: bool
    local_models: list[str] = Field(default_factory=list)


class DocumentInfo(BaseModel):
    id: str
    filename: str
    file_path: str
    file_type: str
    file_size_bytes: int
    mime_type: str | None = None
    ingested_at: str | None = None
    page_count: int | None = None
    char_count: int | None = None
    language: str | None = None
    last_modified: str
    encoding: str | None = None
    word_count: int | None = None
    title: str | None = None
    author: str | None = None
    description: str | None = None
    keywords: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    category: str | None = None
    creation_date: str | None = None
    has_tables: bool = False
    has_images: bool = False
    has_code: bool = False
    parser_engine: str | None = None
    ocr_applied: bool = False
    text_preview: str | None = None
    # Hierarchie organisationnelle (metadata.md)
    domain: str | None = None
    subdomain: str | None = None
    # Classification etendue (metadata.md)
    confidentiality: str | None = None  # public / internal / confidential / secret
    status: str | None = None  # draft / review / published / archived
    source_url: str | None = None
    version: str | None = None
    # Qualite parsing
    parsing_quality: float | None = None  # Score 0-1
    parsing_warnings: list[str] = Field(default_factory=list)
    # Extensible
    custom: dict[str, Any] = Field(default_factory=dict)


class DocumentMetadataUpdate(BaseModel):
    title: str | None = None
    author: str | None = None
    description: str | None = None
    keywords: list[str] | None = None
    tags: list[str] | None = None
    category: str | None = None
    language: str | None = None
    creation_date: str | None = None
    domain: str | None = None
    subdomain: str | None = None
    confidentiality: str | None = None
    status: str | None = None
    source_url: str | None = None
    version: str | None = None

    @field_validator("title", "author", "description", "category", "language", "domain", "subdomain", "confidentiality", "status", "source_url", "version")
    @classmethod
    def strip_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None

    @field_validator("keywords", "tags")
    @classmethod
    def sanitize_list_fields(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = [item.strip() for item in value if item and item.strip()]
        return cleaned


class AnalysisResult(BaseModel):
    success: bool
    analyzed_count: int
    errors: list[str] = Field(default_factory=list)




class IngestionChange(BaseModel):
    type: str
    path: str
    file_size: int | None = None
    last_modified: str | None = None


class ChangeDetectionResult(BaseModel):
    changes: list[IngestionChange] = Field(default_factory=list)
    added: int = 0
    modified: int = 0
    removed: int = 0


class IngestionProgress(BaseModel):
    status: str = "idle"
    version: str = "v0"
    is_incremental: bool = False
    phase: str = "idle"
    doc_index: int = 0
    doc_total: int = 0
    current_doc: str | None = None
    elapsed_seconds: float = 0
    estimated_remaining_seconds: float | None = None
    docs_succeeded: int = 0
    docs_warnings: int = 0
    docs_failed: int = 0
    docs_skipped: int = 0
    total_chunks: int = 0


class IngestionHistoryEntry(BaseModel):
    version: str
    started_at: str
    completed_at: str | None = None
    status: str
    total_docs: int = 0
    total_chunks: int = 0
    docs_added: int = 0
    docs_modified: int = 0
    docs_removed: int = 0
    docs_skipped: int = 0
    docs_failed: int = 0
    duration_seconds: float | None = None
    is_incremental: bool = False


class IngestionLogEntry(BaseModel):
    timestamp: str
    level: str
    message: str

class SettingsPayload(BaseModel):
    version: str = "1.0.0"
    setup_completed: bool = False
    profile: str | None = None
    calibration_answers: dict[str, bool] = Field(default_factory=dict)
    ingestion: IngestionConfig | None = None
    chunking: dict[str, Any] = Field(default_factory=dict)
    embedding: dict[str, Any] = Field(default_factory=dict)
    retrieval: dict[str, Any] = Field(default_factory=dict)
    vector_store: dict[str, Any] = Field(default_factory=dict)
    general: dict[str, Any] = Field(default_factory=dict)
    rerank: dict[str, Any] = Field(default_factory=dict)
    llm: dict[str, Any] = Field(default_factory=dict)
    agents: dict[str, Any] = Field(default_factory=dict)
    monitoring: dict[str, Any] = Field(default_factory=dict)


class WizardCompletionRequest(BaseModel):
    config: SettingsPayload
