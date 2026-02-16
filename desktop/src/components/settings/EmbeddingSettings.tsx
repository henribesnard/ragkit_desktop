import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { Toggle } from "@/components/ui/Toggle";
import { useEmbeddingConfig } from "@/hooks/useEmbeddingConfig";

const EXAMPLES: Record<string, { a: string; b: string }> = {
  technical_documentation: { a: "Comment configurer OAuth2 dans l'API REST ?", b: "Configuration de l'authentification et des tokens d'accès" },
  faq_support: { a: "Je n'arrive pas à me connecter à mon compte", b: "Problème de connexion et réinitialisation du mot de passe" },
  legal_compliance: { a: "Les obligations du prestataire sont définies à l'article 5", b: "Article 5 — Engagements et responsabilités du fournisseur" },
  reports_analysis: { a: "Le chiffre d'affaires a progressé de 12% au T3 2024", b: "Croissance des revenus au troisième trimestre" },
  general: { a: "Les effets du changement climatique sur l'agriculture", b: "Impact du réchauffement global sur les cultures" },
};

export function EmbeddingSettings() {
  const { config, models, environment, cacheStats, loading, error, updateConfig, setProvider, refreshEnvironment, refreshCacheStats, reset } = useEmbeddingConfig();
  const [apiKey, setApiKey] = useState("");
  const [editingKey, setEditingKey] = useState(false);
  const [connection, setConnection] = useState<any>(null);
  const [test, setTest] = useState<any>(null);
  const [textA, setTextA] = useState(EXAMPLES.general.a);
  const [textB, setTextB] = useState(EXAMPLES.general.b);

  const keyName = useMemo(() => (config ? `ragkit.embedding.${config.provider}.api_key` : ""), [config]);

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

  const runConnection = async () => setConnection(await invoke("test_embedding_connection", { provider: config.provider, model: config.model }));
  const runEmbeddingTest = async () => setTest(await invoke("test_embedding", { textA, textB }));

  const similarityLabel = (value: number) => value < 0.3 ? "Faible" : value < 0.6 ? "Modérée" : value < 0.8 ? "Élevée" : "Très élevée";

  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center justify-between"><h3 className="font-medium">Environnement détecté</h3><Button variant="outline" onClick={refreshEnvironment}>↻ Rafraîchir</Button></div>
        <p>GPU : {environment?.gpu_available ? `🟢 ${environment?.gpu_name || "détecté"}` : "⚪ Non détecté"}</p>
        <p>Ollama : {environment?.ollama_available ? `🟢 Installé ${environment?.ollama_version || ""}` : "⚪ Non détecté"}</p>
        <p>Modèles Ollama: {(environment?.ollama_models || []).join(", ") || "—"}</p>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Modèle de documents</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <Select value={config.provider} onChange={(e) => setProvider(e.target.value as any)} options={["openai","ollama","huggingface","cohere","voyageai","mistral"].map(v => ({value:v,label:v}))} />
          <Select value={config.model} onChange={(e) => updateConfig({ model: e.target.value })} options={models.map((m) => ({ value: m.id, label: m.display_name }))} />
        </div>
        <div className="flex items-center gap-2">
          {config.api_key_set && !editingKey ? <><span className="text-green-600">🟢 Clé configurée</span><Button variant="outline" onClick={() => setEditingKey(true)}>✎ Modifier</Button><Button variant="ghost" onClick={deleteKey}>🗑</Button></> : <>
            <input className="border rounded px-2 py-1 flex-1" type="password" placeholder="Saisir la clé API" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            <Button onClick={saveKey} disabled={!apiKey}>Enregistrer</Button>
          </>}
        </div>
        <div className="text-sm text-gray-500">Dimensions supportées: {(models.find((m) => m.id === config.model)?.dimensions_supported || []).join(", ") || "fixe"}</div>
        <div className="flex items-center gap-2">
          <Button onClick={runConnection}>🔌 Tester la connexion</Button>
          {connection && <span className={connection.success ? "text-green-600" : "text-red-600"}>{connection.success ? `🟢 ${connection.message} · ${connection.dimensions} dims · ${connection.latency_ms} ms` : `🔴 ${connection.message}`}</span>}
        </div>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Paramètres de vectorisation</h3>
        <div className="grid md:grid-cols-2 gap-3 items-center">
          <input className="border rounded px-2 py-1" type="number" min={64} max={4096} placeholder="Dimensions (auto si vide)" value={config.dimensions ?? ""} onChange={(e) => updateConfig({ dimensions: e.target.value ? Number(e.target.value) : null })} />
          <Slider min={1} max={2048} step={1} value={config.batch_size} onChange={(value) => updateConfig({ batch_size: value })} label="Batch size" />
        </div>
        <Toggle checked={config.normalize} onChange={(checked) => updateConfig({ normalize: checked })} label="Normalisation L2" />
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Cache d'embeddings</h3>
        <Toggle checked={config.cache_enabled} onChange={(checked) => updateConfig({ cache_enabled: checked })} label="Cache activé" />
        <Select value={config.cache_backend} onChange={(e) => updateConfig({ cache_backend: e.target.value as any })} options={[{ value: "disk", label: "disk" }, { value: "memory", label: "memory" }]} />
        <p className="text-sm">Entrées: {cacheStats?.entries ?? 0} · Taille: {cacheStats?.size_mb ?? 0} MB</p>
        <div className="flex gap-2"><Button variant="outline" onClick={refreshCacheStats}>Actualiser stats</Button><Button variant="ghost" onClick={() => invoke("clear_embedding_cache").then(refreshCacheStats)}>Vider le cache</Button></div>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Panneau de test d'embedding</h3>
        <textarea className="w-full border rounded p-2" rows={3} value={textA} onChange={(e) => setTextA(e.target.value)} />
        <textarea className="w-full border rounded p-2" rows={3} value={textB} onChange={(e) => setTextB(e.target.value)} />
        <Button onClick={runEmbeddingTest}>Tester l'embedding</Button>
        {test && <div className="text-sm space-y-1"><p>Dimensions: <b>{test.dimensions}</b> · Tokens A/B: <b>{test.tokens_a}</b>/<b>{test.tokens_b}</b></p><p>Latence A/B: {test.latency_ms_a}ms / {test.latency_ms_b}ms</p><p>Similarité cosinus: <b>{test.cosine_similarity}</b> ({similarityLabel(test.cosine_similarity)})</p></div>}
      </section>

      <div className="flex justify-end"><Button variant="ghost" className="text-red-600" onClick={reset}>Réinitialiser au profil</Button></div>
    </div>
  );
}
