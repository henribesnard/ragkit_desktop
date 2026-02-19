"""Health checks for embedding, llm, vector store and reranker services."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ragkit.config.monitoring_schema import ServiceHealth, ServiceStatus


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_success(result: Any) -> bool:
    success = getattr(result, "success", None)
    if success is None and isinstance(result, dict):
        success = result.get("success")
    return bool(success)


def _result_model(result: Any) -> str | None:
    model = getattr(result, "model", None)
    if model is None and isinstance(result, dict):
        model = result.get("model")
    if model is None:
        return None
    text = str(model).strip()
    return text or None


def _result_error(result: Any) -> str | None:
    error = getattr(result, "error", None)
    if error is None and isinstance(result, dict):
        error = result.get("error")
    if error is None:
        return None
    text = str(error).strip()
    return text or None


class HealthChecker:
    """Checks all runtime services used by the RAG pipeline."""

    def __init__(
        self,
        *,
        embedding_provider: Any | None = None,
        llm_provider: Any | None = None,
        vector_store: Any | None = None,
        reranker: Any | None = None,
        embedding_name: str | None = None,
        embedding_model: str | None = None,
        llm_name: str | None = None,
        llm_model: str | None = None,
        vector_name: str | None = None,
        reranker_name: str | None = None,
        reranker_model: str | None = None,
    ):
        self.embedding_provider = embedding_provider
        self.llm_provider = llm_provider
        self.vector_store = vector_store
        self.reranker = reranker

        self.embedding_name = embedding_name
        self.embedding_model = embedding_model
        self.llm_name = llm_name
        self.llm_model = llm_model
        self.vector_name = vector_name
        self.reranker_name = reranker_name
        self.reranker_model = reranker_model

    async def check_all(self) -> list[ServiceHealth]:
        return [
            await self._check_embedding(),
            await self._check_llm(),
            await self._check_vector_store(),
            await self._check_reranker(),
        ]

    async def _check_embedding(self) -> ServiceHealth:
        if self.embedding_provider is None:
            return ServiceHealth(
                name="Embedding",
                status=ServiceStatus.DISABLED,
                provider=self.embedding_name,
                model=self.embedding_model,
                last_check=_now_iso(),
            )

        try:
            result = await self.embedding_provider.test_connection()
            if _is_success(result):
                model = _result_model(result) or self.embedding_model
                return ServiceHealth(
                    name="Embedding",
                    status=ServiceStatus.OK,
                    provider=self.embedding_name,
                    model=model,
                    last_check=_now_iso(),
                )
            return ServiceHealth(
                name="Embedding",
                status=ServiceStatus.ERROR,
                provider=self.embedding_name,
                model=self.embedding_model,
                last_check=_now_iso(),
                error=_result_error(result) or "Embedding provider unavailable.",
            )
        except Exception as exc:  # pragma: no cover - defensive
            return ServiceHealth(
                name="Embedding",
                status=ServiceStatus.ERROR,
                provider=self.embedding_name,
                model=self.embedding_model,
                last_check=_now_iso(),
                error=str(exc),
            )

    async def _check_llm(self) -> ServiceHealth:
        if self.llm_provider is None:
            return ServiceHealth(
                name="LLM",
                status=ServiceStatus.DISABLED,
                provider=self.llm_name,
                model=self.llm_model,
                last_check=_now_iso(),
            )

        try:
            result = await self.llm_provider.test_connection()
            if _is_success(result):
                model = _result_model(result) or self.llm_model
                return ServiceHealth(
                    name="LLM",
                    status=ServiceStatus.OK,
                    provider=self.llm_name,
                    model=model,
                    last_check=_now_iso(),
                )
            return ServiceHealth(
                name="LLM",
                status=ServiceStatus.ERROR,
                provider=self.llm_name,
                model=self.llm_model,
                last_check=_now_iso(),
                error=_result_error(result) or "LLM provider unavailable.",
            )
        except Exception as exc:  # pragma: no cover - defensive
            return ServiceHealth(
                name="LLM",
                status=ServiceStatus.ERROR,
                provider=self.llm_name,
                model=self.llm_model,
                last_check=_now_iso(),
                error=str(exc),
            )

    async def _check_vector_store(self) -> ServiceHealth:
        if self.vector_store is None:
            return ServiceHealth(
                name="Vector DB",
                status=ServiceStatus.DISABLED,
                provider=self.vector_name,
                last_check=_now_iso(),
            )
        try:
            test = await self.vector_store.test_connection()
            if not _is_success(test):
                return ServiceHealth(
                    name="Vector DB",
                    status=ServiceStatus.ERROR,
                    provider=self.vector_name,
                    last_check=_now_iso(),
                    error=_result_error(test) or "Vector store unavailable.",
                )
            stats = await self.vector_store.collection_stats()
            vectors_count = int(getattr(stats, "vectors_count", 0) or 0)
            detail = f"{vectors_count} vecs"
            return ServiceHealth(
                name="Vector DB",
                status=ServiceStatus.OK,
                provider=self.vector_name,
                detail=detail,
                last_check=_now_iso(),
            )
        except Exception as exc:  # pragma: no cover - defensive
            return ServiceHealth(
                name="Vector DB",
                status=ServiceStatus.ERROR,
                provider=self.vector_name,
                last_check=_now_iso(),
                error=str(exc),
            )

    async def _check_reranker(self) -> ServiceHealth:
        if self.reranker is None:
            return ServiceHealth(
                name="Reranker",
                status=ServiceStatus.DISABLED,
                provider=self.reranker_name,
                model=self.reranker_model,
                last_check=_now_iso(),
            )

        try:
            result = await self.reranker.test_connection()
            if _is_success(result):
                model = _result_model(result) or self.reranker_model
                return ServiceHealth(
                    name="Reranker",
                    status=ServiceStatus.OK,
                    provider=self.reranker_name,
                    model=model,
                    last_check=_now_iso(),
                )
            return ServiceHealth(
                name="Reranker",
                status=ServiceStatus.ERROR,
                provider=self.reranker_name,
                model=self.reranker_model,
                last_check=_now_iso(),
                error=_result_error(result) or "Reranker unavailable.",
            )
        except Exception as exc:  # pragma: no cover - defensive
            return ServiceHealth(
                name="Reranker",
                status=ServiceStatus.ERROR,
                provider=self.reranker_name,
                model=self.reranker_model,
                last_check=_now_iso(),
                error=str(exc),
            )
