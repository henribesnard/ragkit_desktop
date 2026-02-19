from __future__ import annotations

from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse

from ragkit.config.embedding_schema import EmbeddingConfig
from ragkit.config.monitoring_schema import (
    ActivityDataPoint,
    FeedbackStats,
    FeedbackSubmission,
    IngestionStats,
    IntentDistribution,
    IntentItem,
    LatencyBreakdown,
    MonitoringConfig,
    PaginatedQueryLogs,
    QueryLogEntryModel,
    QueryMetrics,
    ServiceHealth,
)
from ragkit.config.vector_store_schema import VectorStoreConfig
from ragkit.desktop import documents
from ragkit.desktop.ingestion_runtime import runtime
from ragkit.desktop.llm_service import get_llm_config, resolve_llm_provider
from ragkit.desktop.monitoring_service import (
    get_monitoring_config,
    get_query_logger,
    reset_monitoring_config,
    save_monitoring_config,
)
from ragkit.desktop.rerank_service import get_rerank_config, resolve_reranker
from ragkit.desktop.settings_store import load_settings
from ragkit.embedding.engine import EmbeddingEngine
from ragkit.monitoring.alerts import AlertEvaluator
from ragkit.monitoring.health_checker import HealthChecker
from ragkit.storage.base import create_vector_store

router = APIRouter(prefix="/api", tags=["monitoring"])


def _serialize_entry(entry) -> QueryLogEntryModel:
    return QueryLogEntryModel.model_validate(asdict(entry))


class _FailureProvider:
    """Provider shim returning a deterministic failed health check."""

    def __init__(self, error: str, *, model: str | None = None):
        self.error = error
        self.model = model

    async def test_connection(self) -> dict[str, Any]:
        return {
            "success": False,
            "error": self.error,
            "model": self.model,
        }


def _build_health_checker() -> HealthChecker:
    embedding_provider = None
    embedding_name = None
    embedding_model = None
    try:
        from ragkit.desktop.api import embedding as embedding_api
        from ragkit.security.secrets import secrets_manager

        embedding_cfg = embedding_api._get_current_config()
        embedding_name = embedding_cfg.provider.value
        embedding_model = embedding_cfg.model
        api_key = secrets_manager.retrieve(embedding_api._api_key_name(embedding_cfg.provider))
        embedding_provider = EmbeddingEngine(embedding_cfg, api_key=api_key)
    except Exception as exc:
        embedding_provider = _FailureProvider(str(exc), model=embedding_model)

    llm_provider = None
    llm_name = None
    llm_model = None
    try:
        llm_cfg = get_llm_config()
        llm_name = llm_cfg.provider.value
        llm_model = llm_cfg.model
        llm_provider = resolve_llm_provider(llm_cfg)
    except Exception as exc:
        llm_provider = _FailureProvider(str(exc), model=llm_model)

    vector_store = None
    vector_name = None
    try:
        settings = load_settings()
        vector_cfg = VectorStoreConfig.model_validate(settings.vector_store or {})
        embed_cfg = EmbeddingConfig.model_validate(settings.embedding or {})
        vector_store = create_vector_store(vector_cfg)
        vector_name = vector_cfg.provider.value
    except Exception as exc:
        vector_store = _FailureProvider(str(exc))

    reranker = None
    reranker_name = None
    reranker_model = None
    reranker_expected = False
    try:
        rerank_cfg = get_rerank_config()
        reranker_name = rerank_cfg.provider.value
        reranker_model = rerank_cfg.model
        reranker_expected = bool(rerank_cfg.enabled and rerank_cfg.provider.value != "none")
        if reranker_expected:
            reranker = resolve_reranker(rerank_cfg)
    except Exception as exc:
        if reranker_expected:
            reranker = _FailureProvider(str(exc), model=reranker_model)

    return HealthChecker(
        embedding_provider=embedding_provider,
        llm_provider=llm_provider,
        vector_store=vector_store,
        reranker=reranker,
        embedding_name=embedding_name,
        embedding_model=embedding_model,
        llm_name=llm_name,
        llm_model=llm_model,
        vector_name=vector_name,
        reranker_name=reranker_name,
        reranker_model=reranker_model,
    )


async def _resolve_ingestion_stats() -> IngestionStats:
    settings = load_settings()
    total_documents_indexed = 0
    total_chunks = 0
    total_tokens = 0

    try:
        vector_cfg = VectorStoreConfig.model_validate(settings.vector_store or {})
        embed_cfg = EmbeddingConfig.model_validate(settings.embedding or {})
        store = create_vector_store(vector_cfg)
        dims = EmbeddingEngine(embed_cfg).resolve_dimensions()
        try:
            await store.initialize(dims)
        except ValueError:
            # Keep stats at zero if collection cannot initialize yet.
            pass
        stats = await store.collection_stats()
        total_chunks = int(stats.vectors_count)
        points = await store.all_points()
        total_documents_indexed = len(
            {
                str((point.payload or {}).get("doc_id") or "").strip()
                for point in points
                if str((point.payload or {}).get("doc_id") or "").strip()
            }
        )
        total_tokens = sum(
            int((point.payload or {}).get("chunk_tokens") or 0)
            for point in points
            if int((point.payload or {}).get("chunk_tokens") or 0) > 0
        )
    except Exception:
        total_documents_indexed = 0
        total_chunks = 0
        total_tokens = 0

    source_documents_count = 0
    if settings.ingestion:
        try:
            docs, _errors = documents.analyze_documents(settings.ingestion)
            source_documents_count = len(docs)
        except Exception:
            source_documents_count = 0

    coverage_percent = 0.0
    if source_documents_count > 0:
        coverage_percent = round((total_documents_indexed / source_documents_count) * 100, 2)

    last_updated = None
    history = runtime.get_history(limit=20)
    for item in history:
        if item.status == "completed":
            last_updated = item.completed_at
            break

    return IngestionStats(
        total_documents=total_documents_indexed,
        total_chunks=total_chunks,
        total_tokens=total_tokens,
        last_updated=last_updated,
        coverage_percent=coverage_percent,
    )


