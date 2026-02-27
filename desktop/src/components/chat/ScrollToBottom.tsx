import { ArrowDown } from "lucide-react";

interface ScrollToBottomProps {
    visible: boolean;
    onClick: () => void;
}

export function ScrollToBottom({ visible, onClick }: ScrollToBottomProps) {
    if (!visible) return null;

    return (
        <button
            onClick={onClick}
            className="animate-fade-in transition-shadow"
            style={{
                position: "absolute",
                bottom: 90,
                left: "50%",
                transform: "translateX(-50%)",
                width: 36,
                height: 36,
                borderRadius: "var(--radius-full)",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-default)",
                boxShadow: "var(--shadow-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 10,
                color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-lg)";
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
            }}
        >
            <ArrowDown size={16} />
        </button>
    );
}
