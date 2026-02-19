"""SQLite query logger used for monitoring and dashboard aggregation."""

from __future__ import annotations

import csv
import io
import json
import sqlite3
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

try:
    import numpy as _np
except Exception:  # pragma: no cover - defensive at runtime
    _np = None

from ragkit.config.monitoring_schema import MonitoringConfig, QueryLogEntryModel
from ragkit.desktop.settings_store import get_data_root

_RAG_INTENTS = {"question", "clarification"}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_utc(value: str | None) -> datetime | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _safe_average(values: list[int]) -> int:
    if not values:
        return 0
    return int(round(sum(values) / len(values)))


def _safe_p95(values: list[int]) -> int:
    if not values:
        return 0
    if _np is not None:
        return int(round(float(_np.percentile(values, 95))))
    ordered = sorted(values)
    index = int(round((len(ordered) - 1) * 0.95))
    return int(ordered[max(0, min(index, len(ordered) - 1))])


@dataclass
class QueryLogEntry:
    """A single logged query with full pipeline metadata."""

    id: str
    timestamp: str
    query: str
    intent: str
    intent_confidence: float
    needs_rag: bool
    rewritten_query: str | None = None

    search_type: str | None = None
    chunks_retrieved: int = 0
    sources: list[dict[str, Any]] = field(default_factory=list)
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

    feedback: str | None = None

    def to_payload(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "QueryLogEntry":
        validated = QueryLogEntryModel.model_validate(payload)
        return cls(**validated.model_dump(mode="python"))


class QueryLogger:
    """Record, query and aggregate logs from a local SQLite file."""

    def __init__(self, config: MonitoringConfig, db_path: Path | None = None):
        self.config = config
        self.db_path = db_path or (get_data_root() / "logs" / "queries.db")
        self._ensure_db()

    def set_config(self, config: MonitoringConfig) -> None:
        self.config = config

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(str(self.db_path))

    def _ensure_db(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS query_logs (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    data TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_query_logs_timestamp
                ON query_logs(timestamp)
                """
            )
            conn.commit()

    def _rotate_if_needed(self) -> None:
        max_size_bytes = int(max(self.config.max_log_size_mb, 1) * 1024 * 1024)
        if not self.db_path.exists() or self.db_path.stat().st_size <= max_size_bytes:
            return

        with self._connect() as conn:
            for _ in range(5):
                current_size = self.db_path.stat().st_size if self.db_path.exists() else 0
                if current_size <= max_size_bytes:
                    break
                row = conn.execute("SELECT COUNT(*) FROM query_logs").fetchone()
                total = int(row[0] if row else 0)
                if total <= 1:
                    break
                delete_count = max(1, total // 3)
                conn.execute(
                    """
                    DELETE FROM query_logs
                    WHERE id IN (
                        SELECT id FROM query_logs
                        ORDER BY timestamp ASC
                        LIMIT ?
                    )
                    """,
                    (delete_count,),
                )
                conn.commit()
                conn.execute("VACUUM")
                conn.commit()

    def log(self, entry: QueryLogEntry) -> None:
        if not self.config.log_queries:
            return

        payload = entry.to_payload()
        if not self.config.log_retrieval_results:
            payload["chunks_retrieved"] = 0
            payload["sources"] = []
        if not self.config.log_llm_outputs:
            payload["answer"] = None

        validated = QueryLogEntryModel.model_validate(payload)
        serialized = json.dumps(validated.model_dump(mode="json"), ensure_ascii=False)

        self._rotate_if_needed()
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO query_logs (id, timestamp, data) VALUES (?, ?, ?)",
                (validated.id, validated.timestamp, serialized),
            )
            conn.commit()

    def set_feedback(self, query_id: str, feedback: str) -> bool:
        normalized = str(feedback).strip().lower()
        if normalized not in {"positive", "negative"}:
            raise ValueError("feedback must be 'positive' or 'negative'.")

        with self._connect() as conn:
            row = conn.execute("SELECT data FROM query_logs WHERE id = ?", (query_id,)).fetchone()
            if not row:
                return False
            payload = json.loads(str(row[0]))
            payload["feedback"] = normalized
            validated = QueryLogEntryModel.model_validate(payload)
            conn.execute(
                "UPDATE query_logs SET data = ? WHERE id = ?",
                (json.dumps(validated.model_dump(mode="json"), ensure_ascii=False), query_id),
            )
            conn.commit()
        return True

    def get_by_id(self, query_id: str) -> QueryLogEntry | None:
        with self._connect() as conn:
            row = conn.execute("SELECT data FROM query_logs WHERE id = ?", (query_id,)).fetchone()
            if not row:
                return None
        payload = json.loads(str(row[0]))
        return QueryLogEntry.from_payload(payload)

    def _entries_since(self, since: datetime | None = None) -> list[QueryLogEntry]:
        query = "SELECT data FROM query_logs"
        params: tuple[Any, ...] = ()
        if since is not None:
            query += " WHERE timestamp >= ?"
            params = (since.isoformat(),)
        query += " ORDER BY timestamp DESC"

        entries: list[QueryLogEntry] = []
        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
        for row in rows:
            try:
                payload = json.loads(str(row[0]))
                entries.append(QueryLogEntry.from_payload(payload))
            except Exception:
                continue
        return entries

    def query_logs(
        self,
        *,
        intent: str | None = None,
        feedback: str | None = None,
        search_text: str | None = None,
        since_days: int | None = 7,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[QueryLogEntry], int]:
        since = None
        if since_days is not None and int(since_days) > 0:
            since = _utc_now() - timedelta(days=int(since_days))

        rows = self._entries_since(since=since)
        normalized_search = (search_text or "").strip().lower()
        normalized_intent = (intent or "").strip().lower()
        normalized_feedback = (feedback or "").strip().lower()

        filtered: list[QueryLogEntry] = []
        for item in rows:
            if normalized_intent and item.intent.lower() != normalized_intent:
                continue
            if normalized_feedback:
                if normalized_feedback == "none":
                    if item.feedback is not None:
                        continue
                elif item.feedback != normalized_feedback:
                    continue
            if normalized_search:
                query_text = item.query.lower()
                answer_text = (item.answer or "").lower()
                if normalized_search not in query_text and normalized_search not in answer_text:
                    continue
            filtered.append(item)

        safe_page = max(1, int(page))
        safe_page_size = max(1, int(page_size))
        start = (safe_page - 1) * safe_page_size
        end = start + safe_page_size
        return filtered[start:end], len(filtered)

    def recent_queries(self, limit: int = 5) -> list[QueryLogEntry]:
        entries = self._entries_since(since=None)
        return entries[: max(1, int(limit))]

    def count_entries(self) -> int:
        with self._connect() as conn:
            row = conn.execute("SELECT COUNT(*) FROM query_logs").fetchone()
        return int(row[0] if row else 0)

    def get_metrics(self, *, hours: int = 24) -> dict[str, Any]:
        since = _utc_now() - timedelta(hours=max(1, int(hours)))
        entries = self._entries_since(since=since)
        total = len(entries)
        success_count = sum(1 for item in entries if item.success)
        latencies = [int(item.total_latency_ms) for item in entries if int(item.total_latency_ms) > 0]
        total_cost = round(sum(float(item.estimated_cost_usd or 0.0) for item in entries), 6)

        positive = sum(1 for item in entries if item.feedback == "positive")
        negative = sum(1 for item in entries if item.feedback == "negative")
        with_feedback = positive + negative
        negative_feedback_rate = (negative / with_feedback) if with_feedback else 0.0

        return {
            "total_queries": total,
            "success_rate": (success_count / total) if total else 1.0,
            "avg_latency_ms": _safe_average(latencies),
            "p95_latency_ms": _safe_p95(latencies),
            "total_cost_usd": total_cost,
            "period_hours": int(hours),
            "negative_feedback_rate": negative_feedback_rate,
        }

    def get_activity(self, *, days: int = 7) -> list[dict[str, Any]]:
        total_days = max(1, int(days))
        since = _utc_now() - timedelta(days=total_days)
        entries = self._entries_since(since=since)

        buckets: dict[str, dict[str, int]] = {}
        for delta in range(total_days):
            date = (_utc_now() - timedelta(days=(total_days - delta - 1))).date().isoformat()
            buckets[date] = {"total": 0, "rag": 0, "non_rag": 0}

        for item in entries:
            parsed = _to_utc(item.timestamp)
            if parsed is None:
                continue
            date_key = parsed.date().isoformat()
            if date_key not in buckets:
                continue
            buckets[date_key]["total"] += 1
            is_rag = item.intent in _RAG_INTENTS or bool(item.needs_rag)
            if is_rag:
                buckets[date_key]["rag"] += 1
            else:
                buckets[date_key]["non_rag"] += 1

        return [
            {
                "date": date_key,
                "total": values["total"],
                "rag": values["rag"],
                "non_rag": values["non_rag"],
            }
            for date_key, values in buckets.items()
        ]

    def get_intent_distribution(self, *, hours: int = 24) -> list[dict[str, Any]]:
        since = _utc_now() - timedelta(hours=max(1, int(hours)))
        entries = self._entries_since(since=since)
        total = len(entries)
        counts: dict[str, int] = {}
        for item in entries:
            key = item.intent or "unknown"
            counts[key] = counts.get(key, 0) + 1
        ordered = sorted(counts.items(), key=lambda pair: pair[1], reverse=True)
        return [
            {
                "intent": intent,
                "count": count,
                "percentage": round((count / total), 4) if total else 0.0,
            }
            for intent, count in ordered
        ]

    def get_feedback_stats(self, *, days: int = 7) -> dict[str, Any]:
        total_days = max(1, int(days))
        now = _utc_now()
        current_since = now - timedelta(days=total_days)
        previous_since = now - timedelta(days=total_days * 2)

        current_entries = self._entries_since(since=current_since)
        previous_entries = [
            item
            for item in self._entries_since(since=previous_since)
            if (_to_utc(item.timestamp) or now) < current_since
        ]

        positive = sum(1 for item in current_entries if item.feedback == "positive")
        negative = sum(1 for item in current_entries if item.feedback == "negative")
        without_feedback = sum(1 for item in current_entries if item.feedback is None)
        with_feedback = positive + negative
        positive_rate = (positive / with_feedback) if with_feedback else 0.0

        prev_positive = sum(1 for item in previous_entries if item.feedback == "positive")
        prev_negative = sum(1 for item in previous_entries if item.feedback == "negative")
        prev_with_feedback = prev_positive + prev_negative
        prev_positive_rate = (prev_positive / prev_with_feedback) if prev_with_feedback else 0.0

        trend = round((positive_rate - prev_positive_rate) * 100, 2)
        return {
            "positive": positive,
            "negative": negative,
            "without_feedback": without_feedback,
            "positive_rate": round(positive_rate, 4),
            "trend_7d": trend,
        }

    def get_latency_breakdown(self, *, hours: int = 24) -> dict[str, Any]:
        since = _utc_now() - timedelta(hours=max(1, int(hours)))
        entries = self._entries_since(since=since)

        analyzer_values = [int(item.analyzer_latency_ms) for item in entries if int(item.analyzer_latency_ms) > 0]
        rewriting_values = [int(item.rewriting_latency_ms) for item in entries if int(item.rewriting_latency_ms) > 0]
        retrieval_values = [int(item.retrieval_latency_ms) for item in entries if int(item.retrieval_latency_ms) > 0]
        reranking_values = [int(item.reranking_latency_ms) for item in entries if int(item.reranking_latency_ms) > 0]
        llm_values = [int(item.generation_latency_ms) for item in entries if int(item.generation_latency_ms) > 0]
        total_values = [int(item.total_latency_ms) for item in entries if int(item.total_latency_ms) > 0]

        return {
            "analyzer_ms": _safe_average(analyzer_values),
            "rewriting_ms": _safe_average(rewriting_values),
            "retrieval_ms": _safe_average(retrieval_values),
            "reranking_ms": _safe_average(reranking_values),
            "llm_ms": _safe_average(llm_values),
            "total_ms": _safe_average(total_values),
        }

    def purge(self) -> int:
        cutoff = (_utc_now() - timedelta(days=max(1, int(self.config.retention_days)))).isoformat()
        with self._connect() as conn:
            cursor = conn.execute("DELETE FROM query_logs WHERE timestamp < ?", (cutoff,))
            deleted = int(cursor.rowcount or 0)
            conn.commit()
            if deleted:
                conn.execute("VACUUM")
                conn.commit()
        return deleted

    def export_csv(
        self,
        *,
        intent: str | None = None,
        feedback: str | None = None,
        since_days: int | None = None,
        search_text: str | None = None,
    ) -> str:
        entries, _ = self.query_logs(
            intent=intent,
            feedback=feedback,
            search_text=search_text,
            since_days=since_days,
            page=1,
            page_size=200000,
        )
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "id",
                "timestamp",
                "query",
                "intent",
                "intent_confidence",
                "needs_rag",
                "rewritten_query",
                "search_type",
                "chunks_retrieved",
                "retrieval_latency_ms",
                "reranking_applied",
                "reranking_latency_ms",
                "model",
                "prompt_tokens",
                "completion_tokens",
                "generation_latency_ms",
                "estimated_cost_usd",
                "analyzer_latency_ms",
                "rewriting_latency_ms",
                "total_latency_ms",
                "success",
                "error",
                "feedback",
                "sources",
                "answer",
            ]
        )
        for item in entries:
            writer.writerow(
                [
                    item.id,
                    item.timestamp,
                    item.query,
                    item.intent,
                    item.intent_confidence,
                    item.needs_rag,
                    item.rewritten_query or "",
                    item.search_type or "",
                    item.chunks_retrieved,
                    item.retrieval_latency_ms,
                    item.reranking_applied,
                    item.reranking_latency_ms,
                    item.model or "",
                    item.prompt_tokens,
                    item.completion_tokens,
                    item.generation_latency_ms,
                    item.estimated_cost_usd,
                    item.analyzer_latency_ms,
                    item.rewriting_latency_ms,
                    item.total_latency_ms,
                    item.success,
                    item.error or "",
                    item.feedback or "",
                    json.dumps(item.sources, ensure_ascii=False),
                    item.answer or "",
                ]
            )
        return output.getvalue()
