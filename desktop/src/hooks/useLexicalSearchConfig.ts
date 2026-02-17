import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type BM25Algorithm = "bm25" | "bm25_plus";
export type LexicalLanguage = "auto" | "fr" | "en";

export interface LexicalSearchConfig {
  enabled: boolean;
  algorithm: BM25Algorithm;
  top_k: number;
  weight: number;
  bm25_k1: number;
  bm25_b: number;
  bm25_delta: number;
  lowercase: boolean;
  remove_stopwords: boolean;
  stopwords_lang: LexicalLanguage;
  stemming: boolean;
  stemmer_lang: LexicalLanguage;
  threshold: number;
  ngram_range: [number, number];
  debug_default: boolean;
}

const defaultConfig: LexicalSearchConfig = {
  enabled: true,
  algorithm: "bm25",
  top_k: 15,
  weight: 0.5,
  bm25_k1: 1.5,
  bm25_b: 0.75,
  bm25_delta: 0.5,
  lowercase: true,
  remove_stopwords: true,
  stopwords_lang: "auto",
  stemming: true,
  stemmer_lang: "auto",
  threshold: 0,
  ngram_range: [1, 1],
  debug_default: false,
};

function normalizeConfig(config: Partial<LexicalSearchConfig> | undefined): LexicalSearchConfig {
  const ngramsRaw = (config?.ngram_range || defaultConfig.ngram_range) as [number, number] | number[];
  const ngram_range: [number, number] = [
    Number(Array.isArray(ngramsRaw) ? ngramsRaw[0] : 1) || 1,
    Number(Array.isArray(ngramsRaw) ? ngramsRaw[1] : 1) || 1,
  ];
  return {
    ...defaultConfig,
    ...(config || {}),
    ngram_range,
  };
}

export function useLexicalSearchConfig() {
  const [config, setConfig] = useState<LexicalSearchConfig>(defaultConfig);
  const [baseline, setBaseline] = useState<LexicalSearchConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const cfg = await invoke<LexicalSearchConfig>("get_lexical_search_config");
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

  const updateConfig = async (patch: Partial<LexicalSearchConfig>) => {
    const next = normalizeConfig({ ...config, ...patch });
    const saved = await invoke<LexicalSearchConfig>("update_lexical_search_config", { config: next });
    const normalized = normalizeConfig(saved);
    setConfig(normalized);
    return normalized;
  };

  const reset = async () => {
    const cfg = await invoke<LexicalSearchConfig>("reset_lexical_search_config");
    const normalized = normalizeConfig(cfg);
    setConfig(normalized);
    setBaseline(normalized);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await invoke<LexicalSearchConfig>("get_lexical_search_config");
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
