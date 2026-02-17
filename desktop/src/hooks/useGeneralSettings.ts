import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface GeneralSettings {
  ingestion_mode: "manual" | "automatic";
  auto_ingestion_delay: number;
  search_type: "semantic" | "lexical" | "hybrid";
}

const defaultSettings: GeneralSettings = {
  ingestion_mode: "manual",
  auto_ingestion_delay: 30,
  search_type: "hybrid",
};

export function useGeneralSettings() {
  const [settings, setSettings] = useState<GeneralSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const next = await invoke<GeneralSettings>("get_general_settings");
    setSettings({ ...defaultSettings, ...next });
  };

  const update = async (patch: Partial<GeneralSettings>) => {
    const merged = { ...settings, ...patch };
    const saved = await invoke<GeneralSettings>("update_general_settings", { settings: merged });
    setSettings({ ...defaultSettings, ...saved });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await invoke<GeneralSettings>("get_general_settings");
        if (!cancelled) {
          setSettings({ ...defaultSettings, ...next });
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loading, error, update, refresh };
}
