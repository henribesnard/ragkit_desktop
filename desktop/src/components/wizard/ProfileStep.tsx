import { CalibrationQuestion } from "./CalibrationQuestion";
import { useTranslation } from "react-i18next";
import {
    BookOpen, LifeBuoy, Scale, BarChart3, Library,
    CheckCircle2, Table2, Copy, Hash, RefreshCw, Quote, SlidersHorizontal
} from "lucide-react";

interface ProfileStepProps {
    wizard: any;
}

export function ProfileStep({ wizard }: ProfileStepProps) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;

    const currentProfile = state.config?.profile || null;
    const getCalibration = (key: string) => !!state.config?.calibration_answers?.[key];

    const setProfile = (id: string) => {
        updateConfig((cfg: any) => {
            cfg.profile = id;
            return cfg;
        });
    };

    const toggleCalibration = (key: string) => {
        updateConfig((cfg: any) => {
            if (!cfg.calibration_answers) cfg.calibration_answers = {};
            cfg.calibration_answers[key] = !cfg.calibration_answers[key];
            return cfg;
        });
    };

    const profiles = [
        { id: "technical_documentation", name: t('wizard.profile.technicalDocs'), icon: BookOpen, desc: t('wizard.profile.technicalDocsDesc') },
        { id: "faq_support", name: t('wizard.profile.faqSupport'), icon: LifeBuoy, desc: t('wizard.profile.faqSupportDesc') },
        { id: "legal_compliance", name: t('wizard.profile.legalCompliance'), icon: Scale, desc: t('wizard.profile.legalComplianceDesc') },
        { id: "reports_analysis", name: t('wizard.profile.reportsAnalysis'), icon: BarChart3, desc: t('wizard.profile.reportsAnalysisDesc') },
        { id: "general", name: t('wizard.profile.generalBase'), icon: Library, desc: t('wizard.profile.generalBaseDesc') },
    ];

    const questions = [
        { id: "q1", q: t('wizard.profile.q1'), t: t('wizard.profile.t1'), icon: <Table2 size={15} /> },
        { id: "q2", q: t('wizard.profile.q2'), t: t('wizard.profile.t2'), icon: <Copy size={15} /> },
        { id: "q3", q: t('wizard.profile.q3'), t: t('wizard.profile.t3'), icon: <RefreshCw size={15} /> },
        { id: "q4", q: t('wizard.profile.q4'), t: t('wizard.profile.t4'), icon: <Hash size={15} /> },
        { id: "q5", q: t('wizard.profile.q5'), t: t('wizard.profile.t5'), icon: <Quote size={15} /> },
        { id: "q6", q: t('wizard.profile.q6'), t: t('wizard.profile.t6'), icon: <SlidersHorizontal size={15} /> },
    ];

    return (
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6 }}>
                {t('wizard.profile.title')}
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginBottom: 24 }}>
                {t('wizard.profile.subtitle', 'LOKO pré-règle le pipeline selon votre choix. Une seule réponse suffit.')}
            </p>

            {/* Profile cards */}
            <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
                {profiles.map((p) => {
                    const active = currentProfile === p.id;
                    const Icon = p.icon;
                    return (
                        <button
                            key={p.id}
                            onClick={() => setProfile(p.id)}
                            style={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 6,
                                padding: "18px 10px 14px",
                                borderRadius: 12,
                                border: active ? "2px solid var(--brand)" : "1px solid var(--border)",
                                background: active ? "var(--brand-weak)" : "var(--surface)",
                                cursor: "pointer",
                                textAlign: "center",
                                position: "relative",
                                transition: "border-color .14s, background .14s",
                                minWidth: 0,
                            }}
                        >
                            {active && (
                                <CheckCircle2
                                    size={16}
                                    style={{ position: "absolute", top: 10, right: 10, color: "var(--brand)" }}
                                />
                            )}
                            <div
                                style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 9,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: active ? "var(--brand)" : "var(--surface-2)",
                                    color: active ? "var(--brand-fg)" : "var(--text-2)",
                                    marginBottom: 4,
                                    transition: "background .14s, color .14s",
                                }}
                            >
                                <Icon size={18} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.2 }}>
                                {p.name}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.3 }}>
                                {p.desc}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Calibration section */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <SlidersHorizontal size={15} style={{ color: "var(--text-3)" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", letterSpacing: ".01em" }}>
                    {t('wizard.profile.refineProfile', 'Calibrage — affine la qualité des réponses')}
                </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
                {questions.map((q) => (
                    <CalibrationQuestion
                        key={q.id}
                        id={q.id}
                        question={q.q}
                        tooltip={q.t}
                        icon={q.icon}
                        value={getCalibration(q.id)}
                        onChange={toggleCalibration}
                    />
                ))}
            </div>
        </div>
    );
}
