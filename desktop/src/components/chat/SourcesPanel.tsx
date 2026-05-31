import { useTranslation } from "react-i18next";
import { Quote, List } from "lucide-react";
import type { ChatSource } from "@/hooks/useChat";

interface SourcesPanelProps {
    sources: ChatSource[];
    searchMode: string;
    activeCiteIndex: number | null;
    onCiteClick: (index: number) => void;
}

const SEARCH_MODE_LABELS: Record<string, string> = {
    semantic: "Sémantique",
    lexical: "Lexicale",
    hybrid: "Hybride",
};

export function SourcesPanel({ sources, searchMode, activeCiteIndex, onCiteClick }: SourcesPanelProps) {
    const { t } = useTranslation();

    if (sources.length === 0) return null;

    return (
        <aside className="sources-panel">
            <div className="sources-panel-header">
                <Quote size={16} style={{ color: "var(--brand)" }} />
                <span className="title">{t("chat.sourcesCited", "Sources citées")}</span>
                <span className="loko-badge loko-badge-neutral" style={{ marginLeft: "auto" }}>
                    {sources.length}
                </span>
            </div>
            <div className="sources-panel-body loko-scroll">
                {sources.map((src, i) => {
                    const isActive = activeCiteIndex === i;
                    const scorePercent = Math.round((src.score ?? 0) * 100);
                    return (
                        <div
                            key={`${src.chunk_id}-${i}`}
                            className={`source-card${isActive ? " active" : ""}`}
                            onClick={() => onCiteClick(i)}
                            style={{ cursor: "pointer" }}
                        >
                            {/* Header: number + filename + page */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                                <span className="cite-sup" style={{ marginTop: 1 }}>{i + 1}</span>
                                <span style={{
                                    fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0,
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>
                                    {src.title}
                                </span>
                                {src.page && (
                                    <span className="loko-badge loko-badge-neutral" style={{
                                        fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
                                    }}>
                                        p.{src.page}
                                    </span>
                                )}
                            </div>

                            {/* Snippet */}
                            {src.text_preview && (
                                <div style={{
                                    fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 11,
                                    overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                                }}>
                                    &ldquo;{src.text_preview}&rdquo;
                                </div>
                            )}

                            {/* Relevance bar */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div className="relevance-bar">
                                    <div className="fill" style={{ width: `${scorePercent}%` }} />
                                </div>
                                <span style={{
                                    fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-2)",
                                }}>
                                    {scorePercent}%
                                </span>
                                <span className="loko-badge loko-badge-neutral" style={{ height: 19, fontSize: 10.5 }}>
                                    {SEARCH_MODE_LABELS[searchMode] || searchMode}
                                </span>
                            </div>
                        </div>
                    );
                })}
                {sources.length > 3 && (
                    <button
                        className="btn btn-ghost btn-sm"
                        style={{ alignSelf: "center", marginTop: 2 }}
                    >
                        <List size={14} />
                        {t("chat.viewAllPassages", "Voir les {{count}} passages", { count: sources.length })}
                    </button>
                )}
            </div>
        </aside>
    );
}
