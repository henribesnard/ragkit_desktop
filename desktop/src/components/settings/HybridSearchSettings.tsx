import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { Toggle } from "@/components/ui/Toggle";
import { useHybridSearchConfig } from "@/hooks/useHybridSearchConfig";

function ModifiedBadge({ dirty }: { dirty: boolean }) {
  return dirty ? <Badge className="ml-2">Modifie</Badge> : null;
}

const fusionOptions = [
  { value: "rrf", label: "Reciprocal Rank Fusion (RRF)" },
  { value: "weighted_sum", label: "Somme ponderee (Weighted Sum)" },
];

const normalizationOptions = [
  { value: "min_max", label: "Min-Max" },
  { value: "z_score", label: "Z-Score" },
];

export function HybridSearchSettings() {
  const { config, loading, error, dirtyKeys, updateConfig, reset } = useHybridSearchConfig();

  if (loading) {
    return <div>Chargement...</div>;
  }
  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
        <h3 className="font-semibold">Recherche hybride</h3>

        <div>
          <Slider
            value={config.alpha}
            min={0}
            max={1}
            step={0.05}
            label="Alpha (Lexical 0.0 - 1.0 Semantique)"
            formatValue={(value) => value.toFixed(2)}
            onChange={(value) => updateConfig({ alpha: Number(value.toFixed(2)) })}
          />
          <div className="text-xs text-gray-500 mt-1">
            Lexical: {Math.round((1 - config.alpha) * 100)}% | Semantique: {Math.round(config.alpha * 100)}%
          </div>
          <ModifiedBadge dirty={dirtyKeys.includes("alpha")} />
        </div>

        <div>
          <Select
            options={fusionOptions}
            label="Methode de fusion"
            value={config.fusion_method}
            onChange={(event) => updateConfig({ fusion_method: event.target.value as typeof config.fusion_method })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("fusion_method")} />
        </div>

        {config.fusion_method === "rrf" ? (
          <div>
            <Slider
              value={config.rrf_k}
              min={1}
              max={200}
              step={1}
              label="Constante RRF k"
              onChange={(value) => updateConfig({ rrf_k: Math.round(value) })}
            />
            <ModifiedBadge dirty={dirtyKeys.includes("rrf_k")} />
          </div>
        ) : (
          <div className="space-y-3 border rounded-md p-3">
            <Toggle
              checked={config.normalize_scores}
              onChange={(value) => updateConfig({ normalize_scores: value })}
              label="Normaliser les scores avant fusion"
            />
            <ModifiedBadge dirty={dirtyKeys.includes("normalize_scores")} />

            {config.normalize_scores && (
              <div>
                <Select
                  options={normalizationOptions}
                  label="Methode de normalisation"
                  value={config.normalization_method}
                  onChange={(event) =>
                    updateConfig({ normalization_method: event.target.value as typeof config.normalization_method })
                  }
                />
                <ModifiedBadge dirty={dirtyKeys.includes("normalization_method")} />
              </div>
            )}
          </div>
        )}

        <div>
          <Slider
            value={config.top_k}
            min={1}
            max={100}
            step={1}
            label="Nombre de resultats finaux (top_k)"
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
            label="Seuil minimum"
            formatValue={(value) => value.toFixed(2)}
            onChange={(value) => updateConfig({ threshold: Number(value.toFixed(2)) })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("threshold")} />
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Toggle
              checked={config.deduplicate}
              onChange={(value) => updateConfig({ deduplicate: value })}
              label="Dedupliquer les chunks"
            />
            <ModifiedBadge dirty={dirtyKeys.includes("deduplicate")} />
          </div>
          <div>
            <Toggle
              checked={config.debug_default}
              onChange={(value) => updateConfig({ debug_default: value })}
              label="Mode debug actif par defaut"
            />
            <ModifiedBadge dirty={dirtyKeys.includes("debug_default")} />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          className="text-red-600 hover:text-red-700"
          onClick={() => {
            if (confirm("Reinitialiser les parametres de recherche hybride au profil actif ?")) {
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
