import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { Toggle } from "@/components/ui/Toggle";
import { LexicalSearchConfig } from "@/hooks/useLexicalSearchConfig";

interface LexicalPreprocessingPanelProps {
  config: LexicalSearchConfig;
  dirtyKeys: string[];
  onChange: (patch: Partial<LexicalSearchConfig>) => void;
}

function ModifiedBadge({ dirty }: { dirty: boolean }) {
  return dirty ? <Badge className="ml-2">Modifie</Badge> : null;
}

const languageOptions = [
  { value: "auto", label: "Auto (detection)" },
  { value: "fr", label: "Francais" },
  { value: "en", label: "Anglais" },
];

const ngramOptions = [
  { value: "1,1", label: "Unigrams (1,1)" },
  { value: "1,2", label: "Unigrams + Bigrams (1,2)" },
  { value: "1,3", label: "1-gram a 3-gram (1,3)" },
  { value: "2,2", label: "Bigrams (2,2)" },
  { value: "2,3", label: "Bigrams + Trigrams (2,3)" },
  { value: "3,3", label: "Trigrams (3,3)" },
];

export function LexicalPreprocessingPanel({
  config,
  dirtyKeys,
  onChange,
}: LexicalPreprocessingPanelProps) {
  return (
    <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
      <h3 className="font-semibold">Preprocessing lexical</h3>

      <div>
        <Toggle
          checked={config.lowercase}
          onChange={(value) => onChange({ lowercase: value })}
          label="Conversion en minuscules"
        />
        <ModifiedBadge dirty={dirtyKeys.includes("lowercase")} />
      </div>

      <div>
        <Toggle
          checked={config.remove_stopwords}
          onChange={(value) => onChange({ remove_stopwords: value })}
          label="Suppression stopwords"
        />
        <ModifiedBadge dirty={dirtyKeys.includes("remove_stopwords")} />
      </div>

      {config.remove_stopwords && (
        <div>
          <Select
            options={languageOptions}
            label="Langue stopwords"
            value={config.stopwords_lang}
            onChange={(event) => onChange({ stopwords_lang: event.target.value as LexicalSearchConfig["stopwords_lang"] })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("stopwords_lang")} />
        </div>
      )}

      <div>
        <Toggle
          checked={config.stemming}
          onChange={(value) => onChange({ stemming: value })}
          label="Stemming (racinisation)"
        />
        <ModifiedBadge dirty={dirtyKeys.includes("stemming")} />
      </div>

      {config.stemming && (
        <div>
          <Select
            options={languageOptions}
            label="Langue stemmer"
            value={config.stemmer_lang}
            onChange={(event) => onChange({ stemmer_lang: event.target.value as LexicalSearchConfig["stemmer_lang"] })}
          />
          <ModifiedBadge dirty={dirtyKeys.includes("stemmer_lang")} />
        </div>
      )}

      <div>
        <Select
          options={ngramOptions}
          label="N-grams"
          value={`${config.ngram_range[0]},${config.ngram_range[1]}`}
          onChange={(event) => {
            const [minN, maxN] = event.target.value.split(",").map((value) => Number(value));
            onChange({ ngram_range: [minN, maxN] });
          }}
        />
        <ModifiedBadge dirty={dirtyKeys.includes("ngram_range")} />
      </div>

      <div>
        <Slider
          value={config.threshold}
          min={0}
          max={30}
          step={0.1}
          label="Seuil de score minimum"
          formatValue={(value) => value.toFixed(1)}
          onChange={(value) => onChange({ threshold: Number(value.toFixed(1)) })}
        />
        <ModifiedBadge dirty={dirtyKeys.includes("threshold")} />
      </div>

      <div>
        <Toggle
          checked={config.debug_default}
          onChange={(value) => onChange({ debug_default: value })}
          label="Mode debug actif par defaut"
        />
        <ModifiedBadge dirty={dirtyKeys.includes("debug_default")} />
      </div>
    </section>
  );
}
