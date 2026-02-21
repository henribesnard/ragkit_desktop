import { Button } from "@/components/ui/Button";

export function LexicalStep({ wizard }: { wizard: any }) {
    const { state, updateConfig } = wizard;
    const lexicalCfg = state.config?.retrieval?.lexical || {};

    const topK = lexicalCfg.top_k || 5;

    const updateLexical = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.retrieval) cfg.retrieval = {};
            if (!cfg.retrieval.lexical) cfg.retrieval.lexical = {};
            cfg.retrieval.lexical = { ...cfg.retrieval.lexical, ...patch };
            return cfg;
        });
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">Paramètres de Recherche Lexicale</h1>
            <p className="text-gray-500 mb-8">
                Ajustez comment le système trouve les documents contenant les mots exacts de votre requête (BM25).
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
                        onChange={(e) => updateLexical({ top_k: parseInt(e.target.value) })}
                        className="w-full cursor-pointer"
                    />
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                        <span>1</span>
                        <span className="font-bold text-gray-900 dark:text-white">{topK} documents</span>
                        <span>20</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Définit combien de blocs de texte le système doit extraire lorsqu'il cherche des correspondances exactes de mots-clés.</p>
                </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-100 dark:border-gray-800">
                <Button variant="outline" onClick={() => wizard.prevStep()}>Retour</Button>
                <Button onClick={() => wizard.nextStep()}>Continuer</Button>
            </div>
        </div>
    );
}
