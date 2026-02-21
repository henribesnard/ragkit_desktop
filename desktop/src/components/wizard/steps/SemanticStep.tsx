import { Button } from "@/components/ui/Button";

export function SemanticStep({ wizard }: { wizard: any }) {
    const { state, updateConfig } = wizard;
    const semanticCfg = state.config?.retrieval?.semantic || {};

    const topK = semanticCfg.top_k || 5;
    const threshold = semanticCfg.score_threshold || 0.5;

    const updateSemantic = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.retrieval) cfg.retrieval = {};
            if (!cfg.retrieval.semantic) cfg.retrieval.semantic = {};
            cfg.retrieval.semantic = { ...cfg.retrieval.semantic, ...patch };
            return cfg;
        });
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">Paramètres de Recherche Sémantique</h1>
            <p className="text-gray-500 mb-8">
                Ajustez comment le système récupère les documents basés sur le sens de votre question.
            </p>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6 mb-8">
                <div>
                    <label className="block font-medium mb-2">Nombre de résultats (Top K)</label>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={topK}
                        onChange={(e) => updateSemantic({ top_k: parseInt(e.target.value) })}
                        className="w-full cursor-pointer"
                    />
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                        <span>1</span>
                        <span className="font-bold text-gray-900 dark:text-white">{topK} documents</span>
                        <span>20</span>
                    </div>
                </div>

                <div>
                    <label className="block font-medium mb-2">Score de similarité minimum</label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={threshold}
                        onChange={(e) => updateSemantic({ score_threshold: parseFloat(e.target.value) })}
                        className="w-full cursor-pointer"
                    />
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                        <span>0.0 (Tout accepter)</span>
                        <span className="font-bold text-gray-900 dark:text-white">{threshold.toFixed(2)}</span>
                        <span>1.0 (Exactitude parfaite)</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Un seuil plus élevé réduit les faux positifs mais risque d'ignorer des documents pertinents.</p>
                </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-100 dark:border-gray-800">
                <Button variant="outline" onClick={() => wizard.prevStep()}>Retour</Button>
                <Button onClick={() => wizard.nextStep()}>Continuer</Button>
            </div>
        </div>
    );
}
