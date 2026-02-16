import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface HnswConfig {
  ef_construction: number;
  m: number;
  ef_search: number;
}

export interface VectorStoreConfig {
  provider: "qdrant" | "chroma";
  mode: "persistent" | "memory";
  path: string;
  collection_name: string;
  distance_metric: "cosine" | "euclidean" | "dot";
  hnsw: HnswConfig;
  snapshot_retention: number;
}

export interface VectorStoreStats {
  name: string;
  vectors_count: number;
  dimensions: number;
  size_bytes: number;
  status: string;
}

export interface ConnectionResult {
  success: boolean;
  status: string;
  message: string;
}

export function useVectorStoreConfig() {
  const [config, setConfig] = useState<VectorStoreConfig | null>(null);
  const [baseline, setBaseline] = useState<VectorStoreConfig | null>(null);
  const [stats, setStats] = useState<VectorStoreStats | null>(null);
  const [connection, setConnection] = useState<ConnectionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const cfg = await invoke<VectorStoreConfig>("get_vector_store_config");
      const st = await invoke<VectorStoreStats>("get_vector_store_collection_stats");
      setConfig(cfg);
      setBaseline(cfg);
      setStats(st);
      setError(null);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (patch: Partial<VectorStoreConfig>) => {
    if (!config) return null;
    const next = { ...config, ...patch };
    const saved = await invoke<VectorStoreConfig>("update_vector_store_config", { config: next });
    setConfig(saved);
    return saved;
  };

  const refreshStats = async () => {
    const st = await invoke<VectorStoreStats>("get_vector_store_collection_stats");
    setStats(st);
  };

  const reset = async () => {
    const cfg = await invoke<VectorStoreConfig>("reset_vector_store_config");
    setConfig(cfg);
    setBaseline(cfg);
    await refreshStats();
  };

  const testConnection = async () => {
    const result = await invoke<ConnectionResult>("test_vector_store_connection");
    setConnection(result);
    return result;
  };

  const deleteCollection = async () => {
    await invoke("delete_vector_store_collection");
    await refreshStats();
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await invoke<VectorStoreConfig>("get_vector_store_config");
        const st = await invoke<VectorStoreStats>("get_vector_store_collection_stats");
        if (cancelled) return;
        setConfig(cfg);
        setBaseline(cfg);
        setStats(st);
        setError(null);
      } catch (err: any) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirtyKeys = useMemo(() => {
    if (!config || !baseline) return [] as string[];
    return Object.keys(config).filter((key) => JSON.stringify((config as any)[key]) !== JSON.stringify((baseline as any)[key]));
  }, [config, baseline]);

  return { config, stats, connection, loading, error, dirtyKeys, fetchAll, updateConfig, reset, testConnection, deleteCollection, refreshStats };
}

