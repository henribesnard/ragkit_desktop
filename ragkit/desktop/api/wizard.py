# ragkit/desktop/api/wizard.py
from __future__ import annotations

from ragkit.security.secrets import secrets_manager
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException

from ragkit.desktop.models import (
    IngestionConfig,
    SourceConfig,
    ParsingConfig,
    PreprocessingConfig,
    TableExtractionStrategy,
    DeduplicationStrategy,
    FolderValidationRequest,
    FolderValidationResult,
    ScanFolderRequest,
    FolderScanResult,
    WizardAnswers,
    WizardProfileResponse,
    WizardCompletionRequest,
    SettingsPayload,
    EnvironmentInfo,
)
from pydantic import BaseModel
from ragkit.config.manager import config_manager
from ragkit.desktop import documents

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/wizard", tags=["wizard"])

class WizardProgressData(BaseModel):
    wizard_step: int
    config: SettingsPayload

@router.get("/progress", response_model=WizardProgressData)
async def get_wizard_progress() -> WizardProgressData:
    settings = config_manager.load_config() or SettingsPayload()
    return WizardProgressData(wizard_step=settings.wizard_step, config=settings)

@router.post("/progress")
async def save_wizard_progress(data: WizardProgressData):
    data.config.wizard_step = data.wizard_step
    config_manager.save_config(data.config)
    return {"success": True}

@router.post("/validate-folder", response_model=FolderValidationResult)
async def validate_folder(request: FolderValidationRequest) -> FolderValidationResult:
    # recursive defaults to True in model now
    return documents.validate_folder(request.folder_path, recursive=request.recursive)

@router.post("/scan-folder", response_model=FolderScanResult)
async def scan_folder(params: ScanFolderRequest) -> FolderScanResult:
    # ScanFolderRequest structure matches what documents.scan_folder expects
    return documents.scan_folder(params)

class ListTargetFilesRequest(BaseModel):
    source: SourceConfig

class TargetFileInfo(BaseModel):
    path: str
    name: str
    extension: str

@router.post("/list-target-files", response_model=list[TargetFileInfo])
async def list_target_files(req: ListTargetFilesRequest) -> list[TargetFileInfo]:
    source = req.source
    root = Path(source.path).expanduser()
    if not root.exists() or not root.is_dir():
        return []
        
    selected_types = {documents._normalize_extension(ft) for ft in source.file_types}
    results = []
    
    for path in documents._iter_files(
        root=root,
        recursive=source.recursive,
        excluded_dirs=source.excluded_dirs,
        exclusion_patterns=source.exclusion_patterns,
        max_file_size_mb=source.max_file_size_mb
    ):
        ext = documents._normalize_extension(path.suffix)
        if ext in selected_types:
            relative = path.relative_to(root).as_posix()
            results.append(TargetFileInfo(
                path=relative,
                name=path.name,
                extension=ext
            ))
            
    return results

