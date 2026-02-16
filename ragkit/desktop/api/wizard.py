# ragkit/desktop/api/wizard.py
from __future__ import annotations

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
from ragkit.config.manager import config_manager
from ragkit.desktop import documents

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/wizard", tags=["wizard"])


# --- Endpoints ---

@router.post("/validate-folder", response_model=FolderValidationResult)
async def validate_folder(request: FolderValidationRequest) -> FolderValidationResult:
    # recursive defaults to True in model now
    return documents.validate_folder(request.folder_path, recursive=request.recursive)


@router.post("/scan-folder", response_model=FolderScanResult)
async def scan_folder(params: ScanFolderRequest) -> FolderScanResult:
    # ScanFolderRequest structure matches what documents.scan_folder expects
    return documents.scan_folder(params)


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
        "retrieval": {},
        "rerank": {},
        "llm": {},
        "ingestion": {} # Extra ingestion settings
    }
    
    # Q2: Réponses précises vs Synthétiques ? (True = Précise)
    if calibration.get("q2"):
        future_settings["retrieval"]["semantic_top_k"] = 20 # Example boost
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
        ingestion._CURRENT_CONFIG = request.config.ingestion

        # Analysis is NOT done here - it would block for minutes on large corpora.
        # The Settings page triggers analysis via POST /api/ingestion/analyze.

        return {"success": True}
    except Exception as e:
        logger.exception("Failed to complete wizard")
        raise HTTPException(status_code=500, detail="Unable to save setup configuration.")


@router.get("/environment-detection")
async def detect_environment() -> EnvironmentInfo:
    # Basic detect logic
    # In real world, check for CUDA/MPS and Ollama process
    import shutil
    
    ollama_path = shutil.which("ollama")
    
    return EnvironmentInfo(
        gpu_available=False, # Mock
        ollama_available=ollama_path is not None,
        local_models=["llama3", "mistral"] if ollama_path else []
    )

