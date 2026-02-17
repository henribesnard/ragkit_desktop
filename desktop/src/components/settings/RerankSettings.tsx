import { useEffect, useMemo, useState } from "react";
import { KeyRound, Plug, RotateCcw, TestTubeDiagonal } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { Toggle } from "@/components/ui/Toggle";
import { useHybridSearchConfig } from "@/hooks/useHybridSearchConfig";
import { RerankModelInfo, useRerankTest } from "@/hooks/useRerankTest";
import { useRerankConfig } from "@/hooks/useRerankConfig";

function ModifiedBadge({ dirty }: { dirty: boolean }) {
  return dirty ? <Badge className="ml-2">Modifie</Badge> : null;
}

function scoreLabel(score: number): string {
  if (score >= 0.8) return "Tres pertinent";
  if (score >= 0.5) return "Pertinent";
  if (score >= 0.2) return "Faible";
  return "Peu pertinent";
}

export function RerankSettings() {
  const { config, loading, error, dirtyKeys, updateConfig, reset, setCohereApiKey, deleteCohereApiKey } = useRerankConfig();
  const { config: hybridConfig } = useHybridSearchConfig();
  const { loading: testing, error: testError, testConnection, testRerank, getModels } = useRerankTest();

  const [models, setModels] = useState<RerankModelInfo[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [testQuery, setTestQuery] = useState("conditions de resiliation du contrat");
  const [testDocA, setTestDocA] = useState("L'article 12 definit les conditions de resiliation anticipee du contrat.");
  const [testDocB, setTestDocB] = useState("Le contrat prend effet a la date de signature.");
  const [testResults, setTestResults] = useState<{ text: string; score: number; rank: number }[]>([]);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  const providerOptions = [
    { value: "none", label: "Desactive" },
    { value: "cohere", label: "Cohere (cloud)" },
    { value: "local", label: "Local (HuggingFace)" },
  ];

  useEffect(() => {
    if (config.provider !== "cohere" && config.provider !== "local") {
      setModels([]);
      return;
    }
    const provider = config.provider;
    let cancelled = false;
    void (async () => {
      setModelLoading(true);
      try {
        const fetched = await getModels(provider);
        if (cancelled) return;
        setModels(fetched);
        if (!config.model && fetched.length > 0) {
          await updateConfig({ model: fetched[0].id });
        }
      } catch {
        if (!cancelled) {
          setModels([]);
        }
      } finally {
        if (!cancelled) setModelLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config.provider]);

  const modelOptions = useMemo(
    () =>
      models.map((model) => ({
        value: model.id,
        label: model.name,
      })),
    [models],
  );

  const selectedModel = useMemo(
    () => models.find((model) => model.id === config.model) || null,
    [models, config.model],
  );

  if (loading) {
    return <div>Chargement...</div>;
  }
  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
        <h3 className="font-semibold">Reranking</h3>

        <div>
          <Toggle
            checked={config.enabled}
            onChange={(value) => {
              setConnectionMessage(null);
              void updateConfig({ enabled: value });
            }}
            label="Activer le reranking"
          />
          <p className="text-xs text-gray-500 mt-1">
            Reevalue les meilleurs candidats avec un cross-encoder pour ameliorer le classement final.
          </p>
          <ModifiedBadge dirty={dirtyKeys.includes("enabled")} />
        </div>

        <div>
          <Select
            label="Provider"
            options={providerOptions}
            value={config.provider}
            onChange={(event) => {
              const provider = event.target.value as "none" | "cohere" | "local";
              setConnectionMessage(null);
              void updateConfig({
                provider,
                model: provider === "none" ? null : config.model,
              });
            }}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("provider")} />
        </div>

        {config.provider !== "none" && (
          <div>
            <Select
              label="Modele"
              options={modelOptions}
              value={config.model || ""}
              onChange={(event) => {
                setConnectionMessage(null);
                void updateConfig({ model: event.target.value });
              }}
            />
            {modelLoading && <p className="text-xs text-gray-500 mt-1">Chargement des modeles...</p>}
            {!modelLoading && selectedModel && (
              <div className="mt-2 border rounded-md p-2 text-xs text-gray-600 dark:text-gray-300">
                <div>Contexte max: {selectedModel.max_context} tokens</div>
                <div>Langues: {selectedModel.languages}</div>
                <div>Qualite: {selectedModel.quality_rating}/5</div>
                {selectedModel.cost_per_1k ? <div>Cout: {selectedModel.cost_per_1k}</div> : null}
                {selectedModel.size_mb ? <div>Taille: {selectedModel.size_mb} MB</div> : null}
                {selectedModel.latency_hint ? <div>Latence: {selectedModel.latency_hint}</div> : null}
              </div>
            )}
            <ModifiedBadge dirty={dirtyKeys.includes("model")} />
          </div>
        )}

        {config.provider === "cohere" && (
          <div className="space-y-2 rounded-md border p-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              Cle API Cohere
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
                  if (!apiKeyInput.trim()) return;
                  void (async () => {
                    await setCohereApiKey(apiKeyInput.trim());
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
                  void (async () => {
                    await deleteCohereApiKey();
                    setConnectionMessage("Cle API supprimee.");
                  })();
                }}
              >
                Supprimer
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Statut cle API: {config.api_key_set ? "configuree" : "absente"}
            </p>
          </div>
        )}

        {config.provider !== "none" && (
          <div className="space-y-3 rounded-md border p-3">
            <h4 className="font-medium text-sm">Selection des resultats</h4>

            <div>
              <Slider
                value={config.candidates}
                min={5}
                max={100}
                step={1}
                label="Candidats envoyes au reranker"
                onChange={(value) => {
                  const candidates = Math.round(value);
                  void updateConfig({
                    candidates,
                    top_n: Math.min(config.top_n, candidates),
                  });
                }}
              />
              <ModifiedBadge dirty={dirtyKeys.includes("candidates")} />
            </div>

            <div>
              <Slider
                value={config.top_n}
                min={1}
                max={config.candidates}
                step={1}
                label="Resultats finaux (top_n)"
                onChange={(value) => void updateConfig({ top_n: Math.round(value) })}
              />
              <ModifiedBadge dirty={dirtyKeys.includes("top_n")} />
            </div>

            <div>
              <Slider
                value={config.relevance_threshold}
                min={0}
                max={1}
                step={0.01}
                label="Seuil de pertinence"
                formatValue={(value) => value.toFixed(2)}
                onChange={(value) => void updateConfig({ relevance_threshold: Number(value.toFixed(2)) })}
              />
              <ModifiedBadge dirty={dirtyKeys.includes("relevance_threshold")} />
            </div>

            {config.candidates > hybridConfig.top_k && (
              <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Attention: `candidates` ({config.candidates}) depasse `hybrid.top_k` ({hybridConfig.top_k}). Le backend ajustera
                automatiquement le budget de recherche.
              </div>
            )}
          </div>
        )}

        {config.provider !== "none" && (
          <div className="space-y-3 rounded-md border p-3">
            <h4 className="font-medium text-sm">Parametres avances</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Slider
                  value={config.batch_size}
                  min={1}
                  max={64}
                  step={1}
                  label="Batch size"
                  onChange={(value) => void updateConfig({ batch_size: Math.round(value) })}
                />
                <ModifiedBadge dirty={dirtyKeys.includes("batch_size")} />
              </div>
              <div>
                <Slider
                  value={config.timeout}
                  min={5}
                  max={120}
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
                  max={10}
                  step={1}
                  label="Max retries"
                  onChange={(value) => void updateConfig({ max_retries: Math.round(value) })}
                />
                <ModifiedBadge dirty={dirtyKeys.includes("max_retries")} />
              </div>
              <div>
                <Toggle
                  checked={config.debug_default}
                  onChange={(value) => void updateConfig({ debug_default: value })}
                  label="Mode debug par defaut"
                />
                <ModifiedBadge dirty={dirtyKeys.includes("debug_default")} />
              </div>
            </div>
          </div>
        )}

        {config.provider !== "none" && (
          <div className="space-y-3 rounded-md border p-3">
            <h4 className="font-medium text-sm">Test du reranker</h4>

            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={testing}
                onClick={() => {
                  setConnectionMessage(null);
                  void (async () => {
                    const response = await testConnection();
                    if (response.success) {
                      setConnectionMessage(`Connexion reussie (${response.latency_ms} ms)`);
                    } else {
                      setConnectionMessage(response.error || "Echec de connexion");
                    }
                  })();
                }}
              >
                <Plug className="w-4 h-4 mr-2" />
                Tester la connexion
              </Button>
              {connectionMessage ? <span className="text-xs self-center text-gray-600">{connectionMessage}</span> : null}
            </div>

            <div className="grid gap-2">
              <label className="text-sm">
                Requete test
                <input
                  value={testQuery}
                  onChange={(event) => setTestQuery(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                Document test 1
                <textarea
                  value={testDocA}
                  onChange={(event) => setTestDocA(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  rows={3}
                />
              </label>
              <label className="text-sm">
                Document test 2
                <textarea
                  value={testDocB}
                  onChange={(event) => setTestDocB(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  rows={3}
                />
              </label>
            </div>

            <div className="flex gap-2 items-center">
              <Button
                disabled={testing || !testQuery.trim() || !testDocA.trim() || !testDocB.trim()}
                onClick={() => {
                  setTestResults([]);
                  setTestLatency(null);
                  void (async () => {
                    const response = await testRerank(testQuery.trim(), [testDocA.trim(), testDocB.trim()]);
                    if (!response.success) {
                      setConnectionMessage(response.error || "Test reranking en echec");
                      return;
                    }
                    setTestResults(response.results || []);
                    setTestLatency(response.latency_ms);
                  })();
                }}
              >
                <TestTubeDiagonal className="w-4 h-4 mr-2" />
                Tester le reranking
              </Button>
              {testError ? <span className="text-xs text-red-600">{testError}</span> : null}
            </div>

            {testResults.length > 0 && (
              <div className="rounded border border-gray-200 dark:border-gray-700 p-2 text-xs space-y-1">
                {testResults.map((result) => (
                  <div key={`${result.rank}-${result.score}`} className="flex items-center justify-between gap-3">
                    <span>
                      #{result.rank} {result.text}
                    </span>
                    <span className="font-mono">{result.score.toFixed(3)} - {scoreLabel(result.score)}</span>
                  </div>
                ))}
                {testLatency !== null ? <div className="text-gray-500">Latence: {testLatency} ms</div> : null}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          className="text-red-600 hover:text-red-700"
          onClick={() => {
            if (confirm("Reinitialiser les parametres de reranking au profil actif ?")) {
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
