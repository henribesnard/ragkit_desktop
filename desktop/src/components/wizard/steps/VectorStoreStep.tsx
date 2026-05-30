import { Database } from "lucide-react";
import { useTranslation } from "react-i18next";

export function VectorStoreStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const vsCfg = state.config?.vector_store || {};

    const collectionName = vsCfg.collection_name || "documents";

    const updateVectorStore = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.vector_store) cfg.vector_store = {};
            cfg.vector_store = { ...cfg.vector_store, ...patch };
            return cfg;
        });
    };

    return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6 }}>
                {t('wizard.vectorStore.title')}
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginBottom: 22 }}>
                {t('wizard.vectorStore.subtitle')}
            </p>

            <div className="loko-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, background: "var(--brand-weak)", borderRadius: 10, border: "1px solid var(--brand)" }}>
                    <Database style={{ width: 32, height: 32, color: "var(--brand)", flexShrink: 0 }} />
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{t('wizard.vectorStore.localQdrant')}</div>
                        <p style={{ fontSize: 13, color: "var(--text-2)" }}>
                            {t('wizard.vectorStore.localQdrantDesc')}
                        </p>
                    </div>
                </div>

                <div>
                    <label style={{ display: "block", fontWeight: 500, marginBottom: 4, fontSize: 13 }}>{t('wizard.vectorStore.collectionName')}</label>
                    <input
                        type="text"
                        style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", padding: 8, background: "var(--surface)", color: "var(--text)" }}
                        value={collectionName}
                        onChange={(e) => updateVectorStore({ collection_name: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                    />
                    <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{t('wizard.vectorStore.collectionDesc')}</p>
                </div>
            </div>


        </div>
    );
}
