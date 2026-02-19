import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { QueryLogView } from "@/components/dashboard/QueryLogView";
import { useDashboard } from "@/hooks/useDashboard";
import { useMonitoringConfig } from "@/hooks/useMonitoringConfig";

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatLatency(ms: number): string {
  if (!ms || ms <= 0) return "0 ms";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms} ms`;
}

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatTimestamp(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function statusBadge(status: string): string {
  if (status === "ok") return "bg-green-100 text-green-700";
  if (status === "error") return "bg-red-100 text-red-700";
  if (status === "loading") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-700";
}

function feedbackShort(value: "positive" | "negative" | null | undefined, t: (key: string) => string): string {
  if (value === "positive") return t("monitoring.queryLog.feedbackPositiveShort");
  if (value === "negative") return t("monitoring.queryLog.feedbackNegativeShort");
  return t("monitoring.queryLog.feedbackNoneShort");
}

export function DashboardView() {
  const { t } = useTranslation();
  const { config } = useMonitoringConfig();
  const { state, loading, error, refresh } = useDashboard(
    config.dashboard_refresh_interval || 30,
    config.service_check_interval || 60,
  );
  const [showLogs, setShowLogs] = useState(false);

  const intentMax = useMemo(() => Math.max(...state.intents.intents.map((item) => item.count), 1), [state.intents.intents]);
  const activityMax = useMemo(() => Math.max(...state.activity.map((item) => item.total), 1), [state.activity]);

  return (
    <div className="space-y-4">
      {state.alerts.length ? (
        <section className="rounded border border-amber-300 bg-amber-50 text-amber-900 p-3 space-y-1 text-sm">
          {state.alerts.map((alert) => (
            <p key={`${alert.metric}-${alert.message}`}>! {alert.message}</p>
          ))}
        </section>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-2">
          <h3 className="font-semibold">{t("monitoring.dashboard.servicesTitle")}</h3>
          {state.health.map((service) => (
            <div key={service.name} className="flex items-center justify-between gap-2 text-sm">
              <div>
                <span className="font-medium">{service.name}</span>
                <span className="text-gray-500"> - {service.provider || t("monitoring.common.notAvailable")} {service.model || service.detail || ""}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs ${statusBadge(service.status)}`}>
                {t(`monitoring.status.${service.status}`)}
              </span>
            </div>
          ))}
          {!state.health.length ? <p className="text-sm text-gray-500">{t("monitoring.common.noData")}</p> : null}
        </section>

        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-2">
          <h3 className="font-semibold">{t("monitoring.dashboard.ingestionTitle")}</h3>
          <p className="text-sm">{t("monitoring.dashboard.documents")}: <b>{state.ingestion.total_documents}</b></p>
          <p className="text-sm">{t("monitoring.dashboard.chunks")}: <b>{state.ingestion.total_chunks}</b></p>
          <p className="text-sm">{t("monitoring.dashboard.tokens")}: <b>{state.ingestion.total_tokens}</b></p>
          <p className="text-sm">{t("monitoring.dashboard.coverage")}: <b>{state.ingestion.coverage_percent.toFixed(1)}%</b></p>
          <p className="text-xs text-gray-500">{t("monitoring.dashboard.lastUpdated")}: {formatTimestamp(state.ingestion.last_updated, t("monitoring.common.notAvailable"))}</p>
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-2">
          <h3 className="font-semibold">{t("monitoring.dashboard.queries24hTitle")}</h3>
          <p className="text-sm">{t("monitoring.dashboard.total")}: <b>{state.metrics.total_queries}</b></p>
          <p className="text-sm">{t("monitoring.dashboard.success")}: <b>{formatPercent(state.metrics.success_rate)}</b></p>
          <p className="text-sm">{t("monitoring.dashboard.avgLatency")}: <b>{formatLatency(state.metrics.avg_latency_ms)}</b></p>
          <p className="text-sm">{t("monitoring.dashboard.p95Latency")}: <b>{formatLatency(state.metrics.p95_latency_ms)}</b></p>
          <p className="text-sm">{t("monitoring.dashboard.estimatedCost")}: <b>{formatCost(state.metrics.total_cost_usd)}</b></p>
        </section>

        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-2">
          <h3 className="font-semibold">{t("monitoring.dashboard.feedbackTitle")}</h3>
          <p className="text-sm">
            {t("monitoring.dashboard.feedbackPositive")} {state.feedback.positive} - {t("monitoring.dashboard.feedbackNegative")} {state.feedback.negative} - {t("monitoring.dashboard.withoutFeedback")} {state.feedback.without_feedback}
          </p>
          <p className="text-sm">{t("monitoring.dashboard.positiveRate")}: <b>{formatPercent(state.feedback.positive_rate)}</b></p>
          <p className="text-sm">{t("monitoring.dashboard.trend7d")}: <b>{state.feedback.trend_7d > 0 ? "+" : ""}{state.feedback.trend_7d.toFixed(1)} {t("monitoring.dashboard.points")}</b></p>
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-2">
        <h3 className="font-semibold">{t("monitoring.dashboard.activity7dTitle")}</h3>
        <div className="grid grid-cols-7 gap-2 items-end h-32">
          {state.activity.map((point) => (
            <div key={point.date} className="flex flex-col items-center gap-1">
              <div
                className="w-full rounded bg-blue-500/70"
                style={{ height: `${Math.max(4, Math.round((point.total / activityMax) * 100))}%` }}
                title={`${point.date}: ${point.total}`}
              />
              <span className="text-[10px] text-gray-500">{point.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-2">
          <h3 className="font-semibold">{t("monitoring.dashboard.intentDistributionTitle")}</h3>
          {state.intents.intents.map((item) => (
            <div key={item.intent} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>{item.intent}</span>
                <span>{(item.percentage * 100).toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded bg-gray-200">
                <div className="h-full rounded bg-indigo-500" style={{ width: `${Math.max(3, Math.round((item.count / intentMax) * 100))}%` }} />
              </div>
            </div>
          ))}
          {!state.intents.intents.length ? <p className="text-sm text-gray-500">{t("monitoring.common.noData")}</p> : null}
        </section>

        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-2">
          <h3 className="font-semibold">{t("monitoring.dashboard.latencyBreakdownTitle")}</h3>
          {[
            [t("monitoring.dashboard.latencyAnalyzer"), state.latency.analyzer_ms],
            [t("monitoring.dashboard.latencyRewriting"), state.latency.rewriting_ms],
            [t("monitoring.dashboard.latencyRetrieval"), state.latency.retrieval_ms],
            [t("monitoring.dashboard.latencyReranking"), state.latency.reranking_ms],
            [t("monitoring.dashboard.latencyLlm"), state.latency.llm_ms],
            [t("monitoring.dashboard.latencyTotal"), state.latency.total_ms],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span>{label}</span>
              <b>{formatLatency(Number(value || 0))}</b>
            </div>
          ))}
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{t("monitoring.dashboard.recentQueriesTitle")}</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void refresh()}>{t("monitoring.common.refresh")}</Button>
            <Button size="sm" onClick={() => setShowLogs((value) => !value)}>
              {showLogs ? t("monitoring.dashboard.hideLogs") : t("monitoring.dashboard.showLogs")}
            </Button>
          </div>
        </div>
        <div className="space-y-1 text-sm">
          {state.recentQueries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1">
              <span className="truncate">{entry.query}</span>
              <span className="text-xs text-gray-500">
                {entry.intent} - {formatLatency(entry.total_latency_ms)} {feedbackShort(entry.feedback, t)}
              </span>
            </div>
          ))}
          {!state.recentQueries.length ? <p className="text-sm text-gray-500">{t("monitoring.dashboard.noRecentQueries")}</p> : null}
        </div>
      </section>

      {showLogs ? <QueryLogView onClose={() => setShowLogs(false)} /> : null}

      {loading ? <p className="text-sm text-gray-500">{t("monitoring.dashboard.loading")}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
