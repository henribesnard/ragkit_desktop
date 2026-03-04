import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

interface EmptyStateProps {
    isReady: boolean;
    isIngesting?: boolean;
    isBackendDown?: boolean;
}

export function EmptyState({ isReady, isIngesting, isBackendDown }: EmptyStateProps) {
    const { t } = useTranslation();
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
            ) : isBackendDown ? (
                <>
                    <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-tertiary)" }} />
                        <p
                            className="text-xl font-semibold"
                            style={{ color: "var(--text-primary)" }}
                        >
                            {t("chat.connectingTitle")}
                        </p>
                    </div>
                    <p
                        className="text-sm"
                        style={{ color: "var(--text-secondary)", maxWidth: 400 }}
                    >
                        {t("chat.connectingSubtitle")}
                    </p>
                </>
            ) : (
                <>
                    <p
                        className="text-xl font-semibold mb-2"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {t("chat.noDocumentsTitle")}
                    </p>
                    <p
                        className="text-sm"
                        style={{ color: "var(--text-secondary)", maxWidth: 400 }}
                    >
                        {t("chat.noDocumentsSubtitle")}
                    </p>
                </>
            )}
        </div>
    );
}
