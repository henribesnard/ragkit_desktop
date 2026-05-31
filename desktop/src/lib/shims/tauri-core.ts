/**
 * Web shim for @tauri-apps/api/core
 *
 * Provides an invoke() function that routes Tauri command names
 * to their corresponding HTTP endpoints on the FastAPI backend.
 */

const COMMAND_MAP: Record<string, { method: string; path: string | ((...args: any[]) => string) }> = {
  // Health
  health_check: { method: "GET", path: "/health" },

  // Wizard
  detect_environment: { method: "GET", path: "/api/wizard/environment-detection" },
  get_wizard_progress: { method: "GET", path: "/api/wizard/progress" },
  save_wizard_progress: { method: "POST", path: "/api/wizard/progress" },
  validate_folder: { method: "POST", path: "/api/wizard/validate-folder" },
  scan_folder: { method: "POST", path: "/api/wizard/scan-folder" },
  list_target_files: { method: "POST", path: "/api/wizard/list-target-files" },
  analyze_wizard_profile: { method: "POST", path: "/api/wizard/analyze-profile" },
  complete_wizard: { method: "POST", path: "/api/wizard/complete" },
  get_current_profile: { method: "GET", path: "/api/wizard/current-profile" },

  // Setup
  get_setup_status: { method: "GET", path: "/api/ingestion/setup-status" },

  // Ingestion config
  get_ingestion_config: { method: "GET", path: "/api/ingestion/config" },
  update_ingestion_config: { method: "PUT", path: "/api/ingestion/config" },
  reset_ingestion_config: { method: "POST", path: "/api/ingestion/config/reset" },
  get_documents: { method: "GET", path: "/api/ingestion/documents" },
  update_document_metadata: { method: "PUT", path: "/api/ingestion/documents" },
  analyze_documents: { method: "POST", path: "/api/ingestion/analyze" },
  get_analysis_progress: { method: "GET", path: "/api/ingestion/analyze/progress" },

  // Ingestion control
  start_ingestion: { method: "POST", path: "/api/ingestion/start" },
  pause_ingestion: { method: "POST", path: "/api/ingestion/pause" },
  resume_ingestion: { method: "POST", path: "/api/ingestion/resume" },
  cancel_ingestion: { method: "POST", path: "/api/ingestion/cancel" },
  get_ingestion_status: { method: "GET", path: "/api/ingestion/status" },
  detect_changes: { method: "GET", path: "/api/ingestion/changes" },
  get_ingestion_history: { method: "GET", path: "/api/ingestion/history" },
  get_ingestion_log: { method: "GET", path: "/api/ingestion/log" },

  // General settings
  get_general_settings: { method: "GET", path: "/api/ingestion/settings/general" },
  update_general_settings: { method: "PUT", path: "/api/ingestion/settings/general" },

  // Chunking
  get_chunking_config: { method: "GET", path: "/api/chunking/config" },
  update_chunking_config: { method: "PUT", path: "/api/chunking/config" },
  reset_chunking_config: { method: "POST", path: "/api/chunking/config/reset" },
  validate_chunking_config: { method: "POST", path: "/api/chunking/config/validate" },
  preview_chunking: { method: "POST", path: "/api/chunking/preview" },
  preview_chunking_custom: { method: "POST", path: "/api/chunking/preview/custom" },

  // Embedding
  get_embedding_config: { method: "GET", path: "/api/embedding/config" },
  update_embedding_config: { method: "PUT", path: "/api/embedding/config" },
  reset_embedding_config: { method: "POST", path: "/api/embedding/config/reset" },
  store_secret: { method: "POST", path: "/api/embedding/secrets/store" },
  secret_exists: { method: "POST", path: "/api/embedding/secrets/exists" },
  delete_secret: { method: "POST", path: "/api/embedding/secrets/delete" },
  test_embedding_connection: { method: "POST", path: "/api/embedding/test-connection" },
  test_embedding: { method: "POST", path: "/api/embedding/test-embedding" },
  get_embedding_environment: { method: "GET", path: "/api/embedding/environment" },
  get_available_models: { method: "GET", path: "/api/embedding/models" },
  get_embedding_cache_stats: { method: "GET", path: "/api/embedding/cache/stats" },
  clear_embedding_cache: { method: "POST", path: "/api/embedding/cache/clear" },

  // Vector store
  get_vector_store_config: { method: "GET", path: "/api/vector-store/config" },
  update_vector_store_config: { method: "PUT", path: "/api/vector-store/config" },
  reset_vector_store_config: { method: "POST", path: "/api/vector-store/config/reset" },
  test_vector_store_connection: { method: "POST", path: "/api/vector-store/test-connection" },
  get_vector_store_collection_stats: { method: "GET", path: "/api/vector-store/collection/stats" },
  delete_vector_store_collection: { method: "DELETE", path: "/api/vector-store/collection/delete" },

  // Semantic search
  get_semantic_search_config: { method: "GET", path: "/api/retrieval/semantic/config" },
  update_semantic_search_config: { method: "PUT", path: "/api/retrieval/semantic/config" },
  reset_semantic_search_config: { method: "POST", path: "/api/retrieval/semantic/config/reset" },
  run_semantic_search: { method: "POST", path: "/api/retrieval/semantic/search" },
  run_semantic_search_with_options: { method: "POST", path: "/api/retrieval/semantic/search" },
  get_search_filter_values: { method: "GET", path: "/api/search/filters/values" },
  get_chat_ready: { method: "GET", path: "/api/chat/ready" },

  // Lexical search
  get_lexical_search_config: { method: "GET", path: "/api/retrieval/lexical/config" },
  update_lexical_search_config: { method: "PUT", path: "/api/retrieval/lexical/config" },
  reset_lexical_search_config: { method: "POST", path: "/api/retrieval/lexical/config/reset" },
  lexical_search: { method: "POST", path: "/api/search/lexical" },
  get_bm25_index_stats: { method: "GET", path: "/api/retrieval/lexical/index/stats" },
  rebuild_bm25_index: { method: "POST", path: "/api/retrieval/lexical/index/rebuild" },

  // Hybrid search
  get_hybrid_search_config: { method: "GET", path: "/api/retrieval/hybrid/config" },
  update_hybrid_search_config: { method: "PUT", path: "/api/retrieval/hybrid/config" },
  reset_hybrid_search_config: { method: "POST", path: "/api/retrieval/hybrid/config/reset" },
  unified_search: { method: "POST", path: "/api/search" },

  // Rerank
  get_rerank_config: { method: "GET", path: "/api/rerank/config" },
  update_rerank_config: { method: "PUT", path: "/api/rerank/config" },
  reset_rerank_config: { method: "POST", path: "/api/rerank/config/reset" },
  test_rerank_connection: { method: "POST", path: "/api/rerank/test-connection" },
  test_rerank: { method: "POST", path: "/api/rerank/test" },
  get_rerank_models: { method: "GET", path: "/api/rerank/models" },

  // LLM
  get_llm_config: { method: "GET", path: "/api/llm/config" },
  update_llm_config: { method: "PUT", path: "/api/llm/config" },
  reset_llm_config: { method: "POST", path: "/api/llm/config/reset" },
  test_llm_connection: { method: "POST", path: "/api/llm/test-connection" },
  get_llm_models: { method: "GET", path: "/api/llm/models" },

  // Agents
  get_agents_config: { method: "GET", path: "/api/agents/config" },
  update_agents_config: { method: "PUT", path: "/api/agents/config" },
  reset_agents_config: { method: "POST", path: "/api/agents/config/reset" },

  // Chat
  chat: { method: "POST", path: "/api/chat" },
  chat_stream: { method: "POST", path: "/api/chat/stream" },
  chat_stream_stop: { method: "POST", path: "/api/chat/stream/stop" },
  chat_orchestrated: { method: "POST", path: "/api/chat/stream" },
  new_conversation: { method: "POST", path: "/api/chat/new" },
  get_conversation_history: { method: "GET", path: "/api/chat/history" },
  generate_title: { method: "POST", path: "/api/chat/generate_title" },
  list_conversations: { method: "GET", path: "/api/chat/conversations" },
  rename_conversation: { method: "PUT", path: "/api/chat/conversations" },
  archive_conversation: { method: "PUT", path: "/api/chat/conversations" },
  delete_conversation: { method: "DELETE", path: "/api/chat/conversations" },

  // Monitoring
  get_monitoring_config: { method: "GET", path: "/api/monitoring/config" },
  update_monitoring_config: { method: "PUT", path: "/api/monitoring/config" },
  reset_monitoring_config: { method: "POST", path: "/api/monitoring/config/reset" },

  // Dashboard
  get_dashboard_health: { method: "GET", path: "/api/dashboard/health" },
  get_dashboard_ingestion: { method: "GET", path: "/api/dashboard/ingestion" },
  get_dashboard_metrics: { method: "GET", path: "/api/dashboard/metrics" },
  get_dashboard_activity: { method: "GET", path: "/api/dashboard/activity" },
  get_dashboard_intents: { method: "GET", path: "/api/dashboard/intents" },
  get_dashboard_feedback: { method: "GET", path: "/api/dashboard/feedback" },
  get_dashboard_latency: { method: "GET", path: "/api/dashboard/latency" },
  get_dashboard_alerts: { method: "GET", path: "/api/dashboard/alerts" },

  // Logs
  get_query_logs: { method: "GET", path: "/api/logs/queries" },
  get_query_log_detail: { method: "GET", path: "/api/logs/queries" },
  export_query_logs: { method: "GET", path: "/api/logs/export" },
  purge_logs: { method: "POST", path: "/api/logs/purge" },

  // Feedback
  submit_feedback: { method: "POST", path: "/api/feedback" },

  // Security
  get_security_config: { method: "GET", path: "/api/security/config" },
  update_security_config: { method: "PUT", path: "/api/security/config" },
  reset_security_config: { method: "POST", path: "/api/security/config/reset" },
  get_api_keys_status: { method: "GET", path: "/api/security/keys" },
  purge_all_data: { method: "POST", path: "/api/security/purge-all" },

  // Export/Import
  export_config: { method: "POST", path: "/api/import-export/export" },
  validate_import: { method: "POST", path: "/api/import-export/validate" },
  import_config: { method: "POST", path: "/api/import-export/import" },
  export_conversation: { method: "POST", path: "/api/conversation/export" },

  // UX
  generate_test_question: { method: "POST", path: "/api/test-question" },
  get_expertise_level: { method: "GET", path: "/api/general/expertise" },
  set_expertise_level: { method: "PUT", path: "/api/general/expertise" },

  // Sources
  get_sources: { method: "GET", path: "/api/sources" },
  get_source: { method: "GET", path: "/api/sources" },
  add_source: { method: "POST", path: "/api/sources" },
  update_source: { method: "PUT", path: "/api/sources" },
  delete_source: { method: "DELETE", path: "/api/sources" },
  test_source_connection: { method: "POST", path: "/api/sources" },
  sync_source: { method: "POST", path: "/api/sources" },
  get_source_types: { method: "GET", path: "/api/sources/types" },
  start_source_oauth: { method: "POST", path: "/api/sources" },
  revoke_source_oauth: { method: "POST", path: "/api/sources" },

  // Tauri-only (no-op in web)
  get_install_language: { method: "NOOP", path: "" },
  stop_backend_for_update: { method: "NOOP", path: "" },
};

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const key = localStorage.getItem("ragkit_api_key");
    if (key) h["X-API-Key"] = key;
  } catch {
    // ignore
  }
  return h;
}

