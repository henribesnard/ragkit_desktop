import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { QueryLogView } from "@/components/dashboard/QueryLogView";
import { useDashboard } from "@/hooks/useDashboard";
import { useMonitoringConfig } from "@/hooks/useMonitoringConfig";
import {
  MessageSquare,
  FileText,
  Settings2,
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
  MessageCircle
} from "lucide-react";

function formatLatency(ms: number): string {
  if (!ms || ms <= 0) return "0 ms";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms.toFixed(0)} ms`;
}

function statusColor(status: string): string {
  if (status === "ok") return "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]";
  if (status === "error") return "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]";
  if (status === "loading") return "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]";
  return "bg-gray-400";
}

function getStatusIcon(status: string) {
  if (status === "ok") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === "error") return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === "loading") return <Activity className="w-4 h-4 text-amber-500 animate-pulse" />;
  return <ShieldAlert className="w-4 h-4 text-gray-500" />;
}

function feedbackShort(value: "positive" | "negative" | null | undefined): string {
  if (value === "positive") return "👍";
  if (value === "negative") return "👎";
  return "—";
}

export function DashboardView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { config } = useMonitoringConfig();
  const { state, loading, error, refresh } = useDashboard(
    config.dashboard_refresh_interval || 30,
    config.service_check_interval || 60,
  );
  const [showLogs, setShowLogs] = useState(false);

  const intentMax = useMemo(() => Math.max(...state.intents.intents.map((item) => item.count), 1), [state.intents.intents]);
  const activityMax = useMemo(() => Math.max(...state.activity.map((item) => item.total), 1), [state.activity]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 fade-in">
      {/* ALERTS */}
      {state.alerts.length ? (
        <section className="rounded-xl border border-amber-300/50 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2 font-semibold">
            <ShieldAlert className="w-5 h-5" /> Alertes système
          </div>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {state.alerts.map((alert) => (
              <li key={`${alert.metric}-${alert.message}`}>{alert.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* TOP LEVEL: HEALTH RINGS & QUICK ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => navigate("/chat")}
            className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-1 transition-all duration-300"
          >
            <MessageSquare className="w-8 h-8 mb-3 opacity-90" />
            <span className="font-semibold tracking-wide">Démarrer le Chat</span>
          </button>

          <button
            onClick={() => navigate("/settings?tab=ingestion")}
            className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-lg shadow-teal-500/20 hover:shadow-xl hover:shadow-teal-500/30 hover:-translate-y-1 transition-all duration-300"
          >
            <FileText className="w-8 h-8 mb-3 opacity-90" />
            <span className="font-semibold tracking-wide">Ajouter des Docs</span>
          </button>

          <button
            onClick={() => navigate("/settings?tab=agents")}
            className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/50 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 text-gray-700 dark:text-gray-200 backdrop-blur-sm"
          >
            <Settings2 className="w-8 h-8 mb-3 text-indigo-500 group-hover:rotate-45 transition-transform duration-500" />
            <span className="font-semibold tracking-wide">Configurer les Agents</span>
          </button>
        </div>

        {/* System Health */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200 dark:border-gray-700/50 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" /> {t("monitoring.dashboard.servicesTitle")}
            </h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void refresh()}>
              <Activity className="w-3 h-3" />
            </Button>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {state.health.map(service => (
              <div key={service.name} className="flex justify-between items-center group">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${statusColor(service.status)}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-none">{service.name}</p>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{service.provider || t("monitoring.common.notAvailable")}</p>
                  </div>
                </div>
                <div className="text-right">
                  {getStatusIcon(service.status)}
                </div>
              </div>
            ))}
            {!state.health.length ? <p className="text-sm text-gray-500 italic text-center py-4">{t("monitoring.common.noData")}</p> : null}
          </div>
        </div>
      </div>

      {/* MAIN STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ingestion Card */}
        <div className="bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-800/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t("monitoring.dashboard.documents")}</p>
              <h4 className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{state.ingestion.total_documents}</h4>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400"><span className="font-semibold text-blue-600 dark:text-blue-400">{state.ingestion.total_chunks}</span> chunks</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{state.ingestion.coverage_percent.toFixed(1)}% couv.</span>
          </div>
        </div>

        {/* Queries Card */}
        <div className="bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-800/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t("monitoring.dashboard.total")}</p>
              <h4 className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{state.metrics.total_queries}</h4>
            </div>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
              <MessageCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400"><span className="font-semibold text-emerald-600 dark:text-emerald-400">{(state.metrics.success_rate * 100).toFixed(1)}%</span> succès</span>
            <span className="text-gray-500 text-xs">Sur 24h</span>
          </div>
        </div>

        {/* Latency Card */}
        <div className="bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-800/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t("monitoring.dashboard.avgLatency")}</p>
              <h4 className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{formatLatency(state.metrics.avg_latency_ms)}</h4>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400"><span className="font-semibold text-amber-600 dark:text-amber-400 mt-1">{formatLatency(state.metrics.p95_latency_ms)}</span> p95</span>
            <span className="text-gray-500 text-xs">Moyenne</span>
          </div>
        </div>

        {/* Feedback Card */}
        <div className="bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-800/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Taux de Satisfaction</p>
              <h4 className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{(state.feedback.positive_rate * 100).toFixed(1)}%</h4>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={`font-semibold ${state.feedback.trend_7d > 0 ? "text-emerald-500" : state.feedback.trend_7d < 0 ? "text-red-500" : "text-gray-500"}`}>
              {state.feedback.trend_7d > 0 ? "+" : ""}{state.feedback.trend_7d.toFixed(1)} pts
            </span>
            <span className="text-gray-500 text-xs">Sur 7j</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ACTIVITY CHART */}
        <section className="col-span-1 lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-800/80 p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" /> {t("monitoring.dashboard.activity7dTitle")}
          </h3>
          <div className="grid grid-cols-7 gap-3 items-end h-40 mt-4">
            {state.activity.map((point) => (
              <div key={point.date} className="flex flex-col items-center gap-2 group w-full">
                <div className="relative w-full flex justify-center">
                  <div
                    className="w-full max-w-[40px] rounded-t-lg bg-gradient-to-t from-blue-600/80 to-indigo-400 transition-all duration-500 group-hover:from-blue-500 group-hover:to-indigo-300"
                    style={{ height: `${Math.max(4, Math.round((point.total / activityMax) * 100))}%` }}
                  />
                  <div className="absolute -top-8 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    {point.total} reqs
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-400">{point.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* INTENT DISTRIBUTION */}
        <section className="col-span-1 rounded-2xl border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-800/80 p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-500" /> {t("monitoring.dashboard.intentDistributionTitle")}
          </h3>
          <div className="space-y-4">
            {state.intents.intents.map((item) => (
              <div key={item.intent} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-gray-700 dark:text-gray-300 capitalize">{item.intent}</span>
                  <span className="text-gray-500">{(item.percentage * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-1000" style={{ width: `${Math.max(2, Math.round((item.count / intentMax) * 100))}%` }} />
                </div>
              </div>
            ))}
            {!state.intents.intents.length ? <p className="text-sm text-gray-400 italic text-center py-4">{t("monitoring.common.noData")}</p> : null}
          </div>
        </section>
      </div>

      {/* RECENT QUERIES & LATENCY */}
      <div className="grid lg:grid-cols-3 gap-6">
        <section className="col-span-1 lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-800/80 p-5 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-500" /> {t("monitoring.dashboard.recentQueriesTitle")}
            </h3>
            <Button size="sm" variant="ghost" className="h-8 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700" onClick={() => setShowLogs((value) => !value)}>
              {showLogs ? t("monitoring.dashboard.hideLogs") : t("monitoring.dashboard.showLogs")}
            </Button>
          </div>
          <div className="space-y-0 text-sm overflow-y-auto pr-2 custom-scrollbar flex-1">
            {state.recentQueries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 dark:border-gray-700/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 px-2 rounded-lg transition-colors">
                <span className="truncate flex-1 font-medium text-gray-800 dark:text-gray-200">{entry.query}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-md">
                    {entry.intent}
                  </span>
                  <span className="text-xs font-mono text-amber-600 dark:text-amber-400 w-16 text-right">
                    {formatLatency(entry.total_latency_ms)}
                  </span>
                  <span className="w-6 text-center text-base">
                    {feedbackShort(entry.feedback)}
                  </span>
                </div>
              </div>
            ))}
            {!state.recentQueries.length ? <p className="text-sm text-gray-400 italic text-center py-6">{t("monitoring.dashboard.noRecentQueries")}</p> : null}
          </div>
        </section>

        <section className="col-span-1 rounded-2xl border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-800/80 p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-6 flex items-center gap-2">
            <Server className="w-4 h-4 text-orange-500" /> {t("monitoring.dashboard.latencyBreakdownTitle")}
          </h3>
          <div className="space-y-4">
            {[
              [t("monitoring.dashboard.latencyAnalyzer"), state.latency.analyzer_ms, "text-blue-500"],
              [t("monitoring.dashboard.latencyRetrieval"), state.latency.retrieval_ms, "text-indigo-500"],
              [t("monitoring.dashboard.latencyReranking"), state.latency.reranking_ms, "text-purple-500"],
              [t("monitoring.dashboard.latencyLlm"), state.latency.llm_ms, "text-emerald-500"],
            ].map(([label, value, colorClass]) => (
              <div key={label as string} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className={`w-1.5 h-1.5 rounded-full bg-current ${colorClass}`} />
                  {label}
                </div>
                <b className="text-sm font-mono text-gray-900 dark:text-gray-200">{formatLatency(Number(value || 0))}</b>
              </div>
            ))}
            <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
              <span className="font-medium text-gray-900 dark:text-white">Total</span>
              <b className="text-lg font-mono text-amber-600 dark:text-amber-400">{formatLatency(Number(state.latency.total_ms || 0))}</b>
            </div>
          </div>
        </section>
      </div>

      {showLogs ? <QueryLogView onClose={() => setShowLogs(false)} /> : null}

      {(loading || error) && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-3 flex items-center gap-3 animate-in slide-in-from-bottom-5">
          {loading && <Activity className="w-4 h-4 text-blue-500 animate-pulse" />}
          {error && <XCircle className="w-4 h-4 text-red-500" />}
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {loading ? t("monitoring.dashboard.loading") : error}
          </span>
        </div>
      )}
    </div>
  );
}
