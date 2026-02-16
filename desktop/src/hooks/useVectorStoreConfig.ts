import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useVectorStoreConfig() {
  const [config, setConfig] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    const cfg = await invoke("get_vector_store_config");
    const st = await invoke("get_vector_store_collection_stats");
    setConfig(cfg);
    setStats(st);
    setLoading(false);
  };

  const updateConfig = async (next: any) => {
    const saved = await invoke("update_vector_store_config", { config: next });
    setConfig(saved);
    return saved;
  };

  const testConnection = () => invoke("test_vector_store_connection");
  const deleteCollection = () => invoke("delete_vector_store_collection");

  useEffect(() => {
    fetchAll();
  }, []);

  return { config, stats, loading, fetchAll, updateConfig, testConnection, deleteCollection };
}
