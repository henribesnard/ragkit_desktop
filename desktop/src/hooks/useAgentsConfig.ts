import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type AgentIntent = "question" | "greeting" | "chitchat" | "out_of_scope" | "clarification";
export type MemoryStrategy = "sliding_window" | "summary";

export interface QueryRewritingConfig {
  enabled: boolean;
  num_rewrites: number;
}

export interface AgentsConfig {
  always_retrieve: boolean;
  detect_intents: AgentIntent[];
  query_rewriting: QueryRewritingConfig;
  max_history_messages: number;
  memory_strategy: MemoryStrategy;
  prompt_analyzer: string;
  prompt_rewriting: string;
  prompt_greeting: string;
  prompt_out_of_scope: string;
  analyzer_model: string | null;
  analyzer_timeout: number;
  debug_default: boolean;
}

export const DEFAULT_PROMPT_ANALYZER = `Tu es un analyseur de requetes. Ta tache est de classifier le message de l'utilisateur
et de decider si une recherche dans la base documentaire est necessaire.

Contexte de la conversation (derniers messages) :
{conversation_history}

Message de l'utilisateur : "{user_message}"

Intentions possibles : {intents_list}

Reponds UNIQUEMENT en JSON avec ce format :
{
  "intent": "question|greeting|chitchat|out_of_scope|clarification",
  "needs_rag": true|false,
  "confidence": 0.0-1.0,
  "reasoning": "Explication courte de ta decision"
}

- En cas de doute, prefere "question" avec needs_rag=true.`;

export const DEFAULT_PROMPT_REWRITING = `Tu es un reformulateur de requetes pour un systeme de recherche documentaire.
Ta tache est de reformuler la requete de l'utilisateur pour ameliorer la recherche.

Contexte de la conversation :
{conversation_history}

Requete originale : "{user_query}"

Reformule cette requete en :
1. Resolvant les pronoms et references contextuelles ("il", "ca", "celui-ci")
2. Ajoutant le contexte implicite de la conversation
3. Rendant la requete autonome et comprehensible sans l'historique
4. Gardant la meme intention et le meme perimetre

Reponds UNIQUEMENT avec la requete reformulee, sans explication.`;

export const DEFAULT_PROMPT_GREETING = `Tu es un assistant documentaire amical. L'utilisateur te salue ou fait une formule
de politesse. Reponds de maniere chaleureuse et concise, en rappelant brievement
que tu es la pour repondre aux questions sur ses documents.
Langue de reponse : {response_language}.`;

export const DEFAULT_PROMPT_OOS = `Tu es un assistant documentaire. L'utilisateur pose une question qui ne concerne
pas les documents de sa base. Informe-le poliment que cette question est hors de
ton perimetre et invite-le a poser une question sur ses documents.
Ne tente PAS de repondre a la question.
Langue de reponse : {response_language}.`;

const defaultConfig: AgentsConfig = {
  always_retrieve: false,
  detect_intents: ["question", "greeting", "chitchat", "out_of_scope"],
  query_rewriting: {
    enabled: true,
    num_rewrites: 1,
  },
  max_history_messages: 10,
  memory_strategy: "sliding_window",
  prompt_analyzer: DEFAULT_PROMPT_ANALYZER,
  prompt_rewriting: DEFAULT_PROMPT_REWRITING,
  prompt_greeting: DEFAULT_PROMPT_GREETING,
  prompt_out_of_scope: DEFAULT_PROMPT_OOS,
  analyzer_model: null,
  analyzer_timeout: 15,
  debug_default: false,
};

function normalizeConfig(config: Partial<AgentsConfig> | undefined): AgentsConfig {
  const merged = { ...defaultConfig, ...(config || {}) } as AgentsConfig;
  merged.query_rewriting = {
    ...defaultConfig.query_rewriting,
    ...(config?.query_rewriting || {}),
  };
  merged.detect_intents = Array.from(new Set([...(merged.detect_intents || []), "question"])) as AgentIntent[];
  if (merged.query_rewriting.num_rewrites < 0) merged.query_rewriting.num_rewrites = 0;
  if (merged.query_rewriting.num_rewrites > 5) merged.query_rewriting.num_rewrites = 5;
  if (merged.max_history_messages < 0) merged.max_history_messages = 0;
  if (merged.max_history_messages > 50) merged.max_history_messages = 50;
  if (merged.analyzer_timeout < 5) merged.analyzer_timeout = 5;
  if (merged.analyzer_timeout > 60) merged.analyzer_timeout = 60;
  merged.prompt_analyzer = (merged.prompt_analyzer || defaultConfig.prompt_analyzer).trim();
  merged.prompt_rewriting = (merged.prompt_rewriting || defaultConfig.prompt_rewriting).trim();
  merged.prompt_greeting = (merged.prompt_greeting || defaultConfig.prompt_greeting).trim();
  merged.prompt_out_of_scope = (merged.prompt_out_of_scope || defaultConfig.prompt_out_of_scope).trim();
  return merged;
}

export function useAgentsConfig() {
  const [config, setConfig] = useState<AgentsConfig>(defaultConfig);
  const [baseline, setBaseline] = useState<AgentsConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const cfg = await invoke<AgentsConfig>("get_agents_config");
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

  const updateConfig = async (patch: Partial<AgentsConfig>) => {
    const next = normalizeConfig({
      ...config,
      ...patch,
      query_rewriting: {
        ...config.query_rewriting,
        ...(patch.query_rewriting || {}),
      },
    });
    const saved = await invoke<AgentsConfig>("update_agents_config", { config: next });
    const normalized = normalizeConfig(saved);
    setConfig(normalized);
    return normalized;
  };

  const reset = async () => {
    const cfg = await invoke<AgentsConfig>("reset_agents_config");
    const normalized = normalizeConfig(cfg);
    setConfig(normalized);
    setBaseline(normalized);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await invoke<AgentsConfig>("get_agents_config");
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
    const changed: string[] = [];
    if (JSON.stringify(config.detect_intents) !== JSON.stringify(baseline.detect_intents)) changed.push("detect_intents");
    if (config.always_retrieve !== baseline.always_retrieve) changed.push("always_retrieve");
    if (config.query_rewriting.enabled !== baseline.query_rewriting.enabled) changed.push("query_rewriting.enabled");
    if (config.query_rewriting.num_rewrites !== baseline.query_rewriting.num_rewrites) changed.push("query_rewriting.num_rewrites");
    if (config.max_history_messages !== baseline.max_history_messages) changed.push("max_history_messages");
    if (config.memory_strategy !== baseline.memory_strategy) changed.push("memory_strategy");
    if (config.prompt_analyzer !== baseline.prompt_analyzer) changed.push("prompt_analyzer");
    if (config.prompt_rewriting !== baseline.prompt_rewriting) changed.push("prompt_rewriting");
    if (config.prompt_greeting !== baseline.prompt_greeting) changed.push("prompt_greeting");
    if (config.prompt_out_of_scope !== baseline.prompt_out_of_scope) changed.push("prompt_out_of_scope");
    if (config.analyzer_model !== baseline.analyzer_model) changed.push("analyzer_model");
    if (config.analyzer_timeout !== baseline.analyzer_timeout) changed.push("analyzer_timeout");
    if (config.debug_default !== baseline.debug_default) changed.push("debug_default");
    return changed;
  }, [baseline, config]);

  return {
    config,
    loading,
    error,
    dirtyKeys,
    fetchConfig,
    updateConfig,
    reset,
  };
}
