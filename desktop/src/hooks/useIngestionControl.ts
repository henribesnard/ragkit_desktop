import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useIngestionControl() {
  const [status, setStatus] = useState<any>(null);
  const [changes, setChanges] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tickCount = useRef(0);

  // Lightweight poll — only status + log (pure memory reads, fast)
  const refreshStatus = useCallback(async () => {
    try {
      const [nextStatus, nextLogs] = await Promise.all([
        invoke("get_ingestion_status"),
        invoke("get_ingestion_log"),
      ]);
      setStatus(nextStatus);
      setLogs(nextLogs as any[]);
      setError(null);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Full refresh — includes detect_changes (heavy I/O) + history
  const refresh = useCallback(async () => {
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
  }, []);

  const start = async (incremental = false) => {
    await invoke("start_ingestion", { incremental });
    await refreshStatus();
  };

  const pause = async () => {
    await invoke("pause_ingestion");
    await refreshStatus();
  };

  const resume = async () => {
    await invoke("resume_ingestion");
    await refreshStatus();
  };

  const cancel = async () => {
    await invoke("cancel_ingestion");
    await refreshStatus();
  };

  const restore = async (version: string) => {
    await invoke("restore_ingestion_version", { version });
    await refresh();
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    // Full refresh on mount
    void refresh();

    // Then poll lightly every 15s; full refresh every 5 ticks (75s)
    timer = setInterval(() => {
      if (cancelled) return;
      tickCount.current += 1;
      if (tickCount.current % 5 === 0) {
        void refresh();
      } else {
        void refreshStatus();
      }
    }, 15_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [refresh, refreshStatus]);

  return { status, changes, history, logs, loading, error, refresh, start, pause, resume, cancel, restore };
}

