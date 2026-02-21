import { Button } from "@/components/ui/Button";
import { Database } from "lucide-react";

export function VectorStoreStep({ wizard }: { wizard: any }) {
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
            <h1 className="text-2xl font-bold mb-4">Base de Données Vectorielle</h1>
            <p className="text-gray-500 mb-8">
                C'est ici que vos documents découpés et vectorisés seront stockés pour une recherche ultra-rapide.
            </p>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6 mb-8">
                <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900">
                    <Database className="w-8 h-8 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div>
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100">Qdrant Local (Par défaut)</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            RAGKIT intègre nativement Qdrant. Vos données restent sur cet ordinateur, sans configuration complexe requise.
                        </p>
                    </div>
                </div>

                <div>
                    <label className="block font-medium mb-1 text-sm">Nom de la collection</label>
                    <input
                        type="text"
                        className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                        value={collectionName}
                        onChange={(e) => updateVectorStore({ collection_name: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Caractères alphanumériques, tirets et underscores uniquement.</p>
                </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-100 dark:border-gray-800">
                <Button variant="outline" onClick={() => wizard.prevStep()}>Retour</Button>
                <Button onClick={() => wizard.nextStep()} disabled={!collectionName.trim()}>
                    Continuer
                </Button>
            </div>
        </div>
    );
}
