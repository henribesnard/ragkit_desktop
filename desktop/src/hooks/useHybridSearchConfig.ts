import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type FusionMethod = "rrf" | "weighted_sum";
export type NormalizationMethod = "min_max" | "z_score";

export interface HybridSearchConfig {
  alpha: number;
  fusion_method: FusionMethod;
  rrf_k: number;
  normalize_scores: boolean;
  normalization_method: NormalizationMethod;
  top_k: number;
  threshold: number;
  deduplicate: boolean;
  debug_default: boolean;
}

const defaultConfig: HybridSearchConfig = {
  alpha: 0.5,
  fusion_method: "rrf",
  rrf_k: 60,
  normalize_scores: true,
  normalization_method: "min_max",
  top_k: 10,
  threshold: 0,
  deduplicate: true,
  debug_default: false,
};

function normalizeConfig(config: Partial<HybridSearchConfig> | undefined): HybridSearchConfig {
  return {
    ...defaultConfig,
    ...(config || {}),
  };
}

export function useHybridSearchConfig() {
  const [config, setConfig] = useState<HybridSearchConfig>(defaultConfig);
  const [baseline, setBaseline] = useState<HybridSearchConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const cfg = await invoke<HybridSearchConfig>("get_hybrid_search_config");
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

  const updateConfig = async (patch: Partial<HybridSearchConfig>) => {
    const next = normalizeConfig({ ...config, ...patch });
    const saved = await invoke<HybridSearchConfig>("update_hybrid_search_config", { config: next });
    const normalized = normalizeConfig(saved);
    setConfig(normalized);
    return normalized;
  };

  const reset = async () => {
    const cfg = await invoke<HybridSearchConfig>("reset_hybrid_search_config");
    const normalized = normalizeConfig(cfg);
    setConfig(normalized);
    setBaseline(normalized);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await invoke<HybridSearchConfig>("get_hybrid_search_config");
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
      (key) => JSON.stringify((config as any)[key]) !== JSON.stringify((baseline as any)[key])
    );
  }, [config, baseline]);

  return { config, loading, error, dirtyKeys, fetchConfig, updateConfig, reset };
}
