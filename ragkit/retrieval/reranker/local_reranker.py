"""Local cross-encoder reranking provider."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from ragkit.config.rerank_schema import (
    RerankConfig,
    RerankTestResult,
    RerankTestResultItem,
)
from ragkit.retrieval.reranker.base import BaseReranker, RerankCandidate, RerankResult


class LocalReranker(BaseReranker):
    """Local HuggingFace cross-encoder reranker."""

    MODELS_DIR = Path("~/.ragkit/models").expanduser()

    def __init__(self, config: RerankConfig):
        self.config = config
        self._model: Any | None = None

    def _resolve_device(self) -> str:
        try:
            import torch  # type: ignore
        except Exception:
            return "cpu"
        if torch.cuda.is_available():
            return "cuda"
        has_mps = hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
        if has_mps:
            return "mps"
        return "cpu"

    def _load_model(self) -> Any:
        if self._model is None:
            try:
                from sentence_transformers import CrossEncoder  # type: ignore
            except Exception as exc:  # pragma: no cover - environment dependent
                raise RuntimeError("sentence-transformers is required for local reranking") from exc

            self._model = CrossEncoder(
                self.config.model,
                max_length=512,
                device=self._resolve_device(),
                cache_folder=str(self.MODELS_DIR),
            )
        return self._model

    async def rerank(
        self,
        query: str,
        candidates: list[RerankCandidate],
        top_n: int,
        relevance_threshold: float = 0.0,
    ) -> list[RerankResult]:
        if not candidates:
            return []

        model = self._load_model()
        pairs = [(query, candidate.text) for candidate in candidates]

        raw_scores = model.predict(
            pairs,
            batch_size=self.config.batch_size,
            show_progress_bar=False,
        )

        # Convert logits to [0, 1] scores with sigmoid.
        try:
            import numpy as np  # type: ignore
        except Exception as exc:  # pragma: no cover - numpy is part of dependencies
            raise RuntimeError("numpy is required for local reranking") from exc

        logits = np.array(raw_scores, dtype=float)
        scores = 1.0 / (1.0 + np.exp(-logits))

        scored: list[RerankResult] = []
        for candidate, score in zip(candidates, scores):
            scored.append(
                RerankResult(
                    chunk_id=candidate.chunk_id,
                    text=candidate.text,
                    rerank_score=float(max(0.0, min(1.0, score))),
                    original_rank=candidate.original_rank,
                    original_score=candidate.original_score,
                    rank_change=0,
                    metadata=candidate.metadata,
                )
            )

        scored.sort(key=lambda item: item.rerank_score, reverse=True)
        scored = [item for item in scored if item.rerank_score >= relevance_threshold]
        scored = scored[:top_n]

        for new_rank, result in enumerate(scored, start=1):
            result.rank_change = result.original_rank - new_rank

        return scored

    async def test_connection(self) -> RerankTestResult:
        start = time.perf_counter()
        try:
            results = await self.rerank(
                query="test query",
                candidates=[
                    RerankCandidate("1", "relevant doc about the test query", 1, 0.9, {}),
                    RerankCandidate("2", "unrelated doc about cooking recipes", 2, 0.8, {}),
                ],
                top_n=2,
                relevance_threshold=0.0,
            )
            latency = max(1, int((time.perf_counter() - start) * 1000))
            return RerankTestResult(
                success=True,
                results=[
                    RerankTestResultItem(text=item.text[:80], score=item.rerank_score, rank=index + 1)
                    for index, item in enumerate(results)
                ],
                latency_ms=latency,
                model=self.config.model or "",
            )
        except Exception as exc:
            return RerankTestResult(
                success=False,
                results=[],
                latency_ms=0,
                model=self.config.model or "",
                error=str(exc),
            )
