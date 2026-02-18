from __future__ import annotations

import asyncio
from dataclasses import dataclass
from types import SimpleNamespace

from ragkit.agents.memory import ConversationMemory
from ragkit.agents.orchestrator import Orchestrator
from ragkit.agents.query_analyzer import AnalysisResult
from ragkit.agents.query_rewriter import RewriteResult
from ragkit.config.agents_schema import AgentsConfig, Intent
from ragkit.config.retrieval_schema import SearchType, UnifiedSearchResultItem
from ragkit.llm.base import LLMResponse, LLMUsage


class _StaticAnalyzer:
    def __init__(self, result: AnalysisResult):
        self.result = result

    async def analyze(self, message, history=None):
        return self.result


class _StaticRewriter:
    def __init__(self, result: RewriteResult):
        self.result = result

    async def rewrite(self, query, history=None):
        return self.result


class _FakeLLM:
    async def generate(self, messages, temperature=0.1, max_tokens=2000, top_p=0.9):
        return LLMResponse(
            content="Reponse non-rag",
            usage=LLMUsage(prompt_tokens=20, completion_tokens=5, total_tokens=25),
            model="fake",
            latency_ms=12,
        )

    async def stream(self, messages, temperature=0.1, max_tokens=2000, top_p=0.9):
        if False:
            yield

    async def test_connection(self):
        raise NotImplementedError


@dataclass
class _FakeRagResponse:
    content: str
    sources: list
    debug: object | None = None


class _FakeResponseGenerator:
    def __init__(self):
        self.called_with = []
        self.config = SimpleNamespace(response_language="auto", model="fake")

    async def generate(self, query, retrieval_results, **kwargs):
        self.called_with.append((query, retrieval_results, kwargs))
        return _FakeRagResponse(
            content="Reponse rag",
            sources=[
                {
                    "id": 1,
                    "chunk_id": "chunk-1",
                    "title": "Doc",
                    "path": "/tmp/doc",
                    "page": 1,
                    "score": 0.9,
                    "text_preview": "preview",
                }
            ],
        )

    async def stream_events(self, query, retrieval_results, **kwargs):
        if False:
            yield


def _result(chunk_id: str, score: float) -> UnifiedSearchResultItem:
    return UnifiedSearchResultItem(
        chunk_id=chunk_id,
        score=score,
        text=f"text {chunk_id}",
        text_preview=f"text {chunk_id}",
        keywords=[],
    )


def test_orchestrator_non_rag_skips_retrieval() -> None:
    config = AgentsConfig.model_validate({})
    memory = ConversationMemory(config)
    retrieval_calls = {"count": 0}

    async def _retrieve(_query: str):
        retrieval_calls["count"] += 1
        return None

    orchestrator = Orchestrator(
        config=config,
        analyzer=_StaticAnalyzer(
            AnalysisResult(intent=Intent.GREETING, needs_rag=False, confidence=0.9, reasoning="hello", latency_ms=5)
        ),
        rewriter=_StaticRewriter(RewriteResult(original_query="hello", rewritten_queries=["hello"], latency_ms=0)),
        memory=memory,
        response_generator=_FakeResponseGenerator(),
        llm=_FakeLLM(),
        retrieve_handler=_retrieve,
    )

    result = asyncio.run(orchestrator.process("Bonjour", include_debug=True))
    assert retrieval_calls["count"] == 0
    assert result.intent == "greeting"
    assert result.needs_rag is False
    assert memory.state.total_messages == 2


def test_orchestrator_rag_rewrite_multi_query_deduplicates() -> None:
    config = AgentsConfig.model_validate({})
    memory = ConversationMemory(config)
    generator = _FakeResponseGenerator()

    async def _retrieve(query_text: str):
        if "alt" in query_text:
            results = [_result("chunk-1", 0.8), _result("chunk-2", 0.7)]
        else:
            results = [_result("chunk-1", 0.9)]
        return SimpleNamespace(
            results=results,
            search_type=SearchType.HYBRID,
            debug={"query": query_text},
        )

    orchestrator = Orchestrator(
        config=config,
        analyzer=_StaticAnalyzer(
            AnalysisResult(intent=Intent.QUESTION, needs_rag=True, confidence=0.95, reasoning="question", latency_ms=4)
        ),
        rewriter=_StaticRewriter(
            RewriteResult(
                original_query="question",
                rewritten_queries=["question reformulee", "question alt"],
                latency_ms=7,
            )
        ),
        memory=memory,
        response_generator=generator,
        llm=_FakeLLM(),
        retrieve_handler=_retrieve,
    )

    result = asyncio.run(orchestrator.process("question", include_debug=True))
    assert result.needs_rag is True
    assert result.rewritten_query == "question reformulee"
    assert generator.called_with
    _, retrieval_results, _ = generator.called_with[0]
    assert len(retrieval_results) == 2
