import { useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";

export interface MonitoringConfig {
  log_queries: boolean;
  log_retrieval_results: boolean;
  log_llm_outputs: boolean;
  feedback_collection: boolean;
  retention_days: number;
  max_log_size_mb: number;
  alert_latency_p95_ms: number;
  alert_success_rate: number;
  alert_negative_feedback: number;
  alert_daily_cost: number;
  service_check_interval: number;
  dashboard_refresh_interval: number;
}

const defaultMonitoringConfig: MonitoringConfig = {
  log_queries: true,
  log_retrieval_results: true,
  log_llm_outputs: true,
  feedback_collection: true,
  retention_days: 30,
  max_log_size_mb: 100,
  alert_latency_p95_ms: 5000,
  alert_success_rate: 0.9,
  alert_negative_feedback: 0.4,
  alert_daily_cost: 1.0,
  service_check_interval: 60,
  dashboard_refresh_interval: 30,
};

export function useMonitoringConfig() {
  const [config, setConfig] = useState<MonitoringConfig>(defaultMonitoringConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const payload = await ipc.getMonitoringConfig();
      setConfig({ ...defaultMonitoringConfig, ...(payload as any) });
      setError(null);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const update = async (patch: Partial<MonitoringConfig>) => {
    setSaving(true);
    try {
      const saved = await ipc.updateMonitoringConfig({ ...config, ...patch });
      setConfig({ ...defaultMonitoringConfig, ...(saved as any) });
      setError(null);
    } catch (err: any) {
      setError(String(err));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      const payload = await ipc.resetMonitoringConfig();
      setConfig({ ...defaultMonitoringConfig, ...(payload as any) });
      setError(null);
    } catch (err: any) {
      setError(String(err));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    config,
    loading,
    saving,
    error,
    refresh,
    update,
    reset,
  };
}
