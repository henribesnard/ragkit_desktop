import { useGeneralSettings } from "@/hooks/useGeneralSettings";

export function GeneralSettings() {
  const { settings, loading, error, update } = useGeneralSettings();
  if (loading) return <div>Chargement...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-3">
      <h3 className="font-semibold">Mode d'ingestion</h3>
      <select
        className="border rounded px-2 py-1"
        value={settings.ingestion_mode}
        onChange={(e) => void update({ ingestion_mode: e.target.value as "manual" | "automatic" })}
      >
        <option value="manual">Manuel</option>
        <option value="automatic">Automatique</option>
      </select>
      <div>
        <label className="text-sm">Délai auto-ingestion (s)</label>
        <input
          type="number"
          min={5}
          max={300}
          className="border rounded px-2 py-1 ml-2 w-24"
          value={settings.auto_ingestion_delay}
          onChange={(e) => void update({ auto_ingestion_delay: Number(e.target.value) })}
        />
      </div>
      {settings.ingestion_mode === "automatic" ? (
        <p className="text-xs text-amber-700">En mode automatique, les changements déclenchent une ingestion incrémentale après ce délai.</p>
      ) : (
        <p className="text-xs text-gray-500">En mode manuel, l’ingestion est lancée depuis le tableau de bord.</p>
      )}
    </div>
  );
}

