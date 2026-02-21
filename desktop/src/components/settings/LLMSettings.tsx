import { useEffect, useMemo, useState } from "react";
import { KeyRound, Plug, RotateCcw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { Toggle } from "@/components/ui/Toggle";
import { DEFAULT_LLM_SYSTEM_PROMPT, useLLMConfig } from "@/hooks/useLLMConfig";
import { LLMModelInfo, useLLMTest } from "@/hooks/useLLMTest";

function ModifiedBadge({ dirty }: { dirty: boolean }) {
  return dirty ? <Badge className="ml-2">Modifie</Badge> : null;
}

function apiKeyProvider(provider: string): "openai" | "anthropic" | "mistral" | null {
  if (provider === "openai" || provider === "anthropic" || provider === "mistral") return provider;
  return null;
}

export function LLMSettings() {
  const { config, loading, error, dirtyKeys, updateConfig, reset, setApiKey, deleteApiKey } = useLLMConfig();
  const { loading: testing, error: testError, testConnection, getModels } = useLLMTest();

  const [models, setModels] = useState<LLMModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [ollamaAvailable, setOllamaAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const env = await invoke<{ ollama_available?: boolean }>("detect_environment");
        if (!cancelled) setOllamaAvailable(Boolean(env.ollama_available ?? true));
      } catch {
        if (!cancelled) setOllamaAvailable(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setModelsLoading(true);
      try {
        const provider = config.provider;
        const fetched = await getModels(provider);
        if (cancelled) return;
        setModels(fetched);
        if (fetched.length > 0 && !fetched.some((item) => item.id === config.model)) {
          await updateConfig({ model: fetched[0].id });
        }
      } catch {
        if (!cancelled) setModels([]);
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.provider]);

  const providerOptions = [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "ollama", label: ollamaAvailable ? "Ollama (local)" : "Ollama (indisponible)", disabled: !ollamaAvailable },
    { value: "mistral", label: "Mistral AI" },
  ];

  const modelOptions = useMemo(
    () =>
      models.map((model) => ({
        value: model.id,
        label: model.name,
      })),
    [models],
  );
  const selectedModel = useMemo(() => models.find((item) => item.id === config.model) || null, [models, config.model]);

  if (loading) return <div>Chargement...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
        <h3 className="font-semibold">LLM / Generation</h3>

        <div>
          <Select
            label="Provider"
            options={providerOptions}
            value={config.provider}
            onChange={(event) => {
              const provider = event.target.value as typeof config.provider;
              if (provider === "ollama" && !ollamaAvailable) return;
              void updateConfig({ provider });
            }}
          />
          {!ollamaAvailable ? <p className="text-xs text-amber-700 mt-1">Ollama non detecte localement.</p> : null}
          <ModifiedBadge dirty={dirtyKeys.includes("provider")} />
        </div>

        <div>
          <Select
            label="Modele"
            options={modelOptions}
            value={config.model}
            onChange={(event) => void updateConfig({ model: event.target.value })}
          />
          {modelsLoading ? <p className="text-xs text-gray-500 mt-1">Chargement des modeles...</p> : null}
          {!modelsLoading && selectedModel ? (
            <div className="mt-2 border rounded-md p-2 text-xs text-gray-600 dark:text-gray-300">
              <div>Contexte: {selectedModel.context_window} tokens</div>
              <div>Langues: {selectedModel.languages}</div>
              <div>Qualite: {selectedModel.quality_rating}/5</div>
              {selectedModel.cost_input ? <div>Cout input: {selectedModel.cost_input}</div> : null}
              {selectedModel.cost_output ? <div>Cout output: {selectedModel.cost_output}</div> : null}
              {selectedModel.latency_hint ? <div>Latence: {selectedModel.latency_hint}</div> : null}
            </div>
          ) : null}
          <ModifiedBadge dirty={dirtyKeys.includes("model")} />
        </div>

        {apiKeyProvider(config.provider) ? (
          <div className="space-y-2 rounded-md border p-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              Cle API ({config.provider})
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
                placeholder={config.api_key_set ? "Cle configuree" : "Collez votre cle API"}
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
              <Button
                variant="outline"
                onClick={() => {
                  const provider = apiKeyProvider(config.provider);
                  if (!provider || !apiKeyInput.trim()) return;
                  void (async () => {
                    await setApiKey(provider, apiKeyInput.trim());
                    setApiKeyInput("");
                    setConnectionMessage("Cle API enregistree.");
                  })();
                }}
              >
                Enregistrer
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const provider = apiKeyProvider(config.provider);
                  if (!provider) return;
                  void (async () => {
                    await deleteApiKey(provider);
                    setConnectionMessage("Cle API supprimee.");
                  })();
                }}
              >
                Supprimer
              </Button>
            </div>
            <p className="text-xs text-gray-500">Statut: {config.api_key_set ? "configuree" : "absente"}</p>
          </div>
        ) : null}

        <div className="space-y-3 rounded-md border p-3">
          <h4 className="font-medium text-sm">Generation</h4>
          <div>
            <Slider
              value={config.temperature}
              min={0}
              max={2}
              step={0.05}
              label="Temperature"
              formatValue={(value) => value.toFixed(2)}
              onChange={(value) => void updateConfig({ temperature: Number(value.toFixed(2)) })}
            />
            <ModifiedBadge dirty={dirtyKeys.includes("temperature")} />
          </div>
          <div>
            <Slider
              value={config.max_tokens}
              min={100}
              max={8192}
              step={50}
              label="Max tokens"
              onChange={(value) => void updateConfig({ max_tokens: Math.round(value) })}
            />
            <ModifiedBadge dirty={dirtyKeys.includes("max_tokens")} />
          </div>
          <div>
            <Slider
              value={config.top_p}
              min={0}
              max={1}
              step={0.01}
              label="Top P"
              formatValue={(value) => value.toFixed(2)}
              onChange={(value) => void updateConfig({ top_p: Number(value.toFixed(2)) })}
            />
            <ModifiedBadge dirty={dirtyKeys.includes("top_p")} />
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <h4 className="font-medium text-sm">Comportement</h4>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Toggle checked={config.cite_sources} onChange={(value) => void updateConfig({ cite_sources: value })} label="Citer les sources" />
              <ModifiedBadge dirty={dirtyKeys.includes("cite_sources")} />
            </div>
            <div>
              <Toggle
                checked={config.admit_uncertainty}
                onChange={(value) => void updateConfig({ admit_uncertainty: value })}
                label="Admettre l'incertitude"
              />
              <ModifiedBadge dirty={dirtyKeys.includes("admit_uncertainty")} />
            </div>
          </div>

          <div>
            <Select
              label="Format citations"
              options={[
                { value: "inline", label: "Inline [Source: ...]" },
                { value: "footnote", label: "Footnotes 1,2,3" },
              ]}
              value={config.citation_format}
              onChange={(event) => void updateConfig({ citation_format: event.target.value as "inline" | "footnote" })}
            />
            <ModifiedBadge dirty={dirtyKeys.includes("citation_format")} />
          </div>

          <div>
            <Select
              label="Langue de reponse"
              options={[
                { value: "auto", label: "Auto" },
                { value: "fr", label: "Francais" },
                { value: "en", label: "English" },
              ]}
              value={config.response_language}
              onChange={(event) => void updateConfig({ response_language: event.target.value as "auto" | "fr" | "en" })}
            />
            <ModifiedBadge dirty={dirtyKeys.includes("response_language")} />
          </div>

          <div>
            <label className="text-sm font-medium">Phrase d'incertitude</label>
            <input
              value={config.uncertainty_phrase}
              onChange={(event) => void updateConfig({ uncertainty_phrase: event.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
            <ModifiedBadge dirty={dirtyKeys.includes("uncertainty_phrase")} />
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <h4 className="font-medium text-sm">Contexte</h4>
          <div>
            <Slider
              value={config.context_max_chunks}
              min={1}
              max={30}
              step={1}
              label="Max chunks"
              onChange={(value) => void updateConfig({ context_max_chunks: Math.round(value) })}
            />
            <ModifiedBadge dirty={dirtyKeys.includes("context_max_chunks")} />
          </div>
          <div>
            <Slider
              value={config.context_max_tokens}
              min={500}
              max={32000}
              step={100}
              label="Max tokens contexte"
              onChange={(value) => void updateConfig({ context_max_tokens: Math.round(value) })}
            />
            <ModifiedBadge dirty={dirtyKeys.includes("context_max_tokens")} />
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <h4 className="font-medium text-sm">Prompt systeme</h4>
          <textarea
            value={config.system_prompt}
            onChange={(event) => void updateConfig({ system_prompt: event.target.value })}
            className="w-full min-h-40 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
          <ModifiedBadge dirty={dirtyKeys.includes("system_prompt")} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void updateConfig({ system_prompt: DEFAULT_LLM_SYSTEM_PROMPT })}>
              Restaurer le prompt par defaut
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <h4 className="font-medium text-sm">Avance</h4>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Slider
                value={config.timeout}
                min={10}
                max={300}
                step={1}
                label="Timeout (s)"
                onChange={(value) => void updateConfig({ timeout: Math.round(value) })}
              />
              <ModifiedBadge dirty={dirtyKeys.includes("timeout")} />
            </div>
            <div>
              <Slider
                value={config.max_retries}
                min={0}
                max={5}
                step={1}
                label="Max retries"
                onChange={(value) => void updateConfig({ max_retries: Math.round(value) })}
              />
              <ModifiedBadge dirty={dirtyKeys.includes("max_retries")} />
            </div>
            <div>
              <Toggle checked={config.streaming} onChange={(value) => void updateConfig({ streaming: value })} label="Streaming actif" />
              <ModifiedBadge dirty={dirtyKeys.includes("streaming")} />
            </div>
            <div>
              <Toggle checked={config.debug_default} onChange={(value) => void updateConfig({ debug_default: value })} label="Debug par defaut" />
              <ModifiedBadge dirty={dirtyKeys.includes("debug_default")} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            disabled={testing}
            onClick={() => {
              setConnectionMessage(null);
              void (async () => {
                const result = await testConnection();
                if (result.success) {
                  setConnectionMessage(`Connexion reussie (${result.latency_ms} ms)`);
                } else {
                  setConnectionMessage(result.error || "Echec de connexion");
                }
              })();
            }}
          >
            <Plug className="w-4 h-4 mr-2" />
            Tester la connexion
          </Button>
          {connectionMessage ? <div className="text-xs text-gray-600">{connectionMessage}</div> : null}
          {testError ? <div className="text-xs text-red-600">{testError}</div> : null}
        </div>
      </section>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          className="text-red-600 hover:text-red-700"
          onClick={() => {
            if (confirm("Reinitialiser les parametres LLM au profil actif ?")) {
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
