import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { ChevronDown, ChevronUp, MessageSquare, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { LexicalResultCard } from "@/components/chat/LexicalResultCard";
import { ChatSearchMode, SearchModeSelector } from "@/components/chat/SearchModeSelector";
import { LexicalSearchResultItem } from "@/hooks/useLexicalSearch";
import { UnifiedSearchResultItem, useUnifiedSearch } from "@/hooks/useUnifiedSearch";
import { useChatStream } from "@/hooks/useChatStream";
import { useConversation } from "@/hooks/useConversation";

interface FilterValuesResponse {
  values: string[];
}

interface ChatReadyResponse {
  ready: boolean;
  vectors_count: number;
  lexical_chunks?: number;
}

interface ChatFilters {
  doc_ids: string[];
  doc_types: string[];
  languages: string[];
  categories: string[];
}

interface SearchConfigState {
  enabled: boolean;
  lexical_stemming?: boolean;
}

interface GeneralSettingsPayload {
  search_type?: ChatSearchMode;
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

function resultDescription(mode: ChatSearchMode, rerankingEnabled: boolean): string {
  const base =
    mode === "semantic"
      ? "Recherche semantique active."
      : mode === "lexical"
        ? "Recherche lexicale BM25 active."
        : "Recherche hybride active (fusion semantique + lexicale).";
  return rerankingEnabled ? `${base} Reranking actif.` : base;
}

function rankChangeLabel(rankChange: number | null | undefined): string {
  if (rankChange === null || rankChange === undefined) return "";
  if (rankChange > 0) return `▲ +${rankChange}`;
  if (rankChange < 0) return `▼ ${rankChange}`;
  return "═ 0";
}

function toLexicalResult(result: UnifiedSearchResultItem): LexicalSearchResultItem {
  return {
    chunk_id: result.chunk_id,
    score: result.score,
    text: result.text,
    text_preview: result.text_preview,
    matched_terms: result.matched_terms || {},
    highlight_positions: [],
    doc_title: result.doc_title,
    doc_path: result.doc_path,
    doc_type: result.doc_type,
    page_number: result.page_number,
    chunk_index: result.chunk_index,
    chunk_total: result.chunk_total,
    chunk_tokens: result.chunk_tokens,
    section_header: result.section_header,
    doc_language: result.doc_language,
    category: result.category,
    keywords: result.keywords,
    ingestion_version: result.ingestion_version,
  };
}

export function Chat() {
  const { t } = useTranslation();
  const { search: runUnifiedSearch } = useUnifiedSearch();
  const {
    content: streamedAnswer,
    isStreaming,
    finalResponse,
    error: streamError,
    startStream,
    stopStream,
    clear: clearStreamState,
  } = useChatStream();
  const { history, refresh: refreshHistory, resetConversation } = useConversation();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UnifiedSearchResultItem[]>([]);
  const [debug, setDebug] = useState<Record<string, any> | null>(null);
  const [chatReady, setChatReady] = useState<ChatReadyResponse>({ ready: false, vectors_count: 0, lexical_chunks: 0 });
  const [searchMode, setSearchMode] = useState<ChatSearchMode>("hybrid");
  const [semanticEnabled, setSemanticEnabled] = useState(true);
  const [lexicalEnabled, setLexicalEnabled] = useState(true);
  const [lexicalStemming, setLexicalStemming] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const [showScores, setShowScores] = useState(true);
  const [showMetadata, setShowMetadata] = useState(true);
  const [showProvenance, setShowProvenance] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [alphaOverride, setAlphaOverride] = useState(0.5);
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

  const hasActiveFilters = useMemo(() => Object.values(filters).some((items) => items.length > 0), [filters]);
  const rerankingEnabled = useMemo(
    () => results.some((item) => Boolean(item.is_reranked)) || Boolean(debug?.rerank),
    [results, debug],
  );
  const selectedModeEnabled =
    searchMode === "semantic" ? semanticEnabled : searchMode === "lexical" ? lexicalEnabled : semanticEnabled && lexicalEnabled;

  const applySearchConfig = (
    semanticCfg: SearchConfigState,
    lexicalCfg: SearchConfigState,
    generalCfg: GeneralSettingsPayload,
  ) => {
    const semanticIsEnabled = Boolean(semanticCfg.enabled ?? true);
    const lexicalIsEnabled = Boolean(lexicalCfg.enabled ?? true);
    setSemanticEnabled(semanticIsEnabled);
    setLexicalEnabled(lexicalIsEnabled);
    setLexicalStemming(Boolean(lexicalCfg.lexical_stemming ?? true));

    const preferredMode = generalCfg.search_type || "hybrid";
    const preferredAvailable =
      (preferredMode === "semantic" && semanticIsEnabled) ||
      (preferredMode === "lexical" && lexicalIsEnabled) ||
      (preferredMode === "hybrid" && semanticIsEnabled && lexicalIsEnabled);

    if (preferredAvailable) {
      setSearchMode(preferredMode);
      return;
    }

    if (semanticIsEnabled) {
      setSearchMode("semantic");
      return;
    }
    if (lexicalIsEnabled) {
      setSearchMode("lexical");
      return;
    }
    setSearchMode("hybrid");
  };

  const refreshChatState = async () => {
    const ready = await invoke<ChatReadyResponse>("get_chat_ready");
    setChatReady(ready);

    const [docTypes, languages, categories, docIds, semanticCfg, lexicalCfg, generalCfg, hybridCfg] = await Promise.all([
      invoke<FilterValuesResponse>("get_search_filter_values", { field: "doc_type" }),
      invoke<FilterValuesResponse>("get_search_filter_values", { field: "language" }),
      invoke<FilterValuesResponse>("get_search_filter_values", { field: "category" }),
      invoke<FilterValuesResponse>("get_search_filter_values", { field: "doc_id" }),
      invoke<SearchConfigState>("get_semantic_search_config"),
      invoke<{ enabled: boolean; stemming: boolean }>("get_lexical_search_config"),
      invoke<GeneralSettingsPayload>("get_general_settings"),
      invoke<{ alpha?: number }>("get_hybrid_search_config"),
    ]);

    setAvailableFilters({
      doc_types: docTypes.values || [],
      languages: languages.values || [],
      categories: categories.values || [],
      doc_ids: docIds.values || [],
    });

    applySearchConfig(
      semanticCfg,
      { enabled: lexicalCfg.enabled, lexical_stemming: lexicalCfg.stemming },
      generalCfg,
    );
    setAlphaOverride(Number(hybridCfg.alpha ?? 0.5));
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

  useEffect(() => {
    if (!finalResponse) return;
    void refreshHistory();
  }, [finalResponse]);

  const executeSearch = async (targetPage: number, append: boolean) => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const payload = {
        query: query.trim(),
        search_type: searchMode,
        alpha: searchMode === "hybrid" ? alphaOverride : undefined,
        page: targetPage,
        page_size: 5,
        include_debug: debugMode,
        filters,
      };

      const response = await runUnifiedSearch(payload);
      setResults((prev) => (append ? [...prev, ...(response.results || [])] : response.results || []));
      setHasMore(Boolean(response.has_more));
      setPage(response.page || targetPage);
      setTotalResults(response.total_results || 0);
      setDebug((response.debug as Record<string, any>) || null);

      if (!append) {
        setExpanded({});
      }
    } catch (err: any) {
      if (!append) {
        setResults([]);
      }
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchMode !== "hybrid" || !query.trim()) return;
    const timer = window.setTimeout(() => {
      void executeSearch(1, false);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [alphaOverride]);

  const onSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    const payload = {
      query: query.trim(),
      search_type: searchMode,
      alpha: searchMode === "hybrid" ? alphaOverride : undefined,
      filters,
      include_debug: debugMode,
    };
    setResults([]);
    setDebug(null);
    setPage(1);
    setHasMore(false);
    setTotalResults(0);
    await startStream(payload);
  };

  return (
    <div className="h-full flex flex-col p-6 gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{t("chat.title")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{resultDescription(searchMode, rerankingEnabled)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {chatReady.ready
              ? `Index pret (${chatReady.vectors_count} vecteurs, ${chatReady.lexical_chunks || 0} chunks BM25)`
              : "Base vide: lancez une ingestion pour activer le chat."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!confirm("Demarrer une nouvelle conversation ?")) return;
              void (async () => {
                await resetConversation();
                clearStreamState();
                setResults([]);
                setDebug(null);
              })();
            }}
          >
            Nouvelle conversation
          </Button>
          <Button variant="outline" onClick={() => setShowOptions((value) => !value)}>
            <Settings2 className="w-4 h-4 mr-2" />
            Options
          </Button>
        </div>
      </div>

      {showOptions && (
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <div className="grid md:grid-cols-4 gap-3">
            <Toggle checked={debugMode} onChange={setDebugMode} label="Mode debug" />
            <Toggle checked={showScores} onChange={setShowScores} label="Afficher scores" />
            <Toggle checked={showMetadata} onChange={setShowMetadata} label="Afficher metadonnees" />
            <Toggle checked={showProvenance} onChange={setShowProvenance} label="Afficher provenance" />
          </div>

          {searchMode === "hybrid" && (
            <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
              <label className="text-sm font-medium">Alpha ({alphaOverride.toFixed(2)})</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={alphaOverride}
                onChange={(event) => setAlphaOverride(Number(event.target.value))}
                className="mt-2 w-full"
              />
              <div className="mt-1 text-xs text-gray-500 flex justify-between">
                <span>Lexical {Math.round((1 - alphaOverride) * 100)}%</span>
                <span>Semantique {Math.round(alphaOverride * 100)}%</span>
              </div>
            </div>
          )}

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
              Categories
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
            <Button variant="ghost" onClick={() => setFilters({ doc_ids: [], doc_types: [], languages: [], categories: [] })}>
              Reinitialiser filtres
            </Button>
            {hasActiveFilters && <span className="text-xs text-amber-700 self-center">Filtres actifs</span>}
          </div>
        </section>
      )}

      <form onSubmit={onSearch} className="flex gap-2">
        <SearchModeSelector
          mode={searchMode}
          onModeChange={(mode) => {
            setSearchMode(mode);
            setResults([]);
            setDebug(null);
            setPage(1);
            setHasMore(false);
            setTotalResults(0);
            setExpanded({});
          }}
          lexicalEnabled={lexicalEnabled}
          semanticEnabled={semanticEnabled}
        />

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("chat.searchPlaceholder")}
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
        />

        <button
          type="submit"
          disabled={loading || !query.trim() || !chatReady.ready || !selectedModeEnabled}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60"
        >
          <Search size={16} />
          {loading ? t("chat.searching") : t("chat.search")}
        </button>
      </form>

      {error && <div className="rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
      {streamError && <div className="rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">{streamError}</div>}

      {history.messages.length > 0 ? (
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-2">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Conversation</h3>
          {history.messages.slice(-8).map((message, index) => (
            <article
              key={`${message.timestamp}-${index}`}
              className={`rounded border px-3 py-2 text-sm ${
                message.role === "user"
                  ? "border-blue-200 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-900/20"
                  : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60"
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">{message.role === "user" ? "Vous" : "Assistant"}</div>
              <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-100">{message.content}</div>
              {message.intent ? <div className="mt-1 text-xs text-indigo-600">Intent: {message.intent}</div> : null}
            </article>
          ))}
        </section>
      ) : null}

      {debugMode && debug && (
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3 text-xs space-y-1">
          {Object.entries(debug).map(([key, value]) => (
            <div key={key} className="break-words">
              <span className="font-semibold">{key}: </span>
              <span>{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
            </div>
          ))}
        </section>
      )}

      {(streamedAnswer || isStreaming || finalResponse) && (
        <section className="rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">Reponse LLM</h3>
            {isStreaming ? (
              <Button variant="outline" size="sm" onClick={() => void stopStream()}>
                Arreter
              </Button>
            ) : null}
          </div>

          {isStreaming ? <p className="text-xs text-blue-700 dark:text-blue-300">Generation en cours...</p> : null}
          <div className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{streamedAnswer}</div>

          {finalResponse?.intent ? (
            <div className="text-xs text-indigo-700 dark:text-indigo-300">
              Intent: <b>{finalResponse.intent}</b> | RAG: <b>{String(finalResponse.needs_rag)}</b>
              {finalResponse.rewritten_query ? <> | Reformulee: <b>{finalResponse.rewritten_query}</b></> : null}
            </div>
          ) : null}

          {finalResponse?.sources?.length ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Sources</h4>
              {finalResponse.sources.map((source) => (
                <article
                  key={`${source.id}-${source.chunk_id}`}
                  className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-xs"
                >
                  <div className="font-medium">
                    [{source.id}] {source.title} {source.page ? `p.${source.page}` : ""}
                  </div>
                  <div className="text-gray-600 dark:text-gray-300 mt-1">{source.text_preview}</div>
                </article>
              ))}
            </div>
          ) : null}

          {debugMode && finalResponse?.debug ? (
            <section className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20 p-2 text-xs space-y-1">
              {Object.entries(finalResponse.debug).map(([key, value]) => (
                <div key={key} className="break-words">
                  <span className="font-semibold">{key}: </span>
                  <span>{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
                </div>
              ))}
            </section>
          ) : null}
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

        {searchMode === "lexical" &&
          results.map((result) => (
            <LexicalResultCard
              key={result.chunk_id}
              result={toLexicalResult(result)}
              expanded={Boolean(expanded[result.chunk_id])}
              onToggle={() => setExpanded((prev) => ({ ...prev, [result.chunk_id]: !prev[result.chunk_id] }))}
              showScores={showScores}
              showMetadata={showMetadata}
              stemming={lexicalStemming}
            />
          ))}

        {searchMode !== "lexical" &&
          results.map((result) => {
            const opened = Boolean(expanded[result.chunk_id]);
            const displayedScore =
              result.is_reranked && result.rerank_score !== null && result.rerank_score !== undefined
              ? result.rerank_score
              : result.score;
            const rerankToRank =
              result.original_rank !== null &&
              result.original_rank !== undefined &&
              result.rank_change !== null &&
              result.rank_change !== undefined
                ? result.original_rank - result.rank_change
                : null;
            return (
              <article key={result.chunk_id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <span>{result.doc_title || result.doc_path || "Document inconnu"}</span>
                    {result.page_number ? <span> | p.{result.page_number}</span> : null}
                    {result.is_reranked ? (
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-indigo-100 text-indigo-700">
                        {rankChangeLabel(result.rank_change)}
                      </span>
                    ) : null}
                  </div>
                  {showScores ? (
                    <span className={`text-xs px-2 py-1 rounded ${scoreClass(displayedScore)}`}>
                      {result.is_reranked ? "Score rerank" : t("chat.score")}: {displayedScore.toFixed(4)}
                    </span>
                  ) : null}
                </div>

                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {renderHighlighted(opened ? result.text : result.text_preview, query)}
                </p>

                {searchMode === "hybrid" && showProvenance && (
                  <div className="mt-2 text-xs text-indigo-700 dark:text-indigo-300">
                    Semantique: #{result.semantic_rank ?? "-"} ({result.semantic_score?.toFixed(4) ?? "n/a"})
                    {" | "}
                    Lexicale: #{result.lexical_rank ?? "-"} ({result.lexical_score?.toFixed(4) ?? "n/a"})
                    {result.is_reranked ? (
                      <>
                        {" | "}
                        Rerank: #{result.original_rank ?? "-"}{" -> "}#{rerankToRank ?? "-"}
                        {" "}({result.rerank_score?.toFixed(4) ?? "n/a"})
                      </>
                    ) : null}
                  </div>
                )}

                {showMetadata && (
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 grid md:grid-cols-2 gap-2">
                    <div>Type: <b>{result.doc_type || "n/a"}</b></div>
                    <div>Langue: <b>{result.doc_language || "n/a"}</b></div>
                    <div>Categorie: <b>{result.category || "n/a"}</b></div>
                    <div>Chunk: <b>{result.chunk_index ?? "n/a"}/{result.chunk_total ?? "n/a"}</b></div>
                  </div>
                )}

                <div className="mt-3">
                  <Button variant="ghost" size="sm" onClick={() => setExpanded((prev) => ({ ...prev, [result.chunk_id]: !opened }))}>
                    {opened ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                    {opened ? "Reduire" : "Voir le texte complet"}
                  </Button>
                </div>
              </article>
            );
          })}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{totalResults} resultat(s)</span>
        {hasMore && (
          <Button variant="outline" disabled={loading} onClick={() => { void executeSearch(page + 1, true); }}>
            Voir plus de resultats
          </Button>
        )}
      </div>
    </div>
  );
}
