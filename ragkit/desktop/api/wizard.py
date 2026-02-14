# ragkit/desktop/api/wizard.py
from __future__ import annotations

import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ragkit.config.ingestion_schema import (
    IngestionConfig,
    SourceConfig,
    ParsingConfig,
    PreprocessingConfig,
    TableExtractionStrategy,
    DeduplicationStrategy,
    FolderNode,
)
from ragkit.config.manager import config_manager

router = APIRouter(prefix="/api/wizard", tags=["wizard"])


class FolderStats(BaseModel):
    files: int
    size_mb: float
    extensions: list[str]
    extension_counts: dict[str, int]


class FolderValidationResult(BaseModel):
    valid: bool
    error: str | None = None
    error_code: str | None = None
    stats: FolderStats | None = None
    tree: FolderNode | None = None


class FolderValidationRequest(BaseModel):
    folder_path: str
    recursive: bool = True


class FileTypeInfo(BaseModel):
    extension: str
    display_name: str
    count: int
    size_mb: float
    supported: bool


class ScanFolderParams(BaseModel):
    folder_path: str
    recursive: bool = True
    excluded_dirs: list[str] = []
    exclusion_patterns: list[str] = []


class FolderScanResult(BaseModel):
    supported_types: list[FileTypeInfo]
    unsupported_types: list[FileTypeInfo]
    total_files: int
    total_size_mb: float


class WizardAnswers(BaseModel):
    profile: str
    calibration: dict[str, bool]


class WizardProfileResponse(BaseModel):
    profile_name: str
    profile_display_name: str
    icon: str
    description: str
    config_summary: dict[str, str]
    full_config: IngestionConfig


class WizardCompletionRequest(BaseModel):
    config: IngestionConfig


# --- Helpers ---

def build_tree(path: Path, max_depth: int = 2, current_depth: int = 0) -> FolderNode:
    node = FolderNode(name=path.name, path=str(path), is_dir=True)
    
    if current_depth >= max_depth:
        return node

    try:
        # Sort directories first, then files (though we only care about dirs for the tree structure mostly)
        # For the wizard tree, we usually only want to show directories to check/uncheck
        # but the spec says "files count".
        
        # We will only list DIRECTORIES for the tree structure to avoid huge payloads
        # and count files.
        dir_count = 0
        file_count = 0
        
        entries = sorted(list(os.scandir(path)), key=lambda e: e.name.lower())
        
        for entry in entries:
            if entry.is_dir(follow_symlinks=False):
                # Don't recurse into hidden dirs
                if entry.name.startswith("."): 
                    continue
                    
                child = build_tree(Path(entry.path), max_depth, current_depth + 1)
                node.children.append(child)
                file_count += child.file_count # Aggregate count
            elif entry.is_file(follow_symlinks=False):
                file_count += 1
        
        node.file_count = file_count

    except PermissionError:
        pass
    except OSError:
        pass

    return node


# --- Endpoints ---

@router.post("/validate-folder", response_model=FolderValidationResult)
async def validate_folder(request: FolderValidationRequest) -> FolderValidationResult:
    path = Path(request.folder_path)
    
    if not path.exists():
        return FolderValidationResult(valid=False, error="Le dossier n'existe pas", error_code="NOT_FOUND")
    if not path.is_dir():
        return FolderValidationResult(valid=False, error="Ce n'est pas un dossier", error_code="NOT_DIRECTORY")
    
    # Scan for stats – respect recursive flag
    file_count = 0
    total_size = 0
    extensions: dict[str, int] = {}

    try:
        if request.recursive:
            for root, _, files in os.walk(path):
                if Path(root).name.startswith("."):
                    continue
                for file in files:
                    file_count += 1
                    try:
                        fp = Path(root) / file
                        size = fp.stat().st_size
                        total_size += size
                        ext = fp.suffix.lower()
                        if ext:
                            extensions[ext] = extensions.get(ext, 0) + 1
                    except OSError:
                        pass
        else:
            # Non-recursive: only files directly in the selected folder
            for entry in os.scandir(path):
                if entry.is_file(follow_symlinks=False):
                    file_count += 1
                    try:
                        size = entry.stat().st_size
                        total_size += size
                        ext = Path(entry.name).suffix.lower()
                        if ext:
                            extensions[ext] = extensions.get(ext, 0) + 1
                    except OSError:
                        pass
    except OSError as e:
        return FolderValidationResult(valid=False, error=str(e), error_code="ACCESS_DENIED")

    sorted_exts = sorted(extensions.keys())

    # Build tree for UI only when recursive (allows folder exclusion)
    tree_root = build_tree(path, max_depth=3) if request.recursive else None

    return FolderValidationResult(
        valid=True,
        stats=FolderStats(
            files=file_count,
            size_mb=round(total_size / (1024 * 1024), 2),
            extensions=sorted_exts,
            extension_counts=extensions
        ),
        tree=tree_root
    )


