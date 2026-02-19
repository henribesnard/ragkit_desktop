import { useCallback, useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";

export interface QueryLogEntry {
  id: string;
  timestamp: string;
  query: string;
  intent: string;
  intent_confidence: number;
  needs_rag: boolean;
  rewritten_query?: string | null;
  search_type?: string | null;
  chunks_retrieved: number;
  sources: Array<Record<string, any>>;
  retrieval_latency_ms: number;
  reranking_applied: boolean;
  reranking_latency_ms: number;
  answer?: string | null;
  model?: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  generation_latency_ms: number;
  estimated_cost_usd: number;
  analyzer_latency_ms: number;
  rewriting_latency_ms: number;
  total_latency_ms: number;
  success: boolean;
  error?: string | null;
  feedback?: "positive" | "negative" | null;
}

export interface QueryLogsFilters {
  intent?: string;
  feedback?: string;
  since_days?: number;
  page?: number;
  page_size?: number;
  search?: string;
}

export interface PaginatedQueryLogs {
  entries: QueryLogEntry[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

const defaultPayload: PaginatedQueryLogs = {
  entries: [],
  total: 0,
  page: 1,
  page_size: 20,
  has_more: false,
};

export function useQueryLogs(initialFilters: QueryLogsFilters = {}) {
  const [filters, setFilters] = useState<QueryLogsFilters>({
    page: 1,
    page_size: 20,
    since_days: 7,
    ...initialFilters,
  });
  const [data, setData] = useState<PaginatedQueryLogs>(defaultPayload);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (next?: QueryLogsFilters) => {
    setLoading(true);
    const merged = { ...filters, ...(next || {}) };
    setFilters(merged);
    try {
      const payload = (await ipc.getQueryLogs(merged)) as PaginatedQueryLogs;
      setData(payload || defaultPayload);
      setError(null);
      return payload || defaultPayload;
    } catch (err: any) {
      setError(String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const getDetail = async (queryId: string) => {
    return (await ipc.getQueryLogDetail(queryId)) as QueryLogEntry;
  };

  const exportCsv = async (overrideFilters?: QueryLogsFilters) => {
    const merged = { ...filters, ...(overrideFilters || {}) };
    return (await ipc.exportQueryLogs(merged)) as string;
  };

  const purge = async () => {
    return (await ipc.purgeLogs()) as { purged_count: number };
  };

  useEffect(() => {
    void fetchLogs(initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    filters,
    setFilters,
    data,
    loading,
    error,
    fetchLogs,
    getDetail,
    exportCsv,
    purge,
  };
}
