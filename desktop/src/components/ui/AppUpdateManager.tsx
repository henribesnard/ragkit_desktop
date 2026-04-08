import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ConfirmDialog } from "./ConfirmDialog";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

type ProgressState = {
    downloadedBytes: number;
    contentLength: number | null;
};

export function AppUpdateManager() {
    const { t } = useTranslation();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [availableVersion, setAvailableVersion] = useState<string | null>(null);
    const [installState, setInstallState] = useState<"idle" | "downloading" | "installing" | "error">("idle");
    const [progress, setProgress] = useState<ProgressState>({ downloadedBytes: 0, contentLength: null });
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const updateRef = useRef<Update | null>(null);
    const isCheckingRef = useRef(false);
    const dismissedVersionRef = useRef<string | null>(null);

    const closeTrackedUpdate = useCallback(async () => {
        if (!updateRef.current) return;
        try {
            await updateRef.current.close();
        } catch (error) {
            console.warn("[updater] Failed to close update handle:", error);
        } finally {
            updateRef.current = null;
        }
    }, []);

    const checkForUpdates = useCallback(async () => {
        if (isCheckingRef.current || installState === "downloading" || installState === "installing") {
            return;
        }

        isCheckingRef.current = true;
        try {
            const nextUpdate = await check();
            if (!nextUpdate) return;

            if (dismissedVersionRef.current === nextUpdate.version) {
                await nextUpdate.close();
                return;
            }

            await closeTrackedUpdate();
            updateRef.current = nextUpdate;
            setAvailableVersion(nextUpdate.version);
            setErrorMessage(null);
            setProgress({ downloadedBytes: 0, contentLength: null });
            setInstallState("idle");
            setIsDialogOpen(true);
        } catch (error) {
            console.warn("[updater] Failed to check updates:", error);
        } finally {
            isCheckingRef.current = false;
        }
    }, [closeTrackedUpdate, installState]);

    useEffect(() => {
        void checkForUpdates();
        const intervalId = window.setInterval(() => {
            void checkForUpdates();
        }, CHECK_INTERVAL_MS);

        return () => {
            window.clearInterval(intervalId);
            void closeTrackedUpdate();
        };
    }, [checkForUpdates, closeTrackedUpdate]);

    const handleDismiss = useCallback(() => {
        if (installState === "downloading" || installState === "installing") return;
        dismissedVersionRef.current = availableVersion;
        setIsDialogOpen(false);
    }, [availableVersion, installState]);

    const handleInstall = useCallback(async () => {
        if (!updateRef.current || installState === "downloading" || installState === "installing") return;

        setErrorMessage(null);
        setProgress({ downloadedBytes: 0, contentLength: null });
        setInstallState("downloading");

        try {
            await updateRef.current.downloadAndInstall((event) => {
                if (event.event === "Started") {
                    setProgress({ downloadedBytes: 0, contentLength: event.data.contentLength ?? null });
                    return;
                }

                if (event.event === "Progress") {
                    setProgress((current) => ({
                        downloadedBytes: current.downloadedBytes + event.data.chunkLength,
                        contentLength: current.contentLength,
                    }));
                    return;
                }

                if (event.event === "Finished") {
                    setInstallState("installing");
                }
            });

            await closeTrackedUpdate();
            await relaunch();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error("[updater] Failed to install update:", error);
            setErrorMessage(message);
            setInstallState("error");
        }
    }, [closeTrackedUpdate, installState]);

    if (!isDialogOpen || !availableVersion) {
        return null;
    }

    const progressPercent =
        progress.contentLength && progress.contentLength > 0
            ? Math.min(100, Math.round((progress.downloadedBytes / progress.contentLength) * 100))
            : null;

    let title = t("updater.availableTitle");
    let message = t("updater.availableMessage", { version: availableVersion });
    let confirmLabel = t("updater.installNow");

    if (installState === "downloading") {
        title = t("updater.downloadingTitle");
        message = progressPercent === null
            ? t("updater.downloadingMessage")
            : t("updater.downloadingProgress", { percent: progressPercent });
        confirmLabel = t("updater.downloadingButton");
    } else if (installState === "installing") {
        title = t("updater.installingTitle");
        message = t("updater.installingMessage");
        confirmLabel = t("updater.installingButton");
    } else if (installState === "error" && errorMessage) {
        title = t("updater.errorTitle");
        message = t("updater.errorMessage", { error: errorMessage });
        confirmLabel = t("updater.retryInstall");
    }

    return (
        <ConfirmDialog
            open={isDialogOpen}
            title={title}
            message={message}
            confirmLabel={confirmLabel}
            cancelLabel={t("updater.later")}
            onConfirm={() => {
                void handleInstall();
            }}
            onCancel={handleDismiss}
        />
    );
}
