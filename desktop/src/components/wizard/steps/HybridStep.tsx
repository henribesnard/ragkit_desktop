import { useTranslation } from "react-i18next";

export function HybridStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const hybridCfg = state.config?.retrieval?.hybrid || {};

    const topK = hybridCfg.top_k || 5;
    const semanticWeight = hybridCfg.semantic_weight ?? 0.7;
    const fusion = hybridCfg.fusion_method || "rrf";

    const updateHybrid = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.retrieval) cfg.retrieval = {};
            if (!cfg.retrieval.hybrid) cfg.retrieval.hybrid = {};
            cfg.retrieval.hybrid = { ...cfg.retrieval.hybrid, ...patch };
            return cfg;
        });
    };

    return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6 }}>
                {t('wizard.hybrid.title')}
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginBottom: 22 }}>
                {t('wizard.hybrid.subtitle')}
            </p>

            <div className="loko-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                <div>
                    <label style={{ display: "block", fontWeight: 500, marginBottom: 8 }}>{t('wizard.hybrid.topK')}</label>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={topK}
                        onChange={(e) => updateHybrid({ top_k: parseInt(e.target.value) })}
                        className="w-full cursor-pointer"
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
                        <span>1</span>
                        <span style={{ fontWeight: 700, color: "var(--text)" }}>{topK} {t('wizard.hybrid.documents')}</span>
                        <span>20</span>
                    </div>
                </div>

                <div>
                    <label style={{ display: "block", fontWeight: 500, marginBottom: 8 }}>{t('wizard.hybrid.fusionMethod')}</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <label style={{
                            border: fusion === 'rrf' ? "2px solid var(--brand)" : "1px solid var(--border)",
                            background: fusion === 'rrf' ? "var(--brand-weak)" : "transparent",
                            borderRadius: 10,
                            padding: 12,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            transition: "border-color .14s, background .14s",
                        }}>
                            <input
                                type="radio"
                                name="fusion"
                                value="rrf"
                                checked={fusion === 'rrf'}
                                onChange={() => updateHybrid({ fusion_method: 'rrf' })}
                                className="text-brand-600"
                            />
                            <div>
                                <span style={{ display: "block", fontWeight: 500, fontSize: 13 }}>{t('wizard.hybrid.rrf')}</span>
                                <span style={{ fontSize: 12, color: "var(--text-3)" }}>{t('wizard.hybrid.rrfDesc')}</span>
                            </div>
                        </label>
                        <label style={{
                            border: fusion === 'linear' ? "2px solid var(--brand)" : "1px solid var(--border)",
                            background: fusion === 'linear' ? "var(--brand-weak)" : "transparent",
                            borderRadius: 10,
                            padding: 12,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            transition: "border-color .14s, background .14s",
                        }}>
                            <input
                                type="radio"
                                name="fusion"
                                value="linear"
                                checked={fusion === 'linear'}
                                onChange={() => updateHybrid({ fusion_method: 'linear' })}
                                className="text-brand-600"
                            />
                            <div>
                                <span style={{ display: "block", fontWeight: 500, fontSize: 13 }}>{t('wizard.hybrid.linear')}</span>
                                <span style={{ fontSize: 12, color: "var(--text-3)" }}>{t('wizard.hybrid.linearDesc')}</span>
                            </div>
                        </label>
                    </div>
                </div>

                {fusion === 'linear' && (
                    <div>
                        <label style={{ display: "block", fontWeight: 500, marginBottom: 8 }}>{t('wizard.hybrid.weighting')}</label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={semanticWeight}
                            onChange={(e) => updateHybrid({ semantic_weight: parseFloat(e.target.value) })}
                            className="w-full cursor-pointer"
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
                            <span>{t('wizard.hybrid.lexicalOnly')}</span>
                            <span style={{ fontWeight: 700, color: "var(--text)" }}>{Math.round(semanticWeight * 100)}% {t('wizard.hybrid.semanticPercent')}</span>
                            <span>{t('wizard.hybrid.semanticOnly')}</span>
                        </div>
                    </div>
                )}
            </div>


        </div>
    );
}