@router.post("/scan-folder", response_model=FolderScanResult)
async def scan_folder(params: ScanFolderParams) -> FolderScanResult:
    # This would contain more complex logic to filter by excluded dirs/patterns
    # For Step 1, we implement a basic version
    path = Path(params.folder_path)
    if not path.exists() or not path.is_dir():
        raise HTTPException(status_code=400, detail="Invalid folder")

    supported_exts = {".pdf", ".docx", ".doc", ".md", ".txt", ".html", ".csv", ".rst", ".xml", ".json", ".yaml"}
    
    types_map: dict[str, FileTypeInfo] = {}
    
    total_files = 0
    total_size_bytes = 0

    for root, dirs, files in os.walk(path):
        # Filter excluded dirs logic
        # params.excluded_dirs contains absolute paths or relative? 
        # Usually we match against names or relative paths.
        # Simple check: if any excluded dir is in the current path parts
        
        is_excluded = False
        for excluded in params.excluded_dirs:
            if excluded in Path(root).parts:
                is_excluded = True
                break
        
        if is_excluded:
            # Modify dirs in-place to stop walking this branch
            dirs[:] = []
            continue

        for file in files:
            ext = Path(file).suffix.lower()
            if not ext: continue
            
            try:
                size = (Path(root) / file).stat().st_size
                total_files += 1
                total_size_bytes += size
                
                is_supported = ext in supported_exts
                
                if ext not in types_map:
                    types_map[ext] = FileTypeInfo(
                        extension=ext,
                        display_name=ext.upper().replace(".", ""),
                        count=0,
                        size_mb=0,
                        supported=is_supported
                    )
                
                info = types_map[ext]
                info.count += 1
                info.size_mb += size / (1024 * 1024)
            except OSError:
                pass

    supported = [t for t in types_map.values() if t.supported]
    unsupported = [t for t in types_map.values() if not t.supported]
    
    return FolderScanResult(
        supported_types=sorted(supported, key=lambda x: x.count, reverse=True),
        unsupported_types=sorted(unsupported, key=lambda x: x.count, reverse=True),
        total_files=total_files,
        total_size_mb=round(total_size_bytes / (1024 * 1024), 2)
    )

@router.post("/analyze-profile", response_model=WizardProfileResponse)
async def analyze_profile(answers: WizardAnswers) -> WizardProfileResponse:
    # Logic to determine profile config based on answers
    # This roughly maps the logic from the specs
    
    profile = answers.profile
    # Defaults
    profile_name = profile
    profile_display = "Base personnalisée"
    icon = "📚"
    desc = "Configuration adaptée."
    
    # Mapping profile details
    if profile == "technical_documentation":
        profile_display = "Documentation technique"
        icon = "📘"
    elif profile == "faq_support":
        profile_display = "FAQ / Support"
        icon = "❓"
    elif profile == "legal_compliance":
        profile_display = "Juridique / Réglementaire"
        icon = "📜"
    elif profile == "reports_analysis":
        profile_display = "Rapports & Analyses"
        icon = "📊"
    elif profile == "general":
        profile_display = "Base généraliste"
        icon = "📚"

    # Default config generation (simplified for now)
    config = IngestionConfig(
        source=SourceConfig(path=""), # To be filled
        parsing=ParsingConfig(),
        preprocessing=PreprocessingConfig()
    )
    
    # Apply profile specific defaults (implementation of spec section 4.2.1)
    if profile == "technical_documentation":
        config.parsing.table_extraction_strategy = TableExtractionStrategy.MARKDOWN
        config.preprocessing.deduplication_threshold = 0.95
    elif profile == "faq_support":
        config.parsing.table_extraction_strategy = TableExtractionStrategy.PRESERVE
        config.preprocessing.remove_urls = True
        config.preprocessing.deduplication_strategy = DeduplicationStrategy.FUZZY
        config.preprocessing.deduplication_threshold = 0.85
    elif profile == "legal_compliance":
        config.parsing.ocr_language = ["fra"]
        config.preprocessing.deduplication_strategy = DeduplicationStrategy.EXACT
        config.preprocessing.deduplication_threshold = 0.98
    
    # Apply Q1 modifier
    if answers.calibration.get("q1"):
        config.parsing.table_extraction_strategy = TableExtractionStrategy.MARKDOWN
        config.parsing.ocr_enabled = True
        config.parsing.image_captioning_enabled = True

    return WizardProfileResponse(
        profile_name=profile,
        profile_display_name=profile_display,
        icon=icon,
        description=desc,
        config_summary={
            "Profil": profile_display,
            "Chunking": "Auto", # Future
            "Recherche": "Hybride" # Future
        },
        full_config=config
    )

@router.post("/complete")
async def complete_wizard(request: WizardCompletionRequest):
    try:
        config_manager.save_config(request.config)
        # Invalidate the in-memory cache so /api/ingestion/config reloads from disk
        from ragkit.desktop.api import ingestion
        ingestion._CURRENT_CONFIG = None
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/environment-detection")
async def detect_environment():
    return {
        "gpu": False, # Mock
        "ollama": False,
        "models": []
    }
