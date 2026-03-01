import { useTranslation } from "react-i18next";

export function ChunkingStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const chunkCfg = state.config?.chunking || {};

    const updateChunking = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.chunking) cfg.chunking = {};
            cfg.chunking = { ...cfg.chunking, ...patch };
            return cfg;
        });
    };

    const size = chunkCfg.chunk_size || 512;
    const overlap = chunkCfg.chunk_overlap || 50;

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">{t('wizard.chunking.title')}</h1>
            <p className="text-gray-500 mb-8">
                {t('wizard.chunking.subtitle')}
            </p>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6 mb-8">
                <div>
                    <label className="block font-medium mb-2">{t('wizard.chunking.chunkSize')}</label>
                    <input
                        type="range"
                        min="128"
                        max="2048"
                        step="128"
                        value={size}
                        onChange={(e) => updateChunking({ chunk_size: parseInt(e.target.value) })}
                        className="w-full cursor-pointer"
                    />
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                        <span>128 ({t('wizard.chunking.sizePrecise')})</span>
                        <span className="font-bold text-gray-900 dark:text-white">{size} {t('wizard.chunking.tokens')}</span>
                        <span>2048 ({t('wizard.chunking.sizeLarge')})</span>
                    </div>
                </div>

                <div>
                    <label className="block font-medium mb-2">{t('wizard.chunking.overlap')}</label>
                    <input
                        type="range"
                        min="0"
                        max="500"
                        step="10"
                        value={overlap}
                        onChange={(e) => updateChunking({ chunk_overlap: parseInt(e.target.value) })}
                        className="w-full cursor-pointer"
                    />
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                        <span>0</span>
                        <span className="font-bold text-gray-900 dark:text-white">{overlap} {t('wizard.chunking.tokens')}</span>
                        <span>500</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">{t('wizard.chunking.overlapDesc')}</p>
                </div>

                <label className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div>
                        <span className="block font-medium">{t('wizard.chunking.chunkIndex')}</span>
                        <span className="text-sm text-gray-500">{t('wizard.chunking.chunkIndexDesc')}</span>
                    </div>
                    <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 rounded"
                        checked={!!chunkCfg.add_chunk_index}
                        onChange={(e) => updateChunking({ add_chunk_index: e.target.checked })}
                    />
                </label>
            </div>


        </div>
    );
}
