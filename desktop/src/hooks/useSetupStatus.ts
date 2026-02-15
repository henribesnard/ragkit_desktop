import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useSetupStatus() {
    const [hasCompletedSetup, setHasCompletedSetup] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const checkStatus = async () => {
            try {
                const res: any = await invoke("get_setup_status");
                if (!cancelled) {
                    setHasCompletedSetup(!!res.setup_completed);
                }
            } catch {
                // Backend not ready yet, retry after delay
                if (!cancelled) {
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
