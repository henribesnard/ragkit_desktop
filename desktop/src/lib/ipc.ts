// desktop/src/lib/ipc.ts
import { invoke } from "@tauri-apps/api/core";

interface HealthCheckResponse {
    ok: boolean;
    version?: string;
}

export const ipc = {
    healthCheck: () => invoke<HealthCheckResponse>("health_check"),
};