@router.get("/monitoring/config", response_model=MonitoringConfig)
async def get_monitoring_configuration() -> MonitoringConfig:
    return get_monitoring_config()


@router.put("/monitoring/config", response_model=MonitoringConfig)
async def update_monitoring_configuration(payload: dict[str, Any]) -> MonitoringConfig:
    current = get_monitoring_config().model_dump(mode="json")
    merged = {**current, **payload}
    try:
        config = MonitoringConfig.model_validate(merged)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return save_monitoring_config(config)


@router.post("/monitoring/config/reset", response_model=MonitoringConfig)
async def reset_monitoring_configuration() -> MonitoringConfig:
    return reset_monitoring_config()


@router.get("/dashboard/health", response_model=list[ServiceHealth])
async def dashboard_health() -> list[ServiceHealth]:
    checker = _build_health_checker()
    return await checker.check_all()


@router.get("/dashboard/ingestion", response_model=IngestionStats)
async def dashboard_ingestion() -> IngestionStats:
    return await _resolve_ingestion_stats()


@router.get("/dashboard/metrics", response_model=QueryMetrics)
async def dashboard_metrics(hours: int = Query(default=24, ge=1, le=24 * 30)) -> QueryMetrics:
    payload = get_query_logger().get_metrics(hours=hours)
    return QueryMetrics.model_validate(payload)


@router.get("/dashboard/activity", response_model=list[ActivityDataPoint])
async def dashboard_activity(days: int = Query(default=7, ge=1, le=365)) -> list[ActivityDataPoint]:
    payload = get_query_logger().get_activity(days=days)
    return [ActivityDataPoint.model_validate(item) for item in payload]


@router.get("/dashboard/intents", response_model=IntentDistribution)
async def dashboard_intents(hours: int = Query(default=24, ge=1, le=24 * 30)) -> IntentDistribution:
    payload = get_query_logger().get_intent_distribution(hours=hours)
    return IntentDistribution(
        intents=[IntentItem.model_validate(item) for item in payload],
        period_hours=hours,
    )


@router.get("/dashboard/feedback", response_model=FeedbackStats)
async def dashboard_feedback(days: int = Query(default=7, ge=1, le=365)) -> FeedbackStats:
    payload = get_query_logger().get_feedback_stats(days=days)
    return FeedbackStats.model_validate(payload)


@router.get("/dashboard/latency", response_model=LatencyBreakdown)
async def dashboard_latency(hours: int = Query(default=24, ge=1, le=24 * 30)) -> LatencyBreakdown:
    payload = get_query_logger().get_latency_breakdown(hours=hours)
    return LatencyBreakdown.model_validate(payload)


@router.get("/dashboard/alerts")
async def dashboard_alerts():
    logger = get_query_logger()
    config = get_monitoring_config()
    metrics = logger.get_metrics(hours=24)
    feedback_stats = logger.get_feedback_stats(days=7)
    alerts = AlertEvaluator(config).evaluate(metrics=metrics, feedback_stats=feedback_stats)
    return [alert.model_dump(mode="json") for alert in alerts]


@router.get("/logs/queries", response_model=PaginatedQueryLogs)
async def logs_queries(
    intent: str | None = None,
    feedback: str | None = None,
    since_days: int | None = Query(default=None, ge=1, le=365),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    search: str | None = None,
) -> PaginatedQueryLogs:
    entries, total = get_query_logger().query_logs(
        intent=intent,
        feedback=feedback,
        since_days=since_days,
        page=page,
        page_size=page_size,
        search_text=search,
    )
    return PaginatedQueryLogs(
        entries=[_serialize_entry(item) for item in entries],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total,
    )


@router.get("/logs/queries/{query_id}", response_model=QueryLogEntryModel)
async def logs_query_detail(query_id: str) -> QueryLogEntryModel:
    entry = get_query_logger().get_by_id(query_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Query log not found.")
    return _serialize_entry(entry)


@router.get("/logs/export", response_class=PlainTextResponse)
async def logs_export(
    intent: str | None = None,
    feedback: str | None = None,
    since_days: int | None = Query(default=None, ge=1, le=365),
    search: str | None = None,
) -> PlainTextResponse:
    csv_data = get_query_logger().export_csv(
        intent=intent,
        feedback=feedback,
        since_days=since_days,
        search_text=search,
    )
    headers = {"Content-Disposition": 'attachment; filename="query_logs.csv"'}
    return PlainTextResponse(content=csv_data, headers=headers, media_type="text/csv")


@router.post("/logs/purge")
async def logs_purge() -> dict[str, int]:
    purged = get_query_logger().purge()
    return {"purged_count": purged}


@router.post("/feedback")
async def submit_feedback(payload: FeedbackSubmission) -> dict[str, bool]:
    config = get_monitoring_config()
    if not config.feedback_collection:
        raise HTTPException(status_code=400, detail="Feedback collection is disabled.")
    updated = get_query_logger().set_feedback(payload.query_id, payload.feedback)
    if not updated:
        raise HTTPException(status_code=404, detail="Query log not found.")
    try:
        from ragkit.desktop.api import chat as chat_api

        chat_api._get_conversation_memory().set_feedback(payload.query_id, payload.feedback)
    except Exception:
        pass
    return {"success": True}
