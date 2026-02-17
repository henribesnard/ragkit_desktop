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
  getSemanticSearchConfig: () => invoke("get_semantic_search_config"),
  updateSemanticSearchConfig: (config: any) => invoke("update_semantic_search_config", { config }),
  resetSemanticSearchConfig: () => invoke("reset_semantic_search_config"),
  runSemanticSearch: (payload: any) => invoke("run_semantic_search_with_options", { payload }),
  getLexicalSearchConfig: () => invoke("get_lexical_search_config"),
  updateLexicalSearchConfig: (config: any) => invoke("update_lexical_search_config", { config }),
  resetLexicalSearchConfig: () => invoke("reset_lexical_search_config"),
  runLexicalSearch: (query: any) => invoke("lexical_search", { query }),
  getBM25IndexStats: () => invoke("get_bm25_index_stats"),
  rebuildBM25Index: () => invoke("rebuild_bm25_index"),
  getHybridSearchConfig: () => invoke("get_hybrid_search_config"),
  updateHybridSearchConfig: (config: any) => invoke("update_hybrid_search_config", { config }),
  resetHybridSearchConfig: () => invoke("reset_hybrid_search_config"),
  runUnifiedSearch: (query: any) => invoke("unified_search", { query }),
};