/**
 * Build the URL for commands that include IDs in the path.
 * Tauri passes args as a flat object; we extract IDs to build REST paths.
 */
function buildUrl(command: string, args: Record<string, any>): string {
  const entry = COMMAND_MAP[command];
  if (!entry) return `/api/${command.replace(/_/g, "-")}`;

  let url = typeof entry.path === "function" ? entry.path(args) : entry.path;

  // Handle commands that need ID in the URL
  if (args) {
    const id = args.id || args.conversationId || args.conversation_id;
    if (id && typeof id === "string") {
      // Commands like get_source, update_source need /{id}
      if (["get_source", "update_source", "delete_source"].includes(command)) {
        url = `/api/sources/${id}`;
      } else if (command === "test_source_connection") {
        url = `/api/sources/${id}/test`;
      } else if (command === "sync_source") {
        url = `/api/sources/${id}/sync`;
      } else if (command === "start_source_oauth") {
        url = `/api/sources/${id}/oauth/start`;
      } else if (command === "revoke_source_oauth") {
        url = `/api/sources/${id}/oauth/revoke`;
      } else if (command === "rename_conversation") {
        url = `/api/chat/conversations/${id}/title`;
      } else if (command === "archive_conversation") {
        url = `/api/chat/conversations/${id}/archive`;
      } else if (command === "delete_conversation") {
        url = `/api/chat/conversations/${id}`;
      } else if (command === "get_query_log_detail") {
        url = `/api/logs/queries/${args.queryId}`;
      }
    }

    // Handle query parameters for GET requests
    if (entry.method === "GET") {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined && v !== null) {
          params.set(k, String(v));
        }
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }
  }

  return url;
}

/**
 * Web-compatible invoke() that translates Tauri command calls to HTTP requests.
 */
export async function invoke<T = any>(command: string, args?: Record<string, any>): Promise<T> {
  const entry = COMMAND_MAP[command];

  // No-op commands
  if (entry?.method === "NOOP") {
    return null as T;
  }

  const method = entry?.method || "POST";
  const url = buildUrl(command, args || {});

  const fetchOpts: RequestInit = {
    method,
    headers: getHeaders(),
  };

  // For non-GET requests, send the body
  if (method !== "GET" && method !== "DELETE" && args) {
    // Flatten single-key payloads (Tauri wraps args in {key: value})
    const keys = Object.keys(args);
    const body = keys.length === 1 ? args[keys[0]] : args;
    fetchOpts.body = JSON.stringify(body);
  }

  const res = await fetch(url, fetchOpts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return (await res.text()) as unknown as T;
}
