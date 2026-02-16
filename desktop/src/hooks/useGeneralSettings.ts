import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useGeneralSettings() {
  const [settings, setSettings] = useState<any>(null);

  const refresh = async () => setSettings(await invoke("get_general_settings"));
  const update = async (patch: any) => {
    const merged = { ...settings, ...patch };
    const saved = await invoke("update_general_settings", { settings: merged });
    setSettings(saved);
  };

  useEffect(() => {
    refresh();
  }, []);

  return { settings, update, refresh };
}
