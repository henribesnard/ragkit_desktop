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

const RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 5000];

export function useConversation(conversationId: string | null) {
  const [history, setHistory] = useState<ConversationHistory>(emptyHistory);
  // Start in loading state when a conversationId is provided so the first
  // render shows a spinner instead of flashing the EmptyState before the
  // useEffect fires (React 18 defers effects until after paint).
  const [loading, setLoading] = useState(!!conversationId);
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
    await invoke("new_conversation", { conversation_id: conversationId, clear: true });
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

    if (!conversationId) {
      setLoading(false);
      return;
    }

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
        const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
        attempt += 1;
        console.warn(
          `[useConversation] Load attempt ${attempt} failed, retrying in ${delay}ms...`,
          err,
        );
        setError(String(err));
        retryTimerRef.current = setTimeout(() => void tryLoad(), delay);
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
