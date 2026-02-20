import { useEffect, useState, useCallback } from "react";
import { ipc } from "@/lib/ipc";

export type ExpertiseLevel = "simple" | "intermediate" | "expert";

export function useExpertiseLevel() {
  const [level, setLevel] = useState<ExpertiseLevel>("simple");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await ipc.getGeneralSettings() as any;
      const l = payload?.expertise_level || "simple";
      setLevel(l as ExpertiseLevel);
      setError(null);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const setExpertise = useCallback(async (newLevel: ExpertiseLevel) => {
    try {
      await ipc.setExpertiseLevel(newLevel);
      setLevel(newLevel);
      setError(null);
    } catch (err: any) {
      setError(String(err));
      throw err;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { level, loading, error, setExpertise, refresh };
}
