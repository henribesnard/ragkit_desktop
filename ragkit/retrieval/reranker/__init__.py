"""Reranker factory and exports."""

from __future__ import annotations

from ragkit.config.rerank_schema import RerankConfig, RerankProvider
from ragkit.retrieval.reranker.base import BaseReranker, RerankCandidate, RerankResult
from ragkit.retrieval.reranker.cohere_reranker import CohereReranker
from ragkit.retrieval.reranker.jina_reranker import JinaReranker
from ragkit.retrieval.reranker.local_reranker import LocalReranker
from ragkit.retrieval.reranker.voyage_reranker import VoyageReranker

_API_PROVIDERS: dict[RerankProvider, type[BaseReranker]] = {
    RerankProvider.COHERE: CohereReranker,
    RerankProvider.JINA: JinaReranker,
    RerankProvider.VOYAGE: VoyageReranker,
}


def create_reranker(
    config: RerankConfig,
    api_key: str | None = None,
) -> BaseReranker | None:
    """Create a reranker instance from the current config."""
    if not config.enabled or config.provider == RerankProvider.NONE:
        return None
    if config.provider in _API_PROVIDERS:
        if not api_key:
            raise ValueError(f"{config.provider.value.title()} API key is required for reranking.")
        return _API_PROVIDERS[config.provider](config, api_key)
    if config.provider == RerankProvider.LOCAL:
        return LocalReranker(config)
    raise ValueError(f"Unsupported rerank provider: {config.provider}")


__all__ = [
    "BaseReranker",
    "CohereReranker",
    "JinaReranker",
    "LocalReranker",
    "VoyageReranker",
    "RerankCandidate",
    "RerankResult",
    "create_reranker",
]
