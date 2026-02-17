import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ChatPayload {
  query: string;
  search_type?: "semantic" | "lexical" | "hybrid";
  alpha?: number;
  filters?: {
    doc_ids: string[];
    doc_types: string[];
    languages: string[];
    categories: string[];
  };
  include_debug?: boolean;
}

export interface ChatSource {
  id: number;
  chunk_id: string;
  title: string;
  path?: string | null;
  page?: number | null;
  score: number;
  text_preview: string;
}

export interface ChatResponse {
  query: string;
  answer: string;
  sources: ChatSource[];
  search_type: string;
  debug?: Record<string, any> | null;
}

export function useChat() {
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

  return { run, loading, error };
}
