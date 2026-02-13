import { WizardState } from "@/hooks/useWizard";
import { Button } from "@/components/ui/Button";
import { ProfileSummary } from "./ProfileSummary";

interface FileTypesStepProps {
    state: WizardState;
    onPrev: () => void;
    onComplete: () => void;
}

export function FileTypesStep({ state, onPrev, onComplete }: FileTypesStepProps) {
    // Simplified for Step 1 manual verification
    const exts = state.folderStats?.extensions || [];
    const files = state.folderStats?.files || 0;
    const size = state.folderStats?.size_mb || 0;

    return (
        <div className="max-w-3xl mx-auto h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
                <h2 className="text-xl font-bold mb-6 text-center">Types de documents trouvés</h2>

                {/* File types list placeholder */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6">
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 font-medium text-sm">
                        Supportés
                    </div>
                    <div className="p-4 space-y-2">
                        {exts.map((ext: string) => (
                            <div key={ext} className="flex items-center gap-3">
                                <input type="checkbox" checked readOnly className="rounded text-blue-600" />
                                <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{ext}</span>
                                <span className="text-sm text-gray-500">{state.folderStats?.extension_counts?.[ext] || 0} fichiers</span>
                            </div>
                        ))}
                        {exts.length === 0 && <span className="text-gray-500 italic text-sm">Aucune extension détectée</span>}
                    </div>
                </div>

                <div className="text-center text-sm text-gray-500 mb-6 font-medium">
                    📊 {files} fichiers sélectionnés · {size} Mo
                </div>

                <ProfileSummary profile={state.profile} calibration={state.calibration} />
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
                <Button variant="ghost" onClick={onPrev}>← Retour</Button>
                <Button onClick={onComplete} variant="default">✓ Terminer la configuration</Button>
            </div>
        </div>
    );
}
