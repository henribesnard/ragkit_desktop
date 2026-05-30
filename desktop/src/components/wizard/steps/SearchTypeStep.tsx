import { Search, TextSearch, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SearchTypeStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const searchType = state.config?.retrieval?.search_type || "hybrid";

    const setType = (t: "semantic" | "lexical" | "hybrid") => {
        updateConfig((cfg: any) => {
            if (!cfg.retrieval) cfg.retrieval = {};
            cfg.retrieval.search_type = t;
            return cfg;
        });
    };

    return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6 }}>
                {t('wizard.searchType.title')}
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginBottom: 22 }}>
                {t('wizard.searchType.subtitle')}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                <button
                    onClick={() => setType("hybrid")}
                    style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 16,
                        padding: 20,
                        borderRadius: 14,
                        border: searchType === "hybrid" ? "2px solid var(--brand)" : "1px solid var(--border)",
                        background: searchType === "hybrid" ? "var(--brand-weak)" : "var(--surface)",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "border-color .14s, background .14s",
                    }}
                >
                    <div style={{
                        padding: 12,
                        borderRadius: 10,
                        background: searchType === "hybrid" ? "var(--brand)" : "var(--surface-2)",
                        color: searchType === "hybrid" ? "var(--brand-fg)" : "var(--text-3)",
                    }}>
                        <Layers style={{ width: 24, height: 24 }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>{t('wizard.searchType.hybrid')}</div>
                        <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.5 }}>{t('wizard.searchType.hybridDesc')}</p>
                    </div>
                </button>

                <button
                    onClick={() => setType("semantic")}
                    style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 16,
                        padding: 20,
                        borderRadius: 14,
                        border: searchType === "semantic" ? "2px solid var(--brand)" : "1px solid var(--border)",
                        background: searchType === "semantic" ? "var(--brand-weak)" : "var(--surface)",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "border-color .14s, background .14s",
                    }}
                >
                    <div style={{
                        padding: 12,
                        borderRadius: 10,
                        background: searchType === "semantic" ? "var(--brand)" : "var(--surface-2)",
                        color: searchType === "semantic" ? "var(--brand-fg)" : "var(--text-3)",
                    }}>
                        <Search style={{ width: 24, height: 24 }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>{t('wizard.searchType.semantic')}</div>
                        <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.5 }}>{t('wizard.searchType.semanticDesc')}</p>
                    </div>
                </button>

                <button
                    onClick={() => setType("lexical")}
                    style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 16,
                        padding: 20,
                        borderRadius: 14,
                        border: searchType === "lexical" ? "2px solid var(--brand)" : "1px solid var(--border)",
                        background: searchType === "lexical" ? "var(--brand-weak)" : "var(--surface)",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "border-color .14s, background .14s",
                    }}
                >
                    <div style={{
                        padding: 12,
                        borderRadius: 10,
                        background: searchType === "lexical" ? "var(--brand)" : "var(--surface-2)",
                        color: searchType === "lexical" ? "var(--brand-fg)" : "var(--text-3)",
                    }}>
                        <TextSearch style={{ width: 24, height: 24 }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>{t('wizard.searchType.lexical')}</div>
                        <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.5 }}>{t('wizard.searchType.lexicalDesc')}</p>
                    </div>
                </button>
            </div>


        </div>
    );
}
