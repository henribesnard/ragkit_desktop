import { RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { Toggle } from "@/components/ui/Toggle";
import {
  AgentIntent,
  DEFAULT_PROMPT_ANALYZER,
  DEFAULT_PROMPT_GREETING,
  DEFAULT_PROMPT_OOS,
  DEFAULT_PROMPT_REWRITING,
  useAgentsConfig,
} from "@/hooks/useAgentsConfig";

function ModifiedBadge({ dirty }: { dirty: boolean }) {
  return dirty ? <Badge className="ml-2">Modifie</Badge> : null;
}

const intentLabels: Record<AgentIntent, string> = {
  question: "Question",
  greeting: "Salutation",
  chitchat: "Chitchat",
  out_of_scope: "Hors perimetre",
  clarification: "Clarification",
};

export function AgentsSettings() {
  const { config, loading, error, dirtyKeys, updateConfig, reset } = useAgentsConfig();

  if (loading) return <div>Chargement...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  const toggleIntent = (intent: AgentIntent) => {
    if (intent === "question") return;
    const exists = config.detect_intents.includes(intent);
    const next = exists
      ? config.detect_intents.filter((value) => value !== intent)
      : [...config.detect_intents, intent];
    void updateConfig({ detect_intents: next });
  };

  return (
    <div className="space-y-6">
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
        <h3 className="font-semibold">Agents</h3>

        <div className="space-y-2 rounded-md border p-3">
          <h4 className="font-medium text-sm">Query Analyzer</h4>
          <Toggle
            checked={config.always_retrieve}
            onChange={(value) => void updateConfig({ always_retrieve: value })}
            label="Toujours lancer la recherche RAG"
          />
          <ModifiedBadge dirty={dirtyKeys.includes("always_retrieve")} />
          <div className="space-y-2">
            <p className="text-sm font-medium">Intentions actives</p>
            {(["question", "greeting", "chitchat", "out_of_scope", "clarification"] as AgentIntent[]).map((intent) => (
              <label key={intent} className={`flex items-center gap-2 text-sm ${intent === "question" ? "opacity-80" : ""}`}>
                <input
                  type="checkbox"
                  checked={config.detect_intents.includes(intent)}
                  disabled={intent === "question"}
                  onChange={() => toggleIntent(intent)}
                />
                {intentLabels[intent]}
                {intent === "question" ? <span className="text-xs text-gray-500">(obligatoire)</span> : null}
              </label>
            ))}
          </div>
          <ModifiedBadge dirty={dirtyKeys.includes("detect_intents")} />
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <h4 className="font-medium text-sm">Query Rewriting</h4>
          <Toggle
            checked={config.query_rewriting.enabled}
            onChange={(value) => void updateConfig({ query_rewriting: { ...config.query_rewriting, enabled: value } })}
            label="Reformulation automatique"
          />
          <ModifiedBadge dirty={dirtyKeys.includes("query_rewriting.enabled")} />
          <Slider
            value={config.query_rewriting.num_rewrites}
            min={0}
            max={5}
            step={1}
            label="Nombre de reformulations"
            onChange={(value) =>
              void updateConfig({
                query_rewriting: {
                  ...config.query_rewriting,
                  num_rewrites: Math.round(value),
                },
              })
            }
          />
          <ModifiedBadge dirty={dirtyKeys.includes("query_rewriting.num_rewrites")} />
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <h4 className="font-medium text-sm">Historique</h4>
          <Slider
            value={config.max_history_messages}
            min={0}
            max={50}
            step={1}
            label="Messages d'historique"
            onChange={(value) => void updateConfig({ max_history_messages: Math.round(value) })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("max_history_messages")} />
          <Select
            label="Strategie memoire"
            value={config.memory_strategy}
            onChange={(event) =>
              void updateConfig({ memory_strategy: event.target.value as "sliding_window" | "summary" })
            }
            options={[
              { value: "sliding_window", label: "Fenetre glissante" },
              { value: "summary", label: "Resume" },
            ]}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("memory_strategy")} />
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <h4 className="font-medium text-sm">Prompts</h4>

          <div>
            <label className="text-sm font-medium">Prompt Query Analyzer</label>
            <textarea
              value={config.prompt_analyzer}
              onChange={(event) => void updateConfig({ prompt_analyzer: event.target.value })}
              className="mt-1 w-full min-h-28 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => void updateConfig({ prompt_analyzer: DEFAULT_PROMPT_ANALYZER })}>
                Restaurer le prompt par defaut
              </Button>
              <ModifiedBadge dirty={dirtyKeys.includes("prompt_analyzer")} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Prompt Query Rewriting</label>
            <textarea
              value={config.prompt_rewriting}
              onChange={(event) => void updateConfig({ prompt_rewriting: event.target.value })}
              className="mt-1 w-full min-h-28 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => void updateConfig({ prompt_rewriting: DEFAULT_PROMPT_REWRITING })}>
                Restaurer le prompt par defaut
              </Button>
              <ModifiedBadge dirty={dirtyKeys.includes("prompt_rewriting")} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Prompt Greeting</label>
            <textarea
              value={config.prompt_greeting}
              onChange={(event) => void updateConfig({ prompt_greeting: event.target.value })}
              className="mt-1 w-full min-h-24 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => void updateConfig({ prompt_greeting: DEFAULT_PROMPT_GREETING })}>
                Restaurer le prompt par defaut
              </Button>
              <ModifiedBadge dirty={dirtyKeys.includes("prompt_greeting")} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Prompt Out of Scope</label>
            <textarea
              value={config.prompt_out_of_scope}
              onChange={(event) => void updateConfig({ prompt_out_of_scope: event.target.value })}
              className="mt-1 w-full min-h-24 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => void updateConfig({ prompt_out_of_scope: DEFAULT_PROMPT_OOS })}>
                Restaurer le prompt par defaut
              </Button>
              <ModifiedBadge dirty={dirtyKeys.includes("prompt_out_of_scope")} />
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <h4 className="font-medium text-sm">Avance</h4>
          <label className="text-sm block">
            Modele Analyzer (optionnel)
            <input
              value={config.analyzer_model || ""}
              onChange={(event) => {
                const value = event.target.value.trim();
                void updateConfig({ analyzer_model: value ? value : null });
              }}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="meme modele que principal"
            />
          </label>
          <ModifiedBadge dirty={dirtyKeys.includes("analyzer_model")} />
          <Slider
            value={config.analyzer_timeout}
            min={5}
            max={60}
            step={1}
            label="Timeout analyzer (s)"
            onChange={(value) => void updateConfig({ analyzer_timeout: Math.round(value) })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("analyzer_timeout")} />
          <Toggle
            checked={config.debug_default}
            onChange={(value) => void updateConfig({ debug_default: value })}
            label="Mode debug active par defaut"
          />
          <ModifiedBadge dirty={dirtyKeys.includes("debug_default")} />
        </div>
      </section>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          className="text-red-600 hover:text-red-700"
          onClick={() => {
            if (confirm("Reinitialiser les parametres agents au profil actif ?")) {
              void reset();
            }
          }}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reinitialiser au profil
        </Button>
      </div>
    </div>
  );
}
