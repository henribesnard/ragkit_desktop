import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { Toggle } from "@/components/ui/Toggle";
import { EmbeddingProvider, ModelInfo, useEmbeddingConfig } from "@/hooks/useEmbeddingConfig";

const CLOUD_PROVIDERS: EmbeddingProvider[] = ["openai", "cohere", "voyageai", "mistral"];

const PROFILE_EXAMPLES: Record<string, { a: string; b: string }> = {
  technical_documentation: {
    a: "Comment configurer OAuth2 dans l'API REST ?",
    b: "Configuration de l'authentification et gestion des tokens d'accès",
  },
  faq_support: {
    a: "Je n'arrive pas à me connecter à mon compte",
    b: "Problème de connexion et réinitialisation du mot de passe",
  },
  legal_compliance: {
    a: "Les obligations du prestataire sont définies à l'article 5",
    b: "Article 5 — responsabilités et obligations contractuelles",
  },
  reports_analysis: {
    a: "Le chiffre d'affaires a progressé de 12% au T3 2024",
    b: "Croissance des revenus sur le troisième trimestre",
  },
  general: {
    a: "Les effets du changement climatique sur l'agriculture",
    b: "Impact du réchauffement global sur les cultures",
  },
};

function ModifiedBadge({ dirty }: { dirty: boolean }) {
  return dirty ? <Badge className="ml-2">Modifié</Badge> : null;
}

function similarityLabel(value: number): string {
  if (value < 0.3) return "Faible";
  if (value < 0.6) return "Modérée";
  if (value < 0.8) return "Élevée";
  return "Très élevée";
}

