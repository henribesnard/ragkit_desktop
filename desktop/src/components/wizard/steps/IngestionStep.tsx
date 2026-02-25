import { Button } from "@/components/ui/Button";
import { Eye, Hand } from "lucide-react";

export function IngestionStep({ wizard }: { wizard: any }) {
    const { state, updateConfig } = wizard;
    const ingCfg = state.config?.ingestion || {};
    const generalCfg = state.config?.general || {};
    const expertiseLevel = generalCfg.expertise_level || "simple";
    const calibration = state.config?.calibration_answers || {};
    const autoFromCalibration = !!(calibration.q5 || calibration.q5_frequent_updates);

    const normalizedMode = String(generalCfg.ingestion_mode || "").toLowerCase();
    const ingestionMode = normalizedMode === "automatic" || normalizedMode === "auto"
        ? "automatic"
        : normalizedMode === "manual"
            ? "manual"
            : autoFromCalibration
                ? "automatic"
                : "manual";
    const watchInterval = Number(generalCfg.auto_ingestion_delay ?? 60);

    const updateGeneral = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.general) cfg.general = {};
            cfg.general = { ...cfg.general, ...patch };
            return cfg;
        });
    };

    const setIngestionMode = (mode: "manual" | "automatic") => {
        if (mode === "automatic") {
            updateGeneral({
                ingestion_mode: "automatic",
                auto_ingestion_delay: watchInterval || 60,
            });
            return;
        }
        updateGeneral({ ingestion_mode: "manual" });
    };

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
            <h1 className="text-2xl font-bold mb-4">Ingestion & Pre-traitement</h1>
            <p className="text-gray-500 mb-8">
                Ces parametres definissent comment vos documents sont lus et nettoyes. Les valeurs par defaut sont recommandees.
            </p>

            <div className="space-y-6 mb-8">
                {/* Mode d'ingestion */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold mb-4 border-b pb-2">Mode d'ingestion</h3>

                    {expertiseLevel === "simple" ? (
                        /* Debutant: simple toggle avec recommandation */
                        <label className="flex items-center justify-between cursor-pointer">
                            <div>
                                <span className="block font-medium">Ingestion automatique</span>
                                <span className="text-sm text-gray-500">
                                    Surveille automatiquement votre dossier et indexe les nouveaux documents. <span className="text-blue-600 font-medium">Recommande</span>
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                checked={ingestionMode === "automatic"}
                                onChange={(e) => setIngestionMode(e.target.checked ? "automatic" : "manual")}
                                className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                            />
                        </label>
                    ) : (
                        /* Intermediaire / Avance: choix explicite avec descriptions */
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${ingestionMode === "manual"
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                                        }`}
                                    onClick={() => setIngestionMode("manual")}
                                >
                                    <Hand className={`w-6 h-6 ${ingestionMode === "manual" ? "text-blue-600" : "text-gray-400"}`} />
                                    <span className={`font-medium text-sm ${ingestionMode === "manual" ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>Manuel</span>
                                    <span className="text-xs text-gray-500 text-center">
                                        Vous lancez l'ingestion depuis le tableau de bord quand vous le souhaitez
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${ingestionMode === "automatic"
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                                        }`}
                                    onClick={() => setIngestionMode("automatic")}
                                >
                                    <Eye className={`w-6 h-6 ${ingestionMode === "automatic" ? "text-blue-600" : "text-gray-400"}`} />
                                    <span className={`font-medium text-sm ${ingestionMode === "automatic" ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>Automatique</span>
                                    <span className="text-xs text-gray-500 text-center">
                                        RAGKIT surveille votre dossier et indexe les changements automatiquement
                                    </span>
                                </button>
                            </div>

                            {/* Avance: intervalle de surveillance */}
                            {expertiseLevel === "expert" && ingestionMode === "automatic" && (
                                <div className="pt-3 animate-in fade-in slide-in-from-top-2">
                                    <label className="block font-medium mb-2 text-sm">
                                        Intervalle de surveillance (secondes)
                                    </label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="300"
                                        step="10"
                                        value={watchInterval}
                                        onChange={(e) => updateGeneral({ auto_ingestion_delay: parseInt(e.target.value, 10) })}
                                        className="w-full cursor-pointer"
                                    />
                                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                                        <span>10s</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{watchInterval}s</span>
                                        <span>300s</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {/* Parsing Settings */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold mb-4 border-b pb-2">Lecture des Fichiers (Parsing)</h3>

                    <div className="space-y-4">
                        <label className="flex items-center justify-between">
                            <div>
                                <span className="block font-medium">Reconnaissance de texte (OCR)</span>
                                <span className="text-sm text-gray-500">Pour les PDF scannes et les images</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={!!parsing.ocr_enabled}
                                onChange={(e) => updateParsing({ ocr_enabled: e.target.checked })}
                                className="toggle-checkbox"
                            />
                        </label>

                        <div className="pt-2">
                            <label className="block font-medium mb-1">Strategie d'extraction des Tableaux</label>
                            <select
                                className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                                value={parsing.table_extraction_strategy || "preserve"}
                                onChange={(e) => updateParsing({ table_extraction_strategy: e.target.value })}
                            >
                                <option value="markdown">Markdown optimise</option>
                                <option value="preserve">Preservation Exacte</option>
                                <option value="separate">Sections separees</option>
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
                                <span className="block font-medium">Nettoyer les caracteres speciaux</span>
                                <span className="text-sm text-gray-500">Supprime les espaces et retours chariots inutiles</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={preproc.clean_whitespace !== false}
                                onChange={(e) => updatePreproc({ clean_whitespace: e.target.checked })}
                            />
                        </label>

                        <label className="flex items-center justify-between">
                            <div>
                                <span className="block font-medium">Supprimer les URLs</span>
                                <span className="text-sm text-gray-500">Peut etre utile si les liens faussent la recherche</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={!!preproc.remove_urls}
                                onChange={(e) => updatePreproc({ remove_urls: e.target.checked })}
                            />
                        </label>

                        <div className="pt-2">
                            <label className="block font-medium mb-1">Deduplication Automatique</label>
                            <select
                                className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                                value={preproc.deduplication_strategy || "fuzzy"}
                                onChange={(e) => updatePreproc({ deduplication_strategy: e.target.value })}
                            >
                                <option value="none">Aucune</option>
                                <option value="exact">Exacte (Hash)</option>
                                <option value="fuzzy">Floue (Similarite syntaxique)</option>
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
