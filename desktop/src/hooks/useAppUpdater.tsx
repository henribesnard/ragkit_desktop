import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";

// ── Constants ────────────────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

const LS_KEY_AUTO_CHECK = "loko-auto-update-check";
const LS_KEY_LAST_CHECK = "loko-last-update-check";
const LS_KEY_DISMISSED = "loko-dismissed-update-version";

// ── Types ────────────────────────────────────────────────────────────────────

export type UpdateStatus =
    | "idle"
    | "checking"
    | "up-to-date"
    | "available"
    | "downloading"
    | "installing"
    | "error";

export interface UpdaterState {
    /** Current app version from tauri.conf.json */
    currentVersion: string | null;
    /** Available remote version (null when not checked or not found) */
    availableVersion: string | null;
    /** Version postponed by the user (persisted) */
    dismissedVersion: string | null;
    /** Current updater status */
    status: UpdateStatus;
    /** Download progress 0-100, null when not applicable */
    downloadPercent: number | null;
    /** Error message, null when no error */
    errorMessage: string | null;
    /** ISO timestamp of last successful check */
    lastCheckedAt: string | null;
    /** Whether automatic checking is enabled */
    autoCheckEnabled: boolean;
}

export interface UpdaterActions {
    /** Manually trigger an update check */
    checkForUpdates: () => Promise<void>;
    /** Start downloading and installing the available update */
    installUpdate: () => Promise<void>;
    /** Dismiss (postpone) the available update */
    dismissUpdate: () => void;
    /** Toggle automatic update checking */
    setAutoCheckEnabled: (enabled: boolean) => void;
}

type AppUpdaterContextValue = UpdaterState & UpdaterActions;

// ── LocalStorage helpers ─────────────────────────────────────────────────────

function lsGet(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function lsSet(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* quota exceeded or private mode – silently ignore */
    }
}

function lsRemove(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        /* ignore */
    }
}

// ── Context ──────────────────────────────────────────────────────────────────

