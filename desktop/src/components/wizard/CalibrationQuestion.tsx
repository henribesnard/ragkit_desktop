import { Tooltip } from "@/components/ui/Tooltip";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CalibrationQuestionProps {
    id: string;
    question: string;
    tooltip: string;
    icon?: React.ReactNode;
    value: boolean;
    onChange: (id: string) => void;
}

export function CalibrationQuestion({ id, question, tooltip, icon, value, onChange }: CalibrationQuestionProps) {
    const { t } = useTranslation();

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 0",
                borderBottom: "1px solid var(--border)",
            }}
        >
            {icon && (
                <span style={{ color: "var(--text-3)", display: "flex", flexShrink: 0 }}>{icon}</span>
            )}
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>
                {question}
            </span>
            <Tooltip content={tooltip}>
                <Info size={14} style={{ color: "var(--text-3)", cursor: "help", flexShrink: 0 }} />
            </Tooltip>
            <div className="yn">
                <button className={value ? "on" : ""} onClick={() => { if (!value) onChange(id); }}>
                    {t('common.yes', 'Oui')}
                </button>
                <button className={!value ? "on" : ""} onClick={() => { if (value) onChange(id); }}>
                    {t('common.no', 'Non')}
                </button>
            </div>
        </div>
    );
}
