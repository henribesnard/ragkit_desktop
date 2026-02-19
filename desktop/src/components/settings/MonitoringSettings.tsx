import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { ipc } from "@/lib/ipc";
import { MonitoringConfig, useMonitoringConfig } from "@/hooks/useMonitoringConfig";

export function MonitoringSettings() {
  const { t } = useTranslation();
  const { config, loading, saving, error, update, reset } = useMonitoringConfig();
  const [draft, setDraft] = useState<MonitoringConfig>(config);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const save = async () => {
    await update(draft);
    setMessage(t("monitoring.settings.saved"));
  };

  const resetConfig = async () => {
    await reset();
    setMessage(t("monitoring.settings.resetDone"));
  };

  const purgeLogs = async () => {
    const response = (await ipc.purgeLogs()) as { purged_count?: number };
    setMessage(t("monitoring.settings.purged", { count: response?.purged_count ?? 0 }));
  };

  if (loading) {
    return <p className="text-sm text-gray-500">{t("monitoring.settings.loading")}</p>;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{t("monitoring.settings.title")}</h2>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <section className="rounded border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-medium">{t("monitoring.settings.loggingTitle")}</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <Toggle checked={draft.log_queries} onChange={(value) => setDraft((prev) => ({ ...prev, log_queries: value }))} label={t("monitoring.settings.logQueries")} />
          <Toggle checked={draft.log_retrieval_results} onChange={(value) => setDraft((prev) => ({ ...prev, log_retrieval_results: value }))} label={t("monitoring.settings.logRetrieval")} />
          <Toggle checked={draft.log_llm_outputs} onChange={(value) => setDraft((prev) => ({ ...prev, log_llm_outputs: value }))} label={t("monitoring.settings.logLlm")} />
          <Toggle checked={draft.feedback_collection} onChange={(value) => setDraft((prev) => ({ ...prev, feedback_collection: value }))} label={t("monitoring.settings.feedbackCollection")} />
        </div>
      </section>

      <section className="rounded border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-medium">{t("monitoring.settings.retentionTitle")}</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            {t("monitoring.settings.retentionDays")}
            <input
              type="number"
              min={1}
              max={365}
              className="mt-1 w-full border rounded px-2 py-1"
              value={draft.retention_days}
              onChange={(event) => setDraft((prev) => ({ ...prev, retention_days: Number(event.target.value) }))}
            />
          </label>
          <label className="text-sm">
            {t("monitoring.settings.maxLogSize")}
            <input
              type="number"
              min={10}
              max={1000}
              className="mt-1 w-full border rounded px-2 py-1"
              value={draft.max_log_size_mb}
              onChange={(event) => setDraft((prev) => ({ ...prev, max_log_size_mb: Number(event.target.value) }))}
            />
          </label>
        </div>
        <Button variant="outline" size="sm" onClick={() => void purgeLogs()}>
          {t("monitoring.settings.purgeLogs")}
        </Button>
      </section>

      <section className="rounded border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-medium">{t("monitoring.settings.alertsTitle")}</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            {t("monitoring.settings.alertLatency")}
            <input
              type="number"
              min={1000}
              max={30000}
              className="mt-1 w-full border rounded px-2 py-1"
              value={draft.alert_latency_p95_ms}
              onChange={(event) => setDraft((prev) => ({ ...prev, alert_latency_p95_ms: Number(event.target.value) }))}
            />
          </label>
          <label className="text-sm">
            {t("monitoring.settings.alertSuccessRate")}
            <input
              type="number"
              min={0.5}
              max={1}
              step={0.01}
              className="mt-1 w-full border rounded px-2 py-1"
              value={draft.alert_success_rate}
              onChange={(event) => setDraft((prev) => ({ ...prev, alert_success_rate: Number(event.target.value) }))}
            />
          </label>
          <label className="text-sm">
            {t("monitoring.settings.alertNegativeFeedback")}
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.01}
              className="mt-1 w-full border rounded px-2 py-1"
              value={draft.alert_negative_feedback}
              onChange={(event) => setDraft((prev) => ({ ...prev, alert_negative_feedback: Number(event.target.value) }))}
            />
          </label>
          <label className="text-sm">
            {t("monitoring.settings.alertDailyCost")}
            <input
              type="number"
              min={0.1}
              max={100}
              step={0.01}
              className="mt-1 w-full border rounded px-2 py-1"
              value={draft.alert_daily_cost}
              onChange={(event) => setDraft((prev) => ({ ...prev, alert_daily_cost: Number(event.target.value) }))}
            />
          </label>
        </div>
      </section>

      <section className="rounded border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="font-medium">{t("monitoring.settings.refreshTitle")}</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            {t("monitoring.settings.serviceCheckInterval")}
            <input
              type="number"
              min={15}
              max={600}
              className="mt-1 w-full border rounded px-2 py-1"
              value={draft.service_check_interval}
              onChange={(event) => setDraft((prev) => ({ ...prev, service_check_interval: Number(event.target.value) }))}
            />
          </label>
          <label className="text-sm">
            {t("monitoring.settings.dashboardRefreshInterval")}
            <input
              type="number"
              min={10}
              max={300}
              className="mt-1 w-full border rounded px-2 py-1"
              value={draft.dashboard_refresh_interval}
              onChange={(event) => setDraft((prev) => ({ ...prev, dashboard_refresh_interval: Number(event.target.value) }))}
            />
          </label>
        </div>
      </section>

      <div className="flex items-center gap-2">
        <Button onClick={() => void save()} disabled={saving}>{t("monitoring.common.save")}</Button>
        <Button variant="outline" onClick={() => void resetConfig()} disabled={saving}>{t("monitoring.common.reset")}</Button>
      </div>
    </section>
  );
}
