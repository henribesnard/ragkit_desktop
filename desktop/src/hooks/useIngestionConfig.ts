import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useIngestionConfig() {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await invoke("get_ingestion_config");
            setConfig(res);
            setError(null);
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    };

    const updateConfig = async (newConfig: any) => {
        setSaveError(null);
        try {
            const res = await invoke("update_ingestion_config", { config: newConfig });
            setConfig(res);
            return true;
        } catch (err: any) {
            setSaveError(err.toString());
            return false;
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    return { config, loading, error, saveError, fetchConfig, updateConfig };
}
