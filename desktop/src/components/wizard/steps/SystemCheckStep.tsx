import { useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SystemCheckStep({ wizard: _wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const [env, setEnv] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        ipc.detectEnvironment()
            .then(res => setEnv(res))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6 }}>
                {t('wizard.system.title')}
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginBottom: 22 }}>
                {t('wizard.system.subtitle')}
            </p>

            {loading ? (
                <div className="flex items-center justify-center" style={{ padding: 48 }}>
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--brand)" }} />
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Ollama */}
                    <div
                        className="loko-panel"
                        style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    >
                        <div>
                            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{t('wizard.system.ollama')}</div>
                            <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 2 }}>{t('wizard.system.ollamaDesc')}</div>
                        </div>
                        {env?.ollama_available
                            ? <CheckCircle2 size={22} style={{ color: "var(--brand)", flexShrink: 0 }} />
                            : <XCircle size={22} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                        }
                    </div>

                    {/* GPU */}
                    <div
                        className="loko-panel"
                        style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    >
                        <div>
                            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{t('wizard.system.gpu')}</div>
                            <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 2 }}>{t('wizard.system.gpuDesc')}</div>
                        </div>
                        {env?.gpu_available
                            ? <CheckCircle2 size={22} style={{ color: "var(--brand)", flexShrink: 0 }} />
                            : <XCircle size={22} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                        }
                    </div>

                    {/* Models */}
                    {(env?.ollama_llm_models?.length > 0 || env?.ollama_embedding_models?.length > 0) ? (
                        <div className="loko-panel" style={{ padding: "16px 20px" }}>
                            {env?.ollama_llm_models?.length > 0 && (
                                <div style={{ marginBottom: env?.ollama_embedding_models?.length > 0 ? 16 : 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                                        {t('wizard.system.llmModels')}
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                        {env.ollama_llm_models.map((m: string) => (
                                            <span key={m} className="loko-badge loko-badge-brand">{m}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {env?.ollama_embedding_models?.length > 0 && (
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                                        {t('wizard.system.embeddingModels')}
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                        {env.ollama_embedding_models.map((m: string) => (
                                            <span key={m} className="loko-badge loko-badge-neutral">{m}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        env?.ollama_available && (
                            <div className="loko-panel" style={{ padding: "16px 20px" }}>
                                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                                    {t('wizard.system.detectedModels')}
                                </div>
                                <span style={{ fontSize: 13, color: "var(--text-3)", fontStyle: "italic" }}>
                                    {t('wizard.system.noModels')}
                                </span>
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
}
