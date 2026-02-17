import { ReactNode } from "react";

interface TermHighlighterProps {
  text: string;
  matchedTerms: Record<string, number>;
  stemming: boolean;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function TermHighlighter({ text, matchedTerms, stemming }: TermHighlighterProps) {
  const terms = Object.keys(matchedTerms)
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (!terms.length) {
    return <span>{text}</span>;
  }

  const suffix = stemming ? "\\w*" : "";
  const regex = new RegExp(`\\b(${terms.map(escapeRegex).join("|")})${suffix}\\b`, "gi");

  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(regex)) {
    const start = match.index ?? -1;
    if (start < 0) continue;
    const token = match[0] || "";
    const end = start + token.length;
    if (start > cursor) {
      parts.push(<span key={`plain-${cursor}`}>{text.slice(cursor, start)}</span>);
    }
    parts.push(
      <mark key={`mark-${start}-${end}`} className="bg-yellow-200 font-semibold px-0.5 rounded">
        {token}
      </mark>
    );
    cursor = end;
  }

  if (!parts.length) {
    return <span>{text}</span>;
  }
  if (cursor < text.length) {
    parts.push(<span key={`tail-${cursor}`}>{text.slice(cursor)}</span>);
  }

  return <span>{parts}</span>;
}
