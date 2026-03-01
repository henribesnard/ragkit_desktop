import { useTranslation } from "react-i18next";

export function HybridStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const hybridCfg = state.config?.retrieval?.hybrid || {};

    const topK = hybridCfg.top_k || 5;
    const semanticWeight = hybridCfg.semantic_weight ?? 0.7;
    const fusion = hybridCfg.fusion_method || "rrf";

    const updateHybrid = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.retrieval) cfg.retrieval = {};
            if (!cfg.retrieval.hybrid) cfg.retrieval.hybrid = {};
            cfg.retrieval.hybrid = { ...cfg.retrieval.hybrid, ...patch };
            return cfg;
        });
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">{t('wizard.hybrid.title')}</h1>
            <p className="text-gray-500 mb-8">
                {t('wizard.hybrid.subtitle')}
            </p>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6 mb-8">
                <div>
                    <label className="block font-medium mb-2">{t('wizard.hybrid.topK')}</label>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={topK}
                        onChange={(e) => updateHybrid({ top_k: parseInt(e.target.value) })}
                        className="w-full cursor-pointer"
                    />
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                        <span>1</span>
                        <span className="font-bold text-gray-900 dark:text-white">{topK} {t('wizard.hybrid.documents')}</span>
                        <span>20</span>
                    </div>
                </div>

                <div>
                    <label className="block font-medium mb-2">{t('wizard.hybrid.fusionMethod')}</label>
                    <div className="grid grid-cols-2 gap-4">
                        <label className={`border rounded-lg p-3 cursor-pointer flex items-center gap-2 ${fusion === 'rrf' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                            <input
                                type="radio"
                                name="fusion"
                                value="rrf"
                                checked={fusion === 'rrf'}
                                onChange={() => updateHybrid({ fusion_method: 'rrf' })}
                                className="text-blue-600"
                            />
                            <div>
                                <span className="block font-medium text-sm">{t('wizard.hybrid.rrf')}</span>
                                <span className="text-xs text-gray-500">{t('wizard.hybrid.rrfDesc')}</span>
                            </div>
                        </label>
                        <label className={`border rounded-lg p-3 cursor-pointer flex items-center gap-2 ${fusion === 'linear' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                            <input
                                type="radio"
                                name="fusion"
                                value="linear"
                                checked={fusion === 'linear'}
                                onChange={() => updateHybrid({ fusion_method: 'linear' })}
                                className="text-blue-600"
                            />
                            <div>
                                <span className="block font-medium text-sm">{t('wizard.hybrid.linear')}</span>
                                <span className="text-xs text-gray-500">{t('wizard.hybrid.linearDesc')}</span>
                            </div>
                        </label>
                    </div>
                </div>

                {fusion === 'linear' && (
                    <div>
                        <label className="block font-medium mb-2">{t('wizard.hybrid.weighting')}</label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={semanticWeight}
                            onChange={(e) => updateHybrid({ semantic_weight: parseFloat(e.target.value) })}
                            className="w-full cursor-pointer"
                        />
                        <div className="flex justify-between text-sm text-gray-500 mt-1">
                            <span>{t('wizard.hybrid.lexicalOnly')}</span>
                            <span className="font-bold text-gray-900 dark:text-white">{Math.round(semanticWeight * 100)}% {t('wizard.hybrid.semanticPercent')}</span>
                            <span>{t('wizard.hybrid.semanticOnly')}</span>
                        </div>
                    </div>
                )}
            </div>


        </div>
    );
}
