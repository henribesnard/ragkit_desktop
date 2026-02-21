import { Button } from "@/components/ui/Button";

export function RerankingStep({ wizard }: { wizard: any }) {
    const { state, updateConfig } = wizard;
    const rerankCfg = state.config?.rerank || {};

    const enabled = rerankCfg.enabled ?? false;
    const provider = rerankCfg.provider || "huggingface";
    const topN = rerankCfg.top_n || 3;

    const updateRerank = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.rerank) cfg.rerank = {};
            cfg.rerank = { ...cfg.rerank, ...patch };
            return cfg;
        });
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">Re-ranking (Optionnel)</h1>
            <p className="text-gray-500 mb-8">
                Le re-ranking trie à nouveau les résultats de recherche avec un modèle IA plus précis pour assurer que les documents les plus pertinents soient tout en haut.
            </p>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6 mb-8">
                <label className="flex items-center justify-between cursor-pointer border-b border-gray-100 dark:border-gray-700 pb-4">
                    <div>
                        <span className="block font-medium text-lg text-blue-900 dark:text-blue-100">Activer le Re-ranking</span>
                        <span className="text-sm text-gray-500">Améliore significativement la précision, mais réduit légèrement la vitesse. Fortement recommandé pour la plupart des usages professionnels.</span>
                    </div>
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => updateRerank({ enabled: e.target.checked })}
                        className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                    />
                </label>

                {enabled && (
                    <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <label className="block font-medium mb-2">Fournisseur du modèle de Reranking</label>
                            <select
                                className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                                value={provider}
                                onChange={(e) => updateRerank({ provider: e.target.value })}
                            >
                                <option value="huggingface">HuggingFace (BGE Local - Gratuit)</option>
                                <option value="cohere">Cohere API (Cloud - Payant)</option>
                                <option value="voyageai">VoyageAI API (Cloud - Payant)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block font-medium mb-2">Nombre final de documents envoyés au LLM (Top N)</label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                step="1"
                                value={topN}
                                onChange={(e) => updateRerank({ top_n: parseInt(e.target.value) })}
                                className="w-full cursor-pointer"
                            />
                            <div className="flex justify-between text-sm text-gray-500 mt-1">
                                <span>1</span>
                                <span className="font-bold text-gray-900 dark:text-white">{topN} documents</span>
                                <span>10</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Plus ce nombre est élevé, plus le LLM aura de contexte, mais plus l'inférence sera lente et coûteuse (si via API).</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-100 dark:border-gray-800">
                <Button variant="outline" onClick={() => wizard.prevStep()}>Retour</Button>
                <Button onClick={() => wizard.nextStep()}>Continuer</Button>
            </div>
        </div>
    );
}
