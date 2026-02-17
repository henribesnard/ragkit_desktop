from __future__ import annotations

import pytest
from pydantic import ValidationError

from ragkit.config.llm_schema import ChatQuery, LLMConfig, LLMProvider


def test_llm_config_defaults_and_normalization() -> None:
    config = LLMConfig.model_validate(
        {
            "provider": "mistralai",
            "model": "  ",
            "temperature": None,
            "max_tokens": None,
            "top_p": None,
            "context_max_chunks": None,
            "context_max_tokens": None,
            "system_prompt": "  prompt  ",
            "uncertainty_phrase": "  je ne sais pas  ",
        }
    )

    assert config.provider == LLMProvider.MISTRAL
    assert config.model == "mistral-small-latest"
    assert config.temperature == 0.1
    assert config.context_max_chunks == 5
    assert config.context_max_tokens == 4000
    assert config.system_prompt == "prompt"
    assert config.uncertainty_phrase == "je ne sais pas"


def test_llm_config_rejects_invalid_context_budget() -> None:
    with pytest.raises(ValidationError):
        LLMConfig.model_validate({"context_max_chunks": 30, "context_max_tokens": 1000})


def test_chat_query_rejects_empty_query() -> None:
    with pytest.raises(ValidationError):
        ChatQuery.model_validate({"query": "   "})
