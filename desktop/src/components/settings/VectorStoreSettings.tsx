import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { useVectorStoreConfig } from "@/hooks/useVectorStoreConfig";

function ModifiedBadge({ dirty }: { dirty: boolean }) {
  return dirty ? <Badge className="ml-2">Modifié</Badge> : null;
}

export function VectorStoreSettings() {
  const { config, stats, connection, loading, error, dirtyKeys, updateConfig, reset, testConnection, deleteCollection, refreshStats } = useVectorStoreConfig();

  if (loading || !config) return <div>Chargement...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-3">
        <h3 className="font-semibold mb-1">Provider</h3>
        <Select
          value={config.provider}
          onChange={(event) => updateConfig({ provider: event.target.value as "qdrant" | "chroma" })}
          options={[
            { value: "qdrant", label: "Qdrant" },
            { value: "chroma", label: "ChromaDB" },
          ]}
        />
        <ModifiedBadge dirty={dirtyKeys.includes("provider")} />
        <p className="text-xs text-gray-500">
          {config.provider === "qdrant"
            ? "Qdrant: optimisé recherche vectorielle et indexation HNSW."
            : "ChromaDB: simple à déployer pour petits/moyens volumes."}
        </p>
      </section>

      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-3">
        <h3 className="font-semibold">Collection</h3>
        <label className="text-sm block">
          Nom de collection
          <input
            className="mt-1 border rounded px-2 py-1 w-full"
            value={config.collection_name}
            onChange={(event) => updateConfig({ collection_name: event.target.value })}
          />
        </label>
        <ModifiedBadge dirty={dirtyKeys.includes("collection_name")} />

        <Select
          value={config.mode}
          onChange={(event) => updateConfig({ mode: event.target.value as "persistent" | "memory" })}
          options={[
            { value: "persistent", label: "Persistent" },
            { value: "memory", label: "Memory" },
          ]}
          label="Mode"
        />
        <ModifiedBadge dirty={dirtyKeys.includes("mode")} />

        {config.mode === "memory" ? (
          <p className="text-xs text-amber-700">Mode mémoire: les données ne survivent pas au redémarrage.</p>
        ) : (
          <>
            <label className="text-sm block">
              Chemin de stockage
              <input
                className="mt-1 border rounded px-2 py-1 w-full"
                value={config.path}
                onChange={(event) => updateConfig({ path: event.target.value })}
              />
            </label>
            <ModifiedBadge dirty={dirtyKeys.includes("path")} />
          </>
        )}

        <Select
          value={config.distance_metric}
          onChange={(event) => updateConfig({ distance_metric: event.target.value as "cosine" | "euclidean" | "dot" })}
          options={[
            { value: "cosine", label: "Cosine" },
            { value: "euclidean", label: "Euclidean" },
            { value: "dot", label: "Dot Product" },
          ]}
          label="Métrique de distance"
        />
        <ModifiedBadge dirty={dirtyKeys.includes("distance_metric")} />
      </section>

      {config.provider === "qdrant" && (
        <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-3">
          <h3 className="font-semibold">Index HNSW (Qdrant)</h3>
          <Slider
            value={config.hnsw.ef_construction}
            min={4}
            max={512}
            step={1}
            label="ef_construction"
            onChange={(value) => updateConfig({ hnsw: { ...config.hnsw, ef_construction: Math.round(value) } })}
          />
          <Slider
            value={config.hnsw.m}
            min={2}
            max={64}
            step={1}
            label="m"
            onChange={(value) => updateConfig({ hnsw: { ...config.hnsw, m: Math.round(value) } })}
          />
          <Slider
            value={config.hnsw.ef_search}
            min={1}
            max={512}
            step={1}
            label="ef_search"
            onChange={(value) => updateConfig({ hnsw: { ...config.hnsw, ef_search: Math.round(value) } })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("hnsw")} />
        </section>
      )}

      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Statistiques collection</h3>
          <Button variant="outline" size="sm" onClick={refreshStats}>Actualiser</Button>
        </div>
        <p className="text-sm">
          {stats?.vectors_count ?? 0} vecteurs · {stats?.dimensions ?? 0} dimensions · {stats?.size_bytes ?? 0} bytes
        </p>
        <p className="text-xs text-gray-500">Statut: {stats?.status || "n/a"}</p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void testConnection()}>Tester la connexion</Button>
        <Button variant="outline" onClick={() => void deleteCollection()}>Supprimer la collection</Button>
        {connection && (
          <span className={connection.success ? "text-sm text-green-700" : "text-sm text-red-700"}>
            {connection.success ? "Connexion OK" : "Erreur"} · {connection.message}
          </span>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          className="text-red-600 hover:text-red-700"
          onClick={() => {
            if (confirm("Réinitialiser la configuration vector store au profil actif ?")) {
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

