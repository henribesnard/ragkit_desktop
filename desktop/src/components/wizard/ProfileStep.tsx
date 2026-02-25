import { ProfileCard } from "./ProfileCard";
import { CalibrationQuestion } from "./CalibrationQuestion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface ProfileStepProps {
    wizard: any;
}

export function ProfileStep({ wizard }: ProfileStepProps) {
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
        { id: "technical_documentation", name: "Documentation technique", icon: "📘", desc: "Manuels, API docs, guides" },
        { id: "faq_support", name: "FAQ / Support", icon: "❓", desc: "Questions-réponses, aide" },
        { id: "legal_compliance", name: "Juridique / Réglementaire", icon: "📜", desc: "Contrats, lois, conformité" },
        { id: "reports_analysis", name: "Rapports & Analyses", icon: "📊", desc: "Rapports financiers, études" },
        { id: "general", name: "Base généraliste", icon: "📚", desc: "Contenu varié, mixte" },
    ];

    const questions = [
        { id: "q1", q: "Documents avec tableaux ou schémas ?", t: "Active l'OCR et l'extraction avancée de tableaux." },
        { id: "q2", q: "Réponses croisant plusieurs documents ?", t: "Augmente la fenêtre de contexte et le nombre de documents récupérés." },
        { id: "q3", q: "Documents de plus de 50 pages en moyenne ?", t: "Adapte la stratégie de découpage pour les longs documents." },
        { id: "q4", q: "Besoin de réponses très précises ?", t: "Active le reranking et réduit la température du modèle." },
        { id: "q5", q: "Base mise à jour fréquemment ?", t: "Configure les intervalles de rafraîchissement automatique." },
        { id: "q6", q: "Citations avec sources et pages ?", t: "Force l'inclusion des numéros de page et titres dans les citations." },
    ];

    return (
        <div className="max-w-3xl mx-auto h-full flex flex-col">
            <div className="flex-1 overflow-y-auto pr-2">
                <h2 className="text-xl font-bold mb-6 text-center">Quel type de contenu décrit le mieux votre base ?</h2>

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
                        <span className="font-medium text-sm text-gray-700 dark:text-gray-300">Affiner le profil (optionnel)</span>
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
