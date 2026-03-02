import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

interface EmptyStateProps {
    isReady: boolean;
    isIngesting?: boolean;
}

export function EmptyState({ isReady, isIngesting }: EmptyStateProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { theme } = useTheme();

    return (
        <div className="flex flex-col items-center justify-center text-center animate-fade-in" style={{ paddingTop: "15vh" }}>
            {/* LOKO Wordmark */}
            <h1
                style={{
                    fontSize: 30,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    color: theme === "dark" ? "var(--primary-400)" : "var(--primary-800)",
                    marginBottom: 16,
                }}
            >
                LOKO
            </h1>

            {isReady ? (
                <>
                    <p
                        className="text-xl font-semibold mb-2"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {t("chat.emptyTitle")}
                    </p>
                    <p
                        className="text-sm"
                        style={{ color: "var(--text-secondary)", maxWidth: 400 }}
                    >
                        {t("chat.emptySubtitle")}
                    </p>
                </>
            ) : isIngesting ? (
                <>
                    <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                        <p
                            className="text-xl font-semibold"
                            style={{ color: "var(--text-primary)" }}
                        >
                            {t("chat.ingestingTitle")}
                        </p>
                    </div>
                    <p
                        className="text-sm"
                        style={{ color: "var(--text-secondary)", maxWidth: 400 }}
                    >
                        {t("chat.ingestingSubtitle")}
                    </p>
                </>
            ) : (
                <>
                    <p
                        className="text-xl font-semibold mb-2"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {t("chat.notConfiguredTitle")}
                    </p>
                    <p
                        className="text-sm mb-6"
                        style={{ color: "var(--text-secondary)", maxWidth: 400 }}
                    >
                        {t("chat.notConfiguredSubtitle")}
                    </p>
                    <button
                        onClick={() => navigate("/settings")}
                        className="px-6 py-2.5 text-sm font-medium text-white rounded-lg transition-colors"
                        style={{ background: "var(--primary-500)" }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "var(--primary-600)";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "var(--primary-500)";
                        }}
                    >
                        {t("chat.notConfiguredAction")}
                    </button>
                </>
            )}
        </div>
    );
}
