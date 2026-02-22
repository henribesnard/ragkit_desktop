import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { ipc } from "@/lib/ipc";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, CheckCircle, AlertCircle, Key, Cpu, Download } from "lucide-react";

export function EmbeddingStep({ wizard }: { wizard: any }) {
    const { state, updateConfig } = wizard;
    const embCfg = state.config?.embedding || {};

    const [apiKey, setApiKey] = useState("");
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);

    const provider = embCfg.provider || "huggingface";
    const model = embCfg.model || "intfloat/multilingual-e5-large";

    const updateEmbedding = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.embedding) cfg.embedding = {};
            cfg.embedding = { ...cfg.embedding, ...patch };
            return cfg;
        });
        setTestResult(null); // reset testing whenever config changes
    };

    useEffect(() => {
        if (!embCfg.provider || !embCfg.model) {
            updateEmbedding({ provider, model });
        }
    }, [embCfg.provider, embCfg.model, provider, model]);

    useEffect(() => {
        if (provider === "ollama") {
            setLoadingModels(true);
            invoke("get_available_models", { provider: "ollama" })
                .then((res: any) => {
                    const models = res?.map((m: any) => m.id) || [];
                    setOllamaModels(models);
                    if (models.length > 0 && !models.includes(model)) {
                        updateEmbedding({ model: models[0] });
                    }
                })
                .catch(console.error)
                .finally(() => setLoadingModels(false));
        }
    }, [provider]);

    useEffect(() => {
        if (provider === "openai" && model !== "text-embedding-3-small" && model !== "text-embedding-3-large") {
            updateEmbedding({ model: "text-embedding-3-small" });
        } else if (provider === "huggingface" && model !== "intfloat/multilingual-e5-large") {
            updateEmbedding({ model: "intfloat/multilingual-e5-large" });
        }
    }, [provider, model]);


    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            if (provider === "openai" && apiKey) {
                // Save the key first
                await invoke("store_secret", { keyName: "ragkit.embedding.openai.api_key", value: apiKey });
            }

            const res: any = await ipc.testEmbeddingConnection(provider, model);
            if (res.success) {
                setTestResult({ success: true, msg: "Connexion réussie !" });
            } else {
                setTestResult({ success: false, msg: res.error || "Échec de la connexion" });
            }
        } catch (e: any) {
            setTestResult({ success: false, msg: e.toString() });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">Modèle d'Embedding</h1>
            <p className="text-gray-500 mb-8">
                Les embeddings convertissent vos textes en vecteurs mathématiques pour permettre la recherche sémantique.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <button
                    onClick={() => updateEmbedding({ provider: "huggingface" })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${provider === "huggingface" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700"}`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <Download className={`w-5 h-5 ${provider === "huggingface" ? "text-blue-600" : "text-gray-400"}`} />
                        <h3 className="font-semibold text-lg">Local (Recommandé)</h3>
                    </div>
                    <p className="text-sm text-gray-500">Multilingual E5. Environ 2.2Go seront téléchargés au premier test. Optimisé CPU/GPU.</p>
                </button>

                <button
                    onClick={() => updateEmbedding({ provider: "openai" })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${provider === "openai" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700"}`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <Key className={`w-5 h-5 ${provider === "openai" ? "text-blue-600" : "text-gray-400"}`} />
                        <h3 className="font-semibold text-lg">OpenAI API</h3>
                    </div>
                    <p className="text-sm text-gray-500">Rapide, performant et précis. Nécessite une clé API OpenAI payante.</p>
                </button>

                <button
                    onClick={() => updateEmbedding({ provider: "ollama" })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${provider === "ollama" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700"}`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <Cpu className={`w-5 h-5 ${provider === "ollama" ? "text-blue-600" : "text-gray-400"}`} />
                        <h3 className="font-semibold text-lg">Ollama (Local)</h3>
                    </div>
                    <p className="text-sm text-gray-500">100% privé, gratuit. Idéal si vous avez déjà téléchargé nomic-embed-text.</p>
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 mb-8">
                {provider === "openai" && (
                    <>
                        <div>
                            <label className="block font-medium mb-1 text-sm">Modèle OpenAI</label>
                            <select
                                className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                                value={model}
                                onChange={(e) => updateEmbedding({ model: e.target.value })}
                            >
                                <option value="text-embedding-3-small">text-embedding-3-small (Rapide & Éco)</option>
                                <option value="text-embedding-3-large">text-embedding-3-large (Haute précision)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block font-medium mb-1 text-sm">Clé API OpenAI (OPENAI_API_KEY)</label>
                            <input
                                type="password"
                                className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                                placeholder="sk-..."
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">La clé sera stockée de manière sécurisée dans le trousseau de votre OS.</p>
                        </div>
                    </>
                )}

                {provider === "ollama" && (
                    <div>
                        <label className="block font-medium mb-1 text-sm">Modèle local Ollama</label>
                        {loadingModels ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500 p-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Chargement des modèles...
                            </div>
                        ) : ollamaModels.length === 0 ? (
                            <div className="text-amber-600 bg-amber-50 p-3 rounded-md text-sm">
                                Aucun modèle Ollama détecté. Veuillez installer Ollama et télécharger un modèle d'embedding (ex: nomic-embed-text).
                            </div>
                        ) : (
                            <select
                                className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                                value={model}
                                onChange={(e) => updateEmbedding({ model: e.target.value })}
                            >
                                {ollamaModels.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

                {provider === "huggingface" && (
                    <div className="flex flex-col gap-2">
                        <label className="block font-medium mb-1 text-sm">Modèle SentenceTransformers Local</label>
                        <input
                            type="text"
                            className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 bg-gray-50 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                            value={model}
                            readOnly
                        />
                        <p className="text-xs text-gray-500">Ce modèle sera téléchargé et exécuté localement indépendamment de Ollama. Cliquez sur "Tester la connexion" pour forcer le téléchargement si ce n'est pas déjà fait. Cette opération peut prendre quelques minutes.</p>
                    </div>
                )}

                <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-3">
                    <Button onClick={handleTest} variant="outline" className="w-full sm:w-auto self-start" disabled={isTesting || (provider === "openai" && !apiKey)}>
                        {isTesting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Test de connexion...</> : "Tester la connexion"}
                    </Button>

                    {testResult && (
                        <div className={`p-3 rounded-md text-sm flex items-start gap-2 ${testResult.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                            {testResult.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                            <span>{testResult.msg}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-100 dark:border-gray-800">
                <Button variant="outline" onClick={() => wizard.prevStep()}>Retour</Button>
                <Button onClick={() => wizard.nextStep()} disabled={!testResult?.success}>
                    Continuer
                </Button>
            </div>
            {!testResult?.success && (
                <p className="text-center text-xs text-gray-500 mt-2">Vous devez réussir le test de connexion pour continuer.</p>
            )}
        </div>
    );
}
