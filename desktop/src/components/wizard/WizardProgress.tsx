import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

interface WizardProgressProps {
    currentStep: number;
    totalSteps: number;
}

export function WizardProgress({ currentStep, totalSteps }: WizardProgressProps) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center gap-0">
            <div className="steps">
                {Array.from({ length: totalSteps }).map((_, i) => {
                    const isDone = i < currentStep;
                    const isActive = i === currentStep;
                    return (
                        <span key={i}>
                            {i > 0 && (
                                <span
                                    className={"bar" + (i <= currentStep ? " done" : "")}
                                    style={{ width: 16, margin: "0 4px" }}
                                />
                            )}
                            <span className={"s" + (isDone ? " done" : "") + (isActive ? " active" : "")}>
                                <span className="n">
                                    {isDone ? <Check size={13} /> : i + 1}
                                </span>
                            </span>
                        </span>
                    );
                })}
            </div>
            <span
                style={{
                    marginLeft: 12,
                    fontSize: 12,
                    color: "var(--text-3)",
                    fontFamily: "var(--font-mono)",
                }}
            >
                {t('wizard.progress.step')} {currentStep + 1}/{totalSteps}
            </span>
        </div>
    );
}
