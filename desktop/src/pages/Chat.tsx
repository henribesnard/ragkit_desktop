import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Loader2 } from "lucide-react";
import { FeedbackButtons } from "@/components/chat/FeedbackButtons";
import { useParams } from "react-router-dom";
import { type ChatSearchMode } from "@/components/chat/SearchModeSelector";
import { type ChatSource } from "@/hooks/useChat";
import { useConversations } from "@/hooks/useConversations";
import { ipc } from "@/lib/ipc";
import { EmptyState } from "@/components/chat/EmptyState";
import { ScrollToBottom } from "@/components/chat/ScrollToBottom";
import { useChatStream } from "@/hooks/useChatStream";
import { useConversation } from "@/hooks/useConversation";
import { useFeedback } from "@/hooks/useFeedback";
import { usePersistentIngestion } from "@/hooks/usePersistentIngestion";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { stripSourceTags } from "@/lib/sanitize";
import { StreamingStatusIndicator } from "@/components/chat/StreamingStatusIndicator";
import { UserBubble, AssistantBubble } from "@/components/chat/MessageBubble";
import { MetaRow } from "@/components/chat/MetaRow";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { SourcesPanel } from "@/components/chat/SourcesPanel";
import { LokoGlyph } from "@/components/brand/LokoGlyph";

interface ChatReadyResponse {
  ready: boolean;
  vectors_count: number;
  lexical_chunks?: number;
}

interface SearchConfigState {
  enabled: boolean;
  lexical_stemming?: boolean;
}

interface GeneralSettingsPayload {
  search_type?: ChatSearchMode;
}

