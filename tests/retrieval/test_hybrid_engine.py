from __future__ import annotations

from dataclasses import dataclass, field

import pytest

from ragkit.config.retrieval_schema import (
    FusionMethod,
    HybridSearchConfig,
    NormalizationMethod,
)
from ragkit.retrieval.hybrid_engine import HybridSearchEngine


@dataclass
class Candidate:
    chunk_id: str
    score: float
    text: str = ""
    matched_terms: dict[str, int] = field(default_factory=dict)


def _make_engine(**config_overrides) -> HybridSearchEngine:
    config = HybridSearchConfig.model_validate(
        {
            "alpha": 0.5,
            "fusion_method": "rrf",
            "rrf_k": 60,
            "normalize_scores": True,
            "normalization_method": "min_max",
            "top_k": 10,
            "threshold": 0.0,
            "deduplicate": True,
            "debug_default": False,
            **config_overrides,
        }
    )
    return HybridSearchEngine(config)


def test_rrf_fusion_prefers_consensus_chunks() -> None:
    engine = _make_engine(fusion_method=FusionMethod.RRF, rrf_k=10, alpha=0.5)
    semantic = [
        Candidate("a", 0.95),
        Candidate("b", 0.90),
        Candidate("x", 0.70),
    ]
    lexical = [
        Candidate("b", 20.0, matched_terms={"article": 2}),
        Candidate("a", 10.0, matched_terms={"article": 1}),
        Candidate("y", 8.0, matched_terms={"article": 1}),
    ]

    fused = engine.fuse(semantic, lexical, top_k=5)
    ids = [item.chunk_id for item in fused]

    assert ids[0] in {"a", "b"}
    assert "x" in ids
    assert "y" in ids


def test_weighted_sum_alpha_zero_tracks_lexical_order() -> None:
    engine = _make_engine(
        fusion_method=FusionMethod.WEIGHTED_SUM,
        alpha=0.5,
        normalize_scores=True,
        normalization_method=NormalizationMethod.MIN_MAX,
    )
    semantic = [Candidate("a", 0.9), Candidate("b", 0.8), Candidate("c", 0.7)]
    lexical = [Candidate("c", 10.0), Candidate("b", 5.0), Candidate("a", 2.0)]

    fused = engine.fuse(semantic, lexical, alpha=0.0, top_k=3)
    ids = [item.chunk_id for item in fused]
    assert ids == ["c", "b", "a"]


def test_weighted_sum_alpha_one_tracks_semantic_order() -> None:
    engine = _make_engine(
        fusion_method=FusionMethod.WEIGHTED_SUM,
        alpha=0.5,
        normalize_scores=True,
        normalization_method=NormalizationMethod.MIN_MAX,
    )
    semantic = [Candidate("a", 0.9), Candidate("b", 0.8), Candidate("c", 0.7)]
    lexical = [Candidate("c", 10.0), Candidate("b", 5.0), Candidate("a", 2.0)]

    fused = engine.fuse(semantic, lexical, alpha=1.0, top_k=3)
    ids = [item.chunk_id for item in fused]
    assert ids == ["a", "b", "c"]


def test_weighted_sum_includes_chunks_present_in_one_source_only() -> None:
    engine = _make_engine(
        fusion_method=FusionMethod.WEIGHTED_SUM,
        normalize_scores=True,
        normalization_method=NormalizationMethod.MIN_MAX,
    )
    semantic = [Candidate("semantic-only", 0.9)]
    lexical = [Candidate("lexical-only", 12.0, matched_terms={"token": 1})]

    fused = engine.fuse(semantic, lexical, alpha=0.5, top_k=5)
    ids = {item.chunk_id for item in fused}
    assert ids == {"semantic-only", "lexical-only"}


def test_zscore_normalization_centers_distribution() -> None:
    engine = _make_engine(
        fusion_method=FusionMethod.WEIGHTED_SUM,
        normalization_method=NormalizationMethod.Z_SCORE,
    )
    normalized = engine._normalize([1.0, 2.0, 3.0])  # noqa: SLF001 - tested behavior
    assert pytest.approx(sum(normalized), abs=1e-9) == 0.0
