"""Cohere reranking provider."""

from __future__ import annotations

import asyncio
import time

import httpx

from ragkit.config.rerank_schema import (
    RerankConfig,
    RerankTestResult,
    RerankTestResultItem,
)
from ragkit.retrieval.reranker.base import BaseReranker, RerankCandidate, RerankResult


class CohereReranker(BaseReranker):
    """Cohere Rerank API provider."""

    API_URL = "https://api.cohere.com/v2/rerank"

    def __init__(self, config: RerankConfig, api_key: str):
        self.config = config
        self.api_key = api_key

    async def rerank(
        self,
        query: str,
        candidates: list[RerankCandidate],
        top_n: int,
        relevance_threshold: float = 0.0,
    ) -> list[RerankResult]:
        if not candidates:
            return []

        documents = [candidate.text for candidate in candidates]
        payload = {
            "model": self.config.model,
            "query": query,
            "documents": documents,
            # Return all candidates, then apply threshold and top_n locally.
            "top_n": len(documents),
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        timeout = httpx.Timeout(float(self.config.timeout))
        retries = max(int(self.config.max_retries), 0)
        response_payload: dict[str, object] | None = None
        last_error: Exception | None = None

        for attempt in range(retries + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(self.API_URL, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                response_payload = data if isinstance(data, dict) else {}
                last_error = None
                break
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code
                # Retry only transient failures.
                if status_code in {408, 409, 425, 429, 500, 502, 503, 504} and attempt < retries:
                    last_error = exc
                    await asyncio.sleep(min(0.25 * (2**attempt), 2.0))
                    continue
                raise
            except (httpx.TimeoutException, httpx.RequestError) as exc:
                last_error = exc
                if attempt < retries:
                    await asyncio.sleep(min(0.25 * (2**attempt), 2.0))
                    continue
                raise

        if response_payload is None:
            if last_error:
                raise last_error
            return []

        raw_results = response_payload.get("results", [])
        scored: list[RerankResult] = []
        if isinstance(raw_results, list):
            for item in raw_results:
                if not isinstance(item, dict):
                    continue
                idx = int(item.get("index", -1))
                if idx < 0 or idx >= len(candidates):
                    continue
                candidate = candidates[idx]
                raw_score = float(item.get("relevance_score", 0.0))
                score = max(0.0, min(1.0, raw_score))
                scored.append(
                    RerankResult(
                        chunk_id=candidate.chunk_id,
                        text=candidate.text,
                        rerank_score=score,
                        original_rank=candidate.original_rank,
                        original_score=candidate.original_score,
                        rank_change=0,
                        metadata=candidate.metadata,
                    )
                )

        # Defensive fallback if provider returns an empty payload.
        if not scored:
            for candidate in candidates:
                scored.append(
                    RerankResult(
                        chunk_id=candidate.chunk_id,
                        text=candidate.text,
                        rerank_score=0.0,
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
