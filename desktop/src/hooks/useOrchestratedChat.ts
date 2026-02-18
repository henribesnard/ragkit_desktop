import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { ChatPayload, ChatResponse } from "@/hooks/useChat";

export function useOrchestratedChat() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (payload: ChatPayload): Promise<ChatResponse> => {
    setLoading(true);
    setError(null);
    try {
      return await invoke<ChatResponse>("chat", { query: payload });
    } catch (err: any) {
      const message = String(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const runStream = async (payload: ChatPayload): Promise<string> => {
    return await invoke<string>("chat_orchestrated", { query: payload });
  };

  return { run, runStream, loading, error };
}
