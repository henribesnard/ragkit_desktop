import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { ipc } from "@/lib/ipc";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, CheckCircle, AlertCircle, Cpu, Download, Cloud } from "lucide-react";
import { useTranslation } from "react-i18next";

const API_PROVIDERS = [
    { value: "openai", label: "OpenAI" },
    { value: "cohere", label: "Cohere" },
];

export function EmbeddingStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig, setStepValid } = wizard;
    const embCfg = state.config?.embedding || {};

    const [apiKey, setApiKey] = useState("");
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);

    const provider = embCfg.provider || "huggingface";
    const model = embCfg.model || "intfloat/multilingual-e5-large";

    const isHuggingface = provider === "huggingface";
    const isOllama = provider === "ollama";
    const isApiProvider = !isHuggingface && !isOllama;

    // Ref to track the current model value for async callbacks
    const modelRef = useRef(model);
    modelRef.current = model;

    const updateEmbedding = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.embedding) cfg.embedding = {};
            cfg.embedding = { ...cfg.embedding, ...patch };
            return cfg;
        });
        setTestResult(null);
        setStepValid(false);
    };

    const handleSwitchToLocal = () => {
        updateEmbedding({ provider: "huggingface" });
    };

    const handleSwitchToOllama = () => {
        updateEmbedding({ provider: "ollama" });
    };

    const handleSwitchToApi = (apiProvider?: string) => {
        const target = apiProvider || (isApiProvider ? provider : "openai");
        updateEmbedding({ provider: target });
    };

    useEffect(() => {
        if (!embCfg.provider || !embCfg.model) {
            updateEmbedding({ provider, model });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [embCfg.provider, embCfg.model, provider, model]);

    useEffect(() => {
        if (provider === "ollama") {
            setLoadingModels(true);
            invoke("get_available_models", { provider: "ollama" })
                .then((res: any) => {
                    const models = res?.map((m: any) => m.id) || [];
                    setOllamaModels(models);
                    const currentModel = modelRef.current;
                    if (models.length > 0 && !models.includes(currentModel)) {
                        updateEmbedding({ model: models[0] });
                    }
                })
                .catch(console.error)
                .finally(() => setLoadingModels(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [provider]);

    useEffect(() => {
        if (provider === "openai" && model !== "text-embedding-3-small" && model !== "text-embedding-3-large") {
            updateEmbedding({ model: "text-embedding-3-small" });
        } else if (provider === "huggingface" && model !== "intfloat/multilingual-e5-large") {
            updateEmbedding({ model: "intfloat/multilingual-e5-large" });
        } else if (provider === "cohere" && model !== "embed-multilingual-v3.0" && model !== "embed-multilingual-light-v3.0") {
            updateEmbedding({ model: "embed-multilingual-v3.0" });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [provider, model]);

    const secretKeyName = isApiProvider ? `loko.embedding.${provider}.api_key` : null;

    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            if (secretKeyName && apiKey) {
                await invoke("store_secret", { keyName: secretKeyName, value: apiKey });
            }

            const res: any = await ipc.testEmbeddingConnection(provider, model);
            if (res.success) {
                setTestResult({ success: true, msg: t('wizard.embedding.testSuccess') });
                setStepValid(true);
            } else {
                setTestResult({ success: false, msg: res.error || res.message || t('wizard.embedding.testFailed') });
            }
        } catch (e: any) {
            setTestResult({ success: false, msg: e.toString() });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">{t('wizard.embedding.title')}</h1>
            <p className="text-gray-500 mb-8">
                {t('wizard.embedding.subtitle')}
            </p>

            {/* Provider Category Selection — 3 buttons like LLMStep */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <button
                    onClick={handleSwitchToLocal}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${isHuggingface ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <Download className={`w-5 h-5 ${isHuggingface ? "text-blue-600" : "text-gray-400"}`} />
                        <h3 className="font-semibold text-lg">{t('wizard.embedding.localRecommend')}</h3>
                    </div>
                    <p className="text-sm text-gray-500">{t('wizard.embedding.localRecommendDesc')}</p>
                </button>

                <button
                    onClick={handleSwitchToOllama}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${isOllama ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <Cpu className={`w-5 h-5 ${isOllama ? "text-blue-600" : "text-gray-400"}`} />
                        <h3 className="font-semibold text-lg">{t('wizard.embedding.ollamaLocal')}</h3>
                    </div>
                    <p className="text-sm text-gray-500">{t('wizard.embedding.ollamaLocalDesc')}</p>
                </button>

                <button
                    onClick={() => handleSwitchToApi()}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${isApiProvider ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <Cloud className={`w-5 h-5 ${isApiProvider ? "text-blue-600" : "text-gray-400"}`} />
                        <h3 className="font-semibold text-lg">{t('wizard.embedding.apiProvider')}</h3>
                    </div>
                    <p className="text-sm text-gray-500">{t('wizard.embedding.apiProviderDesc')}</p>
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 mb-8">
                {/* API provider sub-selector */}
                {isApiProvider && (
                    <>
                        <div>
                            <label className="block font-medium mb-1 text-sm">{t('wizard.embedding.providerLabel')}</label>
                            <div className="grid grid-cols-2 gap-2">
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
                                {t('wizard.embedding.apiKeyLabel')} {API_PROVIDERS.find(p => p.value === provider)?.label}
                            </label>
                            <input
                                type="password"
                                className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                                placeholder={t('wizard.embedding.apiKeyPlaceholder')}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">{t('wizard.embedding.apiKeyDesc')}</p>
                        </div>

                        {/* Model selector for API provider */}
                        <div>
                            <label className="block font-medium mb-1 text-sm">{t('wizard.embedding.modelLabel')}</label>
                            {provider === "openai" && (
                                <select
                                    className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                                    value={model}
                                    onChange={(e) => updateEmbedding({ model: e.target.value })}
                                >
                                    <option value="text-embedding-3-small">{t('wizard.embedding.openaiSmall')}</option>
                                    <option value="text-embedding-3-large">{t('wizard.embedding.openaiLarge')}</option>
                                </select>
                            )}
                            {provider === "cohere" && (
                                <select
                                    className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                                    value={model}
                                    onChange={(e) => updateEmbedding({ model: e.target.value })}
                                >
                                    <option value="embed-multilingual-v3.0">{t('wizard.embedding.cohereMultilingual')}</option>
                                    <option value="embed-multilingual-light-v3.0">{t('wizard.embedding.cohereMultilingualLight')}</option>
                                </select>
                            )}
                        </div>
                    </>
                )}

                {/* Ollama */}
                {isOllama && (
                    <div>
                        <label className="block font-medium mb-1 text-sm">{t('wizard.embedding.ollamaModel')}</label>
                        {loadingModels ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500 p-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> {t('wizard.embedding.loadingModels')}
                            </div>
                        ) : ollamaModels.length === 0 ? (
                            <div className="text-amber-600 bg-amber-50 p-3 rounded-md text-sm">
                                {t('wizard.embedding.noOllamaModels')}
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

                {/* HuggingFace (Local) */}
                {isHuggingface && (
                    <div className="flex flex-col gap-2">
                        <label className="block font-medium mb-1 text-sm">{t('wizard.embedding.localModel')}</label>
                        <input
                            type="text"
                            className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700 bg-gray-50 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                            value={model}
                            readOnly
                        />
                        <p className="text-xs text-gray-500">{t('wizard.embedding.localModelDesc')}</p>
                    </div>
                )}

                {/* Test connection */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-3">
                    <Button onClick={handleTest} variant="outline" className="w-full sm:w-auto self-start" disabled={isTesting || (isApiProvider && !apiKey)}>
                        {isTesting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('wizard.embedding.testingConnection')}</> : t('wizard.embedding.testConnection')}
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
