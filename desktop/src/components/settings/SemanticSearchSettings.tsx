import { useSemanticSearchConfig } from "@/hooks/useSemanticSearchConfig";

export function SemanticSearchSettings() {
  const { config, loading, updateConfig } = useSemanticSearchConfig();

  if (loading) {
    return <div>Chargement…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
        <h3 className="font-semibold">Recherche sémantique</h3>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => updateConfig({ enabled: e.target.checked })}
          />
          <span>Activer la recherche sémantique</span>
        </label>

        <div className="space-y-2">
          <label className="block text-sm text-gray-600 dark:text-gray-300">Top K</label>
          <input
            type="number"
            min={1}
            max={100}
            className="border rounded px-2 py-1 w-36"
            value={config.top_k}
            onChange={(e) => updateConfig({ top_k: Number(e.target.value) || 1 })}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-gray-600 dark:text-gray-300">Seuil de similarité ({config.similarity_threshold.toFixed(2)})</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={config.similarity_threshold}
            className="w-full"
            onChange={(e) => updateConfig({ similarity_threshold: Number(e.target.value) })}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-gray-600 dark:text-gray-300">Poids ({config.weight.toFixed(2)})</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={config.weight}
            className="w-full"
            onChange={(e) => updateConfig({ weight: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}
