import { ThumbsUp, ThumbsDown, Copy } from "lucide-react";

interface FeedbackButtonsProps {
  queryId?: string | null;
  value?: "positive" | "negative" | null;
  loading?: boolean;
  onSubmit: (queryId: string, feedback: "positive" | "negative") => Promise<void> | void;
  onCopy?: () => void;
}

export function FeedbackButtons({ queryId, value, loading, onSubmit, onCopy }: FeedbackButtonsProps) {
  if (!queryId) return null;

  const btnBase: React.CSSProperties = {
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--radius-sm)",
    background: "transparent",
    cursor: loading ? "wait" : "pointer",
    transition: "background 150ms ease-out, color 150ms ease-out",
  };

  const handleHover = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
  };
  const handleLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLElement).style.background = "transparent";
  };

  return (
    <div className="flex items-center" style={{ gap: 4 }}>
      <button
        style={{
          ...btnBase,
          color: value === "positive" ? "var(--primary-500)" : "var(--text-tertiary)",
        }}
        disabled={loading}
        onClick={() => void onSubmit(queryId, "positive")}
        onMouseEnter={handleHover}
        onMouseLeave={handleLeave}
        title="Feedback positif"
      >
        <ThumbsUp size={14} />
      </button>
      <button
        style={{
          ...btnBase,
          color: value === "negative" ? "var(--error)" : "var(--text-tertiary)",
        }}
        disabled={loading}
        onClick={() => void onSubmit(queryId, "negative")}
        onMouseEnter={handleHover}
        onMouseLeave={handleLeave}
        title="Feedback négatif"
      >
        <ThumbsDown size={14} />
      </button>
      {onCopy && (
        <button
          style={{
            ...btnBase,
            color: "var(--text-tertiary)",
          }}
          onClick={onCopy}
          onMouseEnter={handleHover}
          onMouseLeave={handleLeave}
          title="Copier"
        >
          <Copy size={14} />
        </button>
      )}
    </div>
  );
}

