import { useTranslation } from "react-i18next";
import { LatencyImpactBadge } from "@/components/ui/LatencyImpactBadge";

export function SemanticStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const semanticCfg = state.config?.retrieval?.semantic || {};

    const topK = semanticCfg.top_k || 5;
    const threshold = semanticCfg.score_threshold || 0.5;

    const updateSemantic = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.retrieval) cfg.retrieval = {};
            if (!cfg.retrieval.semantic) cfg.retrieval.semantic = {};
            cfg.retrieval.semantic = { ...cfg.retrieval.semantic, ...patch };
            return cfg;
        });
    };

    return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6 }}>
                {t('wizard.semantic.title')}
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginBottom: 22 }}>
                {t('wizard.semantic.subtitle')}
            </p>

            <div className="loko-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                <div>
                    <label style={{ display: "block", fontWeight: 500, marginBottom: 8 }}>{t('wizard.semantic.topK')}</label>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={topK}
                        onChange={(e) => updateSemantic({ top_k: parseInt(e.target.value) })}
                        className="w-full cursor-pointer"
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
                        <span>1</span>
                        <span style={{ fontWeight: 700, color: "var(--text)" }}>{topK} {t('wizard.semantic.documents')}</span>
                        <span>20</span>
                    </div>
                    <div style={{ marginTop: 8 }}>
                        <LatencyImpactBadge level="medium" description={t("latency.topKSemanticDesc")} />
                    </div>
                </div>

                <div>
                    <label style={{ display: "block", fontWeight: 500, marginBottom: 8 }}>{t('wizard.semantic.threshold')}</label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={threshold}
                        onChange={(e) => updateSemantic({ score_threshold: parseFloat(e.target.value) })}
                        className="w-full cursor-pointer"
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
                        <span>0.0 ({t('wizard.semantic.thresholdAll')})</span>
                        <span style={{ fontWeight: 700, color: "var(--text)" }}>{threshold.toFixed(2)}</span>
                        <span>1.0 ({t('wizard.semantic.thresholdPerfect')})</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>{t('wizard.semantic.thresholdDesc')}</p>
                </div>
            </div>


        </div>
    );
}
