import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface BM25IndexStats {
  num_documents: number;
  num_unique_terms: number;
  size_bytes: number;
  last_updated_version?: string | null;
  last_updated_at?: string | null;
}

const defaultStats: BM25IndexStats = {
  num_documents: 0,
  num_unique_terms: 0,
  size_bytes: 0,
  last_updated_version: null,
  last_updated_at: null,
};

export function useBM25IndexStats() {
  const [stats, setStats] = useState<BM25IndexStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setRefreshing(true);
    try {
      const value = await invoke<BM25IndexStats>("get_bm25_index_stats");
      setStats({ ...defaultStats, ...value });
      setError(null);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const rebuildIndex = async () => {
    const result = await invoke<{ status: string; duration_s: number }>("rebuild_bm25_index");
    await fetchStats();
    return result;
  };

  useEffect(() => {
    void fetchStats();
  }, []);

  return { stats, loading, refreshing, error, fetchStats, rebuildIndex };
}
