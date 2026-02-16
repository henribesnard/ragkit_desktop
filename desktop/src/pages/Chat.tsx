import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { MessageSquare, Search } from "lucide-react";

interface SemanticSearchResult {
  id: string;
  score: number;
  chunk_text: string;
  source_document: string;
  source_page?: number | null;
  metadata: Record<string, unknown>;
}

interface SemanticSearchResponse {
  query: string;
  total: number;
  results: SemanticSearchResult[];
}

export function Chat() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SemanticSearchResult[]>([]);

  const onSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await invoke<SemanticSearchResponse>("run_semantic_search", { query: query.trim() });
      setResults(response.results ?? []);
    } catch (e: any) {
      setResults([]);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 gap-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{t("chat.title")}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("chat.semanticDescription")}</p>
      </div>

      <form onSubmit={onSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("chat.searchPlaceholder")}
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60"
        >
          <Search size={16} />
          {loading ? t("chat.searching") : t("chat.search")}
        </button>
      </form>

      {error && <div className="rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}

      <div className="flex-1 overflow-y-auto space-y-3">
        {!results.length && !loading && !error && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <MessageSquare size={28} className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">{t("chat.emptyResults")}</p>
          </div>
        )}

        {results.map((result) => (
          <div key={result.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center justify-between mb-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{t("chat.score")}: {result.score.toFixed(4)}</span>
              <span>{result.source_document}{result.source_page ? ` · p.${result.source_page}` : ""}</span>
            </div>
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{result.chunk_text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
