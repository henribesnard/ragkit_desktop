import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useBM25IndexStats } from "@/hooks/useBM25IndexStats";

function formatBytes(value: number): string {
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function BM25IndexStatusPanel() {
  const { stats, loading, refreshing, error, rebuildIndex } = useBM25IndexStats();
  const [rebuildMessage, setRebuildMessage] = useState<string | null>(null);

  const onRebuild = async () => {
    setRebuildMessage(null);
    try {
      const result = await rebuildIndex();
      setRebuildMessage(`Index reconstruit en ${result.duration_s.toFixed(2)}s`);
    } catch (err: any) {
      setRebuildMessage(String(err));
    }
  };

  return (
    <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
      <h3 className="font-semibold">Etat de l'index BM25</h3>

      {loading ? (
        <div className="text-sm text-gray-500">Chargement...</div>
      ) : (
        <div className="text-sm space-y-1 text-gray-700 dark:text-gray-200">
          <div>
            Documents: <b>{stats.num_documents}</b> | Termes uniques: <b>{stats.num_unique_terms}</b>
          </div>
          <div>
            Taille: <b>{formatBytes(stats.size_bytes)}</b>
          </div>
          <div>
            Derniere mise a jour: <b>{stats.last_updated_version || "n/a"}</b> {stats.last_updated_at ? `(${stats.last_updated_at})` : ""}
          </div>
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}
      {rebuildMessage && <div className="text-sm text-blue-700">{rebuildMessage}</div>}

      <Button variant="outline" onClick={onRebuild} disabled={refreshing}>
        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
        Reconstruire l'index
      </Button>
    </section>
  );
}
