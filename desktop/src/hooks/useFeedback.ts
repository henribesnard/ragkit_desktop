import { useState } from "react";
import { ipc } from "@/lib/ipc";

export type FeedbackValue = "positive" | "negative";

export function useFeedback() {
  const [pendingByQueryId, setPendingByQueryId] = useState<Record<string, boolean>>({});
  const [valueByQueryId, setValueByQueryId] = useState<Record<string, FeedbackValue>>({});
  const [error, setError] = useState<string | null>(null);

  const submit = async (queryId: string, feedback: FeedbackValue) => {
    if (!queryId) return;
    setPendingByQueryId((prev) => ({ ...prev, [queryId]: true }));
    try {
      await ipc.submitFeedback(queryId, feedback);
      setValueByQueryId((prev) => ({ ...prev, [queryId]: feedback }));
      setError(null);
    } catch (err: any) {
      setError(String(err));
      throw err;
    } finally {
      setPendingByQueryId((prev) => ({ ...prev, [queryId]: false }));
    }
  };

  return {
    submit,
    error,
    pendingByQueryId,
    valueByQueryId,
    setValueByQueryId,
  };
}
