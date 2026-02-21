import { Button } from "@/components/ui/Button";
import { Search, TextSearch, Layers } from "lucide-react";

export function SearchTypeStep({ wizard }: { wizard: any }) {
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
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">Stratégie de Recherche</h1>
            <p className="text-gray-500 mb-8">
                Comment souhaitez-vous que RAGKIT recherche l'information pour générer ses réponses ?
            </p>

            <div className="space-y-4 mb-8">
                <button
                    onClick={() => setType("hybrid")}
                    className={`w-full flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all ${searchType === "hybrid" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-800"}`}
                >
                    <div className={`p-3 rounded-lg ${searchType === "hybrid" ? "bg-blue-100 dark:bg-blue-900 text-blue-600" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                        <Layers className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg mb-1">Recherche Hybride (Recommandée)</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">Combine la force de la recherche sémantique (conceptuelle) et de la recherche lexicale (mots-clés exacts).</p>
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
                        <h3 className="font-semibold text-lg mb-1">Recherche Sémantique</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">Trouve des documents par leur sens et leurs concepts, même si les mots-clés exacts ne correspondent pas.</p>
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
                        <h3 className="font-semibold text-lg mb-1">Recherche Lexicale (BM25)</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">Idéal pour trouver des termes techniques précis, des références de produits ou des noms propres par mots-clés.</p>
                    </div>
                </button>
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-100 dark:border-gray-800">
                <Button variant="outline" onClick={() => wizard.prevStep()}>Retour</Button>
                <Button onClick={() => wizard.nextStep()}>Continuer</Button>
            </div>
        </div>
    );
}
