import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface SemanticSearchConfig {
  enabled: boolean;
  top_k: number;
  similarity_threshold: number;
  weight: number;
}

const defaultConfig: SemanticSearchConfig = {
  enabled: true,
  top_k: 10,
  similarity_threshold: 0,
  weight: 1,
};

export function useSemanticSearchConfig() {
  const [config, setConfig] = useState<SemanticSearchConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    setLoading(true);
    const cfg = await invoke<SemanticSearchConfig>("get_semantic_search_config");
    setConfig(cfg);
    setLoading(false);
  };

  const updateConfig = async (patch: Partial<SemanticSearchConfig>) => {
    const next = { ...config, ...patch };
    const saved = await invoke<SemanticSearchConfig>("update_semantic_search_config", { config: next });
    setConfig(saved);
    return saved;
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return { config, loading, fetchConfig, updateConfig };
}
