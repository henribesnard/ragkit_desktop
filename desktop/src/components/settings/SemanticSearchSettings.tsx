import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { Toggle } from "@/components/ui/Toggle";
import { useSemanticSearchConfig } from "@/hooks/useSemanticSearchConfig";

function ModifiedBadge({ dirty }: { dirty: boolean }) {
  return dirty ? <Badge className="ml-2">Modifié</Badge> : null;
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function SemanticSearchSettings() {
  const { config, loading, error, dirtyKeys, updateConfig, updateFilters, reset } = useSemanticSearchConfig();

  if (loading) {
    return <div>Chargement...</div>;
  }
  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  const defaultFiltersDirty = dirtyKeys.includes("default_filters") || dirtyKeys.includes("default_filters_enabled");

  return (
    <div className="space-y-6">
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
        <h3 className="font-semibold">Recherche sémantique</h3>

        <div>
          <Toggle checked={config.enabled} onChange={(value) => updateConfig({ enabled: value })} label="Activer la recherche sémantique" />
          <ModifiedBadge dirty={dirtyKeys.includes("enabled")} />
        </div>

        <div>
          <Slider
            value={config.top_k}
            min={1}
            max={100}
            step={1}
            label="Top K"
            onChange={(value) => updateConfig({ top_k: Math.round(value) })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("top_k")} />
        </div>

        <div>
          <Slider
            value={config.threshold}
            min={0}
            max={1}
            step={0.01}
            label="Seuil de similarité"
            formatValue={(value) => value.toFixed(2)}
            onChange={(value) => updateConfig({ threshold: value })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("threshold")} />
        </div>

        <div>
          <Slider
            value={config.weight}
            min={0}
            max={1}
            step={0.01}
            label="Poids sémantique"
            formatValue={(value) => value.toFixed(2)}
            onChange={(value) => updateConfig({ weight: value })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("weight")} />
        </div>
      </section>

      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
        <h3 className="font-semibold">Diversification MMR</h3>
        <div>
          <Toggle checked={config.mmr_enabled} onChange={(value) => updateConfig({ mmr_enabled: value })} label="Activer MMR" />
          <ModifiedBadge dirty={dirtyKeys.includes("mmr_enabled")} />
        </div>
        <div>
          <Slider
            value={config.mmr_lambda}
            min={0}
            max={1}
            step={0.01}
            label="Lambda MMR"
            formatValue={(value) => value.toFixed(2)}
            onChange={(value) => updateConfig({ mmr_lambda: value })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("mmr_lambda")} />
        </div>
      </section>

      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
        <h3 className="font-semibold">Filtres par métadonnées</h3>
        <div>
          <Toggle
            checked={config.default_filters_enabled}
            onChange={(value) => updateConfig({ default_filters_enabled: value })}
            label="Activer les filtres par défaut"
          />
          <ModifiedBadge dirty={defaultFiltersDirty} />
        </div>

        <label className="block text-sm">
          Documents (doc_id, séparés par des virgules)
          <input
            className="mt-1 w-full border rounded px-2 py-1"
            value={config.default_filters.doc_ids.join(", ")}
            onChange={(e) => updateFilters({ doc_ids: parseList(e.target.value) })}
          />
        </label>

        <label className="block text-sm">
          Types de document
          <input
            className="mt-1 w-full border rounded px-2 py-1"
            value={config.default_filters.doc_types.join(", ")}
            onChange={(e) => updateFilters({ doc_types: parseList(e.target.value) })}
          />
        </label>

        <label className="block text-sm">
          Langues
          <input
            className="mt-1 w-full border rounded px-2 py-1"
            value={config.default_filters.languages.join(", ")}
            onChange={(e) => updateFilters({ languages: parseList(e.target.value) })}
          />
        </label>

        <label className="block text-sm">
          Catégories
          <input
            className="mt-1 w-full border rounded px-2 py-1"
            value={config.default_filters.categories.join(", ")}
            onChange={(e) => updateFilters({ categories: parseList(e.target.value) })}
          />
        </label>
      </section>

      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
        <h3 className="font-semibold">Options avancées</h3>
        <div>
          <Slider
            value={config.prefetch_multiplier}
            min={1}
            max={10}
            step={1}
            label="Prefetch multiplier"
            onChange={(value) => updateConfig({ prefetch_multiplier: Math.round(value) })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("prefetch_multiplier")} />
        </div>

        <div>
          <Toggle checked={config.debug_default} onChange={(value) => updateConfig({ debug_default: value })} label="Debug activé par défaut" />
          <ModifiedBadge dirty={dirtyKeys.includes("debug_default")} />
        </div>
      </section>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          className="text-red-600 hover:text-red-700"
          onClick={() => {
            if (confirm("Réinitialiser les paramètres de recherche sémantique au profil actif ?")) {
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

