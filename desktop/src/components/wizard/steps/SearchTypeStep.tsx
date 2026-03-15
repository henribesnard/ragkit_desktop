import { Search, TextSearch, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SearchTypeStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const searchType = state.config?.retrieval?.search_type || "hybrid";

    const setType = (t: "semantic" | "lexical" | "hybrid") => {
        updateConfig((cfg: any) => {
            if (!cfg.retrieval) cfg.retrieval = {};
            cfg.retrieval.search_type = t;
            return cfg;
        });
    };

    return (
        <div className="max-w-2xl mx-auto py-4">
            <h1 className="text-xl font-bold mb-4">{t('wizard.searchType.title')}</h1>
            <p className="text-gray-500 mb-4">
                {t('wizard.searchType.subtitle')}
            </p>

            <div className="space-y-4 mb-4">
                <button
                    onClick={() => setType("hybrid")}
                    className={`w-full flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all ${searchType === "hybrid" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-800"}`}
                >
                    <div className={`p-3 rounded-lg ${searchType === "hybrid" ? "bg-blue-100 dark:bg-blue-900 text-blue-600" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                        <Layers className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg mb-1">{t('wizard.searchType.hybrid')}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">{t('wizard.searchType.hybridDesc')}</p>
                    </div>
                </button>

                <button
                    onClick={() => setType("semantic")}
                    className={`w-full flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all ${searchType === "semantic" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-800"}`}
                >
                    <div className={`p-3 rounded-lg ${searchType === "semantic" ? "bg-blue-100 dark:bg-blue-900 text-blue-600" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                        <Search className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg mb-1">{t('wizard.searchType.semantic')}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">{t('wizard.searchType.semanticDesc')}</p>
                    </div>
                </button>

                <button
                    onClick={() => setType("lexical")}
                    className={`w-full flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all ${searchType === "lexical" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-800"}`}
                >
                    <div className={`p-3 rounded-lg ${searchType === "lexical" ? "bg-blue-100 dark:bg-blue-900 text-blue-600" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                        <TextSearch className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg mb-1">{t('wizard.searchType.lexical')}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">{t('wizard.searchType.lexicalDesc')}</p>
                    </div>
                </button>
            </div>


        </div>
    );
}
