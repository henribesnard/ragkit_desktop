import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Slider } from "@/components/ui/Slider";

interface PreprocessingSettingsProps {
    config: any;
    onChange: (key: string, value: any) => void;
}

export function PreprocessingSettings({ config, onChange }: PreprocessingSettingsProps) {
    if (!config) return null;
    const prep = config.preprocessing;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Toggle
                    label="Conversion en minuscules"
                    checked={prep.lowercase}
                    onChange={(v) => onChange("preprocessing.lowercase", v)}
                />
                <Toggle
                    label="Suppression ponctuation"
                    checked={prep.remove_punctuation}
                    onChange={(v) => onChange("preprocessing.remove_punctuation", v)}
                />
                <Toggle
                    label="Normalisation Unicode"
                    checked={prep.normalize_unicode}
                    onChange={(v) => onChange("preprocessing.normalize_unicode", v)}
                />
                <Toggle
                    label="Suppression URLs"
                    checked={prep.remove_urls}
                    onChange={(v) => onChange("preprocessing.remove_urls", v)}
                />
                <Toggle
                    label="Détection langue"
                    checked={prep.language_detection}
                    onChange={(v) => onChange("preprocessing.language_detection", v)}
                />
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Déduplication</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Select
                        label="Stratégie"
                        value={prep.deduplication_strategy}
                        onChange={(e) => onChange("preprocessing.deduplication_strategy", e.target.value)}
                        options={[
                            { value: "exact", label: "Exacte (Hash)" },
                            { value: "fuzzy", label: "Floue (Jaccard)" },
                            { value: "semantic", label: "Sémantique (Embedding)" },
                            { value: "none", label: "Désactivée" },
                        ]}
                    />

                    <Slider
                        label="Seuil de déduplication"
                        value={prep.deduplication_threshold}
                        min={0.5}
                        max={1.0}
                        step={0.01}
                        onChange={(v) => onChange("preprocessing.deduplication_threshold", v)}
                        formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                    />
                </div>
            </div>
        </div>
    );
}
