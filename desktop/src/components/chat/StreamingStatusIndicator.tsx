import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2 } from "lucide-react";
import type { StreamStatus } from "@/hooks/useChatStream";

interface StatusStep {
    step: string;
    label: string;
    done: boolean;
}

interface StreamingStatusIndicatorProps {
    status: StreamStatus;
}

const STEP_ORDER = ["analyzing", "rewriting", "retrieving", "retrieved", "generating"];

export function StreamingStatusIndicator({ status }: StreamingStatusIndicatorProps) {
    const { t } = useTranslation();
    const [steps, setSteps] = useState<StatusStep[]>([]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSteps((prevSteps) => {
            const newSteps = [...prevSteps];

            // Mark all previous steps as done
            newSteps.forEach((s) => {
                s.done = true;
            });

            // Avoid duplicates: only add or update if necessary
            const existingStepIndex = newSteps.findIndex((s) => s.step === status.step);

            let label = t(`chat.status.${status.step}`);
            if (status.step === "retrieved" && status.detail?.count !== undefined) {
                label = t("chat.status.retrieved", { count: status.detail.count });
            }

            if (existingStepIndex >= 0) {
                newSteps[existingStepIndex] = { ...newSteps[existingStepIndex], label, done: false };
            } else {
                newSteps.push({ step: status.step, label, done: false });
            }

            // Ensure steps are sorted logically in case of out-of-order SSE (rare but possible)
            newSteps.sort((a, b) => STEP_ORDER.indexOf(a.step) - STEP_ORDER.indexOf(b.step));

            return newSteps;
        });
    }, [status, t]);

    return (
        <div className="flex flex-col gap-2 py-2 px-1 text-xs text-text-tertiary">
            {steps.map((s, index) => (
                <div key={`${s.step}-${index}`} className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1">
                    {s.done ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                        <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                    )}
                    <span>{s.label}</span>
                </div>
            ))}
        </div>
    );
}
