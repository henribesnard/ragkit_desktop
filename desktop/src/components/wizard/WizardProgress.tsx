import { cn } from "@/lib/cn";

interface WizardProgressProps {
    currentStep: number;
    totalSteps: number;
}

export function WizardProgress({ currentStep, totalSteps }: WizardProgressProps) {
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
                Étape {currentStep}/{totalSteps}
            </span>
        </div>
    );
}
