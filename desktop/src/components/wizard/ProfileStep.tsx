import { CalibrationQuestion } from "./CalibrationQuestion";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

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
        { id: "technical_documentation", name: t('wizard.profile.technicalDocs'), icon: "📘", desc: t('wizard.profile.technicalDocsDesc') },
        { id: "faq_support", name: t('wizard.profile.faqSupport'), icon: "❓", desc: t('wizard.profile.faqSupportDesc') },
        { id: "legal_compliance", name: t('wizard.profile.legalCompliance'), icon: "📜", desc: t('wizard.profile.legalComplianceDesc') },
        { id: "reports_analysis", name: t('wizard.profile.reportsAnalysis'), icon: "📊", desc: t('wizard.profile.reportsAnalysisDesc') },
        { id: "general", name: t('wizard.profile.generalBase'), icon: "📚", desc: t('wizard.profile.generalBaseDesc') },
    ];

    const questions = [
        { id: "q1", q: t('wizard.profile.q1'), t: t('wizard.profile.t1') },
        { id: "q2", q: t('wizard.profile.q2'), t: t('wizard.profile.t2') },
        { id: "q3", q: t('wizard.profile.q3'), t: t('wizard.profile.t3') },
        { id: "q4", q: t('wizard.profile.q4'), t: t('wizard.profile.t4') },
        { id: "q5", q: t('wizard.profile.q5'), t: t('wizard.profile.t5') },
        { id: "q6", q: t('wizard.profile.q6'), t: t('wizard.profile.t6') },
    ];

    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-5">
            <h2 className="text-xl font-bold text-center">{t('wizard.profile.title')}</h2>

            {/* Profile cards — compact horizontal row */}
            <div className="flex gap-2">
                {profiles.map((p) => (
                    <button
                        key={p.id}
                        onClick={() => setProfile(p.id)}
                        className={cn(
                            "flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all duration-200 text-center hover:bg-gray-50 dark:hover:bg-gray-800 min-w-0",
                            currentProfile === p.id
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                        )}
                    >
                        <span className="text-2xl">{p.icon}</span>
                        <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 leading-tight">{p.name}</span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight hidden lg:block">{p.desc}</span>
                    </button>
                ))}
            </div>

            {/* Calibration questions — 2 columns, always visible */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">{t('wizard.profile.refineProfile')}</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-0">
                    {questions.map((q) => (
                        <CalibrationQuestion
                            key={q.id}
                            id={q.id}
                            question={q.q}
                            tooltip={q.t}
                            value={getCalibration(q.id)}
                            onChange={toggleCalibration}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
