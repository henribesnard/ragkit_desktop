import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type EmbeddingProvider = "openai" | "ollama" | "huggingface" | "cohere" | "voyageai" | "mistral";

export interface QueryModelConfig {
  same_as_document: boolean;
  provider?: EmbeddingProvider;
  model?: string;
}

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  api_key_set: boolean;
  query_model: QueryModelConfig;
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

export interface ModelInfo {
  provider: EmbeddingProvider;
  id: string;
  display_name: string;
  dimensions_default: number;
  dimensions_supported: number[];
  max_input_tokens?: number | null;
  pricing_hint?: string | null;
  languages?: string;
  description: string;
  local: boolean;
}

export interface EnvironmentInfo {
  gpu_available: boolean;
  gpu_name?: string | null;
  gpu_backend?: string | null;
  ollama_available: boolean;
  ollama_version?: string | null;
  ollama_llm_models: string[];
  ollama_embedding_models: string[];
  local_cached_models: string[];
  keyring_available: boolean;
}

const defaultConfig: EmbeddingConfig = {
  provider: "openai",
  model: "text-embedding-3-small",
  api_key_set: false,
  query_model: { same_as_document: true },
  dimensions: null,
  batch_size: 100,
  normalize: true,
  cache_enabled: true,
  cache_backend: "disk",
  timeout: 30,
  max_retries: 3,
  rate_limit_rpm: 3000,
  truncation: "end",
};

export function useEmbeddingConfig() {
  const [config, setConfig] = useState<EmbeddingConfig | null>(null);
  const [baseline, setBaseline] = useState<EmbeddingConfig | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [environment, setEnvironment] = useState<EnvironmentInfo | null>(null);
  const [cacheStats, setCacheStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshEnvironment = async () => {
    const env = await invoke<EnvironmentInfo>("get_embedding_environment");
    setEnvironment(env);
    return env;
  };

  const refreshCacheStats = async () => {
    const stats = await invoke("get_embedding_cache_stats");
    setCacheStats(stats);
    return stats;
  };

  const refreshModels = async (provider: EmbeddingProvider) => {
    const available = await invoke<ModelInfo[]>("get_available_models", { provider });
    setModels(available || []);
    return available || [];
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const cfg = await invoke<EmbeddingConfig>("get_embedding_config");
      const normalized = { ...defaultConfig, ...cfg, query_model: { ...defaultConfig.query_model, ...(cfg.query_model || {}) } };
      setConfig(normalized);
      setBaseline(normalized);
      await Promise.all([refreshModels(normalized.provider), refreshEnvironment(), refreshCacheStats()]);
      setError(null);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (patch: Partial<EmbeddingConfig>) => {
    if (!config) return null;
    const merged = { ...config, ...patch };
    const saved = await invoke<EmbeddingConfig>("update_embedding_config", { config: merged });
    const normalized = { ...defaultConfig, ...saved, query_model: { ...defaultConfig.query_model, ...(saved.query_model || {}) } };
    setConfig(normalized);
    return normalized;
  };

  const setProvider = async (provider: EmbeddingProvider) => {
    const saved = await updateConfig({ provider });
    if (!saved) return;
    const available = await refreshModels(provider);
    if (available.length) {
      const primary = available[0];
      await updateConfig({
        model: primary.id,
        dimensions: primary.dimensions_default || null,
      });
    }
  };

  const reset = async () => {
    const cfg = await invoke<EmbeddingConfig>("reset_embedding_config");
    const normalized = { ...defaultConfig, ...cfg, query_model: { ...defaultConfig.query_model, ...(cfg.query_model || {}) } };
    setConfig(normalized);
    setBaseline(normalized);
    await Promise.all([refreshModels(normalized.provider), refreshEnvironment(), refreshCacheStats()]);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await invoke<EmbeddingConfig>("get_embedding_config");
        if (cancelled) return;
        const normalized = { ...defaultConfig, ...cfg, query_model: { ...defaultConfig.query_model, ...(cfg.query_model || {}) } };
        setConfig(normalized);
        setBaseline(normalized);
        const [availableModels, env, stats] = await Promise.all([
          invoke<ModelInfo[]>("get_available_models", { provider: normalized.provider }),
          invoke<EnvironmentInfo>("get_embedding_environment"),
          invoke("get_embedding_cache_stats"),
        ]);
        if (!cancelled) {
          setModels(availableModels || []);
          setEnvironment(env);
          setCacheStats(stats);
          setError(null);
        }
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

  return {
    config,
    models,
    environment,
    cacheStats,
    loading,
    error,
    dirtyKeys,
    fetchConfig,
    refreshEnvironment,
    refreshCacheStats,
    refreshModels,
    updateConfig,
    setProvider,
    reset,
  };
}

