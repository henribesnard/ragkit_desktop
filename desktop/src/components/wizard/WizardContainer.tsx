import { useWizard } from "@/hooks/useWizard";
import { WizardProgress } from "./WizardProgress";
import { Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "react-i18next";
import {
    SystemCheckStep, ExpertiseStep, ProfileStep, SourceStep,
    IngestionStep, ChunkingStep, EmbeddingStep, VectorStoreStep,
    SearchTypeStep, SemanticStep, LexicalStep, HybridStep,
    RerankingStep, LLMStep, AgentsStep, MetadataStep
} from "./steps";

function LanguageToggle() {
    const { i18n } = useTranslation();
    const toggle = () => {
        const newLang = i18n.language === "fr" ? "en" : "fr";
        i18n.changeLanguage(newLang);
        localStorage.setItem("loko-lang", newLang);
    };
    return (
        <button
            onClick={toggle}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={i18n.language === "fr" ? "Switch to English" : "Passer en français"}
        >
            <Globe size={14} />
            {i18n.language.toUpperCase()}
        </button>
    );
}

export function WizardContainer() {
    const { t } = useTranslation();
    const wizard = useWizard();
    const { state } = wizard;

    if (state.isLoading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
    }

    const steps = [
        <SystemCheckStep key="0" wizard={wizard} />,
        <ExpertiseStep key="1" wizard={wizard} />,
        <ProfileStep key="2" wizard={wizard} />,
        <SourceStep key="3" wizard={wizard} />,
        <MetadataStep key="4" wizard={wizard} />,
        <IngestionStep key="5" wizard={wizard} />,
        <ChunkingStep key="6" wizard={wizard} />,
        <EmbeddingStep key="7" wizard={wizard} />,
        <VectorStoreStep key="8" wizard={wizard} />,
        <SearchTypeStep key="9" wizard={wizard} />,
        <SemanticStep key="10" wizard={wizard} />,
        <LexicalStep key="11" wizard={wizard} />,
        <HybridStep key="12" wizard={wizard} />,
        <RerankingStep key="13" wizard={wizard} />,
        <LLMStep key="14" wizard={wizard} />,
        <AgentsStep key="15" wizard={wizard} />
    ];

    const isLastStep = state.step === steps.length - 1;

    return (
        <div className="h-screen bg-white dark:bg-gray-900 flex flex-col font-sans">
            {state.step > 0 ? (
                <header className="h-16 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-50">
                    <div className="font-bold text-lg flex items-center gap-2 tracking-tight">
                        {t('wizard.container.title')} <span className="text-gray-400 font-normal text-sm">{t('wizard.container.subtitle')}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <WizardProgress currentStep={state.step} totalSteps={15} />
                        <LanguageToggle />
                    </div>
                </header>
            ) : (
                <div className="absolute top-4 right-6 z-50">
                    <LanguageToggle />
                </div>
            )}

            <main className="flex-1 overflow-y-auto relative p-6 pt-10">
                <div className="max-w-5xl mx-auto h-full animate-in fade-in duration-500 slide-in-from-bottom-4">
                    {steps[state.step]}
                </div>
            </main>

            {/* Sticky Navigation Footer */}
            {state.step >= 0 && (
                <footer className="h-20 border-t border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-8 flex items-center justify-center z-50">
                    <div className="max-w-5xl w-full flex justify-between items-center">
                        <Button
                            variant="outline"
                            onClick={() => wizard.prevStep()}
                            disabled={state.step === 0 || state.isLoading}
                            className="px-8 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all"
                        >
                            {t('wizard.container.back')}
                        </Button>

                        <div className="flex-1 text-center text-xs text-gray-400 px-4">
                            {t('wizard.container.autoSave')}
                        </div>

                        {isLastStep ? (
                            <Button
                                onClick={() => wizard.completeWizard()}
                                disabled={state.isLoading}
                                className="px-8 bg-black dark:bg-white text-white dark:text-black hover:opacity-90 rounded-xl transition-all shadow-lg"
                            >
                                {state.isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : t('wizard.container.finish')}
                            </Button>
                        ) : (
                            <Button
                                onClick={() => wizard.nextStep()}
                                disabled={state.isLoading || !state.stepValid}
                                className="px-8 bg-black dark:bg-white text-white dark:text-black hover:opacity-90 rounded-xl transition-all shadow-lg"
                            >
                                {t('wizard.container.continue')}
                            </Button>
                        )}
                    </div>
                </footer>
            )}
        </div>
    );
}
