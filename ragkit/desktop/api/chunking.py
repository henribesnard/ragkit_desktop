from __future__ import annotations

import statistics
import time
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ragkit.chunking.engine import create_chunker
from ragkit.chunking.tokenizer import TokenCounter
from ragkit.config.chunking_schema import (
    ChunkingConfig,
    ChunkingPreviewResult,
    ChunkingStats,
    ChunkingValidationResult,
    ChunkPreview,
    SizeBucket,
)
from ragkit.config.embedding_schema import EmbeddingConfig
from ragkit.config.manager import config_manager
from ragkit.desktop import documents
from ragkit.desktop.api.ingestion import _get_current_config, _get_documents
from ragkit.desktop.models import SettingsPayload
from ragkit.desktop.profiles import build_full_config

router = APIRouter(prefix="/api/chunking", tags=["chunking"])


def _default_config_from_profile() -> ChunkingConfig:
    settings = config_manager.load_config() or SettingsPayload()
    profile_name = settings.profile or "general"
    full_config = build_full_config(profile_name, settings.calibration_answers)
    return ChunkingConfig.model_validate(full_config["chunking"])


def _get_current_chunking_config() -> ChunkingConfig:
    settings = config_manager.load_config()
    if not settings:
        return _default_config_from_profile()

    if settings.chunking:
        return ChunkingConfig.model_validate(settings.chunking)

    return _default_config_from_profile()


def _save_chunking_config(config: ChunkingConfig) -> ChunkingConfig:
    settings = config_manager.load_config() or SettingsPayload()
    settings.chunking = config.model_dump(mode="json")
    config_manager.save_config(settings)
    return config




def _get_embedding_config() -> EmbeddingConfig | None:
    settings = config_manager.load_config()
    if settings and settings.embedding:
        try:
            return EmbeddingConfig.model_validate(settings.embedding)
        except Exception:
            return None
    return None

def _validate_with_warnings(config: ChunkingConfig) -> ChunkingValidationResult:
    warnings: list[str] = []
    if config.chunk_overlap > config.chunk_size / 2:
        warnings.append("Un chevauchement supérieur à 50% est inhabituel.")
    embedding = _get_embedding_config()
    if config.strategy.value == "semantic":
        if embedding is None:
            warnings.append("Aucun modèle d'embedding configuré. Configurez l'étape EMBEDDING pour un chunking sémantique optimal.")
        elif embedding.provider.value in {"openai", "cohere", "voyageai", "mistral"}:
            warnings.append("Le chunking sémantique avec un provider cloud génère des coûts API. La prévisualisation reste en mode léger local.")
    return ChunkingValidationResult(valid=True, warnings=warnings)


def _get_document(document_id: str):
    for doc in _get_documents():
        if doc.id == document_id:
            return doc
    raise HTTPException(status_code=404, detail="Document not found")


def _compute_overlap_text(before: str, after: str, overlap_tokens: int, token_counter: TokenCounter) -> str | None:
    if overlap_tokens <= 0:
        return None
    before_words = before.split()
    after_words = after.split()
    common = before_words[-overlap_tokens:]
    if not common:
        return None
    common_text = " ".join(common)
    if common_text and common_text in after:
        return token_counter.truncate(common_text, overlap_tokens)
    return None


def _build_distribution(sizes: list[int], bucket_size: int = 50) -> list[SizeBucket]:
    if not sizes:
        return []
    max_size = max(sizes)
    buckets: list[SizeBucket] = []
    start = 0
    while start <= max_size:
        end = start + bucket_size
        count = sum(1 for value in sizes if start <= value < end)
        buckets.append(SizeBucket(range_start=start, range_end=end, count=count))
        start = end
    return buckets


