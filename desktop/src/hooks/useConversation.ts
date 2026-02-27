import { useCallback, useEffect, useState } from "react";
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

export function useConversation(conversationId: string | null) {
  const [history, setHistory] = useState<ConversationHistory>(emptyHistory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const payload = await invoke<ConversationHistory>("get_conversation_history", {
        conversation_id: conversationId,
      });
      setHistory(payload || emptyHistory);
      setError(null);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const resetConversation = async () => {
    if (!conversationId) return;
    await invoke("new_conversation", { conversation_id: conversationId });
    setHistory(emptyHistory);
  };

  useEffect(() => {
    void refresh();
  }, [conversationId, refresh]);

  return {
    history,
    loading,
    error,
    refresh,
    resetConversation,
  };
}