const AppUpdaterContext = createContext<AppUpdaterContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function AppUpdaterProvider({ children }: { children: ReactNode }) {
    // ── state ────────────────────────────────────────────────────────────────
    const [currentVersion, setCurrentVersion] = useState<string | null>(null);
    const [availableVersion, setAvailableVersion] = useState<string | null>(null);
    const [dismissedVersion, setDismissedVersion] = useState<string | null>(
        lsGet(LS_KEY_DISMISSED),
    );
    const [status, setStatus] = useState<UpdateStatus>("idle");
    const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(
        lsGet(LS_KEY_LAST_CHECK),
    );
    const [autoCheckEnabled, setAutoCheckEnabledState] = useState<boolean>(
        lsGet(LS_KEY_AUTO_CHECK) !== "false", // default = true
    );

    // ── refs ─────────────────────────────────────────────────────────────────
    const updateRef = useRef<Update | null>(null);
    const isCheckingRef = useRef(false);

    // ── helpers ──────────────────────────────────────────────────────────────
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

    // ── fetch current version on mount ───────────────────────────────────────
    useEffect(() => {
        getVersion()
            .then((v) => setCurrentVersion(v))
            .catch((err) =>
                console.warn("[updater] Failed to get app version:", err),
            );
    }, []);

    // If the app is already at the dismissed version (e.g. updated externally),
    // clear the persisted badge to avoid a stale update indicator.
    useEffect(() => {
        if (!currentVersion || !dismissedVersion) return;
        if (currentVersion === dismissedVersion) {
            lsRemove(LS_KEY_DISMISSED);
            setDismissedVersion(null);
        }
    }, [currentVersion, dismissedVersion]);

    // ── checkForUpdates ──────────────────────────────────────────────────────
    const checkForUpdates = useCallback(async () => {
        if (
            isCheckingRef.current ||
            status === "downloading" ||
            status === "installing"
        ) {
            return;
        }

        isCheckingRef.current = true;
        setStatus("checking");
        setErrorMessage(null);

        try {
            const nextUpdate = await check();
            const now = new Date().toISOString();
            setLastCheckedAt(now);
            lsSet(LS_KEY_LAST_CHECK, now);

            if (!nextUpdate) {
                setAvailableVersion(null);
                setStatus("up-to-date");
                return;
            }

            // Has this version been dismissed?
            const dismissed = lsGet(LS_KEY_DISMISSED);
            if (dismissed === nextUpdate.version) {
                await nextUpdate.close();
                // Keep the version around so the UI can still show a subtle badge.
                setAvailableVersion(nextUpdate.version);
                setStatus("up-to-date");
                return;
            }

            await closeTrackedUpdate();
            updateRef.current = nextUpdate;
            setAvailableVersion(nextUpdate.version);
            // A new version supersedes any previously dismissed one.
            setDismissedVersion(null);
            setDownloadPercent(null);
            setStatus("available");
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            console.warn("[updater] Failed to check updates:", error);
            setErrorMessage(message);
            setStatus("error");
        } finally {
            isCheckingRef.current = false;
        }
    }, [closeTrackedUpdate, status]);

    // ── installUpdate ────────────────────────────────────────────────────────
    const installUpdate = useCallback(async () => {
        if (
            !updateRef.current ||
            status === "downloading" ||
            status === "installing"
        ) {
            return;
        }

        setErrorMessage(null);
        setDownloadPercent(0);
        setStatus("downloading");

        // Track raw bytes for proper percent calculation
        let downloadedBytes = 0;
        let totalBytes: number | null = null;

        try {
            await updateRef.current.downloadAndInstall((event) => {
                if (event.event === "Started") {
                    downloadedBytes = 0;
                    totalBytes = event.data.contentLength ?? null;
                    setDownloadPercent(0);
                    return;
                }

                if (event.event === "Progress") {
                    downloadedBytes += event.data.chunkLength;
                    if (totalBytes && totalBytes > 0) {
                        setDownloadPercent(
                            Math.min(
                                100,
                                Math.round(
                                    (downloadedBytes / totalBytes) * 100,
                                ),
                            ),
                        );
                    }
                    return;
                }

                if (event.event === "Finished") {
                    setDownloadPercent(100);
                    setStatus("installing");
                }
            });

            // Clear dismissed version on successful install
            lsRemove(LS_KEY_DISMISSED);
            setDismissedVersion(null);
            await closeTrackedUpdate();
            await relaunch();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            console.error("[updater] Failed to install update:", error);
            setErrorMessage(message);
            setStatus("error");
        }
    }, [closeTrackedUpdate, status]);

    // ── dismissUpdate ────────────────────────────────────────────────────────
    const dismissUpdate = useCallback(() => {
        if (availableVersion) {
            lsSet(LS_KEY_DISMISSED, availableVersion);
            setDismissedVersion(availableVersion);
        }
        setStatus("idle");
    }, [availableVersion]);

    // ── setAutoCheckEnabled ──────────────────────────────────────────────────
    const setAutoCheckEnabled = useCallback((enabled: boolean) => {
        setAutoCheckEnabledState(enabled);
        lsSet(LS_KEY_AUTO_CHECK, String(enabled));
    }, []);

    // ── auto-check on mount + periodic ───────────────────────────────────────
    useEffect(() => {
        if (!autoCheckEnabled) return;

        // Initial check on mount
        void checkForUpdates();

        const intervalId = window.setInterval(() => {
            void checkForUpdates();
        }, CHECK_INTERVAL_MS);

        return () => {
            window.clearInterval(intervalId);
        };
        // We intentionally depend only on autoCheckEnabled to avoid
        // re-registering the interval when checkForUpdates ref changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoCheckEnabled]);

    // ── cleanup on unmount ───────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            void closeTrackedUpdate();
        };
    }, [closeTrackedUpdate]);

    // ── context value ────────────────────────────────────────────────────────
    const value = useMemo<AppUpdaterContextValue>(
        () => ({
            currentVersion,
            availableVersion,
            dismissedVersion,
            status,
            downloadPercent,
            errorMessage,
            lastCheckedAt,
            autoCheckEnabled,
            checkForUpdates,
            installUpdate,
            dismissUpdate,
            setAutoCheckEnabled,
        }),
        [
            currentVersion,
            availableVersion,
            dismissedVersion,
            status,
            downloadPercent,
            errorMessage,
            lastCheckedAt,
            autoCheckEnabled,
            checkForUpdates,
            installUpdate,
            dismissUpdate,
            setAutoCheckEnabled,
        ],
    );

    return (
        <AppUpdaterContext.Provider value={value}>
            {children}
        </AppUpdaterContext.Provider>
    );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAppUpdater(): AppUpdaterContextValue {
    const ctx = useContext(AppUpdaterContext);
    if (!ctx) {
        throw new Error(
            "useAppUpdater must be used within an <AppUpdaterProvider>",
        );
    }
    return ctx;
}
