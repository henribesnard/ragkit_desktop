import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useConfigExport, ImportPreview } from "@/hooks/useConfigExport";
import { save, open } from "@tauri-apps/plugin-dialog";

export function ExportImportPanel() {
  const { t } = useTranslation();
  const { exporting, importing, preview, error, exportConfig, validateImport, importConfig } = useConfigExport();
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");
  const [importPath, setImportPath] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      const path = await save({
        defaultPath: "ragkit-config.ragkit-config",
        filters: [{ name: "RAGKIT Config", extensions: ["ragkit-config"] }],
      });
      if (!path) return;
      await exportConfig(path);
      setMsg(t("config.exportSuccess", "Configuration exportee avec succes"));
      setTimeout(() => setMsg(null), 3000);
    } catch { /* error set by hook */ }
  };

  const handleSelectImport = async () => {
    try {
      const path = await open({
        filters: [{ name: "RAGKIT Config", extensions: ["ragkit-config"] }],
        multiple: false,
      });
      if (!path) return;
      const filePath = typeof path === "string" ? path : path;
      setImportPath(filePath);
      await validateImport(filePath);
    } catch { /* error set by hook */ }
  };

  const handleImport = async () => {
    if (!importPath) return;
    try {
      await importConfig(importPath, importMode);
      setMsg(t("config.importSuccess", "Configuration importee avec succes"));
      setImportPath("");
      setTimeout(() => setMsg(null), 3000);
    } catch { /* error set by hook */ }
  };

  return (
    <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-4">
      <h3 className="font-semibold text-lg">{t("config.exportImport", "Export / Import de configuration")}</h3>

      <div className="flex gap-3">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {exporting ? t("config.exporting", "Export en cours...") : t("config.export", "Exporter")}
        </button>

        <button
          onClick={handleSelectImport}
          disabled={importing}
          className="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
        >
          {t("config.import", "Importer")}
        </button>
      </div>

      {/* Import Preview */}
      {preview && (
        <div className="p-3 border rounded bg-gray-50 dark:bg-gray-800 space-y-3">
          <h4 className="font-medium">{t("config.importPreview", "Apercu de l'import")}</h4>
          <div className="text-sm space-y-1">
            <p>{t("config.version", "Version")} : {preview.version}</p>
            {preview.export_date && <p>{t("config.exportDate", "Date d'export")} : {preview.export_date}</p>}
            {preview.profile && <p>{t("config.profile", "Profil")} : {preview.profile}</p>}
          </div>

          <p className="text-sm text-amber-600">
            {t("config.noApiKeys", "Les cles API ne sont pas incluses dans l'import.")}
          </p>

          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                checked={importMode === "replace"}
                onChange={() => setImportMode("replace")}
              />
              {t("config.replace", "Remplacer")}
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                checked={importMode === "merge"}
                onChange={() => setImportMode("merge")}
              />
              {t("config.merge", "Fusionner")}
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {importing ? t("config.importing", "Import en cours...") : t("config.confirmImport", "Importer")}
            </button>
            <button
              onClick={() => setImportPath("")}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              {t("common.cancel", "Annuler")}
            </button>
          </div>
        </div>
      )}

      {msg && <p className="text-green-600 text-sm">{msg}</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </section>
  );
}
