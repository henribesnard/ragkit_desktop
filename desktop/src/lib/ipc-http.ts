/**
 * HTTP IPC implementation — used in web/server mode (no Tauri).
 * Each method calls the FastAPI backend directly via fetch().
 */
import type { IpcInterface } from "./ipc-types";

// API key stored in memory after login/setup
let _apiKey: string | null = null;

export function setApiKey(key: string): void {
  _apiKey = key;
  try {
    localStorage.setItem("ragkit_api_key", key);
  } catch {
    // localStorage may not be available
  }
}

export function getApiKey(): string | null {
  if (_apiKey) return _apiKey;
  try {
    _apiKey = localStorage.getItem("ragkit_api_key");
  } catch {
    // ignore
  }
  return _apiKey;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const key = getApiKey();
  if (key) {
    h["X-API-Key"] = key;
  }
  return h;
}

async function get<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

async function post<T = any>(url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function put<T = any>(url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function del<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { method: "DELETE", headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export const httpIpc: IpcInterface = {
  healthCheck: () => get("/health"),
  detectEnvironment: () => get("/api/wizard/environment-detection"),
  listTargetFiles: (source) => post("/api/wizard/list-target-files", source),
  getEmbeddingConfig: () => get("/api/embedding/config"),
  updateEmbeddingConfig: (config) => put("/api/embedding/config", config),
  testEmbeddingConnection: (provider, model) => post("/api/embedding/test-connection", { provider, model }),
  getVectorStoreConfig: () => get("/api/vector-store/config"),
  updateVectorStoreConfig: (config) => put("/api/vector-store/config", config),
  startIngestion: (incremental = false) => post("/api/ingestion/start", { incremental }),
  getIngestionStatus: () => get("/api/ingestion/status"),

  // Sources
  getSources: () => get("/api/sources"),
  getSource: (id) => get(`/api/sources/${id}`),
  addSource: (source) => post("/api/sources", source),
  updateSource: (id, source) => put(`/api/sources/${id}`, source),
  deleteSource: (id) => del(`/api/sources/${id}`),
  testSourceConnection: (id) => post(`/api/sources/${id}/test`),
  syncSource: (id, incremental = false) => post(`/api/sources/${id}/sync`, { incremental }),
  getSourceTypes: () => get("/api/sources/types"),
  startSourceOAuth: (id, provider) => post(`/api/sources/${id}/oauth/start`, { provider }),
  revokeSourceOAuth: (id) => post(`/api/sources/${id}/oauth/revoke`),

  // Settings
  getGeneralSettings: () => get("/api/ingestion/settings/general"),
  updateGeneralSettings: (settings) => put("/api/ingestion/settings/general", settings),
  getSemanticSearchConfig: () => get("/api/retrieval/semantic/config"),
  updateSemanticSearchConfig: (config) => put("/api/retrieval/semantic/config", config),
  resetSemanticSearchConfig: () => post("/api/retrieval/semantic/config/reset"),
  runSemanticSearch: (payload) => post("/api/retrieval/semantic/search", payload),
  getLexicalSearchConfig: () => get("/api/retrieval/lexical/config"),
  updateLexicalSearchConfig: (config) => put("/api/retrieval/lexical/config", config),
  resetLexicalSearchConfig: () => post("/api/retrieval/lexical/config/reset"),
  runLexicalSearch: (query) => post("/api/search/lexical", query),
  getBM25IndexStats: () => get("/api/retrieval/lexical/index/stats"),
  rebuildBM25Index: () => post("/api/retrieval/lexical/index/rebuild"),
  getHybridSearchConfig: () => get("/api/retrieval/hybrid/config"),
  updateHybridSearchConfig: (config) => put("/api/retrieval/hybrid/config", config),
  resetHybridSearchConfig: () => post("/api/retrieval/hybrid/config/reset"),
  runUnifiedSearch: (query) => post("/api/search", query),
  getRerankConfig: () => get("/api/rerank/config"),
  updateRerankConfig: (config) => put("/api/rerank/config", config),
  resetRerankConfig: () => post("/api/rerank/config/reset"),
  testRerankConnection: () => post("/api/rerank/test-connection"),
  testRerank: (query) => post("/api/rerank/test", query),
  getRerankModels: (provider) => get(`/api/rerank/models?provider=${encodeURIComponent(provider)}`),
  getLLMConfig: () => get("/api/llm/config"),
  updateLLMConfig: (config) => put("/api/llm/config", config),
  resetLLMConfig: () => post("/api/llm/config/reset"),
  testLLMConnection: () => post("/api/llm/test-connection"),
  getLLMModels: (provider) => get(`/api/llm/models?provider=${encodeURIComponent(provider)}`),
  getAgentsConfig: () => get("/api/agents/config"),
  updateAgentsConfig: (config) => put("/api/agents/config", config),
  resetAgentsConfig: () => post("/api/agents/config/reset"),
  runChat: (query) => post("/api/chat", query),
  startChatStream: (query) => post("/api/chat/stream", query),
  stopChatStream: async () => {
    // In web mode, stream cancellation is handled client-side via AbortController
    return {};
  },
  startOrchestratedChat: (query) => post("/api/chat/stream", query),
  newConversation: (conversationId, clear) =>
    post("/api/chat/new", { conversation_id: conversationId, clear }),
  getConversationHistory: (conversationId) =>
    get(`/api/chat/history${conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : ""}`),
  generateConversationTitle: (conversationId) =>
    post("/api/chat/generate_title", { conversation_id: conversationId }),
  listConversations: () => get("/api/chat/conversations"),
  renameConversation: (id, title) => put(`/api/chat/conversations/${id}/title`, { title }),
  archiveConversation: (id, archived) => put(`/api/chat/conversations/${id}/archive`, { archived }),
  deleteConversation: (id) => del(`/api/chat/conversations/${id}`),
  getMonitoringConfig: () => get("/api/monitoring/config"),
  updateMonitoringConfig: (config) => put("/api/monitoring/config", config),
  resetMonitoringConfig: () => post("/api/monitoring/config/reset"),
  getDashboardHealth: () => get("/api/dashboard/health"),
  getDashboardIngestion: () => get("/api/dashboard/ingestion"),
  getDashboardMetrics: (hours) => get(`/api/dashboard/metrics${hours ? `?hours=${hours}` : ""}`),
  getDashboardActivity: (days) => get(`/api/dashboard/activity${days ? `?days=${days}` : ""}`),
  getDashboardIntents: (hours) => get(`/api/dashboard/intents${hours ? `?hours=${hours}` : ""}`),
  getDashboardFeedback: (days) => get(`/api/dashboard/feedback${days ? `?days=${days}` : ""}`),
  getDashboardLatency: (hours) => get(`/api/dashboard/latency${hours ? `?hours=${hours}` : ""}`),
  getDashboardAlerts: () => get("/api/dashboard/alerts"),
  getQueryLogs: (filters) => get(`/api/logs/queries?${new URLSearchParams(filters).toString()}`),
  getQueryLogDetail: (queryId) => get(`/api/logs/queries/${queryId}`),
  exportQueryLogs: (filters) => get(`/api/logs/export?${new URLSearchParams(filters).toString()}`),
  purgeLogs: () => post("/api/logs/purge"),
  submitFeedback: (queryId, feedback) => post("/api/feedback", { query_id: queryId, feedback }),
  // Security
  getSecurityConfig: () => get("/api/security/config"),
  updateSecurityConfig: (config) => put("/api/security/config", config),
  resetSecurityConfig: () => post("/api/security/config/reset"),
  getApiKeysStatus: () => get("/api/security/keys"),
  purgeAllData: () => post("/api/security/purge-all"),
  // Export/Import — in web mode, use download/upload instead of file paths
  exportConfig: async (path) => {
    const res = await fetch("/api/import-export/export", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ path }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Trigger browser download
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "loko-config.json";
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  },
  validateImport: (path) => post("/api/import-export/validate", { path }),
  importConfig: (path, mode) => post("/api/import-export/import", { path, mode }),
  exportConversation: async (format, path, conversationId) => {
    const res = await fetch("/api/conversation/export", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ format, path, conversation_id: conversationId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  },
  // UX
  generateTestQuestion: () => post("/api/test-question"),
  getExpertiseLevel: () => get("/api/general/expertise"),
  setExpertiseLevel: (level) => put("/api/general/expertise", { level }),
};
