import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type RerankProvider = "none" | "cohere" | "local";

export interface RerankConfig {
  enabled: boolean;
  provider: RerankProvider;
  model: string | null;
  api_key_set: boolean;
  candidates: number;
  top_n: number;
  relevance_threshold: number;
  batch_size: number;
  timeout: number;
  max_retries: number;
  debug_default: boolean;
}

const defaultConfig: RerankConfig = {
  enabled: false,
  provider: "none",
  model: null,
  api_key_set: false,
  candidates: 40,
  top_n: 5,
  relevance_threshold: 0,
  batch_size: 10,
  timeout: 30,
  max_retries: 2,
  debug_default: false,
};

function normalizeConfig(config: Partial<RerankConfig> | undefined): RerankConfig {
  const normalized: RerankConfig = {
    ...defaultConfig,
    ...(config || {}),
  };

  if (normalized.provider === "none") {
    normalized.model = null;
  }
  if (normalized.top_n > normalized.candidates) {
    normalized.top_n = normalized.candidates;
  }
  return normalized;
}

const COHERE_SECRET_KEY = "cohere_api_key";

export function useRerankConfig() {
  const [config, setConfig] = useState<RerankConfig>(defaultConfig);
  const [baseline, setBaseline] = useState<RerankConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const cfg = await invoke<RerankConfig>("get_rerank_config");
      const normalized = normalizeConfig(cfg);
      setConfig(normalized);
      setBaseline(normalized);
      setError(null);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (patch: Partial<RerankConfig>) => {
    const next = normalizeConfig({ ...config, ...patch });
    const saved = await invoke<RerankConfig>("update_rerank_config", { config: next });
    const normalized = normalizeConfig(saved);
    setConfig(normalized);
    return normalized;
  };

  const reset = async () => {
    const cfg = await invoke<RerankConfig>("reset_rerank_config");
    const normalized = normalizeConfig(cfg);
    setConfig(normalized);
    setBaseline(normalized);
  };

  const setCohereApiKey = async (apiKey: string) => {
    await invoke("store_secret", { keyName: COHERE_SECRET_KEY, value: apiKey });
    const refreshed = await invoke<RerankConfig>("get_rerank_config");
    setConfig(normalizeConfig(refreshed));
  };

  const deleteCohereApiKey = async () => {
    await invoke("delete_secret", { keyName: COHERE_SECRET_KEY });
    const refreshed = await invoke<RerankConfig>("get_rerank_config");
    setConfig(normalizeConfig(refreshed));
  };

  const hasCohereApiKey = async (): Promise<boolean> => {
    const response = await invoke<{ exists: boolean }>("secret_exists", { keyName: COHERE_SECRET_KEY });
    return Boolean(response.exists);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await invoke<RerankConfig>("get_rerank_config");
        if (cancelled) return;
        const normalized = normalizeConfig(cfg);
        setConfig(normalized);
        setBaseline(normalized);
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
    return Object.keys(config).filter(
      (key) => JSON.stringify((config as any)[key]) !== JSON.stringify((baseline as any)[key]),
    );
  }, [config, baseline]);

  return {
    config,
    loading,
    error,
    dirtyKeys,
    fetchConfig,
    updateConfig,
    reset,
    setCohereApiKey,
    deleteCohereApiKey,
    hasCohereApiKey,
  };
}
