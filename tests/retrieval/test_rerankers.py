from __future__ import annotations

import asyncio
import types

import pytest

from ragkit.config.rerank_schema import RerankConfig, RerankProvider
from ragkit.retrieval.reranker import create_reranker
from ragkit.retrieval.reranker.base import RerankCandidate
from ragkit.retrieval.reranker.cohere_reranker import CohereReranker
from ragkit.retrieval.reranker.local_reranker import LocalReranker


def test_factory_requires_api_key_for_cohere() -> None:
    config = RerankConfig.model_validate(
        {"enabled": True, "provider": "cohere", "model": "rerank-v3.5", "top_n": 3, "candidates": 10}
    )
    with pytest.raises(ValueError):
        create_reranker(config, api_key=None)

    reranker = create_reranker(config, api_key="test-key")
    assert isinstance(reranker, CohereReranker)

    disabled = RerankConfig.model_validate({"enabled": False, "provider": "none"})
    assert create_reranker(disabled, api_key=None) is None


def test_cohere_reranker_sorts_and_filters_scores(monkeypatch) -> None:
    config = RerankConfig.model_validate(
        {
            "enabled": True,
            "provider": "cohere",
            "model": "rerank-v3.5",
            "top_n": 3,
            "candidates": 10,
            "relevance_threshold": 0.0,
            "timeout": 10,
            "max_retries": 0,
        }
    )

    class _FakeResponse:
        status_code = 200

        def raise_for_status(self) -> None:
            return None

        def json(self):
            return {
                "results": [
                    {"index": 1, "relevance_score": 0.91},
                    {"index": 0, "relevance_score": 0.44},
                ]
            }

    class _FakeClient:
        def __init__(self, *_, **__):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def post(self, *_args, **_kwargs):
            return _FakeResponse()

    monkeypatch.setattr("ragkit.retrieval.reranker.cohere_reranker.httpx.AsyncClient", _FakeClient)

    reranker = CohereReranker(config=config, api_key="token")
    results = asyncio.run(
        reranker.rerank(
            query="article 12",
            candidates=[
                RerankCandidate(chunk_id="a", text="alpha", original_rank=1, original_score=0.8, metadata={}),
                RerankCandidate(chunk_id="b", text="beta", original_rank=2, original_score=0.7, metadata={}),
            ],
            top_n=2,
            relevance_threshold=0.5,
        )
    )

    assert [item.chunk_id for item in results] == ["b"]
    assert results[0].rerank_score == 0.91
    assert results[0].rank_change == 1


def test_local_reranker_sigmoid_normalization_and_threshold(monkeypatch) -> None:
    config = RerankConfig.model_validate(
        {
            "enabled": True,
            "provider": "local",
            "model": "BAAI/bge-reranker-v2-m3",
            "top_n": 2,
            "candidates": 10,
            "batch_size": 2,
        }
    )
    reranker = LocalReranker(config=config)

    class _FakeModel:
        def predict(self, _pairs, batch_size: int, show_progress_bar: bool):
            assert batch_size == 2
            assert show_progress_bar is False
            return [3.0, -4.0]

    monkeypatch.setattr(reranker, "_load_model", lambda: _FakeModel())

    results = asyncio.run(
        reranker.rerank(
            query="query",
            candidates=[
                RerankCandidate(chunk_id="a", text="alpha", original_rank=1, original_score=0.8, metadata={}),
                RerankCandidate(chunk_id="b", text="beta", original_rank=2, original_score=0.7, metadata={}),
            ],
            top_n=2,
            relevance_threshold=0.2,
        )
    )

    assert len(results) == 1
    assert results[0].chunk_id == "a"
    assert 0.9 < results[0].rerank_score < 1.0


def test_local_reranker_detects_cuda_then_mps_then_cpu(monkeypatch) -> None:
    config = RerankConfig.model_validate(
        {
            "enabled": True,
            "provider": "local",
            "model": "BAAI/bge-reranker-v2-m3",
            "top_n": 2,
            "candidates": 10,
        }
    )
    reranker = LocalReranker(config=config)

    fake_torch_cuda = types.SimpleNamespace(
        cuda=types.SimpleNamespace(is_available=lambda: True),
        backends=types.SimpleNamespace(mps=types.SimpleNamespace(is_available=lambda: False)),
    )
    monkeypatch.setitem(__import__("sys").modules, "torch", fake_torch_cuda)
    assert reranker._resolve_device() == "cuda"

    fake_torch_mps = types.SimpleNamespace(
        cuda=types.SimpleNamespace(is_available=lambda: False),
        backends=types.SimpleNamespace(mps=types.SimpleNamespace(is_available=lambda: True)),
    )
    monkeypatch.setitem(__import__("sys").modules, "torch", fake_torch_mps)
    assert reranker._resolve_device() == "mps"
