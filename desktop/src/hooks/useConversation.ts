import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { ChatSource } from "@/hooks/useChat";

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  intent?: string | null;
  sources?: ChatSource[] | null;
  query_log_id?: string | null;
  feedback?: "positive" | "negative" | null;
  timestamp: string;
}

export interface ConversationHistory {
  messages: ConversationMessage[];
  total_messages: number;
  has_summary: boolean;
}

const emptyHistory: ConversationHistory = {
  messages: [],
  total_messages: 0,
  has_summary: false,
};

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

export function useConversation(conversationId: string | null) {
  const [history, setHistory] = useState<ConversationHistory>(emptyHistory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async (): Promise<ConversationHistory> => {
    if (!conversationId) return emptyHistory;
    setLoading(true);
    try {
      const payload = await invoke<ConversationHistory>("get_conversation_history", {
        conversation_id: conversationId,
      });
      const result =
        payload && Array.isArray(payload.messages) ? payload : emptyHistory;
      setHistory(result);
      setError(null);
      return result;
    } catch (err: any) {
      console.warn("[useConversation] Failed to load history for", conversationId, err);
      setError(String(err));
      return emptyHistory;
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const resetConversation = async () => {
    if (!conversationId) return;
    await invoke("new_conversation", { conversation_id: conversationId });
    setHistory(emptyHistory);
  };

  // Reset history immediately when conversationId changes, then fetch with retry
  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    setHistory(emptyHistory);
    setError(null);

    if (!conversationId) return;

    let cancelled = false;
    let attempt = 0;

    const tryLoad = async () => {
      if (cancelled) return;
      try {
        const payload = await invoke<ConversationHistory>("get_conversation_history", {
          conversation_id: conversationId,
        });
        if (cancelled) return;
        const result =
          payload && Array.isArray(payload.messages) ? payload : emptyHistory;
        setHistory(result);
        setError(null);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        attempt++;
        if (attempt < MAX_RETRIES) {
          console.warn(`[useConversation] Load attempt ${attempt} failed, retrying in ${RETRY_DELAYS[attempt - 1]}ms...`, err);
          retryTimerRef.current = setTimeout(() => void tryLoad(), RETRY_DELAYS[attempt - 1]);
        } else {
          console.warn("[useConversation] All retries exhausted for", conversationId, err);
          setError(String(err));
          setLoading(false);
        }
      }
    };

    setLoading(true);
    void tryLoad();

    return () => {
      cancelled = true;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [conversationId]);

  return {
    history,
    loading,
    error,
    refresh,
    resetConversation,
  };
}
