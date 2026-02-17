from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from ragkit.config.rerank_schema import RerankTestResult, RerankTestResultItem
from ragkit.desktop.api import rerank as rerank_api
from ragkit.desktop.api import retrieval as retrieval_api
from ragkit.desktop.main import create_app
from ragkit.retrieval.reranker.base import RerankCandidate, RerankResult
from tests.integration.test_app_step7_hybrid_integration import (
    _configure_core_settings,
    _setup_isolated_storage,
    _wait_for_ingestion_completion,
)


class _FakeReranker:
    async def rerank(
        self,
        query: str,
        candidates: list[RerankCandidate],
        top_n: int,
        relevance_threshold: float = 0.0,
    ) -> list[RerankResult]:
        scored: list[RerankResult] = []
        for index, candidate in enumerate(reversed(candidates), start=1):
            score = max(0.0, 1.0 - ((index - 1) * 0.1))
            if score < relevance_threshold:
                continue
            scored.append(
                RerankResult(
                    chunk_id=candidate.chunk_id,
                    text=candidate.text,
                    rerank_score=score,
                    original_rank=candidate.original_rank,
                    original_score=candidate.original_score,
                    rank_change=candidate.original_rank - index,
                    metadata=candidate.metadata,
                )
            )
        return scored[:top_n]

    async def test_connection(self) -> RerankTestResult:
        return RerankTestResult(
            success=True,
            results=[
                RerankTestResultItem(text="doc 1", score=0.99, rank=1),
                RerankTestResultItem(text="doc 2", score=0.1, rank=2),
            ],
            latency_ms=15,
            model="fake-reranker",
        )


def test_step8_rerank_config_endpoints_and_pipeline(tmp_path: Path, monkeypatch) -> None:
    _, _, data_dir = _setup_isolated_storage(tmp_path, monkeypatch)

    source_dir = tmp_path / "docs"
    source_dir.mkdir(parents=True, exist_ok=True)
    (source_dir / "legal.txt").write_text(
        "Article 12 - Resiliation du contrat. Les conditions de resiliation anticipee "
        "sont definies par la clause 12 du present contrat.",
        encoding="utf-8",
    )
    (source_dir / "hr.txt").write_text(
        "Le contrat de travail est signe a la date de prise de poste.",
        encoding="utf-8",
    )

    fake_reranker = _FakeReranker()
    monkeypatch.setattr(retrieval_api, "resolve_reranker", lambda _config: fake_reranker)
    monkeypatch.setattr(rerank_api, "resolve_reranker", lambda _config: fake_reranker)

    app = create_app()
    with TestClient(app) as client:
        _configure_core_settings(client, source_dir=source_dir, data_root=data_dir)

        config_get = client.get("/api/rerank/config")
        assert config_get.status_code == 200
        assert "enabled" in config_get.json()

        config_put = client.put(
            "/api/rerank/config",
            json={
                "enabled": True,
                "provider": "local",
                "model": "BAAI/bge-reranker-v2-m3",
                "candidates": 8,
                "top_n": 3,
                "relevance_threshold": 0.0,
                "batch_size": 8,
                "timeout": 30,
                "max_retries": 0,
                "debug_default": True,
            },
        )
        assert config_put.status_code == 200
        assert config_put.json()["enabled"] is True
        assert config_put.json()["provider"] == "local"

        connection_test = client.post("/api/rerank/test-connection")
        assert connection_test.status_code == 200
        assert connection_test.json()["success"] is True

        rerank_test = client.post(
            "/api/rerank/test",
            json={
                "query": "conditions de resiliation",
                "documents": [
                    "L'article 12 couvre les conditions de resiliation.",
                    "Le contrat prend effet a la date de signature.",
                ],
            },
        )
        assert rerank_test.status_code == 200
        payload_test = rerank_test.json()
        assert payload_test["success"] is True
        assert len(payload_test["results"]) >= 1

        models_response = client.get("/api/rerank/models", params={"provider": "local"})
        assert models_response.status_code == 200
        assert any(item["id"] == "BAAI/bge-reranker-v2-m3" for item in models_response.json())

        start_response = client.post("/api/ingestion/start", json={"incremental": False})
        assert start_response.status_code == 200
        status = _wait_for_ingestion_completion(client)
        assert status["status"] == "completed"

        search_response = client.post(
            "/api/search",
            json={
                "query": "article 12 resiliation",
                "search_type": "hybrid",
                "page": 1,
                "page_size": 5,
                "include_debug": True,
            },
        )
        assert search_response.status_code == 200
        payload = search_response.json()
        assert payload["search_type"] == "hybrid"
        assert payload["total_results"] >= 1
        assert payload["debug"] is not None
        assert "rerank" in payload["debug"]
        first = payload["results"][0]
        assert first["is_reranked"] is True
        assert first["rerank_score"] is not None
        assert first["original_rank"] is not None
        assert first["rank_change"] is not None
