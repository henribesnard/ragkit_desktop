import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import { ExpertiseLevelSelector } from "@/components/settings/ExpertiseLevelSelector";
import { ExportImportPanel } from "@/components/settings/ExportImportPanel";

export function GeneralSettings() {
  const { t } = useTranslation();
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

  if (loading) return <div>{t("common.loading", "Chargement...")}</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      {/* Expertise Level */}
      <ExpertiseLevelSelector />

      {/* Ingestion Mode */}
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
        <h3 className="font-semibold">{t("general.ingestionMode", "Mode d'ingestion")}</h3>
        <select
          className="border rounded px-2 py-1"
          value={settings.ingestion_mode}
          onChange={(e) => void update({ ingestion_mode: e.target.value as "manual" | "automatic" })}
        >
          <option value="manual">{t("general.manual", "Manuel")}</option>
          <option value="automatic">{t("general.automatic", "Automatique")}</option>
        </select>
        <div>
          <label className="text-sm">{t("general.autoDelay", "Delai auto-ingestion (s)")}</label>
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
          <p className="text-xs text-amber-700">{t("general.autoDesc", "En mode automatique, les changements declenchent une ingestion incrementale apres ce delai.")}</p>
        ) : (
          <p className="text-xs text-gray-500">{t("general.manualDesc", "En mode manuel, l'ingestion est lancee depuis le tableau de bord.")}</p>
        )}
      </section>

      {/* Search Type */}
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
        <h3 className="font-semibold">{t("general.searchType", "Type de recherche")}</h3>
        <div className="space-y-2 text-sm">
          <label className={`flex items-center gap-2 ${!semanticEnabled ? "text-gray-400" : ""}`}>
            <input
              type="radio"
              name="search_type"
              disabled={!semanticEnabled}
              checked={settings.search_type === "semantic"}
              onChange={() => void update({ search_type: "semantic" })}
            />
            {t("general.semantic", "Semantique seule")}
          </label>
          <label className={`flex items-center gap-2 ${!lexicalEnabled ? "text-gray-400" : ""}`}>
            <input
              type="radio"
              name="search_type"
              disabled={!lexicalEnabled}
              checked={settings.search_type === "lexical"}
              onChange={() => void update({ search_type: "lexical" })}
            />
            {t("general.lexical", "Lexicale seule")}
          </label>
          <label className={`flex items-center gap-2 ${!semanticEnabled || !lexicalEnabled ? "text-gray-400" : ""}`}>
            <input
              type="radio"
              name="search_type"
              disabled={!semanticEnabled || !lexicalEnabled}
              checked={settings.search_type === "hybrid"}
              onChange={() => void update({ search_type: "hybrid" })}
            />
            {t("general.hybrid", "Hybride")}
          </label>
        </div>
      </section>

      {/* LLM */}
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-3">
        <h3 className="font-semibold">{t("general.llm", "LLM (generation)")}</h3>
        <div>
          <label className="text-sm">{t("general.llmModel", "Modele LLM")}</label>
          <input
            className="border rounded px-2 py-1 ml-2 w-72"
            value={settings.llm_model}
            onChange={(e) => void update({ llm_model: e.target.value })}
            placeholder="openai/gpt-4o-mini"
          />
        </div>
        <div>
          <label className="text-sm">{t("general.temperature", "Temperature")} ({settings.llm_temperature.toFixed(2)})</label>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            className="ml-2 align-middle"
            value={settings.llm_temperature}
            onChange={(e) => void update({ llm_temperature: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="text-sm">{t("general.responseLang", "Langue de reponse")}</label>
          <select
            className="border rounded px-2 py-1 ml-2"
            value={settings.response_language}
            onChange={(e) => void update({ response_language: e.target.value as "auto" | "fr" | "en" })}
          >
            <option value="auto">Auto</option>
            <option value="fr">Francais</option>
            <option value="en">English</option>
          </select>
        </div>
      </section>

      {/* Export / Import */}
      <ExportImportPanel />
    </div>
  );
}