export function Chat() {
  const { id: urlId } = useParams<{ id: string }>();
  const { updateConversationActivity, openConversation, conversations, renameConversation } = useConversations();
  const { t } = useTranslation();
  const {
    content: streamedAnswer,
    isStreaming,
    finalResponse,
    status,
    error: streamError,
    startStream,
    clear: clearStreamState,
  } = useChatStream();
  const expectedMessageCount = urlId
    ? (conversations.find((conversation) => conversation.id === urlId)?.messageCount ?? 0)
    : 0;
  const { history, loading: historyLoading, refresh: refreshHistory } = useConversation(urlId || null, expectedMessageCount);
  const {
    submit: submitFeedback,
    error: feedbackError,
    pendingByQueryId,
    valueByQueryId,
    setValueByQueryId,
  } = useFeedback();

  const [query, setQuery] = useState("");
  const [chatReady, setChatReady] = useState<ChatReadyResponse>({ ready: false, vectors_count: 0, lexical_chunks: 0 });
  const [searchMode, setSearchMode] = useState<ChatSearchMode>("hybrid");
  const { isRunning: isIngesting } = usePersistentIngestion();
  const { isHealthy: isBackendHealthy } = useBackendHealth();

  const [semanticEnabled, setSemanticEnabled] = useState(true);
  const [lexicalEnabled, setLexicalEnabled] = useState(true);
  const [debugMode] = useState(false);
  const [alphaOverride, setAlphaOverride] = useState(0.5);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [activeQueryData, setActiveQueryData] = useState<{ query: string; cid: string } | null>(null);
  const activeQuery = activeQueryData && activeQueryData.cid === urlId ? activeQueryData.query : null;

  // Sources panel state
  const [displayedSources, setDisplayedSources] = useState<ChatSource[]>([]);
  const [activeCiteIndex, setActiveCiteIndex] = useState<number | null>(null);
  const [llmModel, setLlmModel] = useState<string>("");
  const [queryStartTime, setQueryStartTime] = useState<number | null>(null);
  const [lastElapsedMs, setLastElapsedMs] = useState<number | undefined>(undefined);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const selectedModeEnabled =
    searchMode === "semantic" ? semanticEnabled : searchMode === "lexical" ? lexicalEnabled : semanticEnabled && lexicalEnabled;

  const applySearchConfig = (
    semanticCfg: SearchConfigState,
    lexicalCfg: SearchConfigState,
    generalCfg: GeneralSettingsPayload,
  ) => {
    const sEnabled = Boolean(semanticCfg.enabled ?? true);
    const lEnabled = Boolean(lexicalCfg.enabled ?? true);
    setSemanticEnabled(sEnabled);
    setLexicalEnabled(lEnabled);
    const preferred = generalCfg.search_type || "hybrid";
    const available =
      (preferred === "semantic" && sEnabled) ||
      (preferred === "lexical" && lEnabled) ||
      (preferred === "hybrid" && sEnabled && lEnabled);
    if (available) { setSearchMode(preferred); return; }
    if (sEnabled) { setSearchMode("semantic"); return; }
    if (lEnabled) { setSearchMode("lexical"); return; }
    setSearchMode("hybrid");
  };

  const refreshChatState = async () => {
    try {
      const ready = await invoke<ChatReadyResponse>("get_chat_ready");
      setChatReady(ready);
    } catch { /* ignore */ }

    try {
      const [semanticCfg, lexicalCfg, generalCfg, hybridCfg, llmCfg] = await Promise.all([
        invoke<SearchConfigState>("get_semantic_search_config").catch(() => null),
        invoke<{ enabled: boolean; stemming: boolean }>("get_lexical_search_config").catch(() => null),
        invoke<GeneralSettingsPayload>("get_general_settings").catch(() => null),
        invoke<{ alpha?: number }>("get_hybrid_search_config").catch(() => null),
        invoke<{ model?: string; provider?: string }>("get_llm_config").catch(() => null),
      ]);
      if (semanticCfg && lexicalCfg && generalCfg) {
        applySearchConfig(
          semanticCfg,
          { enabled: lexicalCfg.enabled, lexical_stemming: lexicalCfg.stemming },
          generalCfg,
        );
      }
      if (hybridCfg) setAlphaOverride(Number(hybridCfg.alpha ?? 0.5));
      if (llmCfg?.model) {
        const short = llmCfg.model.replace(/:latest$/, "");
        setLlmModel(llmCfg.provider === "ollama" ? `${short} · local` : short);
      }
    } catch { /* ignore */ }
  };

  const refreshChatStateRef = useRef(refreshChatState);
  useEffect(() => { refreshChatStateRef.current = refreshChatState; });

  const prevIngesting = useRef(isIngesting);
  useEffect(() => {
    if (prevIngesting.current && !isIngesting) {
      void refreshChatStateRef.current();
    }
    prevIngesting.current = isIngesting;
  }, [isIngesting]);

  useEffect(() => { void refreshChatStateRef.current(); }, []);

  const refreshHistoryRef = useRef(refreshHistory);
  useEffect(() => { refreshHistoryRef.current = refreshHistory; });

  // Handle streaming completion
  useEffect(() => {
    if (!finalResponse) return;

    // Compute latency
    if (queryStartTime) {
      setLastElapsedMs(Date.now() - queryStartTime);
      setQueryStartTime(null);
    }

    // Update displayed sources from final response
    if (finalResponse.sources?.length) {
      setDisplayedSources(finalResponse.sources);
      setActiveCiteIndex(null);
    }

    let cancelled = false;
    void (async () => {
      const updated = await refreshHistoryRef.current();
      if (cancelled) return;

      if (urlId && updated.messages.length > 0) {
        updateConversationActivity(urlId, updated.messages.length);
      }

      if (urlId && updated.messages.length >= 2) {
        ipc.generateConversationTitle(urlId)
          .then(({ title }) => {
            if (title) {
              updateConversationActivity(urlId, updated.messages.length, title);
              void renameConversation(urlId, title);
            }
          })
          .catch((err) => {
            console.warn("[Chat] Title generation failed:", err);
          });
      }

      if (updated.messages.length > 0 && !cancelled) {
        clearStreamState();
        setActiveQueryData(null);
      }
    })();

    return () => { cancelled = true; };
  }, [finalResponse, clearStreamState, renameConversation, urlId, updateConversationActivity, queryStartTime]);

  useEffect(() => {
    const values: Record<string, "positive" | "negative"> = {};
    for (const message of history.messages) {
      if (message.query_log_id && message.feedback) {
        values[message.query_log_id] = message.feedback;
      }
    }
    if (Object.keys(values).length) {
      setValueByQueryId((prev) => ({ ...prev, ...values }));
    }
  }, [history.messages, setValueByQueryId]);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!showScrollBtn) scrollToBottom();
  }, [history.messages.length, streamedAnswer, scrollToBottom, showScrollBtn]);

  useEffect(() => {
    if (urlId) {
      void openConversation(urlId);
    }
  }, [urlId, openConversation]);

  // Clean up stream state when switching conversations
  useEffect(() => {
    clearStreamState();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveQueryData(null);
    setDisplayedSources([]);
    setActiveCiteIndex(null);
    setLastElapsedMs(undefined);
  }, [urlId, clearStreamState, setActiveQueryData]);

  // Keep sidebar counters aligned
  const conversationsRef = useRef(conversations);
  useEffect(() => { conversationsRef.current = conversations; });
  const updateActivityRef = useRef(updateConversationActivity);
  useEffect(() => { updateActivityRef.current = updateConversationActivity; });

  useEffect(() => {
    if (!urlId || historyLoading) return;
    const actualCount = history.messages.length;
    if (actualCount <= 0) return;
    const conv = conversationsRef.current.find((c) => c.id === urlId);
    if (!conv || conv.messageCount !== actualCount) {
      updateActivityRef.current(urlId, actualCount);
    }
  }, [history.messages.length, historyLoading, urlId]);

  // Recovery
  const lastRecoveredIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (historyLoading || !urlId || isStreaming || isIngesting) {
      lastRecoveredIdRef.current = null;
      return;
    }
    if (history.messages.length > 0) return;
    const conv = conversations.find((c) => c.id === urlId);
    if (!conv || conv.messageCount === 0) return;
    if (lastRecoveredIdRef.current === urlId) return;
    lastRecoveredIdRef.current = urlId;
    console.warn("[Chat] History empty but conversation has", conv.messageCount, "messages — recovering");
    void refreshHistory();
  }, [historyLoading, urlId, history.messages.length, conversations, isStreaming, isIngesting, refreshHistory]);

  // Update displayed sources when clicking a history message
  const handleMessageSourceClick = (sources: ChatSource[]) => {
    setDisplayedSources(sources);
    setActiveCiteIndex(null);
  };

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 100);
  }, []);

  const onSubmitFeedback = async (queryId: string, feedback: "positive" | "negative") => {
    await submitFeedback(queryId, feedback);
    await refreshHistory();
  };

  const isSubmittingRef = useRef(false);
  useEffect(() => {
    if (!isStreaming) {
      isSubmittingRef.current = false;
    }
  }, [isStreaming]);

  const onSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim() || isStreaming || isSubmittingRef.current || !chatReady.ready || !selectedModeEnabled || isIngesting) return;
    isSubmittingRef.current = true;
    const payload = {
      query: query.trim(),
      conversation_id: urlId || undefined,
      search_type: searchMode,
      alpha: searchMode === "hybrid" ? alphaOverride : undefined,
      filters: { doc_ids: [], doc_types: [], languages: [], categories: [] },
      include_debug: debugMode,
    };
    const q = query.trim();
    setQuery("");
    setActiveQueryData({ query: q, cid: urlId || "" });
    setQueryStartTime(Date.now());

    if (urlId && history.messages.length === 0) {
      const fallbackTitle = q.length > 40 ? q.slice(0, 37) + "..." : q;
      updateConversationActivity(urlId, 1, fallbackTitle);
      void renameConversation(urlId, fallbackTitle);
    }

    await startStream(payload);
  };

  const getPlaceholder = () => {
    if (isIngesting) return t("chat.inputPlaceholderIngestion");
    if (!chatReady.ready) return t("chat.inputPlaceholderNotReady");
    return t("chat.inputPlaceholder");
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  const hasMessages = history.messages.length > 0 || isStreaming || streamedAnswer || activeQuery;

  return (
    <div className="h-full flex" style={{ background: "var(--bg)" }}>
      {/* Conversation column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages scroll area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto loko-scroll"
          style={{ padding: "28px 32px" }}
          onScroll={handleScroll}
        >
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {/* Errors */}
            {(streamError || feedbackError) && (
              <div
                className="mb-4"
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "var(--danger-bg)",
                  color: "var(--danger)",
                  border: "1px solid var(--border)",
                  fontSize: 13,
                }}
              >
                {streamError || feedbackError}
              </div>
            )}

            {historyLoading && !isIngesting && isBackendHealthy ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--brand)" }} />
              </div>
            ) : !hasMessages ? (
              <EmptyState isReady={chatReady.ready} isIngesting={isIngesting} isBackendDown={!isBackendHealthy && !isIngesting} />
            ) : (
              <>
                {/* History messages */}
                {history.messages.map((message, index) => (
                  <div key={`${message.timestamp}-${index}`} className="animate-message-in">
                    {message.role === "user" ? (
                      <UserBubble content={message.content} />
                    ) : (
                      <AssistantBubble
                        content={stripSourceTags(message.content)}
                        sources={message.sources}
                        onCiteClick={(i) => {
                          if (message.sources) {
                            handleMessageSourceClick(message.sources);
                            setActiveCiteIndex(i);
                          }
                        }}
                        metaRow={
                          <MetaRow
                            sourcesCount={message.sources?.length ?? 0}
                            modelName={llmModel}
                            onCopy={() => copyToClipboard(stripSourceTags(message.content))}
                            feedbackNode={
                              message.query_log_id ? (
                                <FeedbackButtons
                                  queryId={message.query_log_id}
                                  value={valueByQueryId[message.query_log_id] || message.feedback || null}
                                  loading={Boolean(pendingByQueryId[message.query_log_id])}
                                  onSubmit={onSubmitFeedback}
                                />
                              ) : undefined
                            }
                          />
                        }
                      />
                    )}
                  </div>
                ))}

                {/* Optimistic user message */}
                {activeQuery && (
                  <div className="animate-message-in">
                    <UserBubble content={activeQuery} />
                  </div>
                )}

                {/* Streaming assistant response */}
                {(streamedAnswer || isStreaming) && (
                  <div className="animate-message-in" style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                    <div style={{
                      width: 30, height: 30, flex: "0 0 auto",
                      filter: "drop-shadow(0 2px 4px rgba(15,125,99,.25))",
                    }}>
                      <LokoGlyph size={30} radius={8} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {!streamedAnswer && status ? (
                        <StreamingStatusIndicator status={status} />
                      ) : (
                        <div style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--text)" }}>
                          <div style={{ whiteSpace: "pre-wrap" }}>{streamedAnswer}</div>
                          {isStreaming && (
                            <span
                              className="inline-block"
                              style={{
                                width: 2, height: 17, background: "var(--brand)",
                                marginLeft: 1, verticalAlign: "middle", borderRadius: 1,
                                animation: "typing-dot 1s infinite",
                              }}
                            />
                          )}
                        </div>
                      )}

                      {/* Final response sources inline */}
                      {finalResponse?.sources?.length ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                          <span style={{ fontSize: 12, color: "var(--text-3)", alignSelf: "center", marginRight: 2 }}>
                            Sources :
                          </span>
                          {finalResponse.sources.map((src, i) => (
                            <span
                              key={`${src.chunk_id}-${i}`}
                              className="cite"
                              onClick={() => setActiveCiteIndex(i)}
                            >
                              <span className="num">{i + 1}</span>
                              {src.title}
                              {src.page ? ` · p.${src.page}` : ""}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {/* Debug info */}
                      {debugMode && finalResponse?.debug && (
                        <details className="mt-3">
                          <summary
                            className="text-xs cursor-pointer font-semibold"
                            style={{ color: "var(--text-3)" }}
                          >
                            Debug
                          </summary>
                          <div
                            className="mt-2 p-3 rounded text-xs space-y-1"
                            style={{
                              background: "var(--code-bg)",
                              border: "1px dashed var(--border)",
                              borderRadius: 8,
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {Object.entries(finalResponse.debug).map(([key, value]) => (
                              <div key={key} className="break-words">
                                <span className="font-semibold">{key}: </span>
                                <span>{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Meta row for final response */}
                      {finalResponse && (
                        <MetaRow
                          sourcesCount={finalResponse.sources?.length ?? 0}
                          elapsedMs={lastElapsedMs}
                          modelName={llmModel}
                          onCopy={() => copyToClipboard(stripSourceTags(finalResponse.answer || ""))}
                          feedbackNode={
                            finalResponse.query_log_id ? (
                              <FeedbackButtons
                                queryId={finalResponse.query_log_id}
                                value={valueByQueryId[finalResponse.query_log_id] || null}
                                loading={Boolean(pendingByQueryId[finalResponse.query_log_id])}
                                onSubmit={onSubmitFeedback}
                              />
                            ) : undefined
                          }
                        />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Scroll to bottom */}
        <ScrollToBottom visible={showScrollBtn} onClick={scrollToBottom} />

        {/* Composer */}
        <ChatComposer
          query={query}
          onQueryChange={setQuery}
          onSubmit={onSearch}
          searchMode={searchMode}
          isStreaming={isStreaming}
          isIngesting={isIngesting}
          disabled={!chatReady.ready || !selectedModeEnabled}
          placeholder={getPlaceholder()}
        />
      </div>

      {/* Sources panel */}
      {displayedSources.length > 0 && (
        <SourcesPanel
          sources={displayedSources}
          searchMode={searchMode}
          activeCiteIndex={activeCiteIndex}
          onCiteClick={setActiveCiteIndex}
        />
      )}
    </div>
  );
}
