import { useWizard } from "@/hooks/useWizard";
import { WizardProgress } from "./WizardProgress";
import { Loader2 } from "lucide-react";
import {
    SystemCheckStep, ExpertiseStep, ProfileStep, SourceStep,
    IngestionStep, ChunkingStep, EmbeddingStep, VectorStoreStep,
    SearchTypeStep, SemanticStep, LexicalStep, HybridStep,
    RerankingStep, LLMStep, AgentsStep
} from "./steps";

export function WizardContainer() {
    const wizard = useWizard();
    const { state } = wizard;

    if (state.isLoading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
    }

    const steps = [
        <SystemCheckStep key="0" wizard={wizard} />,
        <ExpertiseStep key="1" wizard={wizard} />,
        <ProfileStep key="2" wizard={wizard} />,
        <SourceStep key="3" wizard={wizard} />,
        <IngestionStep key="4" wizard={wizard} />,
        <ChunkingStep key="5" wizard={wizard} />,
        <EmbeddingStep key="6" wizard={wizard} />,
        <VectorStoreStep key="7" wizard={wizard} />,
        <SearchTypeStep key="8" wizard={wizard} />,
        <SemanticStep key="9" wizard={wizard} />,
        <LexicalStep key="10" wizard={wizard} />,
        <HybridStep key="11" wizard={wizard} />,
        <RerankingStep key="12" wizard={wizard} />,
        <LLMStep key="13" wizard={wizard} />,
        <AgentsStep key="14" wizard={wizard} />
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
            {state.step > 0 && (
                <header className="h-16 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-8 bg-white dark:bg-gray-900/50 backdrop-blur">
                    <div className="font-bold text-lg flex items-center gap-2">
                        RAGKIT <span className="text-gray-400 font-normal text-sm">Configuration</span>
                    </div>
                    <WizardProgress currentStep={state.step} totalSteps={14} />
                </header>
            )}

            <main className="flex-1 overflow-hidden relative p-6">
                <div className="h-full animate-in fade-in duration-300 slide-in-from-bottom-4">
                    {steps[state.step]}
                </div>
            </main>
        </div>
    );
}
