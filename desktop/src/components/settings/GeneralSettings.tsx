import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";

export function GeneralSettings() {
  const { settings, loading, error, update } = useGeneralSettings();
  const [semanticEnabled, setSemanticEnabled] = useState(true);
  const [lexicalEnabled, setLexicalEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [semantic, lexical] = await Promise.all([
          invoke<{ enabled?: boolean }>("get_semantic_search_config"),
          invoke<{ enabled?: boolean }>("get_lexical_search_config"),
        ]);
        if (cancelled) return;
        setSemanticEnabled(Boolean(semantic.enabled ?? true));
        setLexicalEnabled(Boolean(lexical.enabled ?? true));
      } catch {
        if (!cancelled) {
          setSemanticEnabled(true);
          setLexicalEnabled(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div>Chargement...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
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
        <label className="text-sm">Delai auto-ingestion (s)</label>
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
        <p className="text-xs text-amber-700">En mode automatique, les changements declenchent une ingestion incrementale apres ce delai.</p>
      ) : (
        <p className="text-xs text-gray-500">En mode manuel, l'ingestion est lancee depuis le tableau de bord.</p>
      )}

      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold mb-2">Type de recherche</h3>
        <div className="space-y-2 text-sm">
          <label className={`flex items-center gap-2 ${!semanticEnabled ? "text-gray-400" : ""}`}>
            <input
              type="radio"
              name="search_type"
              disabled={!semanticEnabled}
              checked={settings.search_type === "semantic"}
              onChange={() => void update({ search_type: "semantic" })}
            />
            Semantique seule
          </label>

          <label className={`flex items-center gap-2 ${!lexicalEnabled ? "text-gray-400" : ""}`}>
            <input
              type="radio"
              name="search_type"
              disabled={!lexicalEnabled}
              checked={settings.search_type === "lexical"}
              onChange={() => void update({ search_type: "lexical" })}
            />
            Lexicale seule
          </label>

          <label className={`flex items-center gap-2 ${!semanticEnabled || !lexicalEnabled ? "text-gray-400" : ""}`}>
            <input
              type="radio"
              name="search_type"
              disabled={!semanticEnabled || !lexicalEnabled}
              checked={settings.search_type === "hybrid"}
              onChange={() => void update({ search_type: "hybrid" })}
            />
            Hybride
          </label>
        </div>
      </div>
    </div>
  );
}
