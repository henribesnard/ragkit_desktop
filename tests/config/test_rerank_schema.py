from __future__ import annotations

import pytest
from pydantic import ValidationError

from ragkit.config.rerank_schema import RerankConfig, RerankProvider, RerankTestQuery


def test_rerank_config_normalizes_nullable_profile_payload() -> None:
    config = RerankConfig.model_validate(
        {
            "enabled": False,
            "provider": "none",
            "model": None,
            "candidates": None,
            "top_n": None,
            "relevance_threshold": None,
            "batch_size": None,
            "timeout": None,
            "max_retries": None,
        }
    )

    assert config.provider == RerankProvider.NONE
    assert config.candidates == 40
    assert config.top_n == 5
    assert config.relevance_threshold == 0.0
    assert config.batch_size == 10
    assert config.timeout == 30
    assert config.max_retries == 2


def test_rerank_config_rejects_invalid_constraints() -> None:
    with pytest.raises(ValidationError):
        RerankConfig.model_validate({"enabled": True, "provider": "none", "model": None})

    with pytest.raises(ValidationError):
        RerankConfig.model_validate({"enabled": True, "provider": "cohere", "model": None})

    with pytest.raises(ValidationError):
        RerankConfig.model_validate(
            {"enabled": True, "provider": "cohere", "model": "rerank-v3.5", "candidates": 10, "top_n": 11}
        )


def test_rerank_test_query_requires_two_non_empty_documents() -> None:
    query = RerankTestQuery.model_validate(
        {
            "query": "  contrat  ",
            "documents": ["  doc A  ", "doc B", "   "],
        }
    )
    assert query.query == "contrat"
    assert query.documents == ["doc A", "doc B"]

    with pytest.raises(ValidationError):
        RerankTestQuery.model_validate({"query": "alpha", "documents": ["", "   "]})
