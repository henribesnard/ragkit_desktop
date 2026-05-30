import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { LatencyImpactBadge } from "@/components/ui/LatencyImpactBadge";
import { ipc } from "@/lib/ipc";
import { useTranslation } from "react-i18next";

interface RerankModelInfo {
    id: string;
    name: string;
    size_mb?: number | null;
    cost_per_1k?: string | null;
    latency_hint?: string | null;
    quality_rating?: number;
    languages?: string;
}

const RERANK_DEFAULTS = { provider: "huggingface", top_n: 3 };

const RERANK_KEY_PATHS: Record<string, string> = {
    cohere: "loko.rerank.cohere.api_key",
    jina: "loko.rerank.jina.api_key",
    voyage: "loko.rerank.voyage.api_key",
};

const isCloudProvider = (p: string) => p === "cohere" || p === "jina" || p === "voyage";

export function RerankingStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig, setStepValid } = wizard;
    const rerankCfg = state.config?.rerank || {};

    const [apiKey, setApiKey] = useState("");
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
    const [models, setModels] = useState<RerankModelInfo[]>([]);

    const enabled = rerankCfg.enabled ?? false;
    const provider = rerankCfg.provider || RERANK_DEFAULTS.provider;
    const selectedModel = rerankCfg.model || "";
    const topN = rerankCfg.top_n || RERANK_DEFAULTS.top_n;

    // Load models when provider changes
    useEffect(() => {
        if (!enabled) return;
        // Map wizard "huggingface" to backend "local"
        const backendProvider = provider === "huggingface" ? "local" : provider;
        let cancelled = false;
        void (async () => {
            try {
                const fetched = await ipc.getRerankModels(backendProvider);
                if (cancelled) return;
                setModels(Array.isArray(fetched) ? fetched : []);
            } catch {
                if (!cancelled) setModels([]);
            }
        })();
        return () => { cancelled = true; };
    }, [provider, enabled]);

    // Si le reranking est active (ex: via analyze_profile) mais que
    // le provider n'est pas encore defini, ecrire les valeurs par defaut.
    useEffect(() => {
        if (enabled && !rerankCfg.provider) {
            updateRerank({ ...RERANK_DEFAULTS });
        }
        // Set initial validation state
        setStepValid(!enabled);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateRerank = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.rerank) cfg.rerank = {};
            // Quand on active le reranking, ecrire les defaults s'ils sont absents
            if (patch.enabled === true) {
                if (!cfg.rerank.provider) cfg.rerank.provider = RERANK_DEFAULTS.provider;
                if (!cfg.rerank.top_n) cfg.rerank.top_n = RERANK_DEFAULTS.top_n;
            }
            // Reset model when provider changes
            if (patch.provider && patch.provider !== cfg.rerank.provider) {
                patch.model = null;
            }
            cfg.rerank = { ...cfg.rerank, ...patch };
            return cfg;
        });
        setTestResult(null);
        // Disabled -> can continue freely; enabled -> must test first
        if (patch.enabled === false) {
            setStepValid(true);
        } else {
            setStepValid(false);
        }
    };

    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const secretKey = RERANK_KEY_PATHS[provider];
            if (secretKey && apiKey) {
                await invoke("store_secret", { keyName: secretKey, value: apiKey });
            }
            // Map wizard "huggingface" to backend "local"
            const backendProvider = provider === "huggingface" ? "local" : provider;
            // Persist current wizard config so the backend tests the right provider/model.
            await ipc.updateRerankConfig({
                enabled: true,
                provider: backendProvider,
                model: selectedModel || null,
                top_n: topN,
            });
            const res: any = await ipc.testRerankConnection();
            if (res.success) {
                setTestResult({ success: true, msg: t('wizard.reranking.testSuccess') });
                setStepValid(true);
            } else {
                setTestResult({ success: false, msg: res.error || t('wizard.reranking.testFailed') });
            }
        } catch (e: any) {
            setTestResult({ success: false, msg: e.toString() });
        } finally {
            setIsTesting(false);
        }
    };

    const modelLabel = (m: RerankModelInfo) => {
        const parts = [m.name];
        if (m.size_mb) parts.push(`(${m.size_mb} MB)`);
        if (m.cost_per_1k) parts.push(`- ${m.cost_per_1k}`);
        return parts.join(" ");
    };

    return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6 }}>
                {t('wizard.reranking.title')}
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginBottom: 22 }}>
                {t('wizard.reranking.subtitle')}
            </p>

            <div className="loko-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
                    <div>
                        <span style={{ display: "block", fontWeight: 500, fontSize: 16, color: "var(--text)" }}>{t('wizard.reranking.enable')}</span>
                        <span style={{ fontSize: 13, color: "var(--text-3)" }}>{t('wizard.reranking.enableDesc')}</span>
                        <div style={{ marginTop: 8 }}>
                            <LatencyImpactBadge level="medium" description={t("latency.rerankEnabledDesc")} />
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => updateRerank({ enabled: e.target.checked })}
                        className="w-5 h-5 text-brand-600 rounded cursor-pointer"
                    />
                </label>

                {enabled && (
                    <div className="animate-in fade-in slide-in-from-top-2" style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
                        <div>
                            <label style={{ display: "block", fontWeight: 500, marginBottom: 8 }}>{t('wizard.reranking.provider')}</label>
                            <select
                                style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: 8, background: "var(--surface)", color: "var(--text)" }}
                                value={provider}
                                onChange={(e) => updateRerank({ provider: e.target.value })}
                            >
                                <option value="huggingface">{t('wizard.reranking.hgLocal')}</option>
                                <option value="cohere">{t('wizard.reranking.cohereCloud')}</option>
                                <option value="jina">{t('wizard.reranking.jinaCloud')}</option>
                                <option value="voyage">{t('wizard.reranking.voyageCloud')}</option>
                            </select>
                        </div>

                        {models.length > 0 && (
                            <div>
                                <label style={{ display: "block", fontWeight: 500, marginBottom: 8 }}>{t('wizard.reranking.model')}</label>
                                <select
                                    style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: 8, background: "var(--surface)", color: "var(--text)" }}
                                    value={selectedModel}
                                    onChange={(e) => updateRerank({ model: e.target.value })}
                                >
                                    {!selectedModel && <option value="">{t('wizard.reranking.selectModel')}</option>}
                                    {models.map((m) => (
                                        <option key={m.id} value={m.id}>{modelLabel(m)}</option>
                                    ))}
                                </select>
                                {(() => {
                                    const info = models.find((m) => m.id === selectedModel);
                                    if (!info) return null;
                                    return (
                                        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 2 }}>
                                            {info.languages && <div>{t('wizard.reranking.languages')}: {info.languages}</div>}
                                            {info.quality_rating && <div>{t('wizard.reranking.quality')}: {info.quality_rating}/5</div>}
                                            {info.latency_hint && <div>{t('wizard.reranking.latency')}: {info.latency_hint}</div>}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {isCloudProvider(provider) && (
                            <div>
                                <label style={{ display: "block", fontWeight: 500, marginBottom: 4, fontSize: 13 }}>{t(`wizard.reranking.${provider}Key`)}</label>
                                <input
                                    type="password"
                                    style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: 8, background: "var(--surface)", color: "var(--text)" }}
                                    placeholder="API Key..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                />
                                <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{t(`wizard.reranking.${provider}KeyDesc`)}</p>
                            </div>
                        )}

                        <div>
                            <label style={{ display: "block", fontWeight: 500, marginBottom: 8 }}>{t('wizard.reranking.topN')}</label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                step="1"
                                value={topN}
                                onChange={(e) => updateRerank({ top_n: parseInt(e.target.value) })}
                                className="w-full cursor-pointer"
                            />
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
                                <span>1</span>
                                <span style={{ fontWeight: 700, color: "var(--text)" }}>{topN} {t('wizard.reranking.documents')}</span>
                                <span>10</span>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>{t('wizard.reranking.topNDesc')}</p>
                        </div>
                    </div>
                )}

                {enabled && (
                    <div className="animate-in fade-in slide-in-from-top-2" style={{ paddingTop: 16, marginTop: 8, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                        <button className="btn btn-secondary" onClick={handleTest} disabled={isTesting || (isCloudProvider(provider) && !apiKey)} style={{ alignSelf: "flex-start" }}>
                            {isTesting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('wizard.reranking.testingConnection')}</> : t('wizard.reranking.testConnection')}
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
                )}
            </div>


        </div>
    );
}
