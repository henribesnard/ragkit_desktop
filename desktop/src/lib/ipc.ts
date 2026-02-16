import { invoke } from "@tauri-apps/api/core";

interface HealthCheckResponse {
  ok: boolean;
  version?: string;
}

export const ipc = {
  healthCheck: () => invoke<HealthCheckResponse>("health_check"),
  getEmbeddingConfig: () => invoke("get_embedding_config"),
  updateEmbeddingConfig: (config: any) => invoke("update_embedding_config", { config }),
  testEmbeddingConnection: (provider?: string, model?: string) => invoke("test_embedding_connection", { provider, model }),
  getVectorStoreConfig: () => invoke("get_vector_store_config"),
  updateVectorStoreConfig: (config: any) => invoke("update_vector_store_config", { config }),
  startIngestion: (incremental = false) => invoke("start_ingestion", { incremental }),
  getIngestionStatus: () => invoke("get_ingestion_status"),
};
