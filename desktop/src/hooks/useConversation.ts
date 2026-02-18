import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { ChatSource } from "@/hooks/useChat";

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  intent?: string | null;
  sources?: ChatSource[] | null;
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

export function useConversation() {
  const [history, setHistory] = useState<ConversationHistory>(emptyHistory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const payload = await invoke<ConversationHistory>("get_conversation_history");
      setHistory(payload || emptyHistory);
      setError(null);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const resetConversation = async () => {
    await invoke("new_conversation");
    setHistory(emptyHistory);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    history,
    loading,
    error,
    refresh,
    resetConversation,
  };
}
