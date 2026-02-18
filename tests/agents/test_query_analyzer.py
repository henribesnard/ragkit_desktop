from __future__ import annotations

import asyncio

from ragkit.agents.query_analyzer import QueryAnalyzer
from ragkit.config.agents_schema import AgentsConfig, Intent
from ragkit.llm.base import LLMResponse, LLMUsage


class _FakeAnalyzerLLM:
    def __init__(self, content: str):
        self.content = content

    async def generate(self, messages, temperature=0.1, max_tokens=2000, top_p=0.9):
        return LLMResponse(
            content=self.content,
            usage=LLMUsage(prompt_tokens=30, completion_tokens=10, total_tokens=40),
            model="fake",
            latency_ms=15,
        )

    async def stream(self, messages, temperature=0.1, max_tokens=2000, top_p=0.9):
        if False:
            yield

    async def test_connection(self):
        raise NotImplementedError


def test_query_analyzer_parses_valid_json() -> None:
    config = AgentsConfig.model_validate({})
    analyzer = QueryAnalyzer(
        config=config,
        llm=_FakeAnalyzerLLM(
            '{"intent":"greeting","needs_rag":false,"confidence":0.93,"reasoning":"salutation"}'
        ),
    )

    result = asyncio.run(analyzer.analyze("Bonjour", []))
    assert result.intent == Intent.GREETING
    assert result.needs_rag is False
    assert result.confidence > 0.9


def test_query_analyzer_fallback_on_invalid_payload() -> None:
    config = AgentsConfig.model_validate({})
    analyzer = QueryAnalyzer(config=config, llm=_FakeAnalyzerLLM("not-json"))

    result = asyncio.run(analyzer.analyze("Question", []))
    assert result.intent == Intent.QUESTION
    assert result.needs_rag is True
    assert "defaulting to question" in result.reasoning


def test_query_analyzer_short_circuit_when_always_retrieve() -> None:
    config = AgentsConfig.model_validate({"always_retrieve": True})
    analyzer = QueryAnalyzer(config=config, llm=_FakeAnalyzerLLM("{}"))
    result = asyncio.run(analyzer.analyze("Bonjour", []))
    assert result.intent == Intent.QUESTION
    assert result.needs_rag is True
    assert result.latency_ms == 0
