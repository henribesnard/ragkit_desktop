import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useIngestionControl() {
  const [status, setStatus] = useState<any>(null);
  const [changes, setChanges] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const refresh = async () => {
    setStatus(await invoke("get_ingestion_status"));
    setChanges(await invoke("detect_changes"));
    setHistory((await invoke("get_ingestion_history", { limit: 10 })) as any[]);
    setLogs((await invoke("get_ingestion_log")) as any[]);
  };

  const start = async (incremental = false) => {
    await invoke("start_ingestion", { incremental });
    await refresh();
  };
  const pause = async () => { await invoke("pause_ingestion"); await refresh(); };
  const resume = async () => { await invoke("resume_ingestion"); await refresh(); };
  const cancel = async () => { await invoke("cancel_ingestion"); await refresh(); };
  const restore = async (version: string) => { await invoke("restore_ingestion_version", { version }); await refresh(); };

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, []);

  return { status, changes, history, logs, refresh, start, pause, resume, cancel, restore };
}
