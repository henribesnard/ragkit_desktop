import { ProfileCard } from "./ProfileCard";
import { CalibrationQuestion } from "./CalibrationQuestion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface ProfileStepProps {
    wizard: any;
}

export function ProfileStep({ wizard }: ProfileStepProps) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const [showCalibration, setShowCalibration] = useState(true);

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
        <div className="max-w-3xl mx-auto h-full flex flex-col">
            <div className="flex-1 overflow-y-auto pr-2">
                <h2 className="text-xl font-bold mb-6 text-center">{t('wizard.profile.title')}</h2>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                    {profiles.map((p) => (
                        <ProfileCard
                            key={p.id}
                            id={p.id}
                            name={p.name}
                            icon={p.icon}
                            description={p.desc}
                            selected={currentProfile === p.id}
                            onSelect={setProfile}
                        />
                    ))}
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-8">
                    <button
                        onClick={() => setShowCalibration(!showCalibration)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{t('wizard.profile.refineProfile')}</span>
                        {showCalibration ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showCalibration && (
                        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 space-y-1">
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
                    )}
                </div>
            </div>


        </div>
    );
}
