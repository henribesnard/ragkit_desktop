"""Hybrid search fusion engine (RRF and Weighted Sum)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np

from ragkit.config.retrieval_schema import FusionMethod, HybridSearchConfig, NormalizationMethod


@dataclass
class HybridSearchResult:
    chunk_id: str
    score: float
    text: str
    metadata: dict[str, Any]

    # Provenance.
    semantic_rank: int | None = None
    semantic_score: float | None = None
    lexical_rank: int | None = None
    lexical_score: float | None = None
    matched_terms: dict[str, int] = field(default_factory=dict)

    # Common metadata fields.
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
    keywords: list[str] = field(default_factory=list)
    ingestion_version: str | None = None

    # Extra debug contributions.
    semantic_contribution: float = 0.0
    lexical_contribution: float = 0.0


def _getattr(result: object, name: str, default=None):
    return getattr(result, name, default)


def _to_metadata(result: object) -> dict[str, Any]:
    if result is None:
        return {}
    metadata = _getattr(result, "metadata")
    if isinstance(metadata, dict):
        return metadata
    return {
        "doc_title": _getattr(result, "doc_title"),
        "doc_path": _getattr(result, "doc_path"),
        "doc_type": _getattr(result, "doc_type"),
        "page_number": _getattr(result, "page_number"),
        "chunk_index": _getattr(result, "chunk_index"),
        "chunk_total": _getattr(result, "chunk_total"),
        "chunk_tokens": _getattr(result, "chunk_tokens"),
        "section_header": _getattr(result, "section_header"),
        "doc_language": _getattr(result, "doc_language"),
        "category": _getattr(result, "category"),
        "keywords": _getattr(result, "keywords", []),
        "ingestion_version": _getattr(result, "ingestion_version"),
    }


class HybridSearchEngine:
    """Fuse semantic and lexical search results."""

    def __init__(self, config: HybridSearchConfig):
        self.config = config

    def fuse(
        self,
        semantic_results: list[object],
        lexical_results: list[object],
        alpha: float | None = None,
        top_k: int | None = None,
        threshold: float | None = None,
    ) -> list[HybridSearchResult]:
        effective_alpha = self.config.alpha if alpha is None else float(alpha)
        effective_top_k = self.config.top_k if top_k is None else int(top_k)
        effective_threshold = self.config.threshold if threshold is None else float(threshold)

        if self.config.fusion_method == FusionMethod.RRF:
            fused = self._fuse_rrf(semantic_results, lexical_results, effective_alpha)
        else:
            fused = self._fuse_weighted_sum(semantic_results, lexical_results, effective_alpha)

        filtered = [result for result in fused if result.score >= effective_threshold]
        return filtered[: max(effective_top_k, 1)]

    def _candidate_ids(self, sem_lookup: dict[str, Any], lex_lookup: dict[str, Any]) -> list[str]:
        if self.config.deduplicate:
            merged = list(sem_lookup.keys())
            merged.extend([chunk_id for chunk_id in lex_lookup.keys() if chunk_id not in sem_lookup])
            return merged
        # Keep duplicates when deduplication is disabled.
        return [*sem_lookup.keys(), *lex_lookup.keys()]

    def _fuse_rrf(
        self,
        semantic_results: list[object],
        lexical_results: list[object],
        alpha: float,
    ) -> list[HybridSearchResult]:
        alpha_sem = alpha
        alpha_lex = 1.0 - alpha
        k = self.config.rrf_k

        sem_lookup = {
            _getattr(result, "chunk_id"): (index + 1, float(_getattr(result, "score", 0.0)), result)
            for index, result in enumerate(semantic_results)
            if _getattr(result, "chunk_id")
        }
        lex_lookup = {
            _getattr(result, "chunk_id"): (index + 1, float(_getattr(result, "score", 0.0)), result)
            for index, result in enumerate(lexical_results)
            if _getattr(result, "chunk_id")
        }

        scored: list[HybridSearchResult] = []
        for chunk_id in self._candidate_ids(sem_lookup, lex_lookup):
            sem_rank, sem_score, sem_result = sem_lookup.get(chunk_id, (None, None, None))
            lex_rank, lex_score, lex_result = lex_lookup.get(chunk_id, (None, None, None))

            sem_contrib = (alpha_sem / (k + sem_rank)) if sem_rank is not None else 0.0
            lex_contrib = (alpha_lex / (k + lex_rank)) if lex_rank is not None else 0.0
            fused_score = sem_contrib + lex_contrib

            source = sem_result or lex_result
            matched_terms = dict(_getattr(lex_result, "matched_terms", {}) or {})
            keywords = list(_getattr(source, "keywords", []) or []) if source else []

            scored.append(
                HybridSearchResult(
                    chunk_id=chunk_id,
                    score=fused_score,
                    text=str(_getattr(source, "text", "") or ""),
                    metadata=_to_metadata(source),
                    semantic_rank=sem_rank,
                    semantic_score=sem_score,
                    lexical_rank=lex_rank,
                    lexical_score=lex_score,
                    matched_terms=matched_terms,
                    doc_title=_getattr(source, "doc_title"),
                    doc_path=_getattr(source, "doc_path"),
                    doc_type=_getattr(source, "doc_type"),
                    page_number=_getattr(source, "page_number"),
                    chunk_index=_getattr(source, "chunk_index"),
                    chunk_total=_getattr(source, "chunk_total"),
                    chunk_tokens=_getattr(source, "chunk_tokens"),
                    section_header=_getattr(source, "section_header"),
                    doc_language=_getattr(source, "doc_language"),
                    category=_getattr(source, "category"),
                    keywords=keywords,
                    ingestion_version=_getattr(source, "ingestion_version"),
                    semantic_contribution=sem_contrib,
                    lexical_contribution=lex_contrib,
                )
            )

        scored.sort(key=lambda item: item.score, reverse=True)
        return scored

    def _fuse_weighted_sum(
        self,
        semantic_results: list[object],
        lexical_results: list[object],
        alpha: float,
    ) -> list[HybridSearchResult]:
        sem_raw_scores = [float(_getattr(result, "score", 0.0)) for result in semantic_results]
        lex_raw_scores = [float(_getattr(result, "score", 0.0)) for result in lexical_results]

        if self.config.normalize_scores:
            sem_scores = self._normalize(sem_raw_scores)
            lex_scores = self._normalize(lex_raw_scores)
        else:
            sem_scores = sem_raw_scores
            lex_scores = lex_raw_scores

        sem_lookup = {
            _getattr(result, "chunk_id"): (
                index + 1,
                sem_scores[index] if index < len(sem_scores) else 0.0,
                sem_raw_scores[index] if index < len(sem_raw_scores) else 0.0,
                result,
            )
            for index, result in enumerate(semantic_results)
            if _getattr(result, "chunk_id")
        }
        lex_lookup = {
            _getattr(result, "chunk_id"): (
                index + 1,
                lex_scores[index] if index < len(lex_scores) else 0.0,
                lex_raw_scores[index] if index < len(lex_raw_scores) else 0.0,
                result,
            )
            for index, result in enumerate(lexical_results)
            if _getattr(result, "chunk_id")
        }

        scored: list[HybridSearchResult] = []
        for chunk_id in self._candidate_ids(sem_lookup, lex_lookup):
            sem_rank, sem_score_norm, sem_raw, sem_result = sem_lookup.get(chunk_id, (None, 0.0, None, None))
            lex_rank, lex_score_norm, lex_raw, lex_result = lex_lookup.get(chunk_id, (None, 0.0, None, None))

            sem_contrib = alpha * sem_score_norm
            lex_contrib = (1.0 - alpha) * lex_score_norm
            fused_score = sem_contrib + lex_contrib

            source = sem_result or lex_result
            matched_terms = dict(_getattr(lex_result, "matched_terms", {}) or {})
            keywords = list(_getattr(source, "keywords", []) or []) if source else []

            scored.append(
                HybridSearchResult(
                    chunk_id=chunk_id,
                    score=fused_score,
                    text=str(_getattr(source, "text", "") or ""),
                    metadata=_to_metadata(source),
                    semantic_rank=sem_rank,
                    semantic_score=sem_raw if sem_result is not None else None,
                    lexical_rank=lex_rank,
                    lexical_score=lex_raw if lex_result is not None else None,
                    matched_terms=matched_terms,
                    doc_title=_getattr(source, "doc_title"),
                    doc_path=_getattr(source, "doc_path"),
                    doc_type=_getattr(source, "doc_type"),
                    page_number=_getattr(source, "page_number"),
                    chunk_index=_getattr(source, "chunk_index"),
                    chunk_total=_getattr(source, "chunk_total"),
                    chunk_tokens=_getattr(source, "chunk_tokens"),
                    section_header=_getattr(source, "section_header"),
                    doc_language=_getattr(source, "doc_language"),
                    category=_getattr(source, "category"),
                    keywords=keywords,
                    ingestion_version=_getattr(source, "ingestion_version"),
                    semantic_contribution=sem_contrib,
                    lexical_contribution=lex_contrib,
                )
            )

        scored.sort(key=lambda item: item.score, reverse=True)
        return scored

    def _normalize(self, scores: list[float]) -> list[float]:
        if not scores:
            return []
        values = np.array(scores, dtype=float)

        if self.config.normalization_method == NormalizationMethod.MIN_MAX:
            minimum = float(values.min())
            maximum = float(values.max())
            if maximum - minimum < 1e-10:
                return [0.5 for _ in scores]
            return ((values - minimum) / (maximum - minimum)).tolist()

        mean = float(values.mean())
        std = float(values.std())
        if std < 1e-10:
            return [0.0 for _ in scores]
        return ((values - mean) / std).tolist()
