import { Database } from "lucide-react";
import { useTranslation } from "react-i18next";

export function VectorStoreStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const vsCfg = state.config?.vector_store || {};

    const collectionName = vsCfg.collection_name || "documents";

    const updateVectorStore = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.vector_store) cfg.vector_store = {};
            cfg.vector_store = { ...cfg.vector_store, ...patch };
            return cfg;
        });
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">{t('wizard.vectorStore.title')}</h1>
            <p className="text-gray-500 mb-8">
                {t('wizard.vectorStore.subtitle')}
            </p>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6 mb-8">
                <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900">
                    <Database className="w-8 h-8 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div>
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100">{t('wizard.vectorStore.localQdrant')}</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            {t('wizard.vectorStore.localQdrantDesc')}
                        </p>
                    </div>
                </div>

                <div>
                    <label className="block font-medium mb-1 text-sm">{t('wizard.vectorStore.collectionName')}</label>
                    <input
                        type="text"
                        className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                        value={collectionName}
                        onChange={(e) => updateVectorStore({ collection_name: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                    />
                    <p className="text-xs text-gray-500 mt-1">{t('wizard.vectorStore.collectionDesc')}</p>
                </div>
            </div>


        </div>
    );
}
