// desktop/src/hooks/useBackendHealth.ts
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useBackendHealth(intervalMs = 10_000) {
    const [isHealthy, setIsHealthy] = useState(false);

    useEffect(() => {
        const check = async () => {
            try {
                const res: any = await invoke("health_check");
                setIsHealthy(res?.ok === true);
            } catch {
                setIsHealthy(false);
            }
        };

        check();
        const id = setInterval(check, intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);

    return isHealthy;
}
