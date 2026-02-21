import { Button } from "@/components/ui/Button";
import { User, Settings2, Sliders } from "lucide-react";

export function ExpertiseStep({ wizard }: { wizard: any }) {
    const { state, updateConfig } = wizard;
    const currentLevel = state.config?.general?.expertise_level || "simple";

    const setExpertise = (level: "simple" | "intermediate" | "expert") => {
        updateConfig((cfg: any) => {
            if (!cfg.general) cfg.general = {};
            cfg.general.expertise_level = level;
            return cfg;
        });
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">Votre niveau d'expertise</h1>
            <p className="text-gray-500 mb-8">
                RAGKIT s'adapte à vos besoins. Souhaitez-vous une configuration simple ou avoir le contrôle total sur tous les paramètres ?
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <button
                    onClick={() => setExpertise("simple")}
                    className={`flex flex-col items-start p-6 rounded-xl border-2 transition-all text-left ${currentLevel === "simple"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                        }`}
                >
                    <div className={`p-3 rounded-lg mb-4 ${currentLevel === "simple" ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-800"}`}>
                        <User className={`w-6 h-6 ${currentLevel === "simple" ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`} />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Interface Débutant</h3>
                    <p className="text-sm text-gray-500">
                        Masque les configurations techniques complexes (chunking, vecteurs). Idéal pour commencer rapidement avec les paramètres recommandés.
                    </p>
                </button>

                <button
                    onClick={() => setExpertise("intermediate")}
                    className={`flex flex-col items-start p-6 rounded-xl border-2 transition-all text-left ${currentLevel === "intermediate"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                        }`}
                >
                    <div className={`p-3 rounded-lg mb-4 ${currentLevel === "intermediate" ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-800"}`}>
                        <Sliders className={`w-6 h-6 ${currentLevel === "intermediate" ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`} />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Intermédiaire</h3>
                    <p className="text-sm text-gray-500">
                        Accès aux options principales (modèles) avec des paramètres avancés masqués.
                    </p>
                </button>

                <button
                    onClick={() => setExpertise("expert")}
                    className={`flex flex-col items-start p-6 rounded-xl border-2 transition-all text-left ${currentLevel === "expert"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                        }`}
                >
                    <div className={`p-3 rounded-lg mb-4 ${currentLevel === "expert" ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-800"}`}>
                        <Settings2 className={`w-6 h-6 ${currentLevel === "expert" ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`} />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Mode Avancé</h3>
                    <p className="text-sm text-gray-500">
                        Accès complet aux algorithmes de parsing, dimensions de chunks, sélection des algorithmes de recherche hybride et re-ranking.
                    </p>
                </button>
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-100 dark:border-gray-800">
                <Button variant="outline" onClick={() => wizard.prevStep()}>Retour</Button>
                <Button onClick={() => wizard.nextStep()}>Continuer</Button>
            </div>
        </div>
    );
}
