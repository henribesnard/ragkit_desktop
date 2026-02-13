import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";

interface ParsingSettingsProps {
    config: any;
    onChange: (key: string, value: any) => void;
}

export function ParsingSettings({ config, onChange }: ParsingSettingsProps) {
    if (!config) return null;
    const parsing = config.parsing;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Select
                    label="Moteur de parsing"
                    value={parsing.engine}
                    onChange={(e) => onChange("parsing.engine", e.target.value)}
                    options={[
                        { value: "auto", label: "Automatique (recommandé)" },
                        { value: "unstructured", label: "Unstructured" },
                        { value: "pypdf", label: "PyPDF" },
                        { value: "docling", label: "Docling" },
                    ]}
                />

                <Select
                    label="Extraction tableaux"
                    value={parsing.table_extraction_strategy}
                    onChange={(e) => onChange("parsing.table_extraction_strategy", e.target.value)}
                    options={[
                        { value: "preserve", label: "Préserver la mise en forme" },
                        { value: "markdown", label: "Convertir en Markdown" },
                        { value: "separate", label: "Extraire séparément" },
                        { value: "ignore", label: "Ignorer les tableaux" },
                    ]}
                />
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">OCR & Vision</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Toggle
                        label="Activer l'OCR (fichiers scannés)"
                        checked={parsing.ocr_enabled}
                        onChange={(v) => onChange("parsing.ocr_enabled", v)}
                    />

                    <Toggle
                        label="Captioning d'images"
                        checked={parsing.image_captioning_enabled}
                        onChange={(v) => onChange("parsing.image_captioning_enabled", v)}
                    />
                </div>

                {parsing.ocr_enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in slide-in-from-top-2">
                        <Select
                            label="Moteur OCR"
                            value={parsing.ocr_engine}
                            onChange={(e) => onChange("parsing.ocr_engine", e.target.value)}
                            options={[
                                { value: "tesseract", label: "Tesseract" },
                                { value: "easyocr", label: "EasyOCR" },
                            ]}
                        />
                    </div>
                )}
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <Toggle
                    label="Détection automatique des titres (Structure)"
                    checked={parsing.header_detection}
                    onChange={(v) => onChange("parsing.header_detection", v)}
                />
            </div>
        </div>
    );
}
