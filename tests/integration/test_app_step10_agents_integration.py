from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from ragkit.config.retrieval_schema import SearchType, UnifiedSearchResponse, UnifiedSearchResultItem
from ragkit.desktop.api import chat as chat_api
from ragkit.desktop.main import create_app
from ragkit.llm.base import LLMResponse, LLMStreamChunk, LLMTestResult, LLMUsage
from tests.integration.test_app_step7_hybrid_integration import _setup_isolated_storage


class _FakeAgentLLMProvider:
    def _resolve_text(self, messages) -> str:
        if not messages:
            return "Reponse vide"
        first_content = str(messages[0].content).lower()
        last_content = str(messages[-1].content).lower()
        if "analyseur de requetes" in first_content:
            if "bonjour" in last_content:
                return '{"intent":"greeting","needs_rag":false,"confidence":0.92,"reasoning":"salutation"}'
            return '{"intent":"question","needs_rag":true,"confidence":0.96,"reasoning":"question documentaire"}'
        if "reformulateur de requetes" in first_content:
            return "conditions de resiliation du contrat"
        if "<context>" in last_content:
            return "Reponse RAG test [Source: Doc Test, p.1]"
        return "Bonjour ! Je peux vous aider sur vos documents."

    async def generate(self, messages, temperature=0.1, max_tokens=2000, top_p=0.9):
        content = self._resolve_text(messages)
        return LLMResponse(
            content=content,
            usage=LLMUsage(prompt_tokens=80, completion_tokens=20, total_tokens=100),
            model="fake-model",
            latency_ms=25,
        )

    async def stream(self, messages, temperature=0.1, max_tokens=2000, top_p=0.9):
        content = self._resolve_text(messages)
        parts = content.split(" ")
        for part in parts:
            token = f"{part} "
            yield LLMStreamChunk(content=token, is_final=False, latency_ms=8)
        yield LLMStreamChunk(
            content="",
            is_final=True,
            usage=LLMUsage(prompt_tokens=60, completion_tokens=len(parts), total_tokens=60 + len(parts)),
            latency_ms=8,
        )

    async def test_connection(self):
        return LLMTestResult(success=True, model="fake-model", response_text="ok", latency_ms=15)


async def _fake_unified_search(payload):
    text = f"Extrait document pour: {payload.query}"
    result = UnifiedSearchResultItem(
        chunk_id=f"chunk-{abs(hash(payload.query)) % 1000}",
        score=0.91,
        text=text,
        text_preview=text[:100],
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
        query=payload.query,
        search_type=SearchType.HYBRID,
        results=[result],
        total_results=1,
        page=1,
        page_size=50,
        has_more=False,
        debug={"pipeline": "hybrid + reranking"},
    )


def test_step10_agents_orchestrated_chat_pipeline(tmp_path: Path, monkeypatch) -> None:
    _setup_isolated_storage(tmp_path, monkeypatch)

    fake_llm = _FakeAgentLLMProvider()
    monkeypatch.setattr(chat_api, "resolve_llm_provider", lambda _cfg: fake_llm)
    monkeypatch.setattr(chat_api.retrieval_api, "_execute_unified_search", _fake_unified_search)
    monkeypatch.setattr(chat_api, "_CONVERSATION_MEMORY", None)

    app = create_app()
    with TestClient(app) as client:
        agents_get = client.get("/api/agents/config")
        assert agents_get.status_code == 200
        assert "query_rewriting" in agents_get.json()

        agents_put = client.put(
            "/api/agents/config",
            json={
                "always_retrieve": False,
                "detect_intents": ["question", "greeting", "out_of_scope", "chitchat"],
                "query_rewriting": {"enabled": True, "num_rewrites": 1},
                "max_history_messages": 10,
                "memory_strategy": "sliding_window",
                "prompt_analyzer": agents_get.json()["prompt_analyzer"],
                "prompt_rewriting": agents_get.json()["prompt_rewriting"],
                "prompt_greeting": agents_get.json()["prompt_greeting"],
                "prompt_out_of_scope": agents_get.json()["prompt_out_of_scope"],
                "analyzer_model": None,
                "analyzer_timeout": 15,
                "debug_default": True,
            },
        )
        assert agents_put.status_code == 200
        assert agents_put.json()["debug_default"] is True

        greeting = client.post(
            "/api/chat",
            json={
                "query": "Bonjour",
                "search_type": "hybrid",
                "include_debug": True,
            },
        )
        assert greeting.status_code == 200
        greeting_payload = greeting.json()
        assert greeting_payload["intent"] == "greeting"
        assert greeting_payload["needs_rag"] is False
        assert greeting_payload["sources"] == []

        question = client.post(
            "/api/chat",
            json={
                "query": "Comment resilier un contrat ?",
                "search_type": "hybrid",
                "include_debug": True,
            },
        )
        assert question.status_code == 200
        question_payload = question.json()
        assert question_payload["intent"] == "question"
        assert question_payload["needs_rag"] is True
        assert question_payload["sources"]
        assert question_payload["rewritten_query"] is not None
        assert question_payload["debug"] is not None

        history = client.get("/api/chat/history")
        assert history.status_code == 200
        history_payload = history.json()
        assert history_payload["total_messages"] >= 4
        assert len(history_payload["messages"]) >= 4

        with client.stream(
            "POST",
            "/api/chat/stream",
            json={
                "query": "Comment resilier un contrat ?",
                "search_type": "hybrid",
                "include_debug": True,
            },
        ) as stream_response:
            assert stream_response.status_code == 200
            body = "".join(stream_response.iter_text())
            assert "event: token" in body
            assert "event: done" in body
            assert '"intent": "question"' in body

        reset_response = client.post("/api/chat/new")
        assert reset_response.status_code == 200
        assert reset_response.json()["success"] is True

        history_after_reset = client.get("/api/chat/history")
        assert history_after_reset.status_code == 200
        assert history_after_reset.json()["total_messages"] == 0
