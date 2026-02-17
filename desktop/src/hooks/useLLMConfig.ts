import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type LLMProvider = "openai" | "anthropic" | "ollama" | "mistral";
export type CitationFormat = "inline" | "footnote";
export type ResponseLanguage = "auto" | "fr" | "en";

export const DEFAULT_LLM_SYSTEM_PROMPT = `Tu es un assistant specialise dans l'analyse de documents. Tu reponds aux questions en te basant UNIQUEMENT sur le contexte fourni entre les balises <context> et </context>.

Regles :
1. Base ta reponse exclusivement sur le contexte fourni. Ne genere jamais d'information qui ne s'y trouve pas.
2. Cite tes sources en utilisant le format {citation_format_instruction} apres chaque affirmation importante.
3. Si l'information demandee n'est pas dans le contexte, dis-le honnetement en utilisant la phrase : "{uncertainty_phrase}".
4. Reponds dans la langue de la question, sauf indication contraire.
5. Structure ta reponse de maniere claire avec des paragraphes, listes ou titres si necessaire.
6. Si plusieurs sources se contredisent, signale-le explicitement.`;

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  api_key_set: boolean;
  temperature: number;
  max_tokens: number;
  top_p: number;
  cite_sources: boolean;
  citation_format: CitationFormat;
  admit_uncertainty: boolean;
  uncertainty_phrase: string;
  response_language: ResponseLanguage;
  context_max_chunks: number;
  context_max_tokens: number;
  system_prompt: string;
  timeout: number;
  max_retries: number;
  streaming: boolean;
  debug_default: boolean;
}

const defaultConfig: LLMConfig = {
  provider: "openai",
  model: "gpt-4o-mini",
  api_key_set: false,
  temperature: 0.1,
  max_tokens: 2000,
  top_p: 0.9,
  cite_sources: true,
  citation_format: "inline",
  admit_uncertainty: true,
  uncertainty_phrase: "Je n'ai pas trouve cette information dans les documents disponibles.",
  response_language: "auto",
  context_max_chunks: 5,
  context_max_tokens: 4000,
  system_prompt: DEFAULT_LLM_SYSTEM_PROMPT,
  timeout: 60,
  max_retries: 2,
  streaming: true,
  debug_default: false,
};

function normalizeConfig(config: Partial<LLMConfig> | undefined): LLMConfig {
  const next = { ...defaultConfig, ...(config || {}) };
  if (!next.model.trim()) next.model = defaultConfig.model;
  if (next.context_max_chunks * 50 > next.context_max_tokens) {
    next.context_max_tokens = next.context_max_chunks * 50;
  }
  return next;
}

function apiKeyName(provider: LLMProvider): string | null {
  if (provider === "openai" || provider === "anthropic" || provider === "mistral") {
    return `ragkit.llm.${provider}.api_key`;
  }
  return null;
}

export function useLLMConfig() {
  const [config, setConfig] = useState<LLMConfig>(defaultConfig);
  const [baseline, setBaseline] = useState<LLMConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const cfg = await invoke<LLMConfig>("get_llm_config");
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

  const updateConfig = async (patch: Partial<LLMConfig>) => {
    const next = normalizeConfig({ ...config, ...patch });
    const saved = await invoke<LLMConfig>("update_llm_config", { config: next });
    const normalized = normalizeConfig(saved);
    setConfig(normalized);
    return normalized;
  };

  const reset = async () => {
    const cfg = await invoke<LLMConfig>("reset_llm_config");
    const normalized = normalizeConfig(cfg);
    setConfig(normalized);
    setBaseline(normalized);
  };

  const setApiKey = async (provider: LLMProvider, value: string) => {
    const keyName = apiKeyName(provider);
    if (!keyName) return;
    await invoke("store_secret", { keyName, value });
    const refreshed = await invoke<LLMConfig>("get_llm_config");
    setConfig(normalizeConfig(refreshed));
  };

  const deleteApiKey = async (provider: LLMProvider) => {
    const keyName = apiKeyName(provider);
    if (!keyName) return;
    await invoke("delete_secret", { keyName });
    const refreshed = await invoke<LLMConfig>("get_llm_config");
    setConfig(normalizeConfig(refreshed));
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await invoke<LLMConfig>("get_llm_config");
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

  const dirtyKeys = useMemo(
    () =>
      Object.keys(config).filter(
        (key) => JSON.stringify((config as any)[key]) !== JSON.stringify((baseline as any)[key]),
      ),
    [config, baseline],
  );

  return { config, loading, error, dirtyKeys, fetchConfig, updateConfig, reset, setApiKey, deleteApiKey };
}
