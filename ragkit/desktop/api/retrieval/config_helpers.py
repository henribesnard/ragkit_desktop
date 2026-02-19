"""Retrieval configuration helpers, filtering, and BM25 index management."""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ragkit.config.embedding_schema import EmbeddingConfig
from ragkit.config.retrieval_schema import (
    HybridSearchConfig,
    LexicalSearchConfig,
    SearchFilters,
    SearchType,
    SemanticSearchConfig,
)
from ragkit.config.vector_store_schema import GeneralSettings
from ragkit.desktop.profiles import build_full_config
from ragkit.desktop.settings_store import get_data_dir, load_settings, save_settings
from ragkit.embedding.engine import EmbeddingEngine, cosine_similarity
from ragkit.retrieval import BM25Index
from ragkit.storage.base import VectorPoint

_LEXICAL_INDEX: BM25Index | None = None
_LEXICAL_INDEX_MTIME: float | None = None
_LEXICAL_INDEX_FILE = "bm25_index.json"
_TEXT_PREVIEW_SIZE = 300


# ------------------------------------------------------------------ #
#  Internal data classes                                               #
# ------------------------------------------------------------------ #

@dataclass
class RankedPoint:
    point: VectorPoint
    raw_score: float
    normalized_score: float


@dataclass
class HybridSourceCandidate:
    chunk_id: str
    score: float
    text: str
    metadata: dict[str, Any]
    matched_terms: dict[str, int]
    doc_title: str | None = None
    doc_path: str | None = None
    doc_type: str | None = None
    page_number: int | None = None
    chunk_index: int | None = None
    chunk_total: int | None = None
    chunk_tokens: int | None = None
    section_header: str | None = None
    doc_language: str | None = None
    category: str | None = None
    keywords: list[str] | None = None
    ingestion_version: str | None = None


# ------------------------------------------------------------------ #
#  Profile / config resolution                                         #
# ------------------------------------------------------------------ #

def profile_retrieval_payload() -> dict[str, Any]:
    settings = load_settings()
    profile_name = settings.profile or "general"
    full_config = build_full_config(profile_name, settings.calibration_answers)
    retrieval_payload = full_config.get("retrieval", {})
    if isinstance(retrieval_payload, dict):
        return retrieval_payload
    return {}


def default_search_type_from_profile() -> SearchType:
    retrieval_payload = profile_retrieval_payload()
    architecture = str(retrieval_payload.get("architecture") or "").strip().lower()
    semantic_payload = retrieval_payload.get("semantic", {}) if isinstance(retrieval_payload, dict) else {}
    lexical_payload = retrieval_payload.get("lexical", {}) if isinstance(retrieval_payload, dict) else {}

    semantic_enabled = bool(
        semantic_payload.get("enabled", True) if isinstance(semantic_payload, dict) else True
    )
    lexical_enabled = bool(
        lexical_payload.get("enabled", True) if isinstance(lexical_payload, dict) else True
    )

    if not semantic_enabled and lexical_enabled:
        return SearchType.LEXICAL
    if not lexical_enabled and semantic_enabled:
        return SearchType.SEMANTIC
    if architecture == "semantic":
        return SearchType.SEMANTIC
    if architecture == "lexical":
        return SearchType.LEXICAL
    return SearchType.HYBRID


def resolve_general_settings() -> GeneralSettings:
    settings = load_settings()
    payload = settings.general if isinstance(settings.general, dict) else {}
    if payload:
        try:
            return GeneralSettings.model_validate(payload)
        except Exception:
            pass
    return GeneralSettings(search_type=default_search_type_from_profile())


# ------------------------------------------------------------------ #
#  Semantic config                                                     #
# ------------------------------------------------------------------ #

def default_semantic_config() -> SemanticSearchConfig:
    retrieval_payload = profile_retrieval_payload()
    semantic_payload = retrieval_payload.get("semantic", {}) if isinstance(retrieval_payload, dict) else {}
    return SemanticSearchConfig.model_validate(semantic_payload)


def get_semantic_config() -> SemanticSearchConfig:
    settings = load_settings()
    retrieval_payload = settings.retrieval if isinstance(settings.retrieval, dict) else {}
    semantic_payload = retrieval_payload.get("semantic", {}) if isinstance(retrieval_payload, dict) else {}
    if semantic_payload:
        return SemanticSearchConfig.model_validate(semantic_payload)
    return default_semantic_config()


def save_semantic_config(config: SemanticSearchConfig) -> SemanticSearchConfig:
    settings = load_settings()
    retrieval_payload = settings.retrieval if isinstance(settings.retrieval, dict) else {}
    retrieval_payload["semantic"] = config.model_dump(mode="json")
    settings.retrieval = retrieval_payload
    save_settings(settings)
    return config


# ------------------------------------------------------------------ #
#  Lexical config                                                      #
# ------------------------------------------------------------------ #

def default_lexical_config() -> LexicalSearchConfig:
    retrieval_payload = profile_retrieval_payload()
    lexical_payload = retrieval_payload.get("lexical", {}) if isinstance(retrieval_payload, dict) else {}
    return LexicalSearchConfig.model_validate(lexical_payload)


def get_lexical_config() -> LexicalSearchConfig:
    settings = load_settings()
    retrieval_payload = settings.retrieval if isinstance(settings.retrieval, dict) else {}
    lexical_payload = retrieval_payload.get("lexical", {}) if isinstance(retrieval_payload, dict) else {}
    if lexical_payload:
        return LexicalSearchConfig.model_validate(lexical_payload)
    return default_lexical_config()


