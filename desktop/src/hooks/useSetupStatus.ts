import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

const MAX_SETUP_RETRIES = 20;

export function useSetupStatus() {
    const [hasCompletedSetup, setHasCompletedSetup] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        let attempt = 0;

        const checkStatus = async () => {
            try {
                const res: any = await invoke("get_setup_status");
                if (!cancelled) {
                    setHasCompletedSetup(!!res.setup_completed);
                }
            } catch {
                attempt += 1;
                if (!cancelled && attempt < MAX_SETUP_RETRIES) {
                    // Exponential backoff: 200ms, 400ms, 800ms, 1.6s, capped at 2s
                    const delay = Math.min(200 * Math.pow(2, attempt - 1), 2000);
                    setTimeout(checkStatus, delay);
                    return;
                }
            }
            if (!cancelled) {
                setIsLoading(false);
            }
        };

        checkStatus();

        return () => { cancelled = true; };
    }, []);

    return { hasCompletedSetup, isLoading };
}
