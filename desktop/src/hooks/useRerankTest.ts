import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface RerankTestResultItem {
  text: string;
  score: number;
  rank: number;
}

export interface RerankTestResult {
  success: boolean;
  results: RerankTestResultItem[];
  latency_ms: number;
  model: string;
  error?: string | null;
}

export interface RerankModelInfo {
  id: string;
  name: string;
  provider: "none" | "cohere" | "local";
  max_context: number;
  languages: string;
  quality_rating: number;
  size_mb?: number | null;
  cost_per_1k?: string | null;
  latency_hint?: string | null;
}

export function useRerankTest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testConnection = async (): Promise<RerankTestResult> => {
    setLoading(true);
    setError(null);
    try {
      return await invoke<RerankTestResult>("test_rerank_connection");
    } catch (err: any) {
      const message = String(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const testRerank = async (query: string, documents: string[]): Promise<RerankTestResult> => {
    setLoading(true);
    setError(null);
    try {
      return await invoke<RerankTestResult>("test_rerank", {
        query: {
          query,
          documents,
        },
      });
    } catch (err: any) {
      const message = String(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const getModels = async (provider: "cohere" | "local"): Promise<RerankModelInfo[]> => {
    return await invoke<RerankModelInfo[]>("get_rerank_models", { provider });
  };

  return { loading, error, testConnection, testRerank, getModels };
}
