import { Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LatencyImpactBadge } from "@/components/ui/LatencyImpactBadge";

export function AgentsStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const agentCfg = state.config?.agents || {};
    const enabled = agentCfg.enabled ?? false;

    const updateAgents = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.agents) cfg.agents = {};
            cfg.agents = { ...cfg.agents, ...patch };
            return cfg;
        });
    };

    return (
        <div className="max-w-2xl mx-auto py-4">
            <h1 className="text-xl font-bold mb-4">{t('wizard.agents.title')}</h1>
            <p className="text-gray-500 mb-4">
                {t('wizard.agents.subtitle')}
            </p>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 mb-4">
                <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${enabled ? "bg-blue-100 dark:bg-blue-900 text-blue-600" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                            <Bot className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="block font-medium text-lg">{t('wizard.agents.enable')}</span>
                            <span className="text-sm text-gray-500 max-w-sm block mt-1">{t('wizard.agents.enableDesc')}</span>
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => updateAgents({ enabled: e.target.checked })}
                        className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                    />
                </label>

                {enabled && (
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-2 space-y-3">
                        <LatencyImpactBadge level="high" description={t("latency.analyzerActiveDesc")} />
                        <LatencyImpactBadge level="high" description={t("latency.rewritingActiveDesc")} />
                        <p className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                            <strong>{t('wizard.agents.perfNoteTitle')}</strong> {t('wizard.agents.perfNote')}
                        </p>
                    </div>
                )}
            </div>


        </div>
    );
}
