import { useCallback, useEffect, useMemo, useState } from "react";
import { ipc } from "@/lib/ipc";

export type ServiceStatus = "ok" | "loading" | "error" | "disabled";

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  provider?: string | null;
  model?: string | null;
  detail?: string | null;
  last_check?: string | null;
  error?: string | null;
}

export interface QueryMetrics {
  total_queries: number;
  success_rate: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  total_cost_usd: number;
  period_hours: number;
}

export interface ActivityDataPoint {
  date: string;
  total: number;
  rag: number;
  non_rag: number;
}

export interface IntentDistribution {
  intents: Array<{ intent: string; count: number; percentage: number }>;
  period_hours: number;
}

export interface FeedbackStats {
  positive: number;
  negative: number;
  without_feedback: number;
  positive_rate: number;
  trend_7d: number;
}

export interface LatencyBreakdown {
  analyzer_ms: number;
  rewriting_ms: number;
  retrieval_ms: number;
  reranking_ms: number;
  llm_ms: number;
  total_ms: number;
}

export interface IngestionStats {
  total_documents: number;
  total_chunks: number;
  total_tokens: number;
  last_updated: string | null;
  coverage_percent: number;
}

export interface AlertItem {
  metric: string;
  message: string;
  current_value: number;
  threshold: number;
  severity: string;
}

export interface QueryLogEntry {
  id: string;
  timestamp: string;
  query: string;
  intent: string;
  total_latency_ms: number;
  feedback?: "positive" | "negative" | null;
}

export interface DashboardState {
  health: ServiceHealth[];
  ingestion: IngestionStats;
  metrics: QueryMetrics;
  activity: ActivityDataPoint[];
  intents: IntentDistribution;
  feedback: FeedbackStats;
  latency: LatencyBreakdown;
  alerts: AlertItem[];
  recentQueries: QueryLogEntry[];
}

const defaultState: DashboardState = {
  health: [],
  ingestion: {
    total_documents: 0,
    total_chunks: 0,
    total_tokens: 0,
    last_updated: null,
    coverage_percent: 0,
  },
  metrics: {
    total_queries: 0,
    success_rate: 1,
    avg_latency_ms: 0,
    p95_latency_ms: 0,
    total_cost_usd: 0,
    period_hours: 24,
  },
  activity: [],
  intents: { intents: [], period_hours: 24 },
  feedback: {
    positive: 0,
    negative: 0,
    without_feedback: 0,
    positive_rate: 0,
    trend_7d: 0,
  },
  latency: {
    analyzer_ms: 0,
    rewriting_ms: 0,
    retrieval_ms: 0,
    reranking_ms: 0,
    llm_ms: 0,
    total_ms: 0,
  },
  alerts: [],
  recentQueries: [],
};

export function useDashboard(refreshIntervalSec = 30, serviceCheckIntervalSec = 60) {
  const [state, setState] = useState<DashboardState>(defaultState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [
        health,
        ingestion,
        metrics,
        activity,
        intents,
        feedback,
        latency,
        alerts,
        recent,
      ] = await Promise.all([
        ipc.getDashboardHealth(),
        ipc.getDashboardIngestion(),
        ipc.getDashboardMetrics(24),
        ipc.getDashboardActivity(7),
        ipc.getDashboardIntents(24),
        ipc.getDashboardFeedback(7),
        ipc.getDashboardLatency(24),
        ipc.getDashboardAlerts(),
        ipc.getQueryLogs({ page: 1, page_size: 5, since_days: 7 }),
      ]);

      setState({
        health: (health as ServiceHealth[]) || [],
        ingestion: (ingestion as IngestionStats) || defaultState.ingestion,
        metrics: (metrics as QueryMetrics) || defaultState.metrics,
        activity: (activity as ActivityDataPoint[]) || [],
        intents: (intents as IntentDistribution) || defaultState.intents,
        feedback: (feedback as FeedbackStats) || defaultState.feedback,
        latency: (latency as LatencyBreakdown) || defaultState.latency,
        alerts: (alerts as AlertItem[]) || [],
        recentQueries: ((recent as any)?.entries || []) as QueryLogEntry[],
      });
      setError(null);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    try {
      const [
        ingestion,
        metrics,
        activity,
        intents,
        feedback,
        latency,
        alerts,
        recent,
      ] = await Promise.all([
        ipc.getDashboardIngestion(),
        ipc.getDashboardMetrics(24),
        ipc.getDashboardActivity(7),
        ipc.getDashboardIntents(24),
        ipc.getDashboardFeedback(7),
        ipc.getDashboardLatency(24),
        ipc.getDashboardAlerts(),
        ipc.getQueryLogs({ page: 1, page_size: 5, since_days: 7 }),
      ]);

      setState((prev) => ({
        ...prev,
        ingestion: (ingestion as IngestionStats) || defaultState.ingestion,
        metrics: (metrics as QueryMetrics) || defaultState.metrics,
        activity: (activity as ActivityDataPoint[]) || [],
        intents: (intents as IntentDistribution) || defaultState.intents,
        feedback: (feedback as FeedbackStats) || defaultState.feedback,
        latency: (latency as LatencyBreakdown) || defaultState.latency,
        alerts: (alerts as AlertItem[]) || [],
        recentQueries: ((recent as any)?.entries || []) as QueryLogEntry[],
      }));
      setError(null);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const health = await ipc.getDashboardHealth();
      setState((prev) => ({ ...prev, health: (health as ServiceHealth[]) || [] }));
      setError(null);
    } catch (err: any) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!active) return;
      await refresh();
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  useEffect(() => {
    const intervalMs = Math.max(10, refreshIntervalSec) * 1000;
    const id = window.setInterval(() => {
      void refreshDashboard();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [refreshDashboard, refreshIntervalSec]);

  useEffect(() => {
    const intervalMs = Math.max(15, serviceCheckIntervalSec) * 1000;
    const id = window.setInterval(() => {
      void refreshHealth();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [refreshHealth, serviceCheckIntervalSec]);

  const isHealthy = useMemo(() => state.health.every((item) => item.status === "ok" || item.status === "disabled"), [state.health]);

  return {
    state,
    loading,
    error,
    isHealthy,
    refresh,
  };
}
