import { Button } from "@/components/ui/Button";

interface FeedbackButtonsProps {
  queryId?: string | null;
  value?: "positive" | "negative" | null;
  loading?: boolean;
  onSubmit: (queryId: string, feedback: "positive" | "negative") => Promise<void> | void;
}

export function FeedbackButtons({ queryId, value, loading, onSubmit }: FeedbackButtonsProps) {
  if (!queryId) return null;

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={value === "positive" ? "default" : "outline"}
        disabled={loading}
        onClick={() => void onSubmit(queryId, "positive")}
      >
        👍
      </Button>
      <Button
        size="sm"
        variant={value === "negative" ? "default" : "outline"}
        disabled={loading}
        onClick={() => void onSubmit(queryId, "negative")}
      >
        👎
      </Button>
    </div>
  );
}
