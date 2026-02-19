"""Pydantic schemas for monitoring, logging and dashboard APIs."""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class MonitoringConfig(BaseModel):
    """Monitoring and logging configuration."""

    # Logging.
    log_queries: bool = True
    log_retrieval_results: bool = True
    log_llm_outputs: bool = True
    feedback_collection: bool = True

    # Retention.
    retention_days: int = Field(default=30, ge=1, le=365)
    max_log_size_mb: int = Field(default=100, ge=10, le=1000)

    # Alerts.
    alert_latency_p95_ms: int = Field(default=5000, ge=1000, le=30000)
    alert_success_rate: float = Field(default=0.9, ge=0.5, le=1.0)
    alert_negative_feedback: float = Field(default=0.4, ge=0.1, le=1.0)
    alert_daily_cost: float = Field(default=1.0, ge=0.1, le=100.0)

    # Refresh intervals.
    service_check_interval: int = Field(default=60, ge=15, le=600)
    dashboard_refresh_interval: int = Field(default=30, ge=10, le=300)


class QueryLogEntryModel(BaseModel):
    """A single logged query entry."""

    id: str
    timestamp: str
    query: str
    intent: str
    intent_confidence: float = 0.0
    needs_rag: bool = True
    rewritten_query: str | None = None

    search_type: str | None = None
    chunks_retrieved: int = 0
    sources: list[dict[str, Any]] = Field(default_factory=list)
    retrieval_latency_ms: int = 0

    reranking_applied: bool = False
    reranking_latency_ms: int = 0

    answer: str | None = None
    model: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    generation_latency_ms: int = 0
    estimated_cost_usd: float = 0.0

    analyzer_latency_ms: int = 0
    rewriting_latency_ms: int = 0

    total_latency_ms: int = 0
    success: bool = True
    error: str | None = None

    feedback: Literal["positive", "negative"] | None = None


class QueryMetrics(BaseModel):
    total_queries: int
    success_rate: float
    avg_latency_ms: int
    p95_latency_ms: int
    total_cost_usd: float
    period_hours: int


class ActivityDataPoint(BaseModel):
    date: str
    total: int
    rag: int
    non_rag: int


class IntentItem(BaseModel):
    intent: str
    count: int
    percentage: float


class IntentDistribution(BaseModel):
    intents: list[IntentItem] = Field(default_factory=list)
    period_hours: int


class FeedbackStats(BaseModel):
    positive: int
    negative: int
    without_feedback: int
    positive_rate: float
    trend_7d: float


class LatencyBreakdown(BaseModel):
    analyzer_ms: int
    rewriting_ms: int
    retrieval_ms: int
    reranking_ms: int
    llm_ms: int
    total_ms: int


class IngestionStats(BaseModel):
    total_documents: int
    total_chunks: int
    total_tokens: int
    last_updated: str | None
    coverage_percent: float


class PaginatedQueryLogs(BaseModel):
    entries: list[QueryLogEntryModel] = Field(default_factory=list)
    total: int
    page: int
    page_size: int
    has_more: bool


class FeedbackSubmission(BaseModel):
    query_id: str
    feedback: Literal["positive", "negative"]


class ServiceStatus(str, Enum):
    OK = "ok"
    LOADING = "loading"
    ERROR = "error"
    DISABLED = "disabled"


class ServiceHealth(BaseModel):
    name: str
    status: ServiceStatus
    provider: str | None = None
    model: str | None = None
    detail: str | None = None
    last_check: str | None = None
    error: str | None = None


class AlertModel(BaseModel):
    metric: str
    message: str
    current_value: float
    threshold: float
    severity: str
