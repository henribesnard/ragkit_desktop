import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "./ConfirmDialog";
import { useAppUpdater } from "@/hooks/useAppUpdater";

/**
 * Modal dialog that surfaces when an update is detected in the background.
 * All update logic lives in useAppUpdater; this component is a thin UI shell.
 */
export function AppUpdateManager() {
    const { t } = useTranslation();
    const {
        availableVersion,
        status,
        downloadPercent,
        errorMessage,
        installUpdate,
        dismissUpdate,
    } = useAppUpdater();

    const handleInstall = useCallback(() => {
        void installUpdate();
    }, [installUpdate]);

    // Only show the dialog when an update is available, downloading, installing, or errored
    const showDialog =
        status === "available" ||
        status === "downloading" ||
        status === "installing" ||
        status === "error";

    if (!showDialog || !availableVersion) {
        return null;
    }

    // ── Determine dialog content based on status ────────────────────────────
    let title = t("updater.availableTitle");
    let message = t("updater.availableMessage", { version: availableVersion });
    let confirmLabel = t("updater.installNow");

    if (status === "downloading") {
        title = t("updater.downloadingTitle");
        message = downloadPercent === null
            ? t("updater.downloadingMessage")
            : t("updater.downloadingProgress", { percent: downloadPercent });
        confirmLabel = t("updater.downloadingButton");
    } else if (status === "installing") {
        title = t("updater.installingTitle");
        message = t("updater.installingMessage");
        confirmLabel = t("updater.installingButton");
    } else if (status === "error" && errorMessage) {
        title = t("updater.errorTitle");
        message = t("updater.errorMessage", { error: errorMessage });
        confirmLabel = t("updater.retryInstall");
    }

    return (
        <ConfirmDialog
            open={showDialog}
            title={title}
            message={message}
            confirmLabel={confirmLabel}
            cancelLabel={t("updater.later")}
            onConfirm={handleInstall}
            onCancel={dismissUpdate}
        />
    );
}
