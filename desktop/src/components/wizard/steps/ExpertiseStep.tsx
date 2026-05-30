import { User, SlidersHorizontal, Settings2, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ExpertiseStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const currentLevel = state.config?.general?.expertise_level || "simple";

    const setExpertise = (level: "simple" | "intermediate" | "expert") => {
        updateConfig((cfg: any) => {
            if (!cfg.general) cfg.general = {};
            cfg.general.expertise_level = level;
            return cfg;
        });
    };

    const levels = [
        {
            id: "simple" as const,
            icon: User,
            title: t('wizard.expertise.simple'),
            desc: t('wizard.expertise.simpleDesc'),
        },
        {
            id: "intermediate" as const,
            icon: SlidersHorizontal,
            title: t('wizard.expertise.intermediate'),
            desc: t('wizard.expertise.intermediateDesc'),
        },
        {
            id: "expert" as const,
            icon: Settings2,
            title: t('wizard.expertise.expert'),
            desc: t('wizard.expertise.expertDesc'),
        },
    ];

    return (
        <div style={{ maxWidth: 840, margin: "0 auto" }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6 }}>
                {t('wizard.expertise.title')}
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginBottom: 28 }}>
                {t('wizard.expertise.subtitle')}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {levels.map((lvl) => {
                    const active = currentLevel === lvl.id;
                    const Icon = lvl.icon;
                    return (
                        <button
                            key={lvl.id}
                            onClick={() => setExpertise(lvl.id)}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-start",
                                padding: 24,
                                borderRadius: 14,
                                border: active
                                    ? "2px solid var(--brand)"
                                    : "1px solid var(--border)",
                                background: active ? "var(--brand-weak)" : "var(--surface)",
                                cursor: "pointer",
                                textAlign: "left",
                                position: "relative",
                                transition: "border-color .14s, background .14s",
                            }}
                        >
                            {active && (
                                <CheckCircle2
                                    size={20}
                                    style={{
                                        position: "absolute",
                                        top: 16,
                                        right: 16,
                                        color: "var(--brand)",
                                    }}
                                />
                            )}
                            <div
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 10,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: active ? "var(--brand)" : "var(--surface-2)",
                                    color: active ? "var(--brand-fg)" : "var(--text-2)",
                                    marginBottom: 18,
                                    transition: "background .14s, color .14s",
                                }}
                            >
                                <Icon size={22} />
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>
                                {lvl.title}
                            </div>
                            <div style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.45 }}>
                                {lvl.desc}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
