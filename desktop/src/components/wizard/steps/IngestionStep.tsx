import { Eye, Hand } from "lucide-react";
import { useTranslation } from "react-i18next";

export function IngestionStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const ingCfg = state.config?.ingestion || {};
    const generalCfg = state.config?.general || {};
    const expertiseLevel = generalCfg.expertise_level || "simple";
    const calibration = state.config?.calibration_answers || {};
    const autoFromCalibration = !!(calibration.q5 || calibration.q5_frequent_updates);

    const normalizedMode = String(generalCfg.ingestion_mode || "").toLowerCase();
    const ingestionMode = normalizedMode === "automatic" || normalizedMode === "auto"
        ? "automatic"
        : normalizedMode === "manual"
            ? "manual"
            : autoFromCalibration
                ? "automatic"
                : "manual";
    const watchInterval = Number(generalCfg.auto_ingestion_delay ?? 60);

    const updateGeneral = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.general) cfg.general = {};
            cfg.general = { ...cfg.general, ...patch };
            return cfg;
        });
    };

    const setIngestionMode = (mode: "manual" | "automatic") => {
        if (mode === "automatic") {
            updateGeneral({
                ingestion_mode: "automatic",
                auto_ingestion_delay: watchInterval || 60,
            });
            return;
        }
        updateGeneral({ ingestion_mode: "manual" });
    };

    const updateParsing = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.ingestion) cfg.ingestion = {};
            if (!cfg.ingestion.parsing) cfg.ingestion.parsing = {};
            cfg.ingestion.parsing = { ...cfg.ingestion.parsing, ...patch };
            return cfg;
        });
    };

    const updatePreproc = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.ingestion) cfg.ingestion = {};
            if (!cfg.ingestion.preprocessing) cfg.ingestion.preprocessing = {};
            cfg.ingestion.preprocessing = { ...cfg.ingestion.preprocessing, ...patch };
            return cfg;
        });
    };

    const parsing = ingCfg.parsing || {};
    const preproc = ingCfg.preprocessing || {};

    return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6 }}>
                {t('wizard.ingestion.title')}
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginBottom: 22 }}>
                {t('wizard.ingestion.subtitle')}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                {/* Mode d'ingestion */}
                <div className="loko-panel" style={{ padding: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                        {t('wizard.ingestion.mode')}
                    </div>

                    {expertiseLevel === "simple" ? (
                        /* Debutant: simple toggle avec recommandation */
                        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                            <div>
                                <span style={{ display: "block", fontWeight: 500 }}>{t('wizard.ingestion.automatic')}</span>
                                <span style={{ fontSize: 13, color: "var(--text-3)" }}>
                                    {t('wizard.ingestion.autoRecommended')}
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                checked={ingestionMode === "automatic"}
                                onChange={(e) => setIngestionMode(e.target.checked ? "automatic" : "manual")}
                                className="w-5 h-5 text-brand-600 rounded cursor-pointer"
                            />
                        </label>
                    ) : (
                        /* Intermediaire / Avance: choix explicite avec descriptions */
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <button
                                    type="button"
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: 16,
                                        borderRadius: 10,
                                        border: ingestionMode === "manual"
                                            ? "2px solid var(--brand)"
                                            : "1px solid var(--border)",
                                        background: ingestionMode === "manual" ? "var(--brand-weak)" : "transparent",
                                        cursor: "pointer",
                                        transition: "border-color .14s, background .14s",
                                    }}
                                    onClick={() => setIngestionMode("manual")}
                                >
                                    <Hand style={{ width: 24, height: 24, color: ingestionMode === "manual" ? "var(--brand)" : "var(--text-3)" }} />
                                    <span style={{ fontWeight: 500, fontSize: 13, color: ingestionMode === "manual" ? "var(--brand)" : "var(--text)" }}>
                                        {t('wizard.ingestion.manual')}
                                    </span>
                                    <span style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>
                                        {t('wizard.ingestion.manualDesc')}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: 16,
                                        borderRadius: 10,
                                        border: ingestionMode === "automatic"
                                            ? "2px solid var(--brand)"
                                            : "1px solid var(--border)",
                                        background: ingestionMode === "automatic" ? "var(--brand-weak)" : "transparent",
                                        cursor: "pointer",
                                        transition: "border-color .14s, background .14s",
                                    }}
                                    onClick={() => setIngestionMode("automatic")}
                                >
                                    <Eye style={{ width: 24, height: 24, color: ingestionMode === "automatic" ? "var(--brand)" : "var(--text-3)" }} />
                                    <span style={{ fontWeight: 500, fontSize: 13, color: ingestionMode === "automatic" ? "var(--brand)" : "var(--text)" }}>
                                        {t('wizard.ingestion.automatic')}
                                    </span>
                                    <span style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>
                                        {t('wizard.ingestion.autoDesc')}
                                    </span>
                                </button>
                            </div>

                            {/* Avance: intervalle de surveillance */}
                            {expertiseLevel === "expert" && ingestionMode === "automatic" && (
                                <div className="animate-in fade-in slide-in-from-top-2" style={{ paddingTop: 12 }}>
                                    <label style={{ display: "block", fontWeight: 500, marginBottom: 8, fontSize: 13 }}>
                                        {t('wizard.ingestion.watchInterval')}
                                    </label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="300"
                                        step="10"
                                        value={watchInterval}
                                        onChange={(e) => updateGeneral({ auto_ingestion_delay: parseInt(e.target.value, 10) })}
                                        className="w-full cursor-pointer"
                                    />
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
                                        <span>10s</span>
                                        <span style={{ fontWeight: 700, color: "var(--text)" }}>{watchInterval}s</span>
                                        <span>300s</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {/* Parsing Settings */}
                <div className="loko-panel" style={{ padding: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                        {t('wizard.ingestion.parsing')}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <span style={{ display: "block", fontWeight: 500 }}>{t('wizard.ingestion.ocr')}</span>
                                <span style={{ fontSize: 13, color: "var(--text-3)" }}>{t('wizard.ingestion.ocrDesc')}</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={!!parsing.ocr_enabled}
                                onChange={(e) => updateParsing({ ocr_enabled: e.target.checked })}
                                className="toggle-checkbox"
                            />
                        </label>

                        <div style={{ paddingTop: 8 }}>
                            <label style={{ display: "block", fontWeight: 500, marginBottom: 4 }}>{t('wizard.ingestion.tableStrategy')}</label>
                            <select
                                style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: 8, background: "var(--surface)", color: "var(--text)" }}
                                value={parsing.table_extraction_strategy || "preserve"}
                                onChange={(e) => updateParsing({ table_extraction_strategy: e.target.value })}
                            >
                                <option value="markdown">{t('wizard.ingestion.tableMarkdown')}</option>
                                <option value="preserve">{t('wizard.ingestion.tablePreserve')}</option>
                                <option value="separate">{t('wizard.ingestion.tableSeparate')}</option>
                                <option value="ignore">{t('wizard.ingestion.tableIgnore')}</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Preprocessing Settings */}
                <div className="loko-panel" style={{ padding: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                        {t('wizard.ingestion.preprocessing')}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <span style={{ display: "block", fontWeight: 500 }}>{t('wizard.ingestion.cleanWhitespace')}</span>
                                <span style={{ fontSize: 13, color: "var(--text-3)" }}>{t('wizard.ingestion.cleanWhitespaceDesc')}</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={preproc.clean_whitespace !== false}
                                onChange={(e) => updatePreproc({ clean_whitespace: e.target.checked })}
                            />
                        </label>

                        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <span style={{ display: "block", fontWeight: 500 }}>{t('wizard.ingestion.removeUrls')}</span>
                                <span style={{ fontSize: 13, color: "var(--text-3)" }}>{t('wizard.ingestion.removeUrlsDesc')}</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={!!preproc.remove_urls}
                                onChange={(e) => updatePreproc({ remove_urls: e.target.checked })}
                            />
                        </label>

                        <div style={{ paddingTop: 8 }}>
                            <label style={{ display: "block", fontWeight: 500, marginBottom: 4 }}>{t('wizard.ingestion.deduplication')}</label>
                            <select
                                style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: 8, background: "var(--surface)", color: "var(--text)" }}
                                value={preproc.deduplication_strategy || "fuzzy"}
                                onChange={(e) => updatePreproc({ deduplication_strategy: e.target.value })}
                            >
                                <option value="none">{t('wizard.ingestion.dedupNone')}</option>
                                <option value="exact">{t('wizard.ingestion.dedupExact')}</option>
                                <option value="fuzzy">{t('wizard.ingestion.dedupFuzzy')}</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>


        </div>
    );
}
