/**
 * Shared interface for IPC — both Tauri and HTTP implementations
 * must conform to this contract.
 */
export interface IpcInterface {
  healthCheck: () => Promise<any>;
  detectEnvironment: () => Promise<any>;
  listTargetFiles: (source: any) => Promise<any>;
  getEmbeddingConfig: () => Promise<any>;
  updateEmbeddingConfig: (config: any) => Promise<any>;
  testEmbeddingConnection: (provider?: string, model?: string) => Promise<any>;
  getVectorStoreConfig: () => Promise<any>;
  updateVectorStoreConfig: (config: any) => Promise<any>;
  startIngestion: (incremental?: boolean) => Promise<any>;
  getIngestionStatus: () => Promise<any>;

  // Sources
  getSources: () => Promise<any[]>;
  getSource: (id: string) => Promise<any>;
  addSource: (source: any) => Promise<any>;
  updateSource: (id: string, source: any) => Promise<any>;
  deleteSource: (id: string) => Promise<any>;
  testSourceConnection: (id: string) => Promise<any>;
  syncSource: (id: string, incremental?: boolean) => Promise<any>;
  getSourceTypes: () => Promise<any[]>;
  startSourceOAuth: (id: string, provider: string) => Promise<any>;
  revokeSourceOAuth: (id: string) => Promise<any>;

  // Settings
  getGeneralSettings: () => Promise<any>;
  updateGeneralSettings: (settings: any) => Promise<any>;
  getSemanticSearchConfig: () => Promise<any>;
  updateSemanticSearchConfig: (config: any) => Promise<any>;
  resetSemanticSearchConfig: () => Promise<any>;
  runSemanticSearch: (payload: any) => Promise<any>;
  getLexicalSearchConfig: () => Promise<any>;
  updateLexicalSearchConfig: (config: any) => Promise<any>;
  resetLexicalSearchConfig: () => Promise<any>;
  runLexicalSearch: (query: any) => Promise<any>;
  getBM25IndexStats: () => Promise<any>;
  rebuildBM25Index: () => Promise<any>;
  getHybridSearchConfig: () => Promise<any>;
  updateHybridSearchConfig: (config: any) => Promise<any>;
  resetHybridSearchConfig: () => Promise<any>;
  runUnifiedSearch: (query: any) => Promise<any>;
  getRerankConfig: () => Promise<any>;
  updateRerankConfig: (config: any) => Promise<any>;
  resetRerankConfig: () => Promise<any>;
  testRerankConnection: () => Promise<any>;
  testRerank: (query: any) => Promise<any>;
  getRerankModels: (provider: string) => Promise<any>;
  getLLMConfig: () => Promise<any>;
  updateLLMConfig: (config: any) => Promise<any>;
  resetLLMConfig: () => Promise<any>;
  testLLMConnection: () => Promise<any>;
  getLLMModels: (provider: string) => Promise<any>;
  getAgentsConfig: () => Promise<any>;
  updateAgentsConfig: (config: any) => Promise<any>;
  resetAgentsConfig: () => Promise<any>;
  runChat: (query: any) => Promise<any>;
  startChatStream: (query: any) => Promise<any>;
  stopChatStream: () => Promise<any>;
  startOrchestratedChat: (query: any) => Promise<any>;
  newConversation: (conversationId?: string, clear?: boolean) => Promise<any>;
  getConversationHistory: (conversationId?: string) => Promise<any>;
  generateConversationTitle: (conversationId: string) => Promise<any>;
  listConversations: () => Promise<any>;
  renameConversation: (id: string, title: string) => Promise<any>;
  archiveConversation: (id: string, archived: boolean) => Promise<any>;
  deleteConversation: (id: string) => Promise<any>;
  getMonitoringConfig: () => Promise<any>;
  updateMonitoringConfig: (config: any) => Promise<any>;
  resetMonitoringConfig: () => Promise<any>;
  getDashboardHealth: () => Promise<any>;
  getDashboardIngestion: () => Promise<any>;
  getDashboardMetrics: (hours?: number) => Promise<any>;
  getDashboardActivity: (days?: number) => Promise<any>;
  getDashboardIntents: (hours?: number) => Promise<any>;
  getDashboardFeedback: (days?: number) => Promise<any>;
  getDashboardLatency: (hours?: number) => Promise<any>;
  getDashboardAlerts: () => Promise<any>;
  getQueryLogs: (filters: any) => Promise<any>;
  getQueryLogDetail: (queryId: string) => Promise<any>;
  exportQueryLogs: (filters: any) => Promise<any>;
  purgeLogs: () => Promise<any>;
  submitFeedback: (queryId: string, feedback: "positive" | "negative") => Promise<any>;
  // Security
  getSecurityConfig: () => Promise<any>;
  updateSecurityConfig: (config: any) => Promise<any>;
  resetSecurityConfig: () => Promise<any>;
  getApiKeysStatus: () => Promise<any>;
  purgeAllData: () => Promise<any>;
  // Export/Import
  exportConfig: (path: string) => Promise<any>;
  validateImport: (path: string) => Promise<any>;
  importConfig: (path: string, mode: string) => Promise<any>;
  exportConversation: (format: string, path: string, conversationId?: string) => Promise<any>;
  // UX
  generateTestQuestion: () => Promise<any>;
  getExpertiseLevel: () => Promise<any>;
  setExpertiseLevel: (level: string) => Promise<any>;
}
