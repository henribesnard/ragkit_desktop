import { Button } from "@/components/ui/Button";
import { useIngestionControl } from "@/hooks/useIngestionControl";

function secondsLabel(value: number | null | undefined): string {
  if (!value && value !== 0) return "n/a";
  return `${Math.max(0, Math.round(value))} s`;
}

export function DashboardPanels() {
  const { status, changes, history, logs, loading, error, start, pause, resume, cancel, restore } = useIngestionControl();

  const progressRatio = status?.doc_total ? Math.min(100, Math.round((status.doc_index / status.doc_total) * 100)) : 0;
  const lastHistory = history[0];

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Chargement des données d'ingestion...</p>}

      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-2">
        <h3 className="font-semibold">État de la base de connaissances</h3>
        <p>Statut: <b>{status?.status ?? "idle"}</b> · Version: <b>{status?.version ?? "v0"}</b></p>
        <p>Phase: <b>{status?.phase ?? "idle"}</b> · Document: <b>{status?.current_doc ?? "—"}</b></p>
        <p>Chunks indexés: <b>{status?.total_chunks ?? 0}</b></p>
        <p>Dernière ingestion: <b>{lastHistory?.completed_at ?? "n/a"}</b></p>
      </section>

      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-2">
        <h3 className="font-semibold">Changements détectés</h3>
        <p>Ajoutés: <b>{changes?.added ?? 0}</b> · Modifiés: <b>{changes?.modified ?? 0}</b> · Supprimés: <b>{changes?.removed ?? 0}</b></p>
        <div className="max-h-28 overflow-auto text-xs space-y-1">
          {(changes?.changes || []).slice(0, 20).map((change: any) => (
            <div key={`${change.type}:${change.path}`} className="flex gap-2">
              <span className="w-16 uppercase">{change.type}</span>
              <span className="truncate">{change.path}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-3">
        <h3 className="font-semibold">Progression</h3>
        <div className="h-2 rounded bg-gray-200 overflow-hidden">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${progressRatio}%` }} />
        </div>
        <p className="text-sm">{status?.doc_index ?? 0}/{status?.doc_total ?? 0} documents · {progressRatio}%</p>
        <p className="text-xs text-gray-500">
          Temps écoulé: {secondsLabel(status?.elapsed_seconds)} · Temps restant estimé: {secondsLabel(status?.estimated_remaining_seconds)}
        </p>
        <p className="text-xs text-gray-500">
          Réussis: {status?.docs_succeeded ?? 0} · Avertissements: {status?.docs_warnings ?? 0} · Échecs: {status?.docs_failed ?? 0}
        </p>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Button onClick={() => void start(false)}>Lancer l'ingestion</Button>
          <Button variant="outline" onClick={() => void start(true)}>Ingestion incrémentale</Button>
          <Button variant="outline" onClick={() => void pause()}>Pause</Button>
          <Button variant="outline" onClick={() => void resume()}>Reprendre</Button>
          <Button variant="ghost" onClick={() => {
            if (confirm("Annuler l'ingestion en cours ?")) {
              void cancel();
            }
          }}>Annuler</Button>
        </div>
      </section>

      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900">
        <h3 className="font-semibold">Historique des ingestions</h3>
        <ul className="text-sm space-y-1 mt-2">
          {history.map((entry) => (
            <li key={entry.version} className="flex justify-between gap-4">
              <span>
                {entry.version} · {entry.status} · {entry.total_docs} docs · {entry.total_chunks} chunks
              </span>
              <button className="underline" onClick={() => void restore(entry.version)}>Restaurer</button>
            </li>
          ))}
          {!history.length && <li className="text-gray-500">Aucune ingestion enregistrée.</li>}
        </ul>
      </section>

      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900">
        <h3 className="font-semibold">Journal d'ingestion</h3>
        <div className="max-h-56 overflow-auto text-xs space-y-1 mt-2">
          {logs.map((line, index) => (
            <div key={index}>
              {line.timestamp} [{line.level}] {line.message}
            </div>
          ))}
          {!logs.length && <div className="text-gray-500">Aucune entrée.</div>}
        </div>
      </section>
    </div>
  );
}

