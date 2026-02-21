import { Button } from "@/components/ui/Button";

export function ChunkingStep({ wizard }: { wizard: any }) {
    const { state, updateConfig } = wizard;
    const chunkCfg = state.config?.chunking || {};

    const updateChunking = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.chunking) cfg.chunking = {};
            cfg.chunking = { ...cfg.chunking, ...patch };
            return cfg;
        });
    };

    const size = chunkCfg.chunk_size || 512;
    const overlap = chunkCfg.chunk_overlap || 50;

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">Découpage Sémantique (Chunking)</h1>
            <p className="text-gray-500 mb-8">
                Les documents longs sont divisés en petits morceaux ("chunks") pour être traités efficacement.
            </p>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-6 mb-8">
                <div>
                    <label className="block font-medium mb-2">Taille d'un paragraphe (Tokens)</label>
                    <input
                        type="range"
                        min="128"
                        max="2048"
                        step="128"
                        value={size}
                        onChange={(e) => updateChunking({ chunk_size: parseInt(e.target.value) })}
                        className="w-full cursor-pointer"
                    />
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                        <span>128 (Précis)</span>
                        <span className="font-bold text-gray-900 dark:text-white">{size} Tokens</span>
                        <span>2048 (Contexte large)</span>
                    </div>
                </div>

                <div>
                    <label className="block font-medium mb-2">Chevauchement (Overlap)</label>
                    <input
                        type="range"
                        min="0"
                        max="500"
                        step="10"
                        value={overlap}
                        onChange={(e) => updateChunking({ chunk_overlap: parseInt(e.target.value) })}
                        className="w-full cursor-pointer"
                    />
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                        <span>0</span>
                        <span className="font-bold text-gray-900 dark:text-white">{overlap} Tokens</span>
                        <span>500</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Le chevauchement évite de couper une phrase ou une idée au milieu.</p>
                </div>

                <label className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div>
                        <span className="block font-medium">Indexation des Chunks</span>
                        <span className="text-sm text-gray-500">Ajoute un identifiant unique (utile pour les LLM)</span>
                    </div>
                    <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 rounded"
                        checked={!!chunkCfg.add_chunk_index}
                        onChange={(e) => updateChunking({ add_chunk_index: e.target.checked })}
                    />
                </label>
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-100 dark:border-gray-800">
                <Button variant="outline" onClick={() => wizard.prevStep()}>Retour</Button>
                <Button onClick={() => wizard.nextStep()}>Continuer</Button>
            </div>
        </div>
    );
}
