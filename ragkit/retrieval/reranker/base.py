"""Base abstractions for reranking providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from ragkit.config.rerank_schema import RerankTestResult


@dataclass
class RerankCandidate:
    chunk_id: str
    text: str
    original_rank: int
    original_score: float
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class RerankResult:
    chunk_id: str
    text: str
    rerank_score: float
    original_rank: int
    original_score: float
    rank_change: int
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseReranker(ABC):
    @abstractmethod
    async def rerank(
        self,
        query: str,
        candidates: list[RerankCandidate],
        top_n: int,
        relevance_threshold: float = 0.0,
    ) -> list[RerankResult]:
        """Rerank candidates and return top_n results."""

    @abstractmethod
    async def test_connection(self) -> RerankTestResult:
        """Run a lightweight provider check."""
