import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type SearchType = "semantic" | "lexical" | "hybrid";

export interface UnifiedSearchFilters {
  doc_ids: string[];
  doc_types: string[];
  languages: string[];
  categories: string[];
}

export interface UnifiedSearchPayload {
  query: string;
  search_type?: SearchType;
  alpha?: number;
  top_k?: number;
  threshold?: number;
  filters?: UnifiedSearchFilters;
  include_debug?: boolean;
  page?: number;
  page_size?: number;
}

export interface UnifiedSearchResultItem {
  chunk_id: string;
  score: number;
  text: string;
  text_preview: string;
  semantic_rank?: number | null;
  semantic_score?: number | null;
  lexical_rank?: number | null;
  lexical_score?: number | null;
  matched_terms?: Record<string, number> | null;
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

export interface UnifiedSearchResponse {
  query: string;
  search_type: SearchType;
  results: UnifiedSearchResultItem[];
  total_results: number;
  page: number;
  page_size: number;
  has_more: boolean;
  debug?: Record<string, any> | null;
}

export function useUnifiedSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (payload: UnifiedSearchPayload): Promise<UnifiedSearchResponse> => {
    setLoading(true);
    setError(null);
    try {
      return await invoke<UnifiedSearchResponse>("unified_search", { query: payload });
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
