import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { ChevronDown, ChevronUp, MessageSquare, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";

interface SearchResultItem {
  chunk_id: string;
  score: number;
  text: string;
  text_preview: string;
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

interface SearchDebugInfo {
  query_text: string;
  query_tokens: number;
  embedding_latency_ms: number;
  search_latency_ms: number;
  mmr_latency_ms: number;
  total_latency_ms: number;
  results_from_db: number;
  results_after_threshold: number;
  results_after_filters: number;
  results_after_mmr: number;
}

interface SemanticSearchResponse {
  query: string;
  results: SearchResultItem[];
  total_results: number;
  page: number;
  page_size: number;
  has_more: boolean;
  debug?: SearchDebugInfo | null;
}

interface FilterValuesResponse {
  values: string[];
}

interface ChatReadyResponse {
  ready: boolean;
  vectors_count: number;
}

interface ChatFilters {
  doc_ids: string[];
  doc_types: string[];
  languages: string[];
  categories: string[];
}

function scoreClass(score: number): string {
  if (score >= 0.8) return "text-green-700 bg-green-100";
  if (score >= 0.6) return "text-lime-700 bg-lime-100";
  if (score >= 0.4) return "text-amber-700 bg-amber-100";
  return "text-red-700 bg-red-100";
}

function normalizeQueryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function renderHighlighted(text: string, query: string): ReactNode {
  const terms = normalizeQueryTerms(query);
  if (!terms.length) return text;
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (terms.includes(part.toLowerCase())) {
      return (
        <mark key={`${part}-${index}`} className="bg-yellow-200/80 rounded px-0.5">
          {part}
        </mark>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function selectedValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

export function Chat() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [debug, setDebug] = useState<SearchDebugInfo | null>(null);
  const [chatReady, setChatReady] = useState<ChatReadyResponse>({ ready: false, vectors_count: 0 });
  const [showOptions, setShowOptions] = useState(false);
  const [showScores, setShowScores] = useState(true);
  const [showMetadata, setShowMetadata] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [availableFilters, setAvailableFilters] = useState<ChatFilters>({
    doc_ids: [],
    doc_types: [],
    languages: [],
    categories: [],
  });
  const [filters, setFilters] = useState<ChatFilters>({
    doc_ids: [],
    doc_types: [],
    languages: [],
    categories: [],
  });

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((items) => items.length > 0),
    [filters]
  );

  const refreshChatState = async () => {
    const ready = await invoke<ChatReadyResponse>("get_chat_ready");
    setChatReady(ready);
    const [docTypes, languages, categories, docIds] = await Promise.all([
      invoke<FilterValuesResponse>("get_search_filter_values", { field: "doc_type" }),
      invoke<FilterValuesResponse>("get_search_filter_values", { field: "language" }),
      invoke<FilterValuesResponse>("get_search_filter_values", { field: "category" }),
      invoke<FilterValuesResponse>("get_search_filter_values", { field: "doc_id" }),
    ]);
    setAvailableFilters({
      doc_types: docTypes.values || [],
      languages: languages.values || [],
      categories: categories.values || [],
      doc_ids: docIds.values || [],
    });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refreshChatState();
      } catch (err: any) {
        if (!cancelled) setError(String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const executeSearch = async (targetPage: number, append: boolean) => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const payload = {
        query: query.trim(),
        page: targetPage,
        page_size: 5,
        include_debug: debugMode,
        filters,
      };

      const response = await invoke<SemanticSearchResponse>("run_semantic_search_with_options", { payload });
      setResults((prev) => (append ? [...prev, ...(response.results || [])] : (response.results || [])));
      setHasMore(Boolean(response.has_more));
      setPage(response.page || targetPage);
      setTotalResults(response.total_results || 0);
      setDebug(response.debug || null);
      if (!append) {
        setExpanded({});
      }
    } catch (err: any) {
      if (!append) setResults([]);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const onSearch = async (event: FormEvent) => {
    event.preventDefault();
    await executeSearch(1, false);
  };

  return (
    <div className="h-full flex flex-col p-6 gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{t("chat.title")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("chat.semanticDescription")}</p>
          <p className="text-xs text-gray-500 mt-1">
            {chatReady.ready ? `Index prêt (${chatReady.vectors_count} vecteurs)` : "Base vide: lancez une ingestion pour activer le chat."}
          </p>
        </div>

        <Button variant="outline" onClick={() => setShowOptions((value) => !value)}>
          <Settings2 className="w-4 h-4 mr-2" />
          ⚙ Options
        </Button>
      </div>

      {showOptions && (
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <Toggle checked={debugMode} onChange={setDebugMode} label="Mode debug" />
            <Toggle checked={showScores} onChange={setShowScores} label="Afficher scores" />
            <Toggle checked={showMetadata} onChange={setShowMetadata} label="Afficher métadonnées" />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm">
              Types
              <select
                className="mt-1 w-full border rounded px-2 py-1 min-h-28"
                multiple
                value={filters.doc_types}
                onChange={(event) => setFilters((prev) => ({ ...prev, doc_types: selectedValues(event.target) }))}
              >
                {availableFilters.doc_types.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Langues
              <select
                className="mt-1 w-full border rounded px-2 py-1 min-h-28"
                multiple
                value={filters.languages}
                onChange={(event) => setFilters((prev) => ({ ...prev, languages: selectedValues(event.target) }))}
              >
                {availableFilters.languages.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Catégories
              <select
                className="mt-1 w-full border rounded px-2 py-1 min-h-28"
                multiple
                value={filters.categories}
                onChange={(event) => setFilters((prev) => ({ ...prev, categories: selectedValues(event.target) }))}
              >
                {availableFilters.categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Documents
              <select
                className="mt-1 w-full border rounded px-2 py-1 min-h-28"
                multiple
                value={filters.doc_ids}
                onChange={(event) => setFilters((prev) => ({ ...prev, doc_ids: selectedValues(event.target) }))}
              >
                {availableFilters.doc_ids.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setFilters({ doc_ids: [], doc_types: [], languages: [], categories: [] })}
            >
              Réinitialiser filtres
            </Button>
            {hasActiveFilters && <span className="text-xs text-amber-700 self-center">Filtres actifs</span>}
          </div>
        </section>
      )}

      <form onSubmit={onSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("chat.searchPlaceholder")}
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading || !query.trim() || !chatReady.ready}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60"
        >
          <Search size={16} />
          {loading ? t("chat.searching") : t("chat.search")}
        </button>
      </form>

      {error && <div className="rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}

      {debugMode && debug && (
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3 text-xs grid md:grid-cols-2 gap-2">
          <div>Latence embedding: <b>{debug.embedding_latency_ms} ms</b></div>
          <div>Latence recherche: <b>{debug.search_latency_ms} ms</b></div>
          <div>Latence MMR: <b>{debug.mmr_latency_ms} ms</b></div>
          <div>Latence totale: <b>{debug.total_latency_ms} ms</b></div>
          <div>Résultats DB: <b>{debug.results_from_db}</b></div>
          <div>Après seuil: <b>{debug.results_after_threshold}</b></div>
          <div>Après filtres: <b>{debug.results_after_filters}</b></div>
          <div>Après MMR: <b>{debug.results_after_mmr}</b></div>
        </section>
      )}

      <div className="flex-1 overflow-y-auto space-y-3">
        {!results.length && !loading && !error && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <MessageSquare size={28} className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
              {chatReady.ready ? t("chat.emptyResults") : "Base de connaissances vide. Lancez une ingestion depuis le tableau de bord."}
            </p>
          </div>
        )}

        {results.map((result) => {
          const opened = Boolean(expanded[result.chunk_id]);
          return (
            <article key={result.chunk_id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <span>{result.doc_title || result.doc_path || "Document inconnu"}</span>
                  {result.page_number ? <span> · p.{result.page_number}</span> : null}
                </div>
                {showScores ? (
                  <span className={`text-xs px-2 py-1 rounded ${scoreClass(result.score)}`}>
                    {t("chat.score")}: {result.score.toFixed(4)}
                  </span>
                ) : null}
              </div>

              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {renderHighlighted(opened ? result.text : result.text_preview, query)}
              </p>

              {showMetadata && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 grid md:grid-cols-2 gap-2">
                  <div>Type: <b>{result.doc_type || "n/a"}</b></div>
                  <div>Langue: <b>{result.doc_language || "n/a"}</b></div>
                  <div>Catégorie: <b>{result.category || "n/a"}</b></div>
                  <div>Chunk: <b>{result.chunk_index ?? "n/a"}/{result.chunk_total ?? "n/a"}</b></div>
                </div>
              )}

              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded((prev) => ({ ...prev, [result.chunk_id]: !opened }))}
                >
                  {opened ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                  {opened ? "Réduire" : "Voir le texte complet"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{totalResults} résultat(s)</span>
        {hasMore && (
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => {
              void executeSearch(page + 1, true);
            }}
          >
            Voir plus de résultats
          </Button>
        )}
      </div>
    </div>
  );
}

