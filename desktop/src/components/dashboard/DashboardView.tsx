import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { QueryLogView } from "@/components/dashboard/QueryLogView";
import { useDashboard } from "@/hooks/useDashboard";
import { useMonitoringConfig } from "@/hooks/useMonitoringConfig";
import { useIngestionControl } from "@/hooks/useIngestionControl";
import { usePersistentIngestion } from "@/hooks/usePersistentIngestion";
import {
  Activity,
  Database,
  Server,
  Cpu,
  Zap,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  BarChart3,
  Clock,
  MessageCircle,
  Play,
  RefreshCw,
  Pause,
  Loader2,
  HardDriveDownload
} from "lucide-react";

function formatLatency(ms: number): string {
  if (!ms || ms <= 0) return "0 ms";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms.toFixed(0)} ms`;
}

function statusColor(status: string): string {
  if (status === "ok") return "var(--success)";
  if (status === "error") return "var(--error)";
  if (status === "loading") return "var(--warning)";
  return "var(--text-tertiary)";
}

function getStatusIcon(status: string) {
  if (status === "ok") return <CheckCircle2 size={16} style={{ color: "var(--success)" }} />;
  if (status === "error") return <XCircle size={16} style={{ color: "var(--error)" }} />;
  if (status === "loading") return <Activity size={16} style={{ color: "var(--warning)" }} className="animate-pulse" />;
  return <ShieldAlert size={16} style={{ color: "var(--text-tertiary)" }} />;
}

function feedbackShort(value: "positive" | "negative" | null | undefined): string {
  if (value === "positive") return "👍";
  if (value === "negative") return "👎";
  return "—";
}

function getIngestionStatusLabel(status: string, t: (key: string) => string): { label: string; color: string; icon: React.ReactNode } {
  switch (status) {
    case "running":
      return { label: t("dashboard.ingestionRunning"), color: "var(--info)", icon: <Loader2 size={16} className="animate-spin" /> };
    case "paused":
      return { label: t("dashboard.ingestionPaused"), color: "var(--warning)", icon: <Pause size={16} /> };
    case "completed":
      return { label: t("dashboard.ingestionCompleted"), color: "var(--success)", icon: <CheckCircle2 size={16} /> };
    case "error":
      return { label: t("dashboard.ingestionError"), color: "var(--error)", icon: <XCircle size={16} /> };
    default:
      return { label: t("dashboard.ingestionReady"), color: "var(--text-tertiary)", icon: <Database size={16} /> };
  }
}

/* ── Shared card style ── */
const cardStyle: React.CSSProperties = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-lg)",
  padding: 20,
};

export function DashboardView() {
  const { t } = useTranslation();
  const { config } = useMonitoringConfig();
  const { state, loading, error, refresh } = useDashboard(
    config.dashboard_refresh_interval || 30,
    config.service_check_interval || 60,
  );
  const [showLogs, setShowLogs] = useState(false);
  const ingestion = useIngestionControl();
  const { status: sharedIngestionStatus, progress: sharedProgress } = usePersistentIngestion();

  const intentMax = useMemo(() => Math.max(...state.intents.intents.map((item) => item.count), 1), [state.intents.intents]);
  const activityMax = useMemo(() => Math.max(...state.activity.map((item) => item.total), 1), [state.activity]);

  return (
    <div className="space-y-6 pb-10 animate-fade-in" style={{ maxWidth: "var(--settings-max-width)", margin: "0 auto" }}>
      {/* ALERTS */}
      {state.alerts.length ? (
        <section
          style={{
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderLeft: "3px solid var(--warning)",
            borderRadius: "var(--radius-lg)",
            padding: 16,
          }}
        >
          <div className="flex items-center gap-2 mb-2 font-semibold" style={{ color: "var(--warning)", fontSize: 14 }}>
            <ShieldAlert size={18} /> {t("dashboard.systemAlerts")}
          </div>
          <ul className="list-disc list-inside space-y-1" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {state.alerts.map((alert) => (
              <li key={`${alert.metric}-${alert.message}`}>{alert.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* TOP LEVEL: SERVICES & INGESTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Health */}
        <div className="flex flex-col" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }} className="flex items-center gap-1.5">
              <Activity size={14} style={{ color: "var(--info)" }} /> {t("monitoring.dashboard.servicesTitle")}
            </h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void refresh()}>
              <Activity size={12} />
            </Button>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2">
            {state.health.map(service => (
              <div key={service.name} className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div
                    className="rounded-full"
                    style={{
                      width: 8,
                      height: 8,
                      background: statusColor(service.status),
                      boxShadow: `0 0 8px ${statusColor(service.status)}`,
                    }}
                  />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1 }}>{service.name}</p>
                    <p style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {service.provider || t("monitoring.common.notAvailable")}
                    </p>
                  </div>
                </div>
                <div>{getStatusIcon(service.status)}</div>
              </div>
            ))}
            {!state.health.length ? (
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "16px 0", fontStyle: "italic" }}>
                {t("monitoring.common.noData")}
              </p>
            ) : null}
          </div>
        </div>

        {/* INGESTION STATUS PANEL */}
        {(() => {
          const s = sharedIngestionStatus || ingestion.status;
          const statusInfo = getIngestionStatusLabel(s?.status ?? "idle", t);
          const isRunning = s?.status === "running";
          const isPaused = s?.status === "paused";
          const progressRatio = sharedIngestionStatus ? sharedProgress : (s?.doc_total ? Math.min(100, Math.round((s.doc_index / s.doc_total) * 100)) : 0);

          return (
            <section style={cardStyle}>
              <div className="flex items-center justify-between mb-3">
                <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }} className="flex items-center gap-1.5">
                  <HardDriveDownload size={14} style={{ color: "var(--primary-500)" }} />
                  {t("dashboard.knowledgeBase")}
                </h3>
                <div className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 500, color: statusInfo.color }}>
                  {statusInfo.icon}
                  {statusInfo.label}
                </div>
              </div>

              {/* Progress bar */}
              {(isRunning || isPaused) && (
                <div className="mb-3">
                  <div className="overflow-hidden" style={{ height: 8, borderRadius: "var(--radius-full)", background: "var(--bg-tertiary)" }}>
                    <div
                      className="transition-all"
                      style={{
                        height: "100%",
                        borderRadius: "var(--radius-full)",
                        background: isPaused ? "var(--warning)" : "var(--gradient-hero)",
                        width: `${progressRatio}%`,
                        transition: "width 500ms ease-out",
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    <span>{s?.doc_index ?? 0}/{s?.doc_total ?? 0} documents · {progressRatio}%</span>
                    {s?.current_doc && (
                      <span className="truncate" style={{ maxWidth: 200 }} title={s.current_doc}>{s.current_doc}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {!isRunning && !isPaused && (
                  <>
                    <Button
                      size="sm"
                      className="text-xs gap-1.5 text-white"
                      style={{ background: "var(--primary-500)" }}
                      onClick={() => void ingestion.start(false)}
                    >
                      <Play size={14} />
                      {t("dashboard.startIngestion")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1.5"
                      onClick={() => void ingestion.start(true)}
                    >
                      <RefreshCw size={14} />
                      {t("dashboard.incremental")}
                    </Button>
                  </>
                )}
                {isRunning && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5"
                    onClick={() => void ingestion.pause()}
                  >
                    <Pause size={14} />
                    {t("dashboard.pause")}
                  </Button>
                )}
                {isPaused && (
                  <Button
                    size="sm"
                    className="text-xs gap-1.5 text-white"
                    style={{ background: "var(--primary-500)" }}
                    onClick={() => void ingestion.resume()}
                  >
                    <Play size={14} />
                    {t("dashboard.resume")}
                  </Button>
                )}
                {(isRunning || isPaused) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    style={{ color: "var(--error)" }}
                    onClick={() => {
                      if (confirm(t("dashboard.cancelIngestionConfirm"))) {
                        void ingestion.cancel();
                      }
                    }}
                  >
                    {t("dashboard.cancelIngestion")}
                  </Button>
                )}

                {/* Stats summary inline */}
                <div className="ml-auto flex items-center gap-4" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  <span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{state.ingestion.total_documents}</span> {t("dashboard.docs")}
                  </span>
                  <span>
                    <span style={{ fontWeight: 600, color: "var(--info)" }}>{state.ingestion.total_chunks}</span> {t("dashboard.chunks")}
                  </span>
                  <span style={{ color: "var(--success)", fontWeight: 500 }}>
                    {state.ingestion.coverage_percent.toFixed(1)}% {t("dashboard.coverage")}
                  </span>
                </div>
              </div>
            </section>
          );
        })()}
      </div>

      {/* MAIN STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Queries Card */}
        <div style={cardStyle} className="hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{t("monitoring.dashboard.total")}</p>
              <h4 style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: "var(--text-primary)" }}>{state.metrics.total_queries}</h4>
            </div>
            <div style={{ padding: 10, background: "var(--primary-50)", borderRadius: "var(--radius-lg)", color: "var(--primary-500)" }}>
              <MessageCircle size={18} />
            </div>
          </div>
          <div className="flex items-center justify-between" style={{ fontSize: 13 }}>
            <span style={{ color: "var(--text-secondary)" }}>
              <span style={{ fontWeight: 600, color: "var(--success)" }}>{(state.metrics.success_rate * 100).toFixed(1)}%</span> {t("dashboard.successRate")}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{t("dashboard.over24h")}</span>
          </div>
        </div>

        {/* Latency Card */}
        <div style={cardStyle} className="hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{t("monitoring.dashboard.avgLatency")}</p>
              <h4 style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: "var(--text-primary)" }}>{formatLatency(state.metrics.avg_latency_ms)}</h4>
            </div>
            <div style={{ padding: 10, background: "rgba(245, 158, 11, 0.1)", borderRadius: "var(--radius-lg)", color: "var(--warning)" }}>
              <Zap size={18} />
            </div>
          </div>
          <div className="flex items-center justify-between" style={{ fontSize: 13 }}>
            <span style={{ color: "var(--text-secondary)" }}>
              <span style={{ fontWeight: 600, color: "var(--warning)" }}>{formatLatency(state.metrics.p95_latency_ms)}</span> p95
            </span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{t("dashboard.average")}</span>
          </div>
        </div>

        {/* Feedback Card */}
        <div style={cardStyle} className="hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{t("dashboard.satisfactionRate")}</p>
              <h4 style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: "var(--text-primary)" }}>{(state.feedback.positive_rate * 100).toFixed(1)}%</h4>
            </div>
            <div style={{ padding: 10, background: "var(--primary-50)", borderRadius: "var(--radius-lg)", color: "var(--success)" }}>
              <BarChart3 size={18} />
            </div>
          </div>
          <div className="flex items-center justify-between" style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: state.feedback.trend_7d > 0 ? "var(--success)" : state.feedback.trend_7d < 0 ? "var(--error)" : "var(--text-tertiary)" }}>
              {state.feedback.trend_7d > 0 ? "+" : ""}{state.feedback.trend_7d.toFixed(1)} pts
            </span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{t("dashboard.over7d")}</span>
          </div>
        </div>
      </div>

      {/* ACTIVITY & INTENTS */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* ACTIVITY CHART */}
        <section className="col-span-1 lg:col-span-2" style={cardStyle}>
          <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: 24 }} className="flex items-center gap-1.5">
            <BarChart3 size={14} style={{ color: "var(--primary-500)" }} /> {t("monitoring.dashboard.activity7dTitle")}
          </h3>
          <div className="grid grid-cols-7 gap-3 items-end" style={{ height: 160, marginTop: 16 }}>
            {state.activity.map((point) => (
              <div key={point.date} className="flex flex-col items-center gap-2 group w-full">
                <div className="relative w-full flex justify-center">
                  <div
                    className="w-full transition-all"
                    style={{
                      maxWidth: 40,
                      borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                      background: "var(--gradient-hero)",
                      height: `${Math.max(4, Math.round((point.total / activityMax) * 100))}%`,
                    }}
                  />
                  <div
                    className="absolute opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap"
                    style={{
                      top: -32,
                      background: "var(--text-primary)",
                      color: "var(--bg-primary)",
                      fontSize: 11,
                      padding: "4px 8px",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    {point.total} {t("dashboard.reqs")}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-tertiary)" }}>{point.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* INTENT DISTRIBUTION */}
        <section className="col-span-1" style={cardStyle}>
          <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: 24 }} className="flex items-center gap-1.5">
            <Cpu size={14} style={{ color: "var(--primary-500)" }} /> {t("monitoring.dashboard.intentDistributionTitle")}
          </h3>
          <div className="space-y-4">
            {state.intents.intents.map((item) => (
              <div key={item.intent} className="space-y-1.5">
                <div className="flex items-center justify-between" style={{ fontSize: 12, fontWeight: 500 }}>
                  <span style={{ color: "var(--text-primary)", textTransform: "capitalize" }}>{item.intent}</span>
                  <span style={{ color: "var(--text-tertiary)" }}>{(item.percentage * 100).toFixed(1)}%</span>
                </div>
                <div className="overflow-hidden" style={{ height: 6, borderRadius: "var(--radius-full)", background: "var(--bg-tertiary)" }}>
                  <div
                    className="transition-all"
                    style={{
                      height: "100%",
                      borderRadius: "var(--radius-full)",
                      background: "var(--gradient-hero)",
                      width: `${Math.max(2, Math.round((item.count / intentMax) * 100))}%`,
                      transition: "width 1000ms ease-out",
                    }}
                  />
                </div>
              </div>
            ))}
            {!state.intents.intents.length ? (
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "16px 0", fontStyle: "italic" }}>
                {t("monitoring.common.noData")}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {/* RECENT QUERIES & LATENCY */}
      <div className="grid lg:grid-cols-3 gap-6">
        <section className="col-span-1 lg:col-span-2 overflow-hidden flex flex-col" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }} className="flex items-center gap-2">
              <Clock size={14} style={{ color: "var(--success)" }} /> {t("monitoring.dashboard.recentQueriesTitle")}
            </h3>
            <Button size="sm" variant="ghost" className="h-8 text-xs font-medium" style={{ color: "var(--primary-500)" }} onClick={() => setShowLogs((value) => !value)}>
              {showLogs ? t("monitoring.dashboard.hideLogs") : t("monitoring.dashboard.showLogs")}
            </Button>
          </div>
          <div className="space-y-0 overflow-y-auto pr-2 flex-1" style={{ fontSize: 13 }}>
            {state.recentQueries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 transition-colors"
                style={{
                  padding: "12px 8px",
                  borderBottom: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span className="truncate flex-1" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{entry.query}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    style={{
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "4px 8px",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-tertiary)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    {entry.intent}
                  </span>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--warning)", width: 64, textAlign: "right" }}>
                    {formatLatency(entry.total_latency_ms)}
                  </span>
                  <span style={{ width: 24, textAlign: "center", fontSize: 14 }}>
                    {feedbackShort(entry.feedback)}
                  </span>
                </div>
              </div>
            ))}
            {!state.recentQueries.length ? (
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "24px 0", fontStyle: "italic" }}>
                {t("monitoring.dashboard.noRecentQueries")}
              </p>
            ) : null}
          </div>
        </section>

        <section className="col-span-1" style={cardStyle}>
          <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: 24 }} className="flex items-center gap-2">
            <Server size={14} style={{ color: "var(--warning)" }} /> {t("monitoring.dashboard.latencyBreakdownTitle")}
          </h3>
          <div className="space-y-4">
            {[
              [t("monitoring.dashboard.latencyAnalyzer"), state.latency.analyzer_ms, "var(--info)"],
              [t("monitoring.dashboard.latencyRetrieval"), state.latency.retrieval_ms, "var(--primary-500)"],
              [t("monitoring.dashboard.latencyReranking"), state.latency.reranking_ms, "var(--primary-700)"],
              [t("monitoring.dashboard.latencyLlm"), state.latency.llm_ms, "var(--success)"],
            ].map(([label, value, dotColor]) => (
              <div key={label as string} className="flex items-center justify-between">
                <div className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  <div className="rounded-full" style={{ width: 6, height: 6, background: dotColor as string }} />
                  {label}
                </div>
                <b style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{formatLatency(Number(value || 0))}</b>
              </div>
            ))}
            <div className="flex items-center justify-between" style={{ paddingTop: 16, marginTop: 8, borderTop: "1px solid var(--border-default)" }}>
              <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>Total</span>
              <b style={{ fontSize: 18, fontFamily: "var(--font-mono)", color: "var(--warning)" }}>{formatLatency(Number(state.latency.total_ms || 0))}</b>
            </div>
          </div>
        </section>
      </div>

      {showLogs ? <QueryLogView onClose={() => setShowLogs(false)} /> : null}

      {(loading || error) && (
        <div
          className="fixed bottom-4 right-4 flex items-center gap-3 animate-slide-up"
          style={{
            background: "var(--bg-primary)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--border-default)",
            padding: 12,
          }}
        >
          {loading && <Activity size={16} style={{ color: "var(--info)" }} className="animate-pulse" />}
          {error && <XCircle size={16} style={{ color: "var(--error)" }} />}
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {loading ? t("monitoring.dashboard.loading") : error}
          </span>
        </div>
      )}
    </div>
  );
}
