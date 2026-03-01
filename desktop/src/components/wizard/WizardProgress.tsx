import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

interface WizardProgressProps {
    currentStep: number;
    totalSteps: number;
}

export function WizardProgress({ currentStep, totalSteps }: WizardProgressProps) {
    const { t } = useTranslation();
    return (
        <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => {
                const step = i + 1;
                return (
                    <div
                        key={step}
                        className={cn(
                            "w-3 h-3 rounded-full transition-colors duration-300",
                            step <= currentStep
                                ? "bg-blue-600 dark:bg-blue-500"
                                : "bg-gray-200 dark:bg-gray-700"
                        )}
                    />
                );
            })}
            <span className="ml-4 text-sm text-gray-500 font-medium">
                {t('wizard.progress.step')} {currentStep}/{totalSteps}
            </span>
        </div>
    );
}
