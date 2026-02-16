import { useIngestionControl } from "@/hooks/useIngestionControl";

export function DashboardPanels() {
  const { status, changes, history, logs, start, pause, resume, cancel, restore } = useIngestionControl();
  return (
    <div className="space-y-4">
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900">
        <h3 className="font-semibold">État de la base</h3>
        <p>Statut: {status?.status ?? "idle"} · Version: {status?.version ?? "v0"}</p>
        <p>{status?.total_chunks ?? 0} chunks · doc {status?.doc_index ?? 0}/{status?.doc_total ?? 0}</p>
      </section>
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900">
        <h3 className="font-semibold">Changements détectés</h3>
        <p>+{changes?.added ?? 0} ~{changes?.modified ?? 0} -{changes?.removed ?? 0}</p>
        <div className="flex gap-2 mt-2 flex-wrap">
          <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={() => start(false)}>Lancer l'ingestion</button>
          <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={() => start(true)}>Ingestion incrémentale</button>
          <button className="px-3 py-2 rounded border" onClick={pause}>Pause</button>
          <button className="px-3 py-2 rounded border" onClick={resume}>Reprendre</button>
          <button className="px-3 py-2 rounded border" onClick={cancel}>Annuler</button>
        </div>
      </section>
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900">
        <h3 className="font-semibold">Historique</h3>
        <ul className="text-sm space-y-1">
          {history.map((h) => (
            <li key={h.version} className="flex justify-between gap-4"><span>{h.version} · {h.status} · {h.total_docs} docs</span><button className="underline" onClick={() => restore(h.version)}>Restaurer</button></li>
          ))}
        </ul>
      </section>
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900">
        <h3 className="font-semibold">Journal d'ingestion</h3>
        <div className="max-h-48 overflow-auto text-xs space-y-1">
          {logs.map((l, i) => <div key={i}>{l.timestamp} [{l.level}] {l.message}</div>)}
        </div>
      </section>
    </div>
  );
}
