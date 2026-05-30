import { Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LatencyImpactBadge } from "@/components/ui/LatencyImpactBadge";

export function AgentsStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const agentCfg = state.config?.agents || {};
    const enabled = agentCfg.enabled ?? false;

    const updateAgents = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.agents) cfg.agents = {};
            cfg.agents = { ...cfg.agents, ...patch };
            return cfg;
        });
    };

    return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6 }}>
                {t('wizard.agents.title')}
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginBottom: 22 }}>
                {t('wizard.agents.subtitle')}
            </p>

            <div className="loko-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{
                            padding: 12,
                            borderRadius: 10,
                            background: enabled ? "var(--brand)" : "var(--surface-2)",
                            color: enabled ? "var(--brand-fg)" : "var(--text-3)",
                            transition: "background .14s, color .14s",
                        }}>
                            <Bot style={{ width: 24, height: 24 }} />
                        </div>
                        <div>
                            <span style={{ display: "block", fontWeight: 500, fontSize: 16 }}>{t('wizard.agents.enable')}</span>
                            <span style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 380, display: "block", marginTop: 4 }}>{t('wizard.agents.enableDesc')}</span>
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => updateAgents({ enabled: e.target.checked })}
                        className="w-5 h-5 text-brand-600 rounded cursor-pointer"
                    />
                </label>

                {enabled && (
                    <div className="animate-in fade-in slide-in-from-top-2" style={{ paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                        <LatencyImpactBadge level="high" description={t("latency.analyzerActiveDesc")} />
                        <LatencyImpactBadge level="high" description={t("latency.rewritingActiveDesc")} />
                        <p style={{ fontSize: 13, color: "var(--danger)", background: "var(--danger-bg)", padding: 12, borderRadius: 10, border: "1px solid var(--danger)" }}>
                            <strong>{t('wizard.agents.perfNoteTitle')}</strong> {t('wizard.agents.perfNote')}
                        </p>
                    </div>
                )}
            </div>


        </div>
    );
}
