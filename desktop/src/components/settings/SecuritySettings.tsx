import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSecurityConfig } from "@/hooks/useSecurityConfig";

const PII_TYPE_LABELS: Record<string, string> = {
  email: "Emails",
  phone: "Telephones",
  ssn: "SSN",
  address: "Adresses",
  credit_card: "Cartes bancaires",
  iban: "IBAN",
};

export function SecuritySettings() {
  const { t } = useTranslation();
  const { config, apiKeys, loading, saving, error, update, reset, purgeAll } = useSecurityConfig();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);

  if (loading) return <div className="p-6">{t("common.loading", "Chargement...")}</div>;

  const handleSave = async () => {
    try {
      await update(config);
      setMsg(t("common.saved", "Sauvegarde reussie"));
      setTimeout(() => setMsg(null), 3000);
    } catch { /* error set by hook */ }
  };

  const handlePurge = async () => {
    if (!confirmPurge) {
      setConfirmPurge(true);
      return;
    }
    try {
      await purgeAll();
      setMsg(t("security.purged", "Toutes les donnees locales ont ete supprimees"));
      setConfirmPurge(false);
      setTimeout(() => setMsg(null), 3000);
    } catch { /* error set by hook */ }
  };

  return (
    <div className="space-y-6">
      {/* API Keys Status */}
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-3">
        <h3 className="font-semibold text-lg">{t("security.apiKeys", "Cles API")}</h3>
        <div className="space-y-2">
          {apiKeys.map((key) => (
            <div key={key.provider} className="flex items-center justify-between py-1">
              <span className="capitalize font-medium">{key.provider}</span>
              <span className={key.configured ? "text-green-600 font-medium text-sm" : "text-gray-500 text-sm"}>
                {key.configured ? "✓ Clé système trouvée" : "X Absente"}
              </span>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500">
          {t("security.keyringInfo", "Les cles sont stockees dans le trousseau systeme natif.")}
        </p>
      </section>

      {/* Log Encryption */}
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-3">
        <h3 className="font-semibold text-lg">{t("security.logEncryption", "Chiffrement des logs")}</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.encrypt_logs}
            onChange={(e) => update({ encrypt_logs: e.target.checked })}
            className="w-4 h-4"
          />
          <span>{t("security.encryptLogs", "Chiffrer les journaux de requetes")}</span>
        </label>
        <p className="text-sm text-gray-500">
          {t("security.encryptLogsDesc", "Active le chiffrement AES-256 des donnees sensibles dans les journaux.")}
        </p>
      </section>

      {/* PII Detection */}
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-3">
        <h3 className="font-semibold text-lg">{t("security.piiDetection", "Donnees personnelles (PII)")}</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.pii_detection}
            onChange={(e) => update({ pii_detection: e.target.checked })}
            className="w-4 h-4"
          />
          <span>{t("security.enablePII", "Activer la detection PII")}</span>
        </label>

        {config.pii_detection && (
          <>
            <div className="flex flex-wrap gap-3 mt-2">
              {Object.entries(PII_TYPE_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={config.pii_types.includes(key)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...config.pii_types, key]
                        : config.pii_types.filter((t) => t !== key);
                      update({ pii_types: next });
                    }}
                    className="w-3.5 h-3.5"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="space-y-1 mt-2">
              <label className="text-sm font-medium">{t("security.piiAction", "Action en cas de detection")}</label>
              <div className="flex gap-4">
                {(["warn", "anonymize", "exclude"] as const).map((action) => (
                  <label key={action} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="pii_action"
                      checked={config.pii_action === action}
                      onChange={() => update({ pii_action: action })}
                    />
                    {action === "warn" && t("security.actionWarn", "Avertir")}
                    {action === "anonymize" && t("security.actionAnonymize", "Anonymiser")}
                    {action === "exclude" && t("security.actionExclude", "Exclure")}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Retention */}
      <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-3">
        <h3 className="font-semibold text-lg">{t("security.retention", "Retention")}</h3>
        <div className="flex items-center gap-3">
          <label className="text-sm">{t("security.retentionDays", "Retention des logs (jours)")}</label>
          <input
            type="number"
            min={1}
            max={365}
            value={config.log_retention_days}
            onChange={(e) => update({ log_retention_days: Number(e.target.value) || 30 })}
            className="w-20 px-2 py-1 border rounded"
          />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.auto_purge}
            onChange={(e) => update({ auto_purge: e.target.checked })}
            className="w-4 h-4"
          />
          <span>{t("security.autoPurge", "Purge automatique au demarrage")}</span>
        </label>
      </section>

      {/* Danger Zone */}
      <section className="p-4 border border-red-300 rounded-lg bg-white dark:bg-gray-900 space-y-3">
        <h3 className="font-semibold text-lg text-red-600">{t("security.dangerZone", "Zone de danger")}</h3>
        <button
          onClick={handlePurge}
          className={`px-4 py-2 rounded text-white ${confirmPurge ? "bg-red-700" : "bg-red-500 hover:bg-red-600"}`}
        >
          {confirmPurge
            ? t("security.confirmPurge", "Confirmer la suppression de TOUTES les donnees")
            : t("security.purgeAll", "Supprimer toutes les donnees locales")}
        </button>
        {confirmPurge && (
          <button
            onClick={() => setConfirmPurge(false)}
            className="ml-2 px-4 py-2 border rounded hover:bg-gray-100"
          >
            {t("common.cancel", "Annuler")}
          </button>
        )}
      </section>

      {/* Privacy Info */}
      <section className="p-4 border rounded-lg bg-green-50 dark:bg-green-950 space-y-2">
        <h3 className="font-semibold text-lg">{t("security.privacyInfo", "Informations de confidentialite")}</h3>
        <ul className="text-sm space-y-1 text-green-800 dark:text-green-300">
          <li>{t("security.privacy1", "Toutes les donnees sont stockees localement")}</li>
          <li>{t("security.privacy2", "Aucune telemetrie, aucun tracking")}</li>
          <li>{t("security.privacy3", "Les API externes ne sont appelees que pour les fonctionnalites choisies")}</li>
          <li>{t("security.privacy4", "Communication frontend-backend en localhost")}</li>
        </ul>
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t("common.saving", "Sauvegarde...") : t("common.save", "Sauvegarder")}
        </button>
        <button
          onClick={reset}
          disabled={saving}
          className="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
        >
          {t("common.reset", "Reinitialiser")}
        </button>
      </div>

      {msg && <p className="text-green-600 text-sm">{msg}</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
