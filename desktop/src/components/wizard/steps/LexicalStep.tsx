import { useTranslation } from "react-i18next";
import { LatencyImpactBadge } from "@/components/ui/LatencyImpactBadge";

export function LexicalStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const lexicalCfg = state.config?.retrieval?.lexical || {};

    const topK = lexicalCfg.top_k || 5;

    const updateLexical = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.retrieval) cfg.retrieval = {};
            if (!cfg.retrieval.lexical) cfg.retrieval.lexical = {};
            cfg.retrieval.lexical = { ...cfg.retrieval.lexical, ...patch };
            return cfg;
        });
    };

    return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6 }}>
                {t('wizard.lexical.title')}
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginBottom: 22 }}>
                {t('wizard.lexical.subtitle')}
            </p>

            <div className="loko-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                <div>
                    <label style={{ display: "block", fontWeight: 500, marginBottom: 8 }}>{t('wizard.lexical.topK')}</label>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={topK}
                        onChange={(e) => updateLexical({ top_k: parseInt(e.target.value) })}
                        className="w-full cursor-pointer"
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
                        <span>1</span>
                        <span style={{ fontWeight: 700, color: "var(--text)" }}>{topK} {t('wizard.lexical.documents')}</span>
                        <span>20</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>{t('wizard.lexical.topKDesc')}</p>
                    <div style={{ marginTop: 8 }}>
                        <LatencyImpactBadge level="low" description={t("latency.topKLexicalDesc")} />
                    </div>
                </div>
            </div>


        </div>
    );
}
