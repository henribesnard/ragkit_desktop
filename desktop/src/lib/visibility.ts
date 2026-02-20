/**
 * Visibility matrix for settings sections based on expertise level.
 * Controls which settings sections are visible for each level.
 */

export type ExpertiseLevel = "simple" | "intermediate" | "expert";

export interface VisibilityMap {
  [section: string]: {
    simple: boolean;
    intermediate: boolean;
    expert: boolean;
  };
}

export const VISIBILITY_MATRIX: VisibilityMap = {
  // General settings — always visible
  general: { simple: true, intermediate: true, expert: true },

  // Ingestion
  ingestion_source: { simple: true, intermediate: true, expert: true },
  ingestion_parsing: { simple: false, intermediate: true, expert: true },
  ingestion_preprocessing: { simple: false, intermediate: true, expert: true },

  // Chunking
  chunking_strategy: { simple: true, intermediate: true, expert: true },
  chunking_advanced: { simple: false, intermediate: true, expert: true },

  // Embedding
  embedding_provider: { simple: true, intermediate: true, expert: true },
  embedding_advanced: { simple: false, intermediate: false, expert: true },

  // Vector DB
  vector_db_provider: { simple: false, intermediate: true, expert: true },
  vector_db_advanced: { simple: false, intermediate: false, expert: true },

  // Search
  semantic_search: { simple: false, intermediate: true, expert: true },
  lexical_search: { simple: false, intermediate: false, expert: true },
  hybrid_alpha: { simple: false, intermediate: true, expert: true },
  hybrid_advanced: { simple: false, intermediate: false, expert: true },

  // Reranking
  reranking: { simple: false, intermediate: true, expert: true },

  // LLM
  llm_provider: { simple: true, intermediate: true, expert: true },
  llm_temperature: { simple: true, intermediate: true, expert: true },
  llm_citations: { simple: false, intermediate: true, expert: true },
  llm_prompt: { simple: false, intermediate: true, expert: true },
  llm_advanced: { simple: false, intermediate: false, expert: true },

  // Agents
  agents_intents: { simple: false, intermediate: true, expert: true },
  agents_rewriting: { simple: false, intermediate: false, expert: true },
  agents_prompts: { simple: false, intermediate: false, expert: true },

  // Monitoring
  monitoring: { simple: false, intermediate: true, expert: true },

  // Security
  security: { simple: false, intermediate: false, expert: true },
};

/**
 * Check if a section is visible for the given expertise level.
 */
export function isSectionVisible(section: string, level: ExpertiseLevel): boolean {
  const entry = VISIBILITY_MATRIX[section];
  if (!entry) return true; // Default: visible
  return entry[level] ?? true;
}

/**
 * Filter a list of section keys to only visible ones.
 */
export function getVisibleSections(sections: string[], level: ExpertiseLevel): string[] {
  return sections.filter((s) => isSectionVisible(s, level));
}
