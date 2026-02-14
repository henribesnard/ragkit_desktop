import { useWizard } from "@/hooks/useWizard";
import { WelcomeStep } from "./WelcomeStep";
import { ProfileStep } from "./ProfileStep";
import { FolderStep } from "./FolderStep";
import { FileTypesStep } from "./FileTypesStep";
import { WizardProgress } from "./WizardProgress";

export function WizardContainer() {
    const { state, nextStep, prevStep, setProfile, toggleCalibration, setFolderPath, setFolderStats, setRecursive, toggleFolderExclusion, setIncludedFileTypes, completeWizard } = useWizard();

    const handleComplete = async () => {
        const success = await completeWizard();
        if (success) {
            window.location.href = "/settings";
        } else {
            throw new Error("Wizard completion failed");
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
            {/* Top Bar with Progress (hidden on Welcome step) */}
            {state.step > 1 && (
                <header className="h-16 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-8 bg-white dark:bg-gray-900/50 backdrop-blur">
                    <div className="font-bold text-lg">RAGKIT <span className="text-gray-400 font-normal text-sm ml-2">Configuration</span></div>
                    <WizardProgress currentStep={state.step} totalSteps={4} />
                </header>
            )}

            <main className="flex-1 overflow-hidden relative p-6">
                <div className="h-full animate-in fade-in duration-300 slide-in-from-bottom-4">
                    {state.step === 1 && <WelcomeStep onNext={nextStep} />}
                    {state.step === 2 && (
                        <ProfileStep
                            state={state}
                            onNext={nextStep}
                            onPrev={prevStep}
                            setProfile={setProfile}
                            toggleCalibration={toggleCalibration}
                        />
                    )}
                    {state.step === 3 && (
                        <FolderStep
                            state={state}
                            onNext={nextStep}
                            onPrev={prevStep}
                            setFolderPath={setFolderPath}
                            setFolderStats={setFolderStats}
                            setRecursive={setRecursive}
                            toggleExclusion={toggleFolderExclusion}
                            excludedFolders={state.excludedFolders}
                        />
                    )}
                    {state.step === 4 && (
                        <FileTypesStep
                            state={state}
                            onPrev={prevStep}
                            onComplete={handleComplete}
                            setIncludedFileTypes={setIncludedFileTypes}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}
