import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { Toggle } from "@/components/ui/Toggle";
import { BM25ParamsPanel } from "@/components/settings/BM25ParamsPanel";
import { BM25IndexStatusPanel } from "@/components/settings/BM25IndexStatusPanel";
import { LexicalPreprocessingPanel } from "@/components/settings/LexicalPreprocessingPanel";
import { useLexicalSearchConfig } from "@/hooks/useLexicalSearchConfig";

function ModifiedBadge({ dirty }: { dirty: boolean }) {
  return dirty ? <Badge className="ml-2">Modifie</Badge> : null;
}

const algorithmOptions = [
  { value: "bm25", label: "BM25" },
  { value: "bm25_plus", label: "BM25+" },
];

export function LexicalSearchSettings() {
  const { config, loading, error, dirtyKeys, updateConfig, reset } = useLexicalSearchConfig();

  if (loading) {
    return <div>Chargement...</div>;
  }
  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
        <h3 className="font-semibold">Recherche lexicale</h3>

        <div>
          <Toggle
            checked={config.enabled}
            onChange={(value) => updateConfig({ enabled: value })}
            label="Activer la recherche lexicale"
          />
          <ModifiedBadge dirty={dirtyKeys.includes("enabled")} />
        </div>

        <div>
          <Select
            options={algorithmOptions}
            label="Algorithme"
            value={config.algorithm}
            onChange={(event) => updateConfig({ algorithm: event.target.value as typeof config.algorithm })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("algorithm")} />
        </div>

        <div>
          <Slider
            value={config.top_k}
            min={1}
            max={100}
            step={1}
            label="Nombre de resultats (top_k)"
            onChange={(value) => updateConfig({ top_k: Math.round(value) })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("top_k")} />
        </div>

        <div>
          <Slider
            value={config.weight}
            min={0}
            max={1}
            step={0.01}
            label="Poids (hybride etape 7)"
            formatValue={(value) => value.toFixed(2)}
            onChange={(value) => updateConfig({ weight: Number(value.toFixed(2)) })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("weight")} />
        </div>
      </section>

      <BM25ParamsPanel config={config} dirtyKeys={dirtyKeys} onChange={updateConfig} />
      <LexicalPreprocessingPanel config={config} dirtyKeys={dirtyKeys} onChange={updateConfig} />
      <BM25IndexStatusPanel />

      <div className="flex justify-end">
        <Button
          variant="ghost"
          className="text-red-600 hover:text-red-700"
          onClick={() => {
            if (confirm("Reinitialiser les parametres de recherche lexicale au profil actif ?")) {
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
