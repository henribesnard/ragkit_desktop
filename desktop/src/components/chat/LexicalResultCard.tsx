import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MatchedTermsBadge } from "@/components/chat/MatchedTermsBadge";
import { TermHighlighter } from "@/components/chat/TermHighlighter";
import { LexicalSearchResultItem } from "@/hooks/useLexicalSearch";

interface LexicalResultCardProps {
  result: LexicalSearchResultItem;
  expanded: boolean;
  onToggle: () => void;
  showScores: boolean;
  showMetadata: boolean;
  stemming: boolean;
}

function scoreClass(score: number): string {
  if (score >= 20) return "text-green-700 bg-green-100";
  if (score >= 10) return "text-lime-700 bg-lime-100";
  if (score >= 4) return "text-amber-700 bg-amber-100";
  return "text-red-700 bg-red-100";
}

export function LexicalResultCard({
  result,
  expanded,
  onToggle,
  showScores,
  showMetadata,
  stemming,
}: LexicalResultCardProps) {
  const visibleText = expanded ? result.text : result.text_preview;

  return (
    <article className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span>{result.doc_title || result.doc_path || "Document inconnu"}</span>
          {result.page_number ? <span> | p.{result.page_number}</span> : null}
        </div>
        {showScores ? (
          <span className={`text-xs px-2 py-1 rounded ${scoreClass(result.score)}`}>
            Score BM25: {result.score.toFixed(3)}
          </span>
        ) : null}
      </div>

      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
        <TermHighlighter text={visibleText} matchedTerms={result.matched_terms} stemming={stemming} />
      </p>

      <MatchedTermsBadge matchedTerms={result.matched_terms} />

      {showMetadata && (
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 grid md:grid-cols-2 gap-2">
          <div>
            Type: <b>{result.doc_type || "n/a"}</b>
          </div>
          <div>
            Langue: <b>{result.doc_language || "n/a"}</b>
          </div>
          <div>
            Categorie: <b>{result.category || "n/a"}</b>
          </div>
          <div>
            Chunk: <b>{result.chunk_index ?? "n/a"}/{result.chunk_total ?? "n/a"}</b>
          </div>
        </div>
      )}

      <div className="mt-3">
        <Button variant="ghost" size="sm" onClick={onToggle}>
          {expanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
          {expanded ? "Reduire" : "Voir le texte complet"}
        </Button>
      </div>
    </article>
  );
}
