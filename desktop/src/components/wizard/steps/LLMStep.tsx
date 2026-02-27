import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, CheckCircle, AlertCircle, Key, Cpu, Cloud } from "lucide-react";

interface ModelInfo {
    id: string;
    name: string;
    context_window?: number;
    quality_rating?: number;
    cost_input?: string;
    latency_hint?: string;
}

const API_PROVIDERS = [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "mistral", label: "Mistral AI" },
    { value: "deepseek", label: "DeepSeek" },
];

export function LLMStep({ wizard }: { wizard: any }) {
    const { state, updateConfig, setStepValid } = wizard;
    const llmCfg = state.config?.llm || {};

    const [apiKey, setApiKey] = useState("");
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);

    const provider = llmCfg.provider || "ollama";
    const model = llmCfg.model || "llama3.2";

    const modelRef = useRef(model);
    modelRef.current = model;

    const isOllama = provider === "ollama";
    const isApiProvider = !isOllama;

    const updateLLM = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.llm) cfg.llm = {};
            cfg.llm = { ...cfg.llm, ...patch };
            return cfg;
        });
        setTestResult(null);
        setStepValid(false);
    };

    // Initialize defaults
    useEffect(() => {
        if (!llmCfg.provider || !llmCfg.model) {
            updateLLM({ provider, model });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [llmCfg.provider, llmCfg.model, provider, model]);

    // Load models when provider changes
    useEffect(() => {
        setLoadingModels(true);
        setModels([]);
        invoke("get_llm_models", { provider })
            .then((res: any) => {
                const fetched: ModelInfo[] = res || [];
                setModels(fetched);
                const currentModel = modelRef.current;
                if (fetched.length > 0 && !fetched.some(m => m.id === currentModel)) {
                    updateLLM({ model: fetched[0].id });
                }
            })
            .catch(console.error)
            .finally(() => setLoadingModels(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [provider]);

    const handleSwitchToOllama = () => {
        updateLLM({ provider: "ollama" });
    };

    const handleSwitchToApi = (apiProvider?: string) => {
        const target = apiProvider || (isApiProvider ? provider : "openai");
        updateLLM({ provider: target });
    };

    const secretKeyName = isApiProvider ? `ragkit.llm.${provider}.api_key` : null;

    const handleSaveKey = async () => {
        if (!secretKeyName || !apiKey.trim()) return;
        try {
            await invoke("store_secret", { keyName: secretKeyName, value: apiKey.trim() });
            setTestResult({ success: true, msg: "Clé API enregistrée !" });
            setApiKey("");
        } catch (e: any) {
            setTestResult({ success: false, msg: e.toString() });
        }
    };

    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            if (secretKeyName && apiKey.trim()) {
                await invoke("store_secret", { keyName: secretKeyName, value: apiKey.trim() });
                setApiKey("");
            }
            setTestResult({ success: true, msg: "Configuration prête !" });
            setStepValid(true);
        } catch (e: any) {
            setTestResult({ success: false, msg: e.toString() });
        } finally {
            setIsTesting(false);
        }
    };

    const selectedModel = models.find(m => m.id === model);

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">Générateur de Réponses (LLM)</h1>
            <p className="text-gray-500 mb-8">
                C'est le "cerveau" qui va lire les documents trouvés et rédiger la réponse finale pour vous.
            </p>

            {/* Provider Category Selection */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                    onClick={handleSwitchToOllama}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${isOllama ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <Cpu className={`w-5 h-5 ${isOllama ? "text-blue-600" : "text-gray-400"}`} />
                        <h3 className="font-semibold text-lg">Ollama (Local)</h3>
                    </div>
                    <p className="text-sm text-gray-500">100% privé et gratuit. Idéal avec Llama 3, Qwen 3, Mistral.</p>
                </button>

                <button
                    onClick={() => handleSwitchToApi()}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${isApiProvider ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <Cloud className={`w-5 h-5 ${isApiProvider ? "text-blue-600" : "text-gray-400"}`} />
                        <h3 className="font-semibold text-lg">Fournisseur API</h3>
                    </div>
                    <p className="text-sm text-gray-500">Très intelligent et rapide. Nécessite une clé API payante.</p>
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 mb-8">
                {isApiProvider && (
                    <>
                        {/* API Provider Selector */}
                        <div>
                            <label className="block font-medium mb-1 text-sm">Fournisseur</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {API_PROVIDERS.map(p => (
                                    <button
                                        key={p.value}
                                        onClick={() => handleSwitchToApi(p.value)}
                                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${provider === p.value
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                                            }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* API Key */}
                        <div>
                            <label className="block font-medium mb-1 text-sm">
                                Clé API {API_PROVIDERS.find(p => p.value === provider)?.label}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    className="flex-1 rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                                    placeholder="Collez votre clé API..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                />
                                <Button
                                    variant="outline"
                                    onClick={handleSaveKey}
                                    disabled={!apiKey.trim()}
                                    className="shrink-0"
                                >
                                    <Key className="w-4 h-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">La clé sera stockée de manière sécurisée dans le trousseau de votre OS.</p>
                        </div>
                    </>
                )}

                {/* Model Selector */}
                <div>
                    <label className="block font-medium mb-1 text-sm">
                        {isOllama ? "Modèle local Ollama" : "Modèle"}
                    </label>
                    {loadingModels ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 p-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Chargement des modèles...
                        </div>
                    ) : models.length === 0 ? (
                        <div className="text-amber-600 bg-amber-50 p-3 rounded-md text-sm">
                            {isOllama
                                ? "Aucun modèle LLM Ollama détecté. Téléchargez un modèle (ex: ollama pull llama3.2)."
                                : "Aucun modèle disponible pour ce fournisseur."}
                        </div>
                    ) : (
                        <select
                            className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                            value={model}
                            onChange={(e) => updateLLM({ model: e.target.value })}
                        >
                            {models.map(m => (
                                <option key={m.id} value={m.id}>{m.name || m.id}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Model Details */}
                {selectedModel && (selectedModel.context_window || selectedModel.quality_rating || selectedModel.cost_input) && (
                    <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg space-y-1">
                        {selectedModel.context_window ? <div>Contexte : {selectedModel.context_window.toLocaleString()} tokens</div> : null}
                        {selectedModel.quality_rating ? <div>Qualité : {"★".repeat(selectedModel.quality_rating)}{"☆".repeat(5 - selectedModel.quality_rating)}</div> : null}
                        {selectedModel.cost_input ? <div>Coût : {selectedModel.cost_input}</div> : null}
                        {selectedModel.latency_hint ? <div>Latence : {selectedModel.latency_hint}</div> : null}
                    </div>
                )}

                {/* Validate */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-3">
                    <Button
                        onClick={handleTest}
                        variant="outline"
                        className="w-full sm:w-auto self-start"
                        disabled={isTesting || (isApiProvider && !apiKey && models.length === 0)}
                    >
                        {isTesting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Validation...</> : "Valider le choix"}
                    </Button>

                    {testResult && (
                        <div className={`p-3 rounded-md text-sm flex items-start gap-2 ${testResult.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                            {testResult.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                            <span>{testResult.msg}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
