import { Button } from "@/components/ui/Button";

export function HybridStep({ wizard }: { wizard: any }) {
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
            <h1 className="text-2xl font-bold mb-4">Paramètres de Recherche Hybride</h1>
            <p className="text-gray-500 mb-8">
                Ajustez comment le système combine les résultats sémantiques et lexicaux.
            </p>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6 mb-8">
                <div>
                    <label className="block font-medium mb-2">Nombre final de résultats (Top K)</label>
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
                        <span className="font-bold text-gray-900 dark:text-white">{topK} documents</span>
                        <span>20</span>
                    </div>
                </div>

                <div>
                    <label className="block font-medium mb-2">Méthode de Fusion</label>
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
                                <span className="block font-medium text-sm">RRF (Reciprocal Rank)</span>
                                <span className="text-xs text-gray-500">Mélange robuste basé sur les rangs.</span>
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
                                <span className="block font-medium text-sm">Combinaison Linéaire</span>
                                <span className="text-xs text-gray-500">Mélange basé sur les pondérations.</span>
                            </div>
                        </label>
                    </div>
                </div>

                {fusion === 'linear' && (
                    <div>
                        <label className="block font-medium mb-2">Pondération Sémantique vs Lexicale</label>
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
                            <span>100% Lexical</span>
                            <span className="font-bold text-gray-900 dark:text-white">{Math.round(semanticWeight * 100)}% Sémantique</span>
                            <span>100% Sémantique</span>
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
