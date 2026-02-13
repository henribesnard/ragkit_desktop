import { useMemo } from "react";

interface ProfileSummaryProps {
    profile: string | null;
    calibration: Record<string, boolean>;
}

export function ProfileSummary({ profile, calibration }: ProfileSummaryProps) {
    const summary = useMemo(() => {
        // This logic duplicates backend logic for display purpose
        //Ideally fetching it from backend via analyze_wizard_profile would be better
        // but here we do a quick synchronous approximation for UI responsiveness

        let name = "Base personnalisée";
        if (profile === "technical_documentation") name = "Documentation technique";
        if (profile === "faq_support") name = "FAQ / Support";
        if (profile === "legal_compliance") name = "Juridique / Réglementaire";
        if (profile === "reports_analysis") name = "Rapports & Analyses";
        if (profile === "general") name = "Base généraliste";

        const params = [];
        if (profile === "legal_compliance") params.push("Rappel constant");
        if (calibration.q1) params.push("Extraction tableaux");
        if (calibration.q4) params.push("Précision maximale");

        if (params.length === 0) params.push("Standard");

        return { name, params };
    }, [profile, calibration]);

    return (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 mt-6">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Récapitulatif du profil
            </h3>
            <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                <div className="flex justify-between">
                    <span>Profil détecté :</span>
                    <span className="font-medium">{summary.name}</span>
                </div>
                <div className="flex justify-between">
                    <span>Paramètres clés :</span>
                    <span className="font-medium">{summary.params.join(", ")}</span>
                </div>
            </div>
        </div>
    );
}
