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

function parseHistory(payload: unknown): ConversationHistory {
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as ConversationHistory).messages)
  ) {
    return payload as ConversationHistory;
  }
  return emptyHistory;
}

function shouldRetryForUnexpectedEmptyHistory(
  history: ConversationHistory,
  minExpectedMessages: number,
): boolean {
  const knownTotal = typeof history.total_messages === "number" ? history.total_messages : 0;
  const expected = Math.max(minExpectedMessages, knownTotal);
  return expected > 0 && history.messages.length === 0;
}

/**
 * Single retry mechanism: the useEffect handles both initial load and
 * refresh-triggered reloads.  `refresh()` bumps `retryTrigger` to re-enter
 * the effect, so there is only ONE retry implementation.
 */
export function useConversation(conversationId: string | null, minExpectedMessages = 0) {
  const [history, setHistory] = useState<ConversationHistory>(emptyHistory);
  // Start in loading state when a conversationId is provided so the first
  // render shows a spinner instead of flashing the EmptyState before the
  // useEffect fires (React 18 defers effects until after paint).
  const [loading, setLoading] = useState(!!conversationId);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Use a ref so that changes to minExpectedMessages don't re-trigger the
  // load effect (which would reset history to empty and cause a content flash).
  const minExpectedRef = useRef(minExpectedMessages);
  minExpectedRef.current = minExpectedMessages;

  // Resolve ref: allows the effect to resolve the refresh() promise when done
  const resolveRef = useRef<((h: ConversationHistory) => void) | null>(null);
  const historyRef = useRef(history);
  historyRef.current = history;

  // Unified load effect — handles both initial load and refresh()-triggered reloads
  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    // Do NOT reset history here — old content stays visible while loading
    setError(null);

    if (!conversationId) {
      setHistory(emptyHistory);
      setLoading(false);
      resolveRef.current?.(emptyHistory);
      resolveRef.current = null;
      return;
    }

    let cancelled = false;
    let attempt = 0;
    const expectedCount = Math.max(0, minExpectedRef.current);

    const tryLoad = async () => {
      if (cancelled) return;
      try {
        const payload = await invoke<ConversationHistory>("get_conversation_history", {
          conversation_id: conversationId,
        });
        if (cancelled) return;
        const result = parseHistory(payload);
        if (
          shouldRetryForUnexpectedEmptyHistory(result, expectedCount) &&
          attempt < RETRY_DELAYS_MS.length
        ) {
          const delay = RETRY_DELAYS_MS[attempt];
          attempt += 1;
          console.warn(
            `[useConversation] Empty history for ${conversationId} but ${expectedCount} message(s) expected; retrying in ${delay}ms...`,
          );
          retryTimerRef.current = setTimeout(() => void tryLoad(), delay);
          return;
        }
        setHistory(result);
        setError(null);
        setLoading(false);
        resolveRef.current?.(result);
        resolveRef.current = null;
      } catch (err: any) {
        if (cancelled) return;
        if (attempt < RETRY_DELAYS_MS.length) {
          const delay = RETRY_DELAYS_MS[attempt];
          attempt += 1;
          console.warn(
            `[useConversation] Load attempt ${attempt} failed, retrying in ${delay}ms...`,
            err,
          );
          setError(String(err));
          retryTimerRef.current = setTimeout(() => void tryLoad(), delay);
        } else {
          // Max retries exhausted — keep old content, report error
          setError(String(err));
          setLoading(false);
          resolveRef.current?.(historyRef.current);
          resolveRef.current = null;
        }
      }
    };

    // Only show full loading spinner if we have NO messages yet
    // This prevents the screen from going blank and disappearing the generated message
    // while the history is being refreshed in the background.
    if (historyRef.current.messages.length === 0) {
      setLoading(true);
    }
    
    void tryLoad();

    return () => {
      cancelled = true;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      // If refresh() is waiting, resolve with current history
      resolveRef.current?.(historyRef.current);
      resolveRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, retryTrigger]);

  // refresh() re-enters the effect via retryTrigger and returns when done
  const refresh = useCallback(async (): Promise<ConversationHistory> => {
    if (!conversationId) return emptyHistory;
    return new Promise<ConversationHistory>((resolve) => {
      resolveRef.current = resolve;
      setRetryTrigger((prev) => prev + 1);
    });
  }, [conversationId]);

  const resetConversation = async () => {
    if (!conversationId) return;
    await invoke("new_conversation", { conversation_id: conversationId, clear: true });
    setHistory(emptyHistory);
  };

  return {
    history,
    loading,
    error,
    refresh,
    resetConversation,
  };
}
