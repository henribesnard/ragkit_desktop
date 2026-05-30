import { useState, useEffect, useRef } from "react";
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
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6 }}>
                {t('wizard.embedding.title')}
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginBottom: 22 }}>
                {t('wizard.embedding.subtitle')}
            </p>

            {/* Provider Category Selection -- 3 buttons like LLMStep */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 12 }}>
                <button
                    onClick={handleSwitchToLocal}
                    style={{
                        padding: 16,
                        borderRadius: 14,
                        border: isHuggingface ? "2px solid var(--brand)" : "1px solid var(--border)",
                        background: isHuggingface ? "var(--brand-weak)" : "var(--surface)",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "border-color .14s, background .14s",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                        <Download style={{ width: 20, height: 20, color: isHuggingface ? "var(--brand)" : "var(--text-3)" }} />
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{t('wizard.embedding.localRecommend')}</div>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-3)" }}>{t('wizard.embedding.localRecommendDesc')}</p>
                </button>

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
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{t('wizard.embedding.ollamaLocal')}</div>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-3)" }}>{t('wizard.embedding.ollamaLocalDesc')}</p>
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
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{t('wizard.embedding.apiProvider')}</div>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-3)" }}>{t('wizard.embedding.apiProviderDesc')}</p>
                </button>
            </div>

            <div className="loko-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                {/* API provider sub-selector */}
                {isApiProvider && (
                    <>
                        <div>
                            <label style={{ display: "block", fontWeight: 500, marginBottom: 4, fontSize: 13 }}>{t('wizard.embedding.providerLabel')}</label>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
                                {t('wizard.embedding.apiKeyLabel')} {API_PROVIDERS.find(p => p.value === provider)?.label}
                            </label>
                            <input
                                type="password"
                                style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: 8, background: "var(--surface)", color: "var(--text)" }}
                                placeholder={t('wizard.embedding.apiKeyPlaceholder')}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                            />
                            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{t('wizard.embedding.apiKeyDesc')}</p>
                        </div>

                        {/* Model selector for API provider */}
                        <div>
                            <label style={{ display: "block", fontWeight: 500, marginBottom: 4, fontSize: 13 }}>{t('wizard.embedding.modelLabel')}</label>
                            {provider === "openai" && (
                                <select
                                    style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: 8, background: "var(--surface)", color: "var(--text)" }}
                                    value={model}
                                    onChange={(e) => updateEmbedding({ model: e.target.value })}
                                >
                                    <option value="text-embedding-3-small">{t('wizard.embedding.openaiSmall')}</option>
                                    <option value="text-embedding-3-large">{t('wizard.embedding.openaiLarge')}</option>
                                </select>
                            )}
                            {provider === "cohere" && (
                                <select
                                    style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: 8, background: "var(--surface)", color: "var(--text)" }}
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
                        <label style={{ display: "block", fontWeight: 500, marginBottom: 4, fontSize: 13 }}>{t('wizard.embedding.ollamaModel')}</label>
                        {loadingModels ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-3)", padding: 8 }}>
                                <Loader2 className="w-4 h-4 animate-spin" /> {t('wizard.embedding.loadingModels')}
                            </div>
                        ) : ollamaModels.length === 0 ? (
                            <div style={{ color: "var(--danger)", background: "var(--danger-bg)", padding: 12, borderRadius: 8, fontSize: 13 }}>
                                {t('wizard.embedding.noOllamaModels')}
                            </div>
                        ) : (
                            <select
                                style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: 8, background: "var(--surface)", color: "var(--text)" }}
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
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <label style={{ display: "block", fontWeight: 500, marginBottom: 4, fontSize: 13 }}>{t('wizard.embedding.localModel')}</label>
                        <input
                            type="text"
                            style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: 8, background: "var(--surface-2)", color: "var(--text-2)", cursor: "not-allowed" }}
                            value={model}
                            readOnly
                        />
                        <p style={{ fontSize: 12, color: "var(--text-3)" }}>{t('wizard.embedding.localModelDesc')}</p>
                    </div>
                )}

                {/* Test connection */}
                <div style={{ paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                    <button className="btn btn-secondary" onClick={handleTest} disabled={isTesting || (isApiProvider && !apiKey)} style={{ alignSelf: "flex-start" }}>
                        {isTesting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('wizard.embedding.testingConnection')}</> : t('wizard.embedding.testConnection')}
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
