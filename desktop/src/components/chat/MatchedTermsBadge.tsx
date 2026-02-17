import { Badge } from "@/components/ui/Badge";

interface MatchedTermsBadgeProps {
  matchedTerms: Record<string, number>;
}

export function MatchedTermsBadge({ matchedTerms }: MatchedTermsBadgeProps) {
  const entries = Object.entries(matchedTerms)
    .filter(([term, count]) => Boolean(term.trim()) && count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-600 dark:text-gray-300">Termes matches:</span>
      {entries.map(([term, count]) => (
        <Badge key={term} variant="warning">
          {term} (x{count})
        </Badge>
      ))}
    </div>
  );
}
