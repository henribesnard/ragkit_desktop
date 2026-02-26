import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface IngestionStatus {
    status: "idle" | "running" | "paused" | "completed" | "error";
    doc_index: number;
    doc_total: number;
    current_doc?: string;
    coverage_percent?: number;
}

// Module-level state to persist across unmounts
let globalIngestionStatus: IngestionStatus | null = null;
const listeners = new Set<(status: IngestionStatus | null) => void>();

function updateGlobalStatus(status: IngestionStatus | null) {
    globalIngestionStatus = status;
    listeners.forEach(l => l(status));
}

let pollingActive = false;
async function pollIngestion() {
    if (pollingActive) return;
    pollingActive = true;

    while (pollingActive) {
        try {
            const status = await invoke<IngestionStatus>("get_ingestion_status");
            updateGlobalStatus(status);

            // Poll fast while running, slow otherwise
            const delay = status.status === "running" ? 2000 : 10000;
            await new Promise(resolve => setTimeout(resolve, delay));
        } catch (err) {
            console.error("Failed to poll ingestion status:", err);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
}

export function usePersistentIngestion() {
    const [status, setStatus] = useState<IngestionStatus | null>(globalIngestionStatus);

    useEffect(() => {
        const listener = (newStatus: IngestionStatus | null) => setStatus(newStatus);
        listeners.add(listener);

        // Trigger initial poll if not already active
        if (!pollingActive) {
            void pollIngestion();
        }

        return () => {
            listeners.delete(listener);
            // Stop polling if no more listeners
            if (listeners.size === 0) {
                pollingActive = false;
            }
        };
    }, []);

    const refresh = async () => {
        const newStatus = await invoke<IngestionStatus>("get_ingestion_status");
        updateGlobalStatus(newStatus);
        if (!pollingActive && listeners.size > 0) {
            void pollIngestion();
        }
        return newStatus;
    };

    return {
        status,
        refresh,
        isRunning: status?.status === "running",
        progress: status?.doc_total ? Math.round((status.doc_index / status.doc_total) * 100) : 0,
        coveragePercent: status?.coverage_percent ?? 0,
    };
}