def _build_preview(document_id: str, config: ChunkingConfig) -> ChunkingPreviewResult:
    started = time.perf_counter()
    token_counter = TokenCounter()
    warnings: list[str] = []

    document = _get_document(document_id)
    ingestion_config = _get_current_config()
    text = documents.get_document_text(ingestion_config, document)
    if not text.strip():
        raise HTTPException(status_code=400, detail="Document has no parsable text")

    if config.strategy.value == "semantic":
        embedding = _get_embedding_config()
        if embedding:
            warnings.append(f"Chunking sémantique: le modèle configuré ({embedding.provider.value}/{embedding.model}) sera utilisé hors prévisualisation.")
        warnings.append("La stratégie sémantique utilise un mode léger de similarité locale pour la prévisualisation.")

    base_metadata: dict[str, Any] = {
        "source": document.file_path,
        "page": document.page_count,
        "document_id": document.id,
    }
    if config.add_document_title:
        base_metadata["document_title"] = document.title

    chunker = create_chunker(config)
    chunks = chunker.chunk(text, base_metadata)

    preview_chunks: list[ChunkPreview] = []
    total_overlap_tokens = 0

    for index, chunk in enumerate(chunks):
        overlap_before = None
        overlap_before_tokens = 0
        overlap_after = None
        overlap_after_tokens = 0

        if index > 0 and config.chunk_overlap > 0:
            overlap_before = _compute_overlap_text(
                chunks[index - 1].content,
                chunk.content,
                config.chunk_overlap,
                token_counter,
            )
            overlap_before_tokens = token_counter.count(overlap_before or "")

        if index < len(chunks) - 1 and config.chunk_overlap > 0:
            overlap_after = _compute_overlap_text(
                chunk.content,
                chunks[index + 1].content,
                config.chunk_overlap,
                token_counter,
            )
            overlap_after_tokens = token_counter.count(overlap_after or "")

        total_overlap_tokens += overlap_before_tokens

        preview_chunks.append(
            ChunkPreview(
                index=index,
                content=chunk.content,
                content_truncated=chunk.content[:500] + ("…" if len(chunk.content) > 500 else ""),
                size_tokens=chunk.tokens,
                overlap_before=overlap_before,
                overlap_before_tokens=overlap_before_tokens,
                overlap_after=overlap_after,
                overlap_after_tokens=overlap_after_tokens,
                metadata=chunk.metadata,
            )
        )

    sizes = [chunk.size_tokens for chunk in preview_chunks]
    if sizes:
        stats = ChunkingStats(
            total_chunks=len(sizes),
            avg_size_tokens=round(sum(sizes) / len(sizes), 2),
            min_size_tokens=min(sizes),
            max_size_tokens=max(sizes),
            median_size_tokens=statistics.median(sizes),
            total_overlap_tokens=total_overlap_tokens,
            size_distribution=_build_distribution(sizes),
        )
    else:
        stats = ChunkingStats(
            total_chunks=0,
            avg_size_tokens=0,
            min_size_tokens=0,
            max_size_tokens=0,
            median_size_tokens=0,
            total_overlap_tokens=0,
            size_distribution=[],
        )

    if stats.total_chunks > 200:
        warnings.append(
            f"Ce document produit beaucoup de chunks ({stats.total_chunks}). Vérifiez vos paramètres de taille."
        )

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    return ChunkingPreviewResult(
        document_id=document.id,
        document_title=document.title,
        config_used=config,
        stats=stats,
        chunks=preview_chunks,
        processing_time_ms=elapsed_ms,
        warnings=warnings,
    )


class PreviewRequest(BaseModel):
    document_id: str


class PreviewCustomRequest(BaseModel):
    document_id: str
    config: ChunkingConfig


@router.get("/config", response_model=ChunkingConfig)
async def get_chunking_config() -> ChunkingConfig:
    return _get_current_chunking_config()


@router.put("/config", response_model=ChunkingConfig)
async def update_chunking_config(config: ChunkingConfig) -> ChunkingConfig:
    return _save_chunking_config(config)


@router.post("/config/reset", response_model=ChunkingConfig)
async def reset_chunking_config() -> ChunkingConfig:
    config = _default_config_from_profile()
    return _save_chunking_config(config)


@router.post("/config/validate", response_model=ChunkingValidationResult)
async def validate_chunking_config(config: ChunkingConfig) -> ChunkingValidationResult:
    return _validate_with_warnings(config)


@router.post("/preview", response_model=ChunkingPreviewResult)
async def preview_chunking(payload: PreviewRequest) -> ChunkingPreviewResult:
    config = _get_current_chunking_config()
    return _build_preview(payload.document_id, config)


@router.post("/preview/custom", response_model=ChunkingPreviewResult)
async def preview_chunking_custom(payload: PreviewCustomRequest) -> ChunkingPreviewResult:
    return _build_preview(payload.document_id, payload.config)
