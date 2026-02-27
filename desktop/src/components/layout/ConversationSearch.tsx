import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";

interface ConversationSearchProps {
    value: string;
    onChange: (value: string) => void;
}

export function ConversationSearch({ value, onChange }: ConversationSearchProps) {
    const { t } = useTranslation();

    return (
        <div className="relative mb-2">
            <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--text-tertiary)" }}
            />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={t("sidebar.search")}
                className="w-full text-sm outline-none"
                style={{
                    height: 32,
                    paddingLeft: 32,
                    paddingRight: 12,
                    background: "var(--bg-tertiary)",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-primary)",
                }}
            />
        </div>
    );
}
