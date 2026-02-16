import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type EmbeddingProvider = "openai" | "ollama" | "huggingface" | "cohere" | "voyageai" | "mistral";

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  api_key_set: boolean;
  query_model: { same_as_document: boolean; provider?: EmbeddingProvider; model?: string };
  dimensions: number | null;
  batch_size: number;
  normalize: boolean;
  cache_enabled: boolean;
  cache_backend: "memory" | "disk";
  timeout: number;
  max_retries: number;
  rate_limit_rpm: number;
  truncation: "start" | "end" | "middle";
}

export function useEmbeddingConfig() {
  const [config, setConfig] = useState<EmbeddingConfig | null>(null);
  const [baseline, setBaseline] = useState<EmbeddingConfig | null>(null);
  const [models, setModels] = useState<any[]>([]);
  const [environment, setEnvironment] = useState<any | null>(null);
  const [cacheStats, setCacheStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const cfg = await invoke<EmbeddingConfig>("get_embedding_config");
      setConfig(cfg); setBaseline(cfg);
      const m = await invoke<any[]>("get_available_models", { provider: cfg.provider });
      setModels(m);
      setError(null);
    } catch (e: any) { setError(String(e)); }
    finally { setLoading(false); }
  };

  const refreshEnvironment = async () => setEnvironment(await invoke("get_embedding_environment"));
  const refreshCacheStats = async () => setCacheStats(await invoke("get_embedding_cache_stats"));

  const updateConfig = async (patch: Partial<EmbeddingConfig>) => {
    if (!config) return;
    const merged = { ...config, ...patch };
    setConfig(merged);
    const saved = await invoke<EmbeddingConfig>("update_embedding_config", { config: merged });
    setConfig(saved);
  };

  const setProvider = async (provider: EmbeddingProvider) => {
    await updateConfig({ provider });
    const m = await invoke<any[]>("get_available_models", { provider });
    setModels(m);
    if (m.length) await updateConfig({ model: m[0].id, dimensions: m[0].dimensions_default || null });
  };

  const reset = async () => {
    const cfg = await invoke<EmbeddingConfig>("reset_embedding_config");
    setConfig(cfg); setBaseline(cfg);
  };

  const dirty = useMemo(() => {
    if (!config || !baseline) return false;
    return JSON.stringify(config) !== JSON.stringify(baseline);
  }, [config, baseline]);

  useEffect(() => { fetchConfig(); refreshEnvironment(); refreshCacheStats(); }, []);

  return {
    config, models, environment, cacheStats, loading, error, dirty,
    fetchConfig, refreshEnvironment, refreshCacheStats, updateConfig, setProvider, reset,
  };
}
