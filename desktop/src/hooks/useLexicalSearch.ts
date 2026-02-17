import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface LexicalSearchResultItem {
  chunk_id: string;
  score: number;
  text: string;
  text_preview: string;
  matched_terms: Record<string, number>;
  highlight_positions: Array<{ start: number; end: number; term: string }>;
  doc_title?: string | null;
  doc_path?: string | null;
  doc_type?: string | null;
  page_number?: number | null;
  chunk_index?: number | null;
  chunk_total?: number | null;
  chunk_tokens?: number | null;
  section_header?: string | null;
  doc_language?: string | null;
  category?: string | null;
  keywords: string[];
  ingestion_version?: string | null;
}

export interface LexicalDebugInfo {
  query_text: string;
  query_tokens: string[];
  tokenization_latency_ms: number;
  search_latency_ms: number;
  total_latency_ms: number;
  results_from_index: number;
  results_after_threshold: number;
  index_stats: {
    documents: number;
    unique_terms: number;
    size_bytes: number;
  };
}

export interface LexicalSearchResponse {
  query: string;
  results: LexicalSearchResultItem[];
  total_results: number;
  page: number;
  page_size: number;
  has_more: boolean;
  debug?: LexicalDebugInfo | null;
}

export interface LexicalSearchFilters {
  doc_ids: string[];
  doc_types: string[];
  languages: string[];
  categories: string[];
}

export interface LexicalSearchPayload {
  query: string;
  top_k?: number;
  threshold?: number;
  filters?: LexicalSearchFilters;
  include_debug?: boolean;
  page?: number;
  page_size?: number;
}

export function useLexicalSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (payload: LexicalSearchPayload): Promise<LexicalSearchResponse> => {
    setLoading(true);
    setError(null);
    try {
      return await invoke<LexicalSearchResponse>("lexical_search", { query: payload });
    } catch (err: any) {
      const message = String(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  return { search, loading, error };
}
