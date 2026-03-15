import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
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

const API_KEY_SECRETS: Record<string, string> = {
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

    // Si le reranking est activé (ex: via analyze_profile) mais que
    // le provider n'est pas encore défini, écrire les valeurs par défaut.
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
            // Quand on active le reranking, écrire les defaults s'ils sont absents
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
        // Disabled → can continue freely; enabled → must test first
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
            const secretKey = API_KEY_SECRETS[provider];
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
        <div className="max-w-2xl mx-auto py-4">
            <h1 className="text-xl font-bold mb-4">{t('wizard.reranking.title')}</h1>
            <p className="text-gray-500 mb-4">
                {t('wizard.reranking.subtitle')}
            </p>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 mb-4">
                <label className="flex items-center justify-between cursor-pointer border-b border-gray-100 dark:border-gray-700 pb-4">
                    <div>
                        <span className="block font-medium text-lg text-blue-900 dark:text-blue-100">{t('wizard.reranking.enable')}</span>
                        <span className="text-sm text-gray-500">{t('wizard.reranking.enableDesc')}</span>
                        <div className="mt-2">
                            <LatencyImpactBadge level="medium" description={t("latency.rerankEnabledDesc")} />
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => updateRerank({ enabled: e.target.checked })}
                        className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                    />
                </label>

                {enabled && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <label className="block font-medium mb-2">{t('wizard.reranking.provider')}</label>
                            <select
                                className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
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
                                <label className="block font-medium mb-2">{t('wizard.reranking.model')}</label>
                                <select
                                    className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
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
                                        <div className="mt-2 text-xs text-gray-500 space-y-0.5">
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
                                <label className="block font-medium mb-1 text-sm">{t(`wizard.reranking.${provider}Key`)}</label>
                                <input
                                    type="password"
                                    className="w-full rounded-md border border-gray-300 p-2 dark:bg-gray-700"
                                    placeholder="API Key..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                />
                                <p className="text-xs text-gray-500 mt-1">{t(`wizard.reranking.${provider}KeyDesc`)}</p>
                            </div>
                        )}

                        <div>
                            <label className="block font-medium mb-2">{t('wizard.reranking.topN')}</label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                step="1"
                                value={topN}
                                onChange={(e) => updateRerank({ top_n: parseInt(e.target.value) })}
                                className="w-full cursor-pointer"
                            />
                            <div className="flex justify-between text-sm text-gray-500 mt-1">
                                <span>1</span>
                                <span className="font-bold text-gray-900 dark:text-white">{topN} {t('wizard.reranking.documents')}</span>
                                <span>10</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">{t('wizard.reranking.topNDesc')}</p>
                        </div>
                    </div>
                )}

                {enabled && (
                    <div className="pt-4 mt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                        <Button onClick={handleTest} variant="outline" className="w-full sm:w-auto self-start" disabled={isTesting || (isCloudProvider(provider) && !apiKey)}>
                            {isTesting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('wizard.reranking.testingConnection')}</> : t('wizard.reranking.testConnection')}
                        </Button>

                        {testResult && (
                            <div className={`p-3 rounded-md text-sm flex items-start gap-2 ${testResult.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
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
