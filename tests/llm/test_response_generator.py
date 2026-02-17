from __future__ import annotations

import asyncio

from ragkit.config.llm_schema import LLMConfig
from ragkit.config.retrieval_schema import UnifiedSearchResultItem
from ragkit.llm.base import LLMResponse, LLMStreamChunk, LLMTestResult, LLMUsage
from ragkit.llm.response_generator import ResponseGenerator


class _FakeLLMProvider:
    async def generate(self, messages, temperature=0.1, max_tokens=2000, top_p=0.9):
        assert messages[0].role == "system"
        assert "<context>" in messages[1].content
        return LLMResponse(
            content="Reponse test [Source: Doc A, p.1]",
            usage=LLMUsage(prompt_tokens=120, completion_tokens=24, total_tokens=144),
            model="fake-model",
            latency_ms=40,
        )

    async def stream(self, messages, temperature=0.1, max_tokens=2000, top_p=0.9):
        assert messages[0].role == "system"
        yield LLMStreamChunk(content="Reponse ", is_final=False, usage=None, latency_ms=15)
        yield LLMStreamChunk(content="test", is_final=False, usage=None, latency_ms=15)
        yield LLMStreamChunk(
            content="",
            is_final=True,
            usage=LLMUsage(prompt_tokens=120, completion_tokens=2, total_tokens=122),
            latency_ms=15,
        )

    async def test_connection(self):
        return LLMTestResult(success=True, model="fake-model", response_text="ok", latency_ms=10)


def _result() -> UnifiedSearchResultItem:
    text = "Article 12: les conditions de resiliation sont detaillees ici."
    return UnifiedSearchResultItem(
        chunk_id="chunk-1",
        score=0.95,
        text=text,
        text_preview=text[:80],
        doc_title="Doc A",
        doc_path="/tmp/doc-a.txt",
        page_number=1,
        keywords=[],
    )


def test_response_generator_generate_and_debug() -> None:
    config = LLMConfig.model_validate(
        {"provider": "openai", "model": "gpt-4o-mini", "citation_format": "inline"}
    )
    generator = ResponseGenerator(config=config, llm_provider=_FakeLLMProvider())

    rag = asyncio.run(
        generator.generate(
            query="conditions de resiliation",
            retrieval_results=[_result()],
            retrieval_latency_ms=55,
            search_type="hybrid",
            reranking_applied=True,
            include_debug=True,
        )
    )

    assert "Reponse test" in rag.content
    assert len(rag.sources) == 1
    assert rag.debug is not None
    assert rag.debug.retrieval_latency_ms == 55
    assert rag.debug.context_chunks == 1
    assert rag.debug.reranking_applied is True


def test_response_generator_stream_events() -> None:
    config = LLMConfig.model_validate({"provider": "openai", "model": "gpt-4o-mini"})
    generator = ResponseGenerator(config=config, llm_provider=_FakeLLMProvider())

    async def _collect():
        events = []
        async for item in generator.stream_events(
            query="question",
            retrieval_results=[_result()],
            include_debug=True,
            retrieval_latency_ms=10,
            search_type="hybrid",
            reranking_applied=False,
        ):
            events.append(item)
        return events

    events = asyncio.run(_collect())
    assert events[0]["type"] == "token"
    assert events[-1]["type"] == "done"
    assert "answer" in events[-1]
    assert "sources" in events[-1]
