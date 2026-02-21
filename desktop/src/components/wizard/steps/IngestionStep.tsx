import { Button } from "@/components/ui/Button";

export function IngestionStep({ wizard }: { wizard: any }) {
    const { state, updateConfig } = wizard;
    const ingCfg = state.config?.ingestion || {};

    const updateParsing = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.ingestion) cfg.ingestion = {};
            if (!cfg.ingestion.parsing) cfg.ingestion.parsing = {};
            cfg.ingestion.parsing = { ...cfg.ingestion.parsing, ...patch };
            return cfg;
        });
    };

    const updatePreproc = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.ingestion) cfg.ingestion = {};
            if (!cfg.ingestion.preprocessing) cfg.ingestion.preprocessing = {};
            cfg.ingestion.preprocessing = { ...cfg.ingestion.preprocessing, ...patch };
            return cfg;
        });
    };

    const parsing = ingCfg.parsing || {};
    const preproc = ingCfg.preprocessing || {};

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">Ingestion & Pré-traitement</h1>
            <p className="text-gray-500 mb-8">
                Ces paramètres définissent comment vos documents sont lus et nettoyés. Les valeurs par défaut sont recommandées.
            </p>

            <div className="space-y-6 mb-8">
                {/* Parsing Settings */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold mb-4 border-b pb-2">Lecture des Fichiers (Parsing)</h3>

                    <div className="space-y-4">
                        <label className="flex items-center justify-between">
                            <div>
                                <span className="block font-medium">Reconnaissance de texte (OCR)</span>
                                <span className="text-sm text-gray-500">Pour les PDF scannés et les images</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={!!parsing.ocr_enabled}
                                onChange={(e) => updateParsing({ ocr_enabled: e.target.checked })}
                                className="toggle-checkbox"
                            />
                        </label>

                        <div className="pt-2">
                            <label className="block font-medium mb-1">Stratégie d'extraction des Tableaux</label>
                            <select
                                className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                                value={parsing.table_extraction_strategy || "smart"}
                                onChange={(e) => updateParsing({ table_extraction_strategy: e.target.value })}
                            >
                                <option value="smart">Intelligente (Markdown/HTML optimisé)</option>
                                <option value="preserve">Préservation Exacte</option>
                                <option value="flatten">Aplatir en texte simple</option>
                                <option value="ignore">Ignorer les tableaux</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Preprocessing Settings */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold mb-4 border-b pb-2">Nettoyage (Preprocessing)</h3>

                    <div className="space-y-4">
                        <label className="flex items-center justify-between">
                            <div>
                                <span className="block font-medium">Nettoyer les caractères spéciaux</span>
                                <span className="text-sm text-gray-500">Supprime les espaces et retours chariots inutiles</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={preproc.clean_whitespace !== false} // default true
                                onChange={(e) => updatePreproc({ clean_whitespace: e.target.checked })}
                            />
                        </label>

                        <label className="flex items-center justify-between">
                            <div>
                                <span className="block font-medium">Supprimer les URLs</span>
                                <span className="text-sm text-gray-500">Peut être utile si les liens faussent la recherche</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={!!preproc.remove_urls}
                                onChange={(e) => updatePreproc({ remove_urls: e.target.checked })}
                            />
                        </label>

                        <div className="pt-2">
                            <label className="block font-medium mb-1">Déduplication Automatique</label>
                            <select
                                className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                                value={preproc.deduplication_strategy || "fuzzy"}
                                onChange={(e) => updatePreproc({ deduplication_strategy: e.target.value })}
                            >
                                <option value="none">Aucune</option>
                                <option value="exact">Exacte (Hash)</option>
                                <option value="fuzzy">Floue (Similarité syntaxique)</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-100 dark:border-gray-800">
                <Button variant="outline" onClick={() => wizard.prevStep()}>Retour</Button>
                <Button onClick={() => wizard.nextStep()}>Continuer</Button>
            </div>
        </div>
    );
}
