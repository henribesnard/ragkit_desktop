import { Slider } from "@/components/ui/Slider";
import { Badge } from "@/components/ui/Badge";
import { LexicalSearchConfig } from "@/hooks/useLexicalSearchConfig";

interface BM25ParamsPanelProps {
  config: LexicalSearchConfig;
  dirtyKeys: string[];
  onChange: (patch: Partial<LexicalSearchConfig>) => void;
}

function ModifiedBadge({ dirty }: { dirty: boolean }) {
  return dirty ? <Badge className="ml-2">Modifie</Badge> : null;
}

export function BM25ParamsPanel({ config, dirtyKeys, onChange }: BM25ParamsPanelProps) {
  return (
    <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
      <h3 className="font-semibold">Parametres BM25</h3>

      <div>
        <Slider
          value={config.bm25_k1}
          min={0.1}
          max={3}
          step={0.05}
          label="k1 (saturation terme)"
          formatValue={(value) => value.toFixed(2)}
          onChange={(value) => onChange({ bm25_k1: Number(value.toFixed(2)) })}
        />
        <ModifiedBadge dirty={dirtyKeys.includes("bm25_k1")} />
      </div>

      <div>
        <Slider
          value={config.bm25_b}
          min={0}
          max={1}
          step={0.01}
          label="b (normalisation longueur)"
          formatValue={(value) => value.toFixed(2)}
          onChange={(value) => onChange({ bm25_b: Number(value.toFixed(2)) })}
        />
        <ModifiedBadge dirty={dirtyKeys.includes("bm25_b")} />
      </div>

      {config.algorithm === "bm25_plus" && (
        <div>
          <Slider
            value={config.bm25_delta}
            min={0}
            max={2}
            step={0.05}
            label="delta (BM25+)"
            formatValue={(value) => value.toFixed(2)}
            onChange={(value) => onChange({ bm25_delta: Number(value.toFixed(2)) })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("bm25_delta")} />
        </div>
      )}
    </section>
  );
}
