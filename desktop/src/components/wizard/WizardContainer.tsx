import { useWizard } from "@/hooks/useWizard";
import { WizardProgress } from "./WizardProgress";
import { Globe, Loader2, ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Lockup } from "@/components/brand/Lockup";
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
            className="btn btn-ghost btn-sm"
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
        return (
            <div className="h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--brand)" }} />
            </div>
        );
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
        <div
            className="h-screen flex flex-col"
            style={{
                background: "var(--bg)",
                color: "var(--text)",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                lineHeight: 1.5,
            }}
        >
            {/* Header: brand lockup + step rail */}
            <header
                className="flex items-center shrink-0"
                style={{
                    height: 60,
                    padding: "0 40px",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--surface)",
                    gap: 28,
                }}
            >
                <Lockup glyph={24} text={18} />
                <div style={{ flex: 1 }} />
                <WizardProgress currentStep={state.step} totalSteps={steps.length} />
                <LanguageToggle />
            </header>

            {/* Body */}
            <main
                className="flex-1 min-h-0 overflow-y-auto loko-scroll"
                style={{ padding: "34px 40px" }}
            >
                <div style={{ width: "100%", maxWidth: 940, margin: "0 auto" }}>
                    {steps[state.step]}
                </div>
            </main>

            {/* Footer */}
            <footer
                className="flex items-center shrink-0"
                style={{
                    padding: "16px 40px",
                    borderTop: "1px solid var(--border)",
                    background: "var(--surface)",
                }}
            >
                <button
                    className="btn btn-ghost"
                    onClick={() => wizard.prevStep()}
                    disabled={state.step === 0 || state.isLoading}
                    style={{ opacity: state.step === 0 ? 0.4 : 1 }}
                >
                    <ArrowLeft size={16} />
                    {t('wizard.container.back')}
                </button>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 12.5, color: "var(--text-3)", marginRight: 14 }}>
                    {t('wizard.container.autoSave')}
                </span>
                {isLastStep ? (
                    <button
                        className="btn btn-primary"
                        onClick={() => wizard.completeWizard()}
                        disabled={state.isLoading}
                    >
                        <Sparkles size={16} />
                        {state.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('wizard.container.finish')}
                    </button>
                ) : (
                    <button
                        className="btn btn-primary"
                        onClick={() => wizard.nextStep()}
                        disabled={state.isLoading || !state.stepValid}
                    >
                        {t('wizard.container.continue')}
                        <ArrowRight size={16} />
                    </button>
                )}
            </footer>
        </div>
    );
}