export function EmbeddingSettings() {
  const { config, models, environment, cacheStats, loading, error, dirtyKeys, updateConfig, setProvider, refreshEnvironment, refreshCacheStats, reset } = useEmbeddingConfig();
  const [apiKey, setApiKey] = useState("");
  const [editingKey, setEditingKey] = useState(false);
  const [connection, setConnection] = useState<any>(null);
  const [test, setTest] = useState<any>(null);
  const [profile, setProfile] = useState<string>("general");
  const [textA, setTextA] = useState(PROFILE_EXAMPLES.general.a);
  const [textB, setTextB] = useState(PROFILE_EXAMPLES.general.b);
  const [fetchedQueryModels, setFetchedQueryModels] = useState<ModelInfo[]>([]);

  const keyName = useMemo(() => (config ? `ragkit.embedding.${config.provider}.api_key` : ""), [config]);
  const queryProvider = config?.query_model.provider || config?.provider;
  const requiresApiKey = config ? CLOUD_PROVIDERS.includes(config.provider) : false;

  const selectedModel = useMemo(() => models.find((item) => item.id === config?.model), [models, config?.model]);
  const queryModels = useMemo(() => {
    if (!config) return [] as ModelInfo[];
    if (config.query_model.same_as_document) return models;
    return fetchedQueryModels;
  }, [config, models, fetchedQueryModels]);

  const selectedQueryModel = useMemo(() => {
    if (!config) return null;
    if (config.query_model.same_as_document) return selectedModel || null;
    return queryModels.find((item) => item.id === config.query_model.model) || null;
  }, [config, queryModels, selectedModel]);

  const dimensionMismatch = useMemo(() => {
    if (!config || !selectedModel || !selectedQueryModel) return false;
    const docDimensions = config.dimensions || selectedModel.dimensions_default;
    const queryDimensions = config.query_model.same_as_document
      ? docDimensions
      : selectedQueryModel.dimensions_default;
    return Boolean(docDimensions && queryDimensions && docDimensions !== queryDimensions);
  }, [config, selectedModel, selectedQueryModel]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await invoke<{ profile?: string }>("get_current_profile");
        const nextProfile = response.profile || "general";
        if (cancelled) return;
        setProfile(nextProfile);
        const samples = PROFILE_EXAMPLES[nextProfile] || PROFILE_EXAMPLES.general;
        setTextA(samples.a);
        setTextB(samples.b);
      } catch {
        if (!cancelled) {
          const samples = PROFILE_EXAMPLES.general;
          setTextA(samples.a);
          setTextB(samples.b);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config) return;
    if (config.query_model.same_as_document) {
      return;
    }
    void invoke<ModelInfo[]>("get_available_models", { provider: queryProvider }).then((available) => {
      setFetchedQueryModels(available || []);
    });
  }, [config, queryProvider]);

  if (loading || !config) return <div>Chargement embedding...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  const saveKey = async () => {
    await invoke("store_secret", { keyName, value: apiKey });
    setApiKey("");
    setEditingKey(false);
    await updateConfig({ api_key_set: true });
  };

  const deleteKey = async () => {
    if (!confirm("Supprimer la clé API stockée ?")) return;
    await invoke("delete_secret", { keyName });
    await updateConfig({ api_key_set: false });
  };

  const runConnection = async () => {
    const result = await invoke("test_embedding_connection", { provider: config.provider, model: config.model });
    setConnection(result);
  };

  const runEmbeddingTest = async () => {
    const result = await invoke("test_embedding", { textA, textB });
    setTest(result);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Environnement détecté</h3>
          <Button variant="outline" onClick={() => void refreshEnvironment()}>Rafraîchir</Button>
        </div>
        <p>GPU: {environment?.gpu_available ? `${environment?.gpu_name || "détecté"} (${environment?.gpu_backend || "auto"})` : "non détecté"}</p>
        <p>Ollama: {environment?.ollama_available ? `installé (${environment?.ollama_version || "ok"})` : "non détecté"}</p>
        <p>Modèles Ollama: {(environment?.ollama_embedding_models || []).join(", ") || "—"}</p>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Modèle de documents</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Provider</label>
            <select
              className="block w-full rounded-md border p-2 bg-white dark:bg-gray-800"
              value={config.provider}
              onChange={(event) => void setProvider(event.target.value as EmbeddingProvider)}
            >
              {(["openai", "ollama", "huggingface", "cohere", "voyageai", "mistral"] as EmbeddingProvider[]).map((provider) => {
                const disabled = provider === "ollama" && !environment?.ollama_available;
                const label = provider === "huggingface" ? "HuggingFace (Local)" : provider === "ollama" ? "Ollama (Local)" : `${provider.charAt(0).toUpperCase() + provider.slice(1)} (API)`;
                return (
                  <option key={provider} value={provider} disabled={disabled}>
                    {label}{disabled ? " - Non détecté" : ""}
                  </option>
                );
              })}
            </select>
            <ModifiedBadge dirty={dirtyKeys.includes("provider")} />
          </div>
          <Select
            value={config.model}
            onChange={(event) => void updateConfig({ model: event.target.value })}
            label="Modèle"
            options={models.map((model) => ({ value: model.id, label: model.display_name }))}
          />
        </div>
        <ModifiedBadge dirty={dirtyKeys.includes("model")} />

        {selectedModel && (
          <div className="rounded border p-3 text-sm bg-gray-50 dark:bg-gray-900/40">
            <p><b>Dimensions:</b> {selectedModel.dimensions_default} (supportées: {(selectedModel.dimensions_supported || []).join(", ") || "fixes"})</p>
            <p><b>Max tokens:</b> {selectedModel.max_input_tokens ?? "n/a"}</p>
            <p><b>Coût:</b> {selectedModel.pricing_hint || "n/a"}</p>
            <p><b>Langues:</b> {selectedModel.languages || "n/a"}</p>
            <p><b>Description:</b> {selectedModel.description}</p>
          </div>
        )}

        {requiresApiKey && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Clé API</label>
            <div className="flex items-center gap-2">
              {config.api_key_set && !editingKey ? (
                <>
                  <span className="text-green-600">Clé configurée</span>
                  <Button variant="outline" size="sm" onClick={() => setEditingKey(true)}>Modifier</Button>
                  <Button variant="ghost" size="sm" onClick={() => void deleteKey()}>Supprimer</Button>
                </>
              ) : (
                <>
                  <input
                    className="border rounded px-2 py-1 flex-1"
                    type="password"
                    placeholder="Saisir la clé API"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                  <Button size="sm" onClick={() => void saveKey()} disabled={!apiKey}>Enregistrer</Button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {dirtyKeys.includes("provider") || dirtyKeys.includes("model") || dirtyKeys.includes("api_key_set") || connection ? (
            <>
              <Button onClick={() => void runConnection()}>Tester la connexion</Button>
              {connection && (
                <span className={connection.success ? "text-green-600 text-sm" : "text-red-600 text-sm"}>
                  {connection.success
                    ? `${connection.message} · ${connection.dimensions} dims · ${connection.latency_ms} ms`
                    : connection.message}
                </span>
              )}
            </>
          ) : (
            <div className="text-sm px-3 py-1.5 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 font-medium">
              ✓ Modèle configuré et vérifié
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Modèle de requêtes</h3>
        <Toggle
          checked={config.query_model.same_as_document}
          onChange={(checked) => void updateConfig({ query_model: { ...config.query_model, same_as_document: checked } })}
          label="Utiliser le même modèle que les documents"
        />
        <ModifiedBadge dirty={dirtyKeys.includes("query_model")} />

        {!config.query_model.same_as_document && (
          <div className="grid md:grid-cols-2 gap-3">
            <Select
              value={queryProvider}
              label="Provider requête"
              onChange={(event) => void updateConfig({ query_model: { ...config.query_model, provider: event.target.value as EmbeddingProvider } })}
              options={(["openai", "ollama", "huggingface", "cohere", "voyageai", "mistral"] as EmbeddingProvider[]).map((provider) => ({
                value: provider,
                label: provider === "huggingface" ? "HuggingFace (Local)" : provider === "ollama" ? "Ollama (Local)" : `${provider.charAt(0).toUpperCase() + provider.slice(1)} (API)`,
                disabled: provider === "ollama" && !environment?.ollama_available
              }))}
            />
            <Select
              value={config.query_model.model || ""}
              label="Modèle requête"
              onChange={(event) => void updateConfig({ query_model: { ...config.query_model, model: event.target.value } })}
              options={(queryModels || []).map((model) => ({ value: model.id, label: model.display_name }))}
            />
          </div>
        )}

        {dimensionMismatch && (
          <p className="text-sm text-amber-700">
            Attention: dimensions différentes entre modèle document et modèle requête. Les vecteurs peuvent être incompatibles.
          </p>
        )}
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Paramètres de vectorisation</h3>
        <div className="grid md:grid-cols-2 gap-3 items-center">
          <input
            className="border rounded px-2 py-1"
            type="number"
            min={64}
            max={4096}
            placeholder="Dimensions (auto si vide)"
            value={config.dimensions ?? ""}
            onChange={(event) => void updateConfig({ dimensions: event.target.value ? Number(event.target.value) : null })}
          />
          <Slider min={1} max={2048} step={1} value={config.batch_size} onChange={(value) => void updateConfig({ batch_size: value })} label="Batch size" />
        </div>
        <Toggle checked={config.normalize} onChange={(checked) => void updateConfig({ normalize: checked })} label="Normalisation L2" />
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Paramètres avancés</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm block">
            Timeout (s)
            <input
              type="number"
              min={5}
              max={120}
              className="mt-1 border rounded px-2 py-1 w-full"
              value={config.timeout}
              onChange={(event) => void updateConfig({ timeout: Number(event.target.value) })}
            />
          </label>
          <label className="text-sm block">
            Retries
            <input
              type="number"
              min={0}
              max={10}
              className="mt-1 border rounded px-2 py-1 w-full"
              value={config.max_retries}
              onChange={(event) => void updateConfig({ max_retries: Number(event.target.value) })}
            />
          </label>
          <label className="text-sm block">
            Rate limit RPM
            <input
              type="number"
              min={0}
              max={10000}
              className="mt-1 border rounded px-2 py-1 w-full"
              value={config.rate_limit_rpm}
              onChange={(event) => void updateConfig({ rate_limit_rpm: Number(event.target.value) })}
            />
          </label>
          <Select
            value={config.truncation}
            label="Truncation"
            onChange={(event) => void updateConfig({ truncation: event.target.value as "start" | "end" | "middle" })}
            options={[
              { value: "start", label: "start" },
              { value: "middle", label: "middle" },
              { value: "end", label: "end" },
            ]}
          />
        </div>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Cache d'embeddings</h3>
        <Toggle checked={config.cache_enabled} onChange={(checked) => void updateConfig({ cache_enabled: checked })} label="Cache activé" />
        <Select
          value={config.cache_backend}
          onChange={(event) => void updateConfig({ cache_backend: event.target.value as "disk" | "memory" })}
          options={[
            { value: "disk", label: "disk" },
            { value: "memory", label: "memory" },
          ]}
        />
        <p className="text-sm">Entrées: {cacheStats?.entries ?? 0} · Taille: {cacheStats?.size_mb ?? 0} MB</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refreshCacheStats()}>Actualiser stats</Button>
          <Button variant="ghost" onClick={() => void invoke("clear_embedding_cache").then(() => refreshCacheStats())}>Vider le cache</Button>
        </div>
        {dirtyKeys.includes("model") && (
          <p className="text-xs text-amber-700">Le changement de modèle invalide automatiquement le cache d'embeddings.</p>
        )}
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Panneau de test d'embedding ({profile})</h3>
        <textarea className="w-full border rounded p-2" rows={3} value={textA} onChange={(event) => setTextA(event.target.value)} />
        <textarea className="w-full border rounded p-2" rows={3} value={textB} onChange={(event) => setTextB(event.target.value)} />
        <Button onClick={() => void runEmbeddingTest()}>Tester l'embedding</Button>
        {test && (
          <div className="text-sm space-y-1">
            <p>Dimensions: <b>{test.dimensions}</b> · Tokens A/B: <b>{test.tokens_a}</b>/<b>{test.tokens_b}</b></p>
            <p>Latence A/B: {test.latency_ms_a}ms / {test.latency_ms_b}ms</p>
            <p>Similarité cosinus: <b>{test.cosine_similarity}</b> ({similarityLabel(test.cosine_similarity)})</p>
            <div className="h-2 rounded bg-gray-200 overflow-hidden">
              <div className="h-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, Math.round(test.cosine_similarity * 100)))}%` }} />
            </div>
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          className="text-red-600"
          onClick={() => {
            if (confirm("Réinitialiser la configuration embedding au profil actif ?")) {
              void reset();
            }
          }}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Réinitialiser au profil
        </Button>
      </div>
    </div>
  );
}
