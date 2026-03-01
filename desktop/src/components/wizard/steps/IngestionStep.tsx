import { Eye, Hand } from "lucide-react";
import { useTranslation } from "react-i18next";

export function IngestionStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
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
            <h1 className="text-2xl font-bold mb-4">{t('wizard.ingestion.title')}</h1>
            <p className="text-gray-500 mb-8">
                {t('wizard.ingestion.subtitle')}
            </p>

            <div className="space-y-6 mb-8">
                {/* Mode d'ingestion */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold mb-4 border-b pb-2">{t('wizard.ingestion.mode')}</h3>

                    {expertiseLevel === "simple" ? (
                        /* Debutant: simple toggle avec recommandation */
                        <label className="flex items-center justify-between cursor-pointer">
                            <div>
                                <span className="block font-medium">{t('wizard.ingestion.automatic')}</span>
                                <span className="text-sm text-gray-500">
                                    {t('wizard.ingestion.autoRecommended')}
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
                                    <span className={`font-medium text-sm ${ingestionMode === "manual" ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>{t('wizard.ingestion.manual')}</span>
                                    <span className="text-xs text-gray-500 text-center">
                                        {t('wizard.ingestion.manualDesc')}
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
                                    <span className={`font-medium text-sm ${ingestionMode === "automatic" ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>{t('wizard.ingestion.automatic')}</span>
                                    <span className="text-xs text-gray-500 text-center">
                                        {t('wizard.ingestion.autoDesc')}
                                    </span>
                                </button>
                            </div>

                            {/* Avance: intervalle de surveillance */}
                            {expertiseLevel === "expert" && ingestionMode === "automatic" && (
                                <div className="pt-3 animate-in fade-in slide-in-from-top-2">
                                    <label className="block font-medium mb-2 text-sm">
                                        {t('wizard.ingestion.watchInterval')}
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
                    <h3 className="font-semibold mb-4 border-b pb-2">{t('wizard.ingestion.parsing')}</h3>

                    <div className="space-y-4">
                        <label className="flex items-center justify-between">
                            <div>
                                <span className="block font-medium">{t('wizard.ingestion.ocr')}</span>
                                <span className="text-sm text-gray-500">{t('wizard.ingestion.ocrDesc')}</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={!!parsing.ocr_enabled}
                                onChange={(e) => updateParsing({ ocr_enabled: e.target.checked })}
                                className="toggle-checkbox"
                            />
                        </label>

                        <div className="pt-2">
                            <label className="block font-medium mb-1">{t('wizard.ingestion.tableStrategy')}</label>
                            <select
                                className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                                value={parsing.table_extraction_strategy || "preserve"}
                                onChange={(e) => updateParsing({ table_extraction_strategy: e.target.value })}
                            >
                                <option value="markdown">{t('wizard.ingestion.tableMarkdown')}</option>
                                <option value="preserve">{t('wizard.ingestion.tablePreserve')}</option>
                                <option value="separate">{t('wizard.ingestion.tableSeparate')}</option>
                                <option value="ignore">{t('wizard.ingestion.tableIgnore')}</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Preprocessing Settings */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold mb-4 border-b pb-2">{t('wizard.ingestion.preprocessing')}</h3>

                    <div className="space-y-4">
                        <label className="flex items-center justify-between">
                            <div>
                                <span className="block font-medium">{t('wizard.ingestion.cleanWhitespace')}</span>
                                <span className="text-sm text-gray-500">{t('wizard.ingestion.cleanWhitespaceDesc')}</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={preproc.clean_whitespace !== false}
                                onChange={(e) => updatePreproc({ clean_whitespace: e.target.checked })}
                            />
                        </label>

                        <label className="flex items-center justify-between">
                            <div>
                                <span className="block font-medium">{t('wizard.ingestion.removeUrls')}</span>
                                <span className="text-sm text-gray-500">{t('wizard.ingestion.removeUrlsDesc')}</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={!!preproc.remove_urls}
                                onChange={(e) => updatePreproc({ remove_urls: e.target.checked })}
                            />
                        </label>

                        <div className="pt-2">
                            <label className="block font-medium mb-1">{t('wizard.ingestion.deduplication')}</label>
                            <select
                                className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                                value={preproc.deduplication_strategy || "fuzzy"}
                                onChange={(e) => updatePreproc({ deduplication_strategy: e.target.value })}
                            >
                                <option value="none">{t('wizard.ingestion.dedupNone')}</option>
                                <option value="exact">{t('wizard.ingestion.dedupExact')}</option>
                                <option value="fuzzy">{t('wizard.ingestion.dedupFuzzy')}</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>


        </div>
    );
}
