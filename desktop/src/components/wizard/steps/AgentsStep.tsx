import { Button } from "@/components/ui/Button";
import { Loader2, Bot } from "lucide-react";

export function AgentsStep({ wizard }: { wizard: any }) {
    const { state, updateConfig, completeWizard } = wizard;
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
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">Agents Intelligents</h1>
            <p className="text-gray-500 mb-8">
                RAGKIT peut utiliser une architecture multi-agents pour décomposer des questions complexes et chercher dans plusieurs directions simultanément.
            </p>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6 mb-8">
                <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${enabled ? "bg-blue-100 dark:bg-blue-900 text-blue-600" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                            <Bot className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="block font-medium text-lg">Activer les Agents</span>
                            <span className="text-sm text-gray-500 max-w-sm block mt-1">Permet au LLM de réfléchir, de formuler ses propres recherches et d'auto-corriger ses réponses itérativement.</span>
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
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-2">
                        <p className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                            <strong>Note de performance :</strong> L'utilisation d'agents multiplie le nombre de requêtes envoyées au LLM. Si vous utilisez l'API OpenAI, cela augmentera vos coûts. Si vous utilisez Ollama, chaque réponse prendra significativement plus de temps.
                        </p>
                    </div>
                )}
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-100 dark:border-gray-800">
                <Button variant="outline" onClick={() => wizard.prevStep()} disabled={state.isLoading}>Retour</Button>
                <Button onClick={() => completeWizard()} disabled={state.isLoading} className="bg-green-600 hover:bg-green-700 text-white">
                    {state.isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enregistrement...</> : "Terminer la Configuration"}
                </Button>
            </div>
        </div>
    );
}
