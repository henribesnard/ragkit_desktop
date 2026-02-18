from __future__ import annotations

import asyncio

from ragkit.agents.query_rewriter import QueryRewriter
from ragkit.config.agents_schema import AgentsConfig
from ragkit.llm.base import LLMResponse, LLMUsage


class _FakeRewriteLLM:
    def __init__(self, responses: list[str]):
        self.responses = responses
        self.calls = 0

    async def generate(self, messages, temperature=0.1, max_tokens=2000, top_p=0.9):
        content = self.responses[min(self.calls, len(self.responses) - 1)]
        self.calls += 1
        return LLMResponse(
            content=content,
            usage=LLMUsage(prompt_tokens=20, completion_tokens=6, total_tokens=26),
            model="fake",
            latency_ms=10,
        )

    async def stream(self, messages, temperature=0.1, max_tokens=2000, top_p=0.9):
        if False:
            yield

    async def test_connection(self):
        raise NotImplementedError


def test_query_rewriter_disabled_returns_original() -> None:
    config = AgentsConfig.model_validate({"query_rewriting": {"enabled": False, "num_rewrites": 0}})
    rewriter = QueryRewriter(config=config, llm=_FakeRewriteLLM(["ignored"]))
    result = asyncio.run(rewriter.rewrite("Et pour celui-la ?", []))
    assert result.rewritten_queries == ["Et pour celui-la ?"]
    assert result.latency_ms == 0


def test_query_rewriter_multiple_rewrites_deduplicates() -> None:
    config = AgentsConfig.model_validate({"query_rewriting": {"enabled": True, "num_rewrites": 3}})
    rewriter = QueryRewriter(
        config=config,
        llm=_FakeRewriteLLM(
            [
                "conditions de resiliation du contrat principal",
                "conditions de resiliation du contrat principal",
                "modalites de resiliation du contrat principal",
            ]
        ),
    )
    result = asyncio.run(rewriter.rewrite("Et pour celui-la ?", [{"role": "user", "content": "contrat principal"}]))
    assert len(result.rewritten_queries) == 2
    assert result.rewritten_queries[0].startswith("conditions")