def save_lexical_config(config: LexicalSearchConfig) -> LexicalSearchConfig:
    settings = load_settings()
    retrieval_payload = settings.retrieval if isinstance(settings.retrieval, dict) else {}
    retrieval_payload["lexical"] = config.model_dump(mode="json")
    settings.retrieval = retrieval_payload
    save_settings(settings)
    if _LEXICAL_INDEX is not None:
        _LEXICAL_INDEX.configure_preprocessor(config)
    return config


# ------------------------------------------------------------------ #
#  Hybrid config                                                       #
# ------------------------------------------------------------------ #

def default_hybrid_config() -> HybridSearchConfig:
    retrieval_payload = profile_retrieval_payload()
    hybrid_payload = retrieval_payload.get("hybrid", {}) if isinstance(retrieval_payload, dict) else {}
    return HybridSearchConfig.model_validate(hybrid_payload)


def get_hybrid_config() -> HybridSearchConfig:
    settings = load_settings()
    retrieval_payload = settings.retrieval if isinstance(settings.retrieval, dict) else {}
    hybrid_payload = retrieval_payload.get("hybrid", {}) if isinstance(retrieval_payload, dict) else {}
    if hybrid_payload:
        return HybridSearchConfig.model_validate(hybrid_payload)
    return default_hybrid_config()


def save_hybrid_config(config: HybridSearchConfig) -> HybridSearchConfig:
    settings = load_settings()
    retrieval_payload = settings.retrieval if isinstance(settings.retrieval, dict) else {}
    retrieval_payload["hybrid"] = config.model_dump(mode="json")
    settings.retrieval = retrieval_payload
    save_settings(settings)
    return config


# ------------------------------------------------------------------ #
#  Filtering helpers                                                   #
# ------------------------------------------------------------------ #

def merge_filters(default_filters: SearchFilters, runtime_filters: SearchFilters | None) -> SearchFilters:
    if runtime_filters is None:
        return default_filters

    def merge_values(default_values: list[str], runtime_values: list[str]) -> list[str]:
        if default_values and runtime_values:
            default_set = set(default_values)
            return [value for value in runtime_values if value in default_set]
        if runtime_values:
            return runtime_values
        return default_values

    return SearchFilters(
        doc_ids=merge_values(default_filters.doc_ids, runtime_filters.doc_ids),
        doc_types=merge_values(default_filters.doc_types, runtime_filters.doc_types),
        languages=merge_values(default_filters.languages, runtime_filters.languages),
        categories=merge_values(default_filters.categories, runtime_filters.categories),
    )


def payload_value(payload: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = payload.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def match_filters(point_payload: dict[str, Any], filters: SearchFilters) -> bool:
    if filters.doc_ids:
        doc_id = payload_value(point_payload, ("doc_id",))
        if doc_id not in set(filters.doc_ids):
            return False

    if filters.doc_types:
        doc_type = payload_value(point_payload, ("doc_type", "file_type"))
        if doc_type not in set(filters.doc_types):
            return False

    if filters.languages:
        language = payload_value(point_payload, ("doc_language", "language"))
        if language not in set(filters.languages):
            return False

    if filters.categories:
        category = payload_value(point_payload, ("category",))
        if category not in set(filters.categories):
            return False

    return True


def filters_field_value(payload: dict[str, Any], field: str) -> str | None:
    field_map: dict[str, tuple[str, ...]] = {
        "doc_type": ("doc_type", "file_type"),
        "language": ("doc_language", "language"),
        "category": ("category",),
        "doc_id": ("doc_id",),
    }
    keys = field_map.get(field)
    if not keys:
        return None
    return payload_value(payload, keys)


# ------------------------------------------------------------------ #
#  Score helpers                                                       #
# ------------------------------------------------------------------ #

def normalize_semantic_score(score: float) -> float:
    return max(0.0, min(1.0, (score + 1.0) / 2.0))


def text_preview(text: str) -> str:
    return text[:_TEXT_PREVIEW_SIZE] + ("..." if len(text) > _TEXT_PREVIEW_SIZE else "")


# ------------------------------------------------------------------ #
#  BM25 index management                                               #
# ------------------------------------------------------------------ #

def bm25_index_dir() -> Path:
    return get_data_dir() / "bm25_index"


def bm25_index_path() -> Path:
    return bm25_index_dir() / _LEXICAL_INDEX_FILE


def bm25_index_mtime() -> float | None:
    path = bm25_index_path()
    if not path.exists():
        return None
    return path.stat().st_mtime


def load_or_create_lexical_index(config: LexicalSearchConfig) -> BM25Index:
    global _LEXICAL_INDEX, _LEXICAL_INDEX_MTIME

    current_mtime = bm25_index_mtime()
    needs_reload = _LEXICAL_INDEX is None or _LEXICAL_INDEX_MTIME != current_mtime
    if needs_reload:
        index = BM25Index(config)
        index.load(bm25_index_dir())
        _LEXICAL_INDEX = index
        _LEXICAL_INDEX_MTIME = current_mtime
    else:
        _LEXICAL_INDEX.configure_preprocessor(config)
    return _LEXICAL_INDEX


def set_lexical_index(index: BM25Index) -> None:
    global _LEXICAL_INDEX, _LEXICAL_INDEX_MTIME
    _LEXICAL_INDEX = index
    _LEXICAL_INDEX_MTIME = bm25_index_mtime()
