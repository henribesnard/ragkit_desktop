import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useIngestionControl() {
  const [status, setStatus] = useState<any>(null);
  const [changes, setChanges] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [nextStatus, nextChanges, nextHistory, nextLogs] = await Promise.all([
        invoke("get_ingestion_status"),
        invoke("detect_changes"),
        invoke("get_ingestion_history", { limit: 10 }),
        invoke("get_ingestion_log"),
      ]);
      setStatus(nextStatus);
      setChanges(nextChanges);
      setHistory(nextHistory as any[]);
      setLogs(nextLogs as any[]);
      setError(null);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const start = async (incremental = false) => {
    await invoke("start_ingestion", { incremental });
    await refresh();
  };

  const pause = async () => {
    await invoke("pause_ingestion");
    await refresh();
  };

  const resume = async () => {
    await invoke("resume_ingestion");
    await refresh();
  };

  const cancel = async () => {
    await invoke("cancel_ingestion");
    await refresh();
  };

  const restore = async (version: string) => {
    await invoke("restore_ingestion_version", { version });
    await refresh();
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (cancelled) return;
      await refresh();
    };

    void tick();
    timer = setInterval(() => {
      void tick();
    }, 3000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  return { status, changes, history, logs, loading, error, refresh, start, pause, resume, cancel, restore };
}

