import { Toggle } from "@/components/ui/Toggle";
import { Tooltip } from "@/components/ui/Tooltip";
import { Info } from "lucide-react";

interface CalibrationQuestionProps {
    id: string;
    question: string;
    tooltip: string;
    value: boolean;
    onChange: (id: string) => void;
}

export function CalibrationQuestion({ id, question, tooltip, value, onChange }: CalibrationQuestionProps) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">{question}</span>
                <Tooltip content={tooltip}>
                    <Info className="w-4 h-4 text-gray-400 cursor-help" />
                </Tooltip>
            </div>
            <Toggle checked={value} onChange={() => onChange(id)} />
        </div>
    );
}
