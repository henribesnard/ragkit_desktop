import { useTranslation } from "react-i18next";
import { useAppUpdater } from "@/hooks/useAppUpdater";
import { RefreshCw, Download, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

function formatRelativeTime(isoDate: string, t: (key: string) => string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return t("updater.justNow");
    if (minutes < 60) return t("updater.minutesAgo").replace("{{count}}", String(minutes));
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("updater.hoursAgo").replace("{{count}}", String(hours));
    const days = Math.floor(hours / 24);
    return t("updater.daysAgo").replace("{{count}}", String(days));
}

export function AboutSettings() {
    const { t } = useTranslation();
    const {
        currentVersion,
        availableVersion,
        status,
        downloadPercent,
        errorMessage,
        lastCheckedAt,
        autoCheckEnabled,
        checkForUpdates,
        installUpdate,
        dismissUpdate,
        setAutoCheckEnabled,
    } = useAppUpdater();

    const isActionDisabled =
        status === "checking" ||
        status === "downloading" ||
        status === "installing";

    return (
        <div className="space-y-6">
            {/* Title */}
            <div>
                <h2
                    className="text-base font-semibold mb-1"
                    style={{ color: "var(--text-primary)" }}
                >
                    {t("updater.aboutTitle")}
                </h2>
                <p
                    className="text-sm"
                    style={{ color: "var(--text-tertiary)" }}
                >
                    {t("updater.aboutSubtitle")}
                </p>
            </div>

            {/* Version Card */}
            <div
                style={{
                    background: "var(--bg-secondary)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-default)",
                    padding: "20px 24px",
                }}
            >
                <span
                    style={{
                        fontSize: 20,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        color: "var(--primary-500)",
                    }}
                >
                    LOKO
                </span>
                <div
                    className="mt-2 text-sm"
                    style={{ color: "var(--text-secondary)" }}
                >
                    {t("updater.currentVersion")}{" "}
                    <span
                        className="font-semibold"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {currentVersion ? `v${currentVersion}` : "..."}
                    </span>
                </div>
                <p
                    className="mt-1 text-xs"
                    style={{ color: "var(--text-tertiary)" }}
                >
                    {t("updater.aboutDescription")}
                </p>
            </div>

            {/* Update Section */}
            <div>
                <h3
                    className="text-sm font-semibold mb-3"
                    style={{ color: "var(--text-primary)" }}
                >
                    {t("updater.updatesSection")}
                </h3>

                {/* ── Status Card ──────────────────────────────────────── */}
                <div
                    style={{
                        background: "var(--bg-secondary)",
                        borderRadius: "var(--radius-lg)",
                        border: "1px solid var(--border-default)",
                        padding: "16px 20px",
                    }}
                >
                    {/* idle — show check button */}
                    {status === "idle" && (
                        <button
                            onClick={() => void checkForUpdates()}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
                            style={{
                                borderRadius: "var(--radius-md)",
                                background: "var(--primary-500)",
                                color: "#fff",
                            }}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.filter = "brightness(0.9)";
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.filter = "none";
                            }}
                        >
                            <RefreshCw size={16} />
                            {t("updater.checkForUpdates")}
                        </button>
                    )}

                    {/* checking — spinner */}
                    {status === "checking" && (
                        <div
                            className="flex items-center gap-3 text-sm"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            <Loader2 size={18} className="animate-spin" style={{ color: "var(--primary-500)" }} />
                            {t("updater.checking")}
                        </div>
                    )}

                    {/* up-to-date — success */}
                    {status === "up-to-date" && (
                        <div className="space-y-3">
                            <div
                                className="flex items-center gap-2 text-sm font-medium"
                                style={{ color: "var(--success)" }}
                            >
                                <CheckCircle2 size={18} />
                                {t("updater.upToDate")}
                            </div>
                            <button
                                onClick={() => void checkForUpdates()}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors"
                                style={{
                                    borderRadius: "var(--radius-md)",
                                    background: "transparent",
                                    color: "var(--text-secondary)",
                                    border: "1px solid var(--border-default)",
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = "transparent";
                                }}
                            >
                                <RefreshCw size={14} />
                                {t("updater.checkAgain")}
                            </button>
                        </div>
                    )}

                    {/* available — update ready */}
                    {status === "available" && availableVersion && (
                        <div className="space-y-3">
                            <div
                                className="flex items-center gap-2 text-sm font-semibold"
                                style={{ color: "var(--primary-500)" }}
                            >
                                <Download size={18} />
                                {t("updater.newVersionAvailable")}
                            </div>
                            <p
                                className="text-sm"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                {t("updater.versionLabel", { version: availableVersion })}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => void installUpdate()}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors text-white"
                                    style={{
                                        borderRadius: "var(--radius-md)",
                                        background: "var(--primary-500)",
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLElement).style.filter = "brightness(0.9)";
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLElement).style.filter = "none";
                                    }}
                                >
                                    <Download size={16} />
                                    {t("updater.installAndRestart")}
                                </button>
                                <button
                                    onClick={dismissUpdate}
                                    className="px-4 py-2 text-sm font-medium transition-colors"
                                    style={{
                                        borderRadius: "var(--radius-md)",
                                        background: "transparent",
                                        color: "var(--text-secondary)",
                                        border: "1px solid var(--border-default)",
                                    }}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLElement).style.background = "transparent";
                                    }}
                                >
                                    {t("updater.postpone")}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* downloading — progress bar */}
                    {status === "downloading" && (
                        <div className="space-y-3">
                            <div
                                className="flex items-center gap-2 text-sm font-medium"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                <Loader2 size={18} className="animate-spin" style={{ color: "var(--primary-500)" }} />
                                {downloadPercent !== null
                                    ? t("updater.downloadPercent", { percent: downloadPercent })
                                    : t("updater.downloadingLabel")}
                            </div>
                            {/* Progress bar */}
                            <div
                                style={{
                                    height: 6,
                                    borderRadius: 3,
                                    background: "var(--bg-hover)",
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        height: "100%",
                                        borderRadius: 3,
                                        width: `${downloadPercent ?? 0}%`,
                                        background: "var(--primary-500)",
                                        transition: "width 0.3s ease",
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* installing — almost done */}
                    {status === "installing" && (
                        <div
                            className="flex items-center gap-3 text-sm"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            <Loader2 size={18} className="animate-spin" style={{ color: "var(--primary-500)" }} />
                            <div>
                                <p className="font-medium">{t("updater.installingLabel")}</p>
                                <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                                    {t("updater.installRestart")}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* error */}
                    {status === "error" && (
                        <div className="space-y-3">
                            <div
                                className="flex items-center gap-2 text-sm font-medium"
                                style={{ color: "var(--error)" }}
                            >
                                <AlertCircle size={18} />
                                {t("updater.errorTitle")}
                            </div>
                            {errorMessage && (
                                <p
                                    className="text-xs"
                                    style={{
                                        color: "var(--text-tertiary)",
                                        wordBreak: "break-word",
                                    }}
                                >
                                    {errorMessage}
                                </p>
                            )}
                            <button
                                onClick={() => void checkForUpdates()}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors"
                                style={{
                                    borderRadius: "var(--radius-md)",
                                    background: "transparent",
                                    color: "var(--text-secondary)",
                                    border: "1px solid var(--border-default)",
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = "transparent";
                                }}
                            >
                                <RefreshCw size={14} />
                                {t("updater.retry")}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Auto-check toggle + last checked */}
            <div
                style={{
                    background: "var(--bg-secondary)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-default)",
                    padding: "16px 20px",
                }}
            >
                <div className="flex items-center justify-between">
                    <label
                        htmlFor="auto-update-toggle"
                        className="text-sm font-medium"
                        style={{ color: "var(--text-primary)", cursor: "pointer" }}
                    >
                        {t("updater.autoCheck")}
                    </label>
                    <button
                        id="auto-update-toggle"
                        role="switch"
                        aria-checked={autoCheckEnabled}
                        onClick={() => setAutoCheckEnabled(!autoCheckEnabled)}
                        disabled={isActionDisabled}
                        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                        style={{
                            background: autoCheckEnabled ? "var(--primary-500)" : "var(--bg-hover)",
                            cursor: isActionDisabled ? "not-allowed" : "pointer",
                            opacity: isActionDisabled ? 0.5 : 1,
                        }}
                    >
                        <span
                            className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                            style={{
                                transform: autoCheckEnabled ? "translateX(17px)" : "translateX(3px)",
                            }}
                        />
                    </button>
                </div>

                {lastCheckedAt && (
                    <p
                        className="text-xs mt-2"
                        style={{ color: "var(--text-tertiary)" }}
                    >
                        {t("updater.lastChecked", {
                            time: formatRelativeTime(lastCheckedAt, t),
                        })}
                    </p>
                )}
                {!lastCheckedAt && (
                    <p
                        className="text-xs mt-2"
                        style={{ color: "var(--text-tertiary)" }}
                    >
                        {t("updater.neverChecked")}
                    </p>
                )}
            </div>
        </div>
    );
}
