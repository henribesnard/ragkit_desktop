import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

const MAX_SETUP_RETRIES = 30;

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
                    setTimeout(checkStatus, 1000);
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
