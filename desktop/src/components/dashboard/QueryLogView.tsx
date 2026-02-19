import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { useQueryLogs } from "@/hooks/useQueryLogs";

interface QueryLogViewProps {
  onClose?: () => void;
}

function formatLatency(value: number): string {
  if (!value || value <= 0) return "0 ms";
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${value} ms`;
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function feedbackLabel(value: "positive" | "negative" | null | undefined, t: (key: string) => string): string {
  if (value === "positive") return t("monitoring.queryLog.feedbackPositiveShort");
  if (value === "negative") return t("monitoring.queryLog.feedbackNegativeShort");
  return t("monitoring.queryLog.feedbackNoneShort");
}

export function QueryLogView({ onClose }: QueryLogViewProps) {
  const { t } = useTranslation();
  const [intent, setIntent] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [sinceDays, setSinceDays] = useState<number | null>(7);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, loading, error, fetchLogs, exportCsv, purge } = useQueryLogs({
    page: 1,
    page_size: 20,
    since_days: 7,
  });

  const totalPages = useMemo(() => {
    if (!data.page_size) return 1;
    return Math.max(1, Math.ceil(data.total / data.page_size));
  }, [data.page_size, data.total]);

  const applyFilters = async () => {
    await fetchLogs({
      page: 1,
      page_size: data.page_size || 20,
      intent: intent || undefined,
      feedback: feedback || undefined,
      since_days: sinceDays ?? undefined,
      search: search || undefined,
    });
  };

  const goToPage = async (target: number) => {
    await fetchLogs({
      page: Math.min(Math.max(target, 1), totalPages),
      page_size: data.page_size || 20,
      intent: intent || undefined,
      feedback: feedback || undefined,
      since_days: sinceDays ?? undefined,
      search: search || undefined,
    });
  };

  const exportToFile = async () => {
    const csv = await exportCsv({
      intent: intent || undefined,
      feedback: feedback || undefined,
      since_days: sinceDays ?? undefined,
      search: search || undefined,
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "query_logs.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const purgeLogs = async () => {
    if (!confirm(t("monitoring.queryLog.purgeConfirm"))) return;
    await purge();
    await applyFilters();
  };

  return (
    <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{t("monitoring.queryLog.title")}</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void exportToFile()}>
            {t("monitoring.queryLog.exportCsv")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void purgeLogs()}>
            {t("monitoring.queryLog.purge")}
          </Button>
          {onClose ? (
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t("monitoring.common.close")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-2">
        <select className="border rounded px-2 py-1 text-sm" value={intent} onChange={(event) => setIntent(event.target.value)}>
          <option value="">{t("monitoring.queryLog.allIntents")}</option>
          <option value="question">question</option>
          <option value="greeting">greeting</option>
          <option value="chitchat">chitchat</option>
          <option value="out_of_scope">out_of_scope</option>
          <option value="clarification">clarification</option>
        </select>
        <select className="border rounded px-2 py-1 text-sm" value={feedback} onChange={(event) => setFeedback(event.target.value)}>
          <option value="">{t("monitoring.queryLog.allFeedback")}</option>
          <option value="positive">{t("monitoring.queryLog.feedbackPositive")}</option>
          <option value="negative">{t("monitoring.queryLog.feedbackNegative")}</option>
          <option value="none">{t("monitoring.queryLog.feedbackNone")}</option>
        </select>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={sinceDays === null ? "all" : String(sinceDays)}
          onChange={(event) => {
            const value = event.target.value;
            setSinceDays(value === "all" ? null : Number(value));
          }}
        >
          <option value="all">{t("monitoring.queryLog.periodAll")}</option>
          <option value="1">{t("monitoring.queryLog.periodToday")}</option>
          <option value="7">{t("monitoring.queryLog.period7d")}</option>
          <option value="30">{t("monitoring.queryLog.period30d")}</option>
          <option value="90">{t("monitoring.queryLog.period90d")}</option>
        </select>
        <input
          className="border rounded px-2 py-1 text-sm md:col-span-2"
          placeholder={t("monitoring.queryLog.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => void applyFilters()} disabled={loading}>
          {t("monitoring.common.apply")}
        </Button>
        <span className="text-xs text-gray-500">{t("monitoring.queryLog.resultsCount", { count: data.total })}</span>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-2 max-h-[540px] overflow-auto">
        {data.entries.map((entry) => {
          const isOpen = expandedId === entry.id;
          return (
            <article key={entry.id} className="border rounded p-3 text-sm">
              <button
                className="w-full text-left flex items-center justify-between gap-3"
                onClick={() => setExpandedId(isOpen ? null : entry.id)}
              >
                <span className="font-medium">
                  {formatTimestamp(entry.timestamp)} - "{entry.query}" - {entry.intent}
                </span>
                <span className="text-xs text-gray-500">
                  {formatLatency(entry.total_latency_ms)} {feedbackLabel(entry.feedback, t)}
                </span>
              </button>
              {isOpen ? (
                <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 space-y-1">
                  <div>{t("monitoring.queryLog.intentConfidence")}: {entry.intent_confidence.toFixed(2)}</div>
                  <div>{t("monitoring.queryLog.rewrittenQuery")}: {entry.rewritten_query || t("monitoring.common.notAvailable")}</div>
                  <div>{t("monitoring.queryLog.searchType")}: {entry.search_type || t("monitoring.common.notAvailable")}</div>
                  <div>{t("monitoring.queryLog.chunksRetrieved")}: {entry.chunks_retrieved}</div>
                  <div>
                    {t("monitoring.queryLog.latencyBreakdown")}: {entry.analyzer_latency_ms} / {entry.rewriting_latency_ms} / {entry.retrieval_latency_ms} / {entry.generation_latency_ms} ms
                  </div>
                  <div>{t("monitoring.queryLog.estimatedCost")}: ${entry.estimated_cost_usd.toFixed(6)}</div>
                  {entry.answer ? <div className="whitespace-pre-wrap">{t("monitoring.queryLog.answer")}: {entry.answer.slice(0, 600)}</div> : null}
                </div>
              ) : null}
            </article>
          );
        })}
        {!data.entries.length && !loading ? <p className="text-sm text-gray-500">{t("monitoring.queryLog.noEntries")}</p> : null}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => void goToPage((data.page || 1) - 1)} disabled={(data.page || 1) <= 1 || loading}>
          {t("monitoring.common.previous")}
        </Button>
        <span className="text-xs text-gray-500">{t("monitoring.common.pageOf", { page: data.page, total: totalPages })}</span>
        <Button variant="outline" size="sm" onClick={() => void goToPage((data.page || 1) + 1)} disabled={!data.has_more || loading}>
          {t("monitoring.common.next")}
        </Button>
      </div>
    </section>
  );
}