@router.post("/analyze-profile", response_model=WizardProfileResponse)
async def analyze_profile(answers: WizardAnswers) -> WizardProfileResponse:
    profile = answers.profile
    
    # Defaults
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

    # Default config generation
    config = IngestionConfig(
        source=SourceConfig(path=""), 
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
    elif profile == "reports_analysis":
        config.parsing.table_extraction_strategy = TableExtractionStrategy.MARKDOWN
        config.preprocessing.deduplication_threshold = 0.95
    elif profile == "general":
        config.preprocessing.deduplication_threshold = 0.90
    
    # Apply Calibration modifiers (Section 4.4)
    calibration = answers.calibration
    
    # Q1: Documents contiennent tableaux/images ?
    if calibration.get("q1"):
        config.parsing.table_extraction_strategy = TableExtractionStrategy.MARKDOWN
        config.parsing.ocr_enabled = True
        config.parsing.image_captioning_enabled = True

    # Calculate future settings based on answers
    future_settings = {
        "chunking": {},
        "retrieval": {
            "semantic": {
                "enabled": True,
                "top_k": 10,
                "similarity_threshold": 0.0,
                "weight": 1.0,
            }
        },
        "rerank": {},
        "llm": {},
        "ingestion": {} # Extra ingestion settings
    }
    
    # Q2: Réponses précises vs Synthétiques ? (True = Précise)
    if calibration.get("q2"):
        future_settings["retrieval"]["semantic"]["top_k"] = 20
        future_settings["llm"]["context_max_chunks"] = 10
    
    # Q3: Documents longs/complexes ?
    if calibration.get("q3"):
        future_settings["chunking"]["chunk_size"] = 1536 # Larger chunks
        future_settings["chunking"]["chunk_overlap"] = 200
    
    # Q4: Importance multilingue/sémantique ?
    if calibration.get("q4"):
        future_settings["rerank"]["enabled"] = True
        future_settings["llm"]["temperature"] = 0.0 # Strict
    
    # Q5: Mise à jour fréquente ?
    if calibration.get("q5"):
        future_settings["ingestion"]["mode"] = "auto"
        future_settings["ingestion"]["watch_enabled"] = True
        
    # Q6: Besoin de citations strictes ?
    if calibration.get("q6"):
        future_settings["chunking"]["add_chunk_index"] = True
        future_settings["llm"]["cite_sources"] = True
        future_settings["llm"]["citation_format"] = "footnote"

    # Construct the full SettingsPayload
    full_payload = SettingsPayload(
        profile=profile,
        calibration_answers=calibration,
        ingestion=config,
        chunking=future_settings["chunking"],
        retrieval=future_settings["retrieval"],
        rerank=future_settings["rerank"],
        llm=future_settings["llm"]
    )

    return WizardProfileResponse(
        profile_name=profile,
        profile_display_name=profile_display,
        icon=icon,
        description=desc,
        config_summary={
            "Profil": profile_display,
            "Mode": "Auto" if calibration.get("q5") else "Manuel",
            "Citations": "Oui" if calibration.get("q6") else "Non",
            "OCR": "Oui" if config.parsing.ocr_enabled else "Non"
        },
        full_config=full_payload.model_dump() # Return dict
    )


@router.post("/complete")
async def complete_wizard(request: WizardCompletionRequest):
    try:
        # Save full configuration
        request.config.setup_completed = True
        config_manager.save_config(request.config)

        # Invalidate the in-memory cache so ingestion endpoints pick up new config
        from ragkit.desktop.api import ingestion
        from ragkit.desktop.models import IngestionConfig
        if request.config.ingestion:
            ingestion._CURRENT_CONFIG = IngestionConfig.model_validate(request.config.ingestion)
        else:
            ingestion._CURRENT_CONFIG = None

        # Analysis is NOT done here - it would block for minutes on large corpora.
        # The Settings page triggers analysis via POST /api/ingestion/analyze.

        return {"success": True}
    except Exception as e:
        logger.exception("Failed to complete wizard")
        raise HTTPException(status_code=500, detail="Unable to save setup configuration.")


@router.get("/environment-detection")
async def detect_environment() -> EnvironmentInfo:
    import shutil
    import httpx
    
    ollama_path = shutil.which("ollama")
    llm_models = []
    embedding_models = []
    
    if ollama_path:
        try:
            with httpx.Client(timeout=1.0) as client:
                res = client.get("http://127.0.0.1:11434/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    
                    for m in data.get("models", []):
                        name = m.get("name")
                        if not name:
                            continue
                            
                        family = m.get("details", {}).get("family", "").lower()
                        # Typical Embedding families
                        if family in ["bert", "nomic-bert", "nomic-bert-moe", "gemma3", "qwen3"]:
                            embedding_models.append(name)
                        # Typical LLM families
                        elif family in ["llama", "qwen2", "gemma", "mixtral", "command-r", "phi3"]:
                            llm_models.append(name)
                        else:
                            # Fallback heuristics based on name
                            if "embed" in name.lower() or "bge" in name.lower() or "minilm" in name.lower():
                                embedding_models.append(name)
                            else:
                                llm_models.append(name)
                        
        except Exception:
            pass
            
    gpu_available = False
    gpu_backend = None
    try:
        import torch
        if torch.cuda.is_available():
            gpu_available = True
            gpu_backend = "CUDA"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            gpu_available = True
            gpu_backend = "MPS"
    except ImportError:
        pass
            
    return EnvironmentInfo(
        gpu_available=gpu_available,
        gpu_backend=gpu_backend,
        ollama_available=ollama_path is not None,
        ollama_llm_models=llm_models,
        ollama_embedding_models=embedding_models,
        keyring_available=secrets_manager.keyring_available
    )


@router.get("/current-profile")
async def get_current_profile():
    settings = config_manager.load_config() or SettingsPayload()
    return {"profile": settings.profile or "general"}

