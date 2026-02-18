from __future__ import annotations

import pytest

from ragkit.config.agents_schema import AgentsConfig, Intent


def test_agents_config_enforces_question_intent() -> None:
    config = AgentsConfig.model_validate(
        {
            "detect_intents": ["greeting", "out_of_scope"],
            "query_rewriting": {"enabled": True, "num_rewrites": 1},
        }
    )
    assert config.detect_intents[0] == Intent.QUESTION
    assert Intent.GREETING in config.detect_intents
    assert Intent.OUT_OF_SCOPE in config.detect_intents


def test_agents_config_rejects_empty_prompts() -> None:
    with pytest.raises(ValueError):
        AgentsConfig.model_validate({"prompt_analyzer": "   "})
