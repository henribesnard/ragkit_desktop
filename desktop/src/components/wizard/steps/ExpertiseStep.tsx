import { User, Settings2, Sliders } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ExpertiseStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const currentLevel = state.config?.general?.expertise_level || "simple";

    const setExpertise = (level: "simple" | "intermediate" | "expert") => {
        updateConfig((cfg: any) => {
            if (!cfg.general) cfg.general = {};
            cfg.general.expertise_level = level;
            return cfg;
        });
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">{t('wizard.expertise.title')}</h1>
            <p className="text-gray-500 mb-8">
                {t('wizard.expertise.subtitle')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <button
                    onClick={() => setExpertise("simple")}
                    className={`flex flex-col items-start p-6 rounded-xl border-2 transition-all text-left ${currentLevel === "simple"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                        }`}
                >
                    <div className={`p-3 rounded-lg mb-4 ${currentLevel === "simple" ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-800"}`}>
                        <User className={`w-6 h-6 ${currentLevel === "simple" ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`} />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{t('wizard.expertise.simple')}</h3>
                    <p className="text-sm text-gray-500">
                        {t('wizard.expertise.simpleDesc')}
                    </p>
                </button>

                <button
                    onClick={() => setExpertise("intermediate")}
                    className={`flex flex-col items-start p-6 rounded-xl border-2 transition-all text-left ${currentLevel === "intermediate"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                        }`}
                >
                    <div className={`p-3 rounded-lg mb-4 ${currentLevel === "intermediate" ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-800"}`}>
                        <Sliders className={`w-6 h-6 ${currentLevel === "intermediate" ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`} />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{t('wizard.expertise.intermediate')}</h3>
                    <p className="text-sm text-gray-500">
                        {t('wizard.expertise.intermediateDesc')}
                    </p>
                </button>

                <button
                    onClick={() => setExpertise("expert")}
                    className={`flex flex-col items-start p-6 rounded-xl border-2 transition-all text-left ${currentLevel === "expert"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                        }`}
                >
                    <div className={`p-3 rounded-lg mb-4 ${currentLevel === "expert" ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-800"}`}>
                        <Settings2 className={`w-6 h-6 ${currentLevel === "expert" ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`} />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{t('wizard.expertise.expert')}</h3>
                    <p className="text-sm text-gray-500">
                        {t('wizard.expertise.expertDesc')}
                    </p>
                </button>
            </div>


        </div>
    );
}
