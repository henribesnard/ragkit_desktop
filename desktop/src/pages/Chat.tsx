import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { ArrowUp, FileText, Loader2 } from "lucide-react";
import { FeedbackButtons } from "@/components/chat/FeedbackButtons";
import { useParams } from "react-router-dom";
import { type ChatSearchMode } from "@/components/chat/SearchModeSelector";
import { useConversations } from "@/hooks/useConversations";
import { ipc } from "@/lib/ipc";
import { EmptyState } from "@/components/chat/EmptyState";
import { ScrollToBottom } from "@/components/chat/ScrollToBottom";
import { useChatStream } from "@/hooks/useChatStream";
import { useConversation } from "@/hooks/useConversation";
import { useFeedback } from "@/hooks/useFeedback";
import { usePersistentIngestion } from "@/hooks/usePersistentIngestion";
import { stripSourceTags } from "@/lib/sanitize";
import { StreamingStatusIndicator } from "@/components/chat/StreamingStatusIndicator";

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
  const { updateConversationActivity, openConversation } = useConversations();
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
  const { history, refresh: refreshHistory } = useConversation(urlId || null);
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

  const [semanticEnabled, setSemanticEnabled] = useState(true);
  const [lexicalEnabled, setLexicalEnabled] = useState(true);
  const [debugMode] = useState(false);
  const [alphaOverride, setAlphaOverride] = useState(0.5);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      const [semanticCfg, lexicalCfg, generalCfg, hybridCfg] = await Promise.all([
        invoke<SearchConfigState>("get_semantic_search_config").catch(() => null),
        invoke<{ enabled: boolean; stemming: boolean }>("get_lexical_search_config").catch(() => null),
        invoke<GeneralSettingsPayload>("get_general_settings").catch(() => null),
        invoke<{ alpha?: number }>("get_hybrid_search_config").catch(() => null),
      ]);
      if (semanticCfg && lexicalCfg && generalCfg) {
        applySearchConfig(
          semanticCfg,
          { enabled: lexicalCfg.enabled, lexical_stemming: lexicalCfg.stemming },
          generalCfg,
        );
      }
      if (hybridCfg) setAlphaOverride(Number(hybridCfg.alpha ?? 0.5));
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

  // Ref for refreshHistory so the effect doesn't re-fire when conversationId changes
  const refreshHistoryRef = useRef(refreshHistory);
  useEffect(() => { refreshHistoryRef.current = refreshHistory; });

  // Handle streaming completion: fetch history, update activity, generate title, clear UI
  useEffect(() => {
    if (!finalResponse) return;

    let cancelled = false;
    void (async () => {
      const updated = await refreshHistoryRef.current();
      if (cancelled) return;

      // Always persist messageCount immediately so the conversation survives cleanup
      if (urlId && updated.messages.length > 0) {
        updateConversationActivity(urlId, updated.messages.length);
      }

      // Auto-generate title after first exchange (best-effort, non-blocking)
      if (urlId && updated.messages.length >= 2) {
        try {
          const { title } = await ipc.generateConversationTitle(urlId);
          if (title && !cancelled) {
            updateConversationActivity(urlId, updated.messages.length, title);
          }
        } catch (err) {
          console.warn("[Chat] Title generation failed:", err);
        }
      }

      // Clear streaming UI LAST — this sets finalResponse=null which triggers effect cleanup
      if (updated.messages.length > 0 && !cancelled) {
        clearStreamState();
        setActiveQuery(null);
      }
    })();

    return () => { cancelled = true; };
  }, [finalResponse, clearStreamState, urlId, updateConversationActivity]);

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

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 100);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [query]);

  const onSubmitFeedback = async (queryId: string, feedback: "positive" | "negative") => {
    await submitFeedback(queryId, feedback);
    await refreshHistory();
  };

  const onSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim() || isStreaming || !chatReady.ready || !selectedModeEnabled) return;
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
    setActiveQuery(q);

    // Immediately set a fallback title from the query text on first message
    // so the sidebar never stays on "Nouvelle conversation"
    if (urlId && history.messages.length === 0) {
      const fallbackTitle = q.length > 40 ? q.slice(0, 37) + "..." : q;
      updateConversationActivity(urlId, 1, fallbackTitle);
    }

    await startStream(payload);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void onSearch(e as unknown as FormEvent);
    }
  };

  const getPlaceholder = () => {
    if (!chatReady.ready) return t("chat.inputPlaceholderNotReady");
    return t("chat.inputPlaceholder");
  };

  const hasMessages = history.messages.length > 0 || isStreaming || streamedAnswer;

  return (
    <div className="h-full flex flex-col relative" style={{ background: "var(--bg-primary)" }}>
      {/* Ingestion Banner */}
      {isIngesting && (
        <div
          className="animate-fade-in flex items-center gap-2 mx-auto"
          style={{
            maxWidth: "var(--chat-max-width)",
            width: "100%",
            padding: "8px 16px",
            margin: "8px auto 0",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
          }}
        >
          <style>{`.dark .ingestion-banner { background: rgba(6, 78, 59, 0.2) !important; color: var(--primary-300) !important; }`}</style>
          <div
            className="ingestion-banner flex items-center gap-2 w-full"
            style={{
              background: "var(--primary-50)",
              color: "var(--primary-700)",
              padding: "8px 16px",
              borderRadius: "var(--radius-md)",
            }}
          >
            <Loader2 size={14} className="animate-spin" />
            {t("chat.ingestionInProgress")}...
          </div>
        </div>
      )}



      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto"
        style={{ padding: "32px 0 0" }}
        onScroll={handleScroll}
      >
        <div
          style={{
            maxWidth: "var(--chat-max-width)",
            margin: "0 auto",
            padding: "0 20px",
          }}
        >
          {/* Errors */}
          {(streamError || feedbackError) && (
            <div
              className="mb-4 rounded-lg px-4 py-3 text-sm"
              style={{
                background: "#FEE2E2",
                color: "#991B1B",
                border: "1px solid #FCA5A5",
              }}
            >
              {streamError || feedbackError}
            </div>
          )}

          {!hasMessages ? (
            <EmptyState isReady={chatReady.ready} isIngesting={isIngesting} />
          ) : (
            <div className="flex flex-col" style={{ gap: 24 }}>
              {/* History messages */}
              {history.messages.map((message: any, index: number) => (
                <div
                  key={`${message.timestamp}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-message-in`}
                >
                  {message.role === "user" ? (
                    /* User bubble */
                    <div
                      className="text-sm text-white"
                      style={{
                        maxWidth: "80%",
                        padding: "12px 16px",
                        borderRadius: "20px 20px 4px 20px",
                        background: "var(--primary-500)",
                      }}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </div>
                  ) : (
                    /* Assistant bubble */
                    <div
                      className="text-sm"
                      style={{
                        maxWidth: "85%",
                        padding: 16,
                        borderRadius: "4px 20px 20px 20px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <div className="whitespace-pre-wrap leading-relaxed">{stripSourceTags(message.content)}</div>

                      {/* Sources */}
                      {message.sources?.length ? (
                        <div className="mt-3 pt-2" style={{ borderTop: "1px solid var(--border-default)" }}>
                          <div
                            className="text-xs font-semibold uppercase mb-2"
                            style={{ color: "var(--text-tertiary)", letterSpacing: "0.05em", fontSize: 10 }}
                          >
                            {t("chat.sources")}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {message.sources.map((src: any, si: number) => (
                              <span
                                key={si}
                                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded cursor-pointer transition-colors"
                                style={{
                                  background: "var(--bg-tertiary)",
                                  color: "var(--text-secondary)",
                                  borderRadius: "var(--radius-sm)",
                                }}
                                title={src.text_preview}
                              >
                                <FileText size={12} />
                                {src.title || src.id}
                                {src.page ? ` p.${src.page}` : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Feedback */}
                      {message.query_log_id && (
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          <FeedbackButtons
                            queryId={message.query_log_id}
                            value={valueByQueryId[message.query_log_id] || message.feedback || null}
                            loading={Boolean(pendingByQueryId[message.query_log_id])}
                            onSubmit={onSubmitFeedback}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Optimistic User Message */}
              {activeQuery && (
                <div className="flex justify-end animate-message-in">
                  <div
                    className="text-sm text-white"
                    style={{
                      maxWidth: "80%",
                      padding: "12px 16px",
                      borderRadius: "20px 20px 4px 20px",
                      background: "var(--primary-500)",
                    }}
                  >
                    <div className="whitespace-pre-wrap">{activeQuery}</div>
                  </div>
                </div>
              )}

              {(streamedAnswer || isStreaming) && (
                <div className="flex justify-start animate-message-in">
                  <div
                    className="text-sm"
                    style={{
                      maxWidth: "85%",
                      padding: 16,
                      borderRadius: "4px 20px 20px 20px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {!streamedAnswer && status ? (
                      <StreamingStatusIndicator status={status} />
                    ) : (
                      <>
                        <div className="whitespace-pre-wrap leading-relaxed">{streamedAnswer}</div>
                        {isStreaming && (
                          <span
                            className="inline-block w-2 h-4 ml-0.5"
                            style={{
                              background: "var(--primary-500)",
                              animation: "typing-dot 1s infinite",
                            }}
                          />
                        )}
                      </>
                    )}


                    {/* Final response sources */}
                    {finalResponse?.sources?.length ? (
                      <div className="mt-3 pt-2" style={{ borderTop: "1px solid var(--border-default)" }}>
                        <div
                          className="text-xs font-semibold uppercase mb-2"
                          style={{ color: "var(--text-tertiary)", letterSpacing: "0.05em", fontSize: 10 }}
                        >
                          {t("chat.sources")}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {finalResponse.sources.map((src: any) => (
                            <span
                              key={`${src.id}-${src.chunk_id}`}
                              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded cursor-pointer transition-colors"
                              style={{
                                background: "var(--bg-tertiary)",
                                color: "var(--text-secondary)",
                                borderRadius: "var(--radius-sm)",
                              }}
                              title={src.text_preview}
                            >
                              <FileText size={12} />
                              {src.title} {src.page ? `p.${src.page}` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Debug info */}
                    {debugMode && finalResponse?.debug && (
                      <details className="mt-3">
                        <summary
                          className="text-xs cursor-pointer font-semibold"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          Debug
                        </summary>
                        <div
                          className="mt-2 p-3 rounded text-xs space-y-1"
                          style={{
                            background: "var(--bg-tertiary)",
                            border: "1px dashed var(--border-default)",
                            borderRadius: "var(--radius-md)",
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

                    {/* Feedback for final response */}
                    {finalResponse?.query_log_id && (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <FeedbackButtons
                          queryId={finalResponse.query_log_id}
                          value={valueByQueryId[finalResponse.query_log_id] || null}
                          loading={Boolean(pendingByQueryId[finalResponse.query_log_id])}
                          onSubmit={onSubmitFeedback}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Scroll to bottom */}
      <ScrollToBottom visible={showScrollBtn} onClick={scrollToBottom} />

      {/* Input Area */}
      <div
        style={{
          maxWidth: "var(--chat-max-width)",
          width: "100%",
          margin: "0 auto",
          padding: "16px 20px 24px",
        }}
      >
        <form
          onSubmit={onSearch}
          className="relative"
          style={{
            background: "var(--bg-tertiary)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-sm)",
            padding: "14px 16px",
            paddingRight: 96,
          }}
        >
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            disabled={isStreaming || !chatReady.ready || !selectedModeEnabled}
            rows={1}
            className="w-full resize-none outline-none text-sm"
            style={{
              background: "transparent",
              color: "var(--text-primary)",
              minHeight: 24,
              maxHeight: 200,
              fontFamily: "var(--font-sans)",
            }}
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={isStreaming || !query.trim() || !chatReady.ready || !selectedModeEnabled}
            className="absolute right-3 bottom-3 flex items-center justify-center transition-all"
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-full)",
              background: query.trim() && chatReady.ready ? "var(--primary-500)" : "var(--bg-hover)",
              color: query.trim() && chatReady.ready ? "white" : "var(--text-tertiary)",
              cursor: query.trim() && chatReady.ready ? "pointer" : "default",
            }}
          >
            {isStreaming ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ArrowUp size={18} />
            )}
          </button>
        </form>



        {/* Disclaimer */}
        <div
          className="text-center mt-2"
          style={{ fontSize: 10, color: "var(--text-tertiary)" }}
        >
          {t("chat.aiDisclaimer")}
        </div>
      </div>
    </div>
  );
}
