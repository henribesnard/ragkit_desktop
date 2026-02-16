import { useGeneralSettings } from "@/hooks/useGeneralSettings";

export function GeneralSettings() {
  const { settings, update } = useGeneralSettings();
  if (!settings) return <div>Chargement…</div>;
  return (
    <div className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-3">
      <h3 className="font-semibold">Mode d'ingestion</h3>
      <select className="border rounded px-2 py-1" value={settings.ingestion_mode} onChange={(e) => update({ ingestion_mode: e.target.value })}>
        <option value="manual">Manuel</option>
        <option value="automatic">Automatique</option>
      </select>
      <div>
        <label className="text-sm">Délai auto-ingestion (s)</label>
        <input type="number" className="border rounded px-2 py-1 ml-2 w-24" value={settings.auto_ingestion_delay} onChange={(e) => update({ auto_ingestion_delay: Number(e.target.value) })} />
      </div>
    </div>
  );
}
