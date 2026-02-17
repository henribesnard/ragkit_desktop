from __future__ import annotations

import pytest
from pydantic import ValidationError

from ragkit.config.retrieval_schema import (
    BM25Algorithm,
    FusionMethod,
    HighlightPosition,
    HybridSearchConfig,
    LexicalLanguage,
    LexicalSearchConfig,
    NormalizationMethod,
    UnifiedSearchQuery,
)


def test_lexical_config_normalizes_legacy_fields_and_aliases() -> None:
    config = LexicalSearchConfig.model_validate(
        {
            "algorithm": "bm25+",
            "min_score": 1.25,
            "stopwords_lang": "french",
            "stemmer_lang": "english",
            "ngram_range": [1, 2],
        }
    )

    assert config.algorithm == BM25Algorithm.BM25_PLUS
    assert config.threshold == 1.25
    assert config.stopwords_lang == LexicalLanguage.FR
    assert config.stemmer_lang == LexicalLanguage.EN
    assert config.ngram_range == (1, 2)


def test_lexical_config_invalid_ngram_range_raises() -> None:
    with pytest.raises(ValidationError):
        LexicalSearchConfig.model_validate({"ngram_range": [2, 1]})

    with pytest.raises(ValidationError):
        LexicalSearchConfig.model_validate({"ngram_range": [1, 4]})


def test_highlight_position_requires_end_gt_start() -> None:
    valid = HighlightPosition(start=1, end=3, term="alpha")
    assert valid.start == 1

    with pytest.raises(ValidationError):
        HighlightPosition(start=5, end=5, term="beta")


def test_hybrid_config_normalizes_legacy_aliases() -> None:
    config = HybridSearchConfig.model_validate(
        {
            "fusion_method": "ws",
            "normalization_method": "zscore",
            "min_score": 0.2,
        }
    )
    assert config.fusion_method == FusionMethod.WEIGHTED_SUM
    assert config.normalization_method == NormalizationMethod.Z_SCORE
    assert config.threshold == 0.2


def test_unified_search_query_rejects_empty_query() -> None:
    with pytest.raises(ValidationError):
        UnifiedSearchQuery.model_validate({"query": "   "})
