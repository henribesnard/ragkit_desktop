from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from ragkit.config.llm_schema import LLMProvider
from ragkit.config.retrieval_schema import SearchType, UnifiedSearchResponse, UnifiedSearchResultItem
from ragkit.desktop.api import chat as chat_api
from ragkit.desktop.api import llm as llm_api
from ragkit.desktop.main import create_app
from ragkit.llm.base import LLMResponse, LLMStreamChunk, LLMTestResult, LLMUsage
from tests.integration.test_app_step7_hybrid_integration import _setup_isolated_storage


class _FakeLLMProvider:
    async def generate(self, messages, temperature=0.1, max_tokens=2000, top_p=0.9):
        assert messages
        return LLMResponse(
            content="Reponse RAG test [Source: Doc Test, p.1]",
            usage=LLMUsage(prompt_tokens=100, completion_tokens=20, total_tokens=120),
            model="fake-model",
            latency_ms=35,
        )

    async def stream(self, messages, temperature=0.1, max_tokens=2000, top_p=0.9):
        assert messages
        yield LLMStreamChunk(content="Reponse ", is_final=False, latency_ms=12)
        yield LLMStreamChunk(content="RAG test", is_final=False, latency_ms=12)
        yield LLMStreamChunk(
            content="",
            is_final=True,
            usage=LLMUsage(prompt_tokens=90, completion_tokens=2, total_tokens=92),
            latency_ms=12,
        )

    async def test_connection(self):
        return LLMTestResult(success=True, model="fake-model", response_text="ok", latency_ms=18)


async def _fake_unified_search(_payload):
    result = UnifiedSearchResultItem(
        chunk_id="chunk-1",
        score=0.91,
        text="Le contrat peut etre resilie selon l'article 12.",
        text_preview="Le contrat peut etre resilie...",
        doc_title="Doc Test",
        doc_path="/tmp/doc-test.txt",
        page_number=1,
        keywords=[],
        is_reranked=True,
        rerank_score=0.97,
        original_rank=3,
        rank_change=2,
    )
    return UnifiedSearchResponse(
        query="resiliation",
        search_type=SearchType.HYBRID,
        results=[result],
        total_results=1,
        page=1,
        page_size=50,
        has_more=False,
        debug={"pipeline": "hybrid + reranking"},
    )


def test_step9_llm_config_and_chat_pipeline(tmp_path: Path, monkeypatch) -> None:
    _setup_isolated_storage(tmp_path, monkeypatch)

    fake_llm = _FakeLLMProvider()
    monkeypatch.setattr(llm_api, "resolve_llm_provider", lambda _cfg: fake_llm)
    monkeypatch.setattr(chat_api, "resolve_llm_provider", lambda _cfg: fake_llm)
    monkeypatch.setattr(chat_api.retrieval_api, "_execute_unified_search", _fake_unified_search)

    app = create_app()
    with TestClient(app) as client:
        config_get = client.get("/api/llm/config")
        assert config_get.status_code == 200
        assert config_get.json()["provider"] in {item.value for item in LLMProvider}

        config_put = client.put(
            "/api/llm/config",
            json={
                "provider": "openai",
                "model": "gpt-4o-mini",
                "temperature": 0.2,
                "max_tokens": 1200,
                "top_p": 0.95,
                "cite_sources": True,
                "citation_format": "inline",
                "admit_uncertainty": True,
                "uncertainty_phrase": "Je ne sais pas.",
                "response_language": "auto",
                "context_max_chunks": 5,
                "context_max_tokens": 4000,
                "system_prompt": "Prompt {citation_format_instruction} {uncertainty_phrase}",
                "timeout": 60,
                "max_retries": 2,
                "streaming": True,
                "debug_default": True,
            },
        )
        assert config_put.status_code == 200
        assert config_put.json()["temperature"] == 0.2

        test_conn = client.post("/api/llm/test-connection")
        assert test_conn.status_code == 200
        assert test_conn.json()["success"] is True

        chat_resp = client.post(
            "/api/chat",
            json={
                "query": "Comment resilier un contrat ?",
                "search_type": "hybrid",
                "include_debug": True,
            },
        )
        assert chat_resp.status_code == 200
        payload = chat_resp.json()
        assert "Reponse RAG test" in payload["answer"]
        assert payload["sources"]
        assert payload["debug"] is not None

        with client.stream(
            "POST",
            "/api/chat/stream",
            json={
                "query": "Comment resilier un contrat ?",
                "search_type": "hybrid",
                "include_debug": True,
            },
        ) as stream_resp:
            assert stream_resp.status_code == 200
            body = "".join(stream_resp.iter_text())
            assert "event: token" in body
            assert "event: done" in body
