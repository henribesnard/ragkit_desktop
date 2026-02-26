// desktop/src/hooks/useBackendHealth.ts
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useBackendHealth(intervalMs = 10_000) {
    const [isHealthy, setIsHealthy] = useState(false);
    const [version, setVersion] = useState<string | null>(null);

    useEffect(() => {
        const check = async () => {
            try {
                const res: any = await invoke("health_check");
                setIsHealthy(res?.ok === true);
                if (res?.version) setVersion(res.version);
            } catch {
                setIsHealthy(false);
            }
        };

        check();
        const id = setInterval(check, intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);

    return { isHealthy, version };
}
