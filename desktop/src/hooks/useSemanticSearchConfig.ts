import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface SemanticSearchFilters {
  doc_ids: string[];
  doc_types: string[];
  languages: string[];
  categories: string[];
}

export interface SemanticSearchConfig {
  enabled: boolean;
  top_k: number;
  threshold: number;
  weight: number;
  mmr_enabled: boolean;
  mmr_lambda: number;
  default_filters_enabled: boolean;
  default_filters: SemanticSearchFilters;
  prefetch_multiplier: number;
  debug_default: boolean;
}

const defaultConfig: SemanticSearchConfig = {
  enabled: true,
  top_k: 10,
  threshold: 0,
  weight: 1,
  mmr_enabled: false,
  mmr_lambda: 0.5,
  default_filters_enabled: false,
  default_filters: { doc_ids: [], doc_types: [], languages: [], categories: [] },
  prefetch_multiplier: 3,
  debug_default: false,
};

export function useSemanticSearchConfig() {
  const [config, setConfig] = useState<SemanticSearchConfig>(defaultConfig);
  const [baseline, setBaseline] = useState<SemanticSearchConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const cfg = await invoke<SemanticSearchConfig>("get_semantic_search_config");
      const normalized: SemanticSearchConfig = {
        ...defaultConfig,
        ...cfg,
        default_filters: { ...defaultConfig.default_filters, ...(cfg.default_filters || {}) },
      };
      setConfig(normalized);
      setBaseline(normalized);
      setError(null);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (patch: Partial<SemanticSearchConfig>) => {
    const next = { ...config, ...patch };
    const saved = await invoke<SemanticSearchConfig>("update_semantic_search_config", { config: next });
    const normalized: SemanticSearchConfig = {
      ...defaultConfig,
      ...saved,
      default_filters: { ...defaultConfig.default_filters, ...(saved.default_filters || {}) },
    };
    setConfig(normalized);
    return normalized;
  };

  const updateFilters = async (filtersPatch: Partial<SemanticSearchFilters>) => {
    return updateConfig({ default_filters: { ...config.default_filters, ...filtersPatch } });
  };

  const reset = async () => {
    const cfg = await invoke<SemanticSearchConfig>("reset_semantic_search_config");
    const normalized: SemanticSearchConfig = {
      ...defaultConfig,
      ...cfg,
      default_filters: { ...defaultConfig.default_filters, ...(cfg.default_filters || {}) },
    };
    setConfig(normalized);
    setBaseline(normalized);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await invoke<SemanticSearchConfig>("get_semantic_search_config");
        if (cancelled) return;
        const normalized: SemanticSearchConfig = {
          ...defaultConfig,
          ...cfg,
          default_filters: { ...defaultConfig.default_filters, ...(cfg.default_filters || {}) },
        };
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
    return Object.keys(config).filter((key) => JSON.stringify((config as any)[key]) !== JSON.stringify((baseline as any)[key]));
  }, [config, baseline]);

  return { config, loading, error, dirtyKeys, fetchConfig, updateConfig, updateFilters, reset };
}

