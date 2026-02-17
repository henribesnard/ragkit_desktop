import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface LLMTestResult {
  success: boolean;
  model: string;
  response_text: string;
  latency_ms: number;
  error?: string | null;
}

export interface LLMModelInfo {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "ollama" | "mistral";
  context_window: number;
  cost_input?: string | null;
  cost_output?: string | null;
  languages: string;
  quality_rating: number;
  latency_hint?: string | null;
  local?: boolean;
}

export function useLLMTest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testConnection = async (): Promise<LLMTestResult> => {
    setLoading(true);
    setError(null);
    try {
      return await invoke<LLMTestResult>("test_llm_connection");
    } catch (err: any) {
      const message = String(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const getModels = async (provider: "openai" | "anthropic" | "ollama" | "mistral"): Promise<LLMModelInfo[]> => {
    return await invoke<LLMModelInfo[]>("get_llm_models", { provider });
  };

  return { loading, error, testConnection, getModels };
}
