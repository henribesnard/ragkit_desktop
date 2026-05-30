import { useState, useEffect, useRef } from "react";
import { LatencyImpactBadge } from "@/components/ui/LatencyImpactBadge";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, CheckCircle, AlertCircle, Key, Cpu, Cloud } from "lucide-react";
import { useTranslation } from "react-i18next";

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
    const { t } = useTranslation();
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

    const secretKeyName = isApiProvider ? `loko.llm.${provider}.api_key` : null;

    const handleSaveKey = async () => {
        if (!secretKeyName || !apiKey.trim()) return;
        try {
            await invoke("store_secret", { keyName: secretKeyName, value: apiKey.trim() });
            setTestResult({ success: true, msg: t('wizard.llm.apiKeySaved') });
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
            setTestResult({ success: true, msg: t('wizard.llm.configReady') });
            setStepValid(true);
        } catch (e: any) {
            setTestResult({ success: false, msg: e.toString() });
        } finally {
            setIsTesting(false);
        }
    };

    const selectedModel = models.find(m => m.id === model);

    return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6 }}>
                {t('wizard.llm.title')}
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginBottom: 22 }}>
                {t('wizard.llm.subtitle')}
            </p>

            {/* Provider Category Selection */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
                <button
                    onClick={handleSwitchToOllama}
                    style={{
                        padding: 16,
                        borderRadius: 14,
                        border: isOllama ? "2px solid var(--brand)" : "1px solid var(--border)",
                        background: isOllama ? "var(--brand-weak)" : "var(--surface)",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "border-color .14s, background .14s",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                        <Cpu style={{ width: 20, height: 20, color: isOllama ? "var(--brand)" : "var(--text-3)" }} />
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{t('wizard.llm.ollamaLocal')}</div>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-3)" }}>{t('wizard.llm.ollamaLocalDesc')}</p>
                    {isOllama && (
                        <div style={{ marginTop: 8 }}>
                            <LatencyImpactBadge level="high" description={t("latency.providerOllamaDesc")} />
                        </div>
                    )}
                </button>

                <button
                    onClick={() => handleSwitchToApi()}
                    style={{
                        padding: 16,
                        borderRadius: 14,
                        border: isApiProvider ? "2px solid var(--brand)" : "1px solid var(--border)",
                        background: isApiProvider ? "var(--brand-weak)" : "var(--surface)",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "border-color .14s, background .14s",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                        <Cloud style={{ width: 20, height: 20, color: isApiProvider ? "var(--brand)" : "var(--text-3)" }} />
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{t('wizard.llm.apiProvider')}</div>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-3)" }}>{t('wizard.llm.apiProviderDesc')}</p>
                </button>
            </div>

            <div className="loko-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                {isApiProvider && (
                    <>
                        {/* API Provider Selector */}
                        <div>
                            <label style={{ display: "block", fontWeight: 500, marginBottom: 4, fontSize: 13 }}>{t('wizard.llm.providerLabel')}</label>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                                {API_PROVIDERS.map(p => (
                                    <button
                                        key={p.value}
                                        onClick={() => handleSwitchToApi(p.value)}
                                        style={{
                                            padding: "8px 12px",
                                            borderRadius: 10,
                                            border: provider === p.value ? "2px solid var(--brand)" : "1px solid var(--border)",
                                            background: provider === p.value ? "var(--brand-weak)" : "transparent",
                                            color: provider === p.value ? "var(--brand)" : "var(--text-2)",
                                            fontSize: 13,
                                            fontWeight: 500,
                                            cursor: "pointer",
                                            transition: "border-color .14s, background .14s",
                                        }}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* API Key */}
                        <div>
                            <label style={{ display: "block", fontWeight: 500, marginBottom: 4, fontSize: 13 }}>
                                {t('wizard.llm.apiKeyLabel')} {API_PROVIDERS.find(p => p.value === provider)?.label}
                            </label>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input
                                    type="password"
                                    style={{ flex: 1, borderRadius: 8, border: "1px solid var(--border)", padding: 8, background: "var(--surface)", color: "var(--text)" }}
                                    placeholder={t('wizard.llm.apiKeyPlaceholder')}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                />
                                <button
                                    className="btn btn-secondary"
                                    onClick={handleSaveKey}
                                    disabled={!apiKey.trim()}
                                    style={{ flexShrink: 0 }}
                                >
                                    <Key className="w-4 h-4" />
                                </button>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{t('wizard.llm.apiKeyDesc')}</p>
                        </div>
                    </>
                )}

                {/* Model Selector */}
                <div>
                    <label style={{ display: "block", fontWeight: 500, marginBottom: 4, fontSize: 13 }}>
                        {isOllama ? t('wizard.llm.localModelLabel') : t('wizard.llm.modelLabel')}
                    </label>
                    {loadingModels ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-3)", padding: 8 }}>
                            <Loader2 className="w-4 h-4 animate-spin" /> {t('wizard.llm.loadingModels')}
                        </div>
                    ) : models.length === 0 ? (
                        <div style={{ color: "var(--danger)", background: "var(--danger-bg)", padding: 12, borderRadius: 8, fontSize: 13 }}>
                            {isOllama
                                ? t('wizard.llm.noOllamaModels')
                                : t('wizard.llm.noApiModels')}
                        </div>
                    ) : (
                        <select
                            style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: 8, background: "var(--surface)", color: "var(--text)" }}
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
                    <div style={{ fontSize: 12, color: "var(--text-3)", background: "var(--surface-2)", padding: 12, borderRadius: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                        {selectedModel.context_window ? <div>{t('wizard.llm.contextWindow')} : {selectedModel.context_window.toLocaleString()} {t('wizard.llm.tokens')}</div> : null}
                        {selectedModel.quality_rating ? <div>{t('wizard.llm.quality')} : {"★".repeat(selectedModel.quality_rating)}{"☆".repeat(5 - selectedModel.quality_rating)}</div> : null}
                        {selectedModel.cost_input ? <div>{t('wizard.llm.cost')} : {selectedModel.cost_input}</div> : null}
                        {selectedModel.latency_hint ? <div>{t('wizard.llm.latency')} : {selectedModel.latency_hint}</div> : null}
                    </div>
                )}

                {/* Validate */}
                <div style={{ paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                    <button
                        className="btn btn-secondary"
                        onClick={handleTest}
                        disabled={isTesting || (isApiProvider && !apiKey && models.length === 0)}
                        style={{ alignSelf: "flex-start" }}
                    >
                        {isTesting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('wizard.llm.validating')}</> : t('wizard.llm.validateChoice')}
                    </button>

                    {testResult && (
                        <div style={{
                            padding: 12,
                            borderRadius: 8,
                            fontSize: 13,
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                            background: testResult.success ? "var(--brand-weak)" : "var(--danger-bg)",
                            color: testResult.success ? "var(--brand)" : "var(--danger)",
                            border: testResult.success ? "1px solid var(--brand)" : "1px solid var(--danger)",
                        }}>
                            {testResult.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                            <span>{testResult.msg}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
