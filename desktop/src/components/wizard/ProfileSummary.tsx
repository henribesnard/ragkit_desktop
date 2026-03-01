import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface ProfileSummaryProps {
    profile: string | null;
    calibration: Record<string, boolean>;
}

export function ProfileSummary({ profile, calibration }: ProfileSummaryProps) {
    const { t } = useTranslation();
    const summary = useMemo(() => {
        // This logic duplicates backend logic for display purpose
        //Ideally fetching it from backend via analyze_wizard_profile would be better
        // but here we do a quick synchronous approximation for UI responsiveness

        let name = t('wizard.profileSummary.basePersonalized');
        if (profile === "technical_documentation") name = t('wizard.profileSummary.techDoc');
        if (profile === "faq_support") name = t('wizard.profileSummary.faqSupport');
        if (profile === "legal_compliance") name = t('wizard.profileSummary.legalCompliance');
        if (profile === "reports_analysis") name = t('wizard.profileSummary.reportsAnalysis');
        if (profile === "general") name = t('wizard.profileSummary.generalBase');

        const params = [];
        if (profile === "legal_compliance") params.push(t('wizard.profileSummary.constantRecall'));
        if (calibration.q1) params.push(t('wizard.profileSummary.extractTables'));
        if (calibration.q4) params.push(t('wizard.profileSummary.maxPrecision'));

        if (params.length === 0) params.push(t('wizard.profileSummary.standard'));

        return { name, params };
    }, [profile, calibration]);

    return (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 mt-6">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                {t('wizard.profileSummary.title')}
            </h3>
            <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                <div className="flex justify-between">
                    <span>{t('wizard.profileSummary.detectedProfile')}</span>
                    <span className="font-medium">{summary.name}</span>
                </div>
                <div className="flex justify-between">
                    <span>{t('wizard.profileSummary.keyParams')}</span>
                    <span className="font-medium">{summary.params.join(", ")}</span>
                </div>
            </div>
        </div>
    );
}
