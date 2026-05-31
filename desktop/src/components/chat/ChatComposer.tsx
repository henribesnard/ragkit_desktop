import { FormEvent, useEffect, useRef } from "react";
import { ArrowUp, Lock, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ChatComposerProps {
    query: string;
    onQueryChange: (value: string) => void;
    onSubmit: (event: FormEvent) => void;
    searchMode: string;
    isStreaming: boolean;
    isIngesting: boolean;
    disabled: boolean;
    placeholder: string;
}

const MODE_LABELS: Record<string, string> = {
    semantic: "Sémantique",
    lexical: "Lexicale",
    hybrid: "Hybride",
};

export function ChatComposer({
    query, onQueryChange, onSubmit, searchMode,
    isStreaming, isIngesting, disabled, placeholder,
}: ChatComposerProps) {
    const { t } = useTranslation();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }, [query]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit(e as unknown as FormEvent);
        }
    };

    const canSend = query.trim() && !disabled && !isStreaming && !isIngesting;

    return (
        <div style={{
            padding: "14px 32px 20px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg)",
        }}>
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
                {isIngesting && (
                    <div className="mb-2 p-3 rounded-lg flex items-center gap-2 text-sm"
                        style={{
                            background: "var(--warn-bg)",
                            border: "1px solid var(--border)",
                            color: "var(--warn)",
                        }}
                    >
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        {t("chat.ingestionInProgress")}
                    </div>
                )}

                <form onSubmit={onSubmit}>
                    <div className="card" style={{
                        padding: 10, display: "flex", alignItems: "flex-end", gap: 8, borderRadius: 14,
                    }}>
                        <textarea
                            ref={textareaRef}
                            value={query}
                            onChange={(e) => onQueryChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            disabled={disabled || isStreaming}
                            rows={1}
                            style={{
                                flex: 1, padding: "8px 2px", fontSize: 14.5, color: "var(--text)",
                                background: "transparent", border: "none", outline: "none", resize: "none",
                                fontFamily: "var(--font-sans)", minHeight: 24, maxHeight: 200, lineHeight: 1.5,
                            }}
                        />
                        <span className="loko-badge loko-badge-neutral" style={{
                            flex: "0 0 auto", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
                        }}>
                            {MODE_LABELS[searchMode] || searchMode}
                        </span>
                        <button
                            type="submit"
                            disabled={!canSend}
                            className="btn btn-primary btn-icon"
                            style={{ flex: "0 0 auto", width: 36, height: 36, borderRadius: 10 }}
                        >
                            {isStreaming ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <ArrowUp size={18} />
                            )}
                        </button>
                    </div>
                </form>

                <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    marginTop: 9, justifyContent: "center",
                }}>
                    <Lock size={12} style={{ color: "var(--text-3)" }} />
                    <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                        {t("chat.localDisclaimer", "Requête traitée localement — rien n'est envoyé sur Internet.")}
                    </span>
                </div>
            </div>
        </div>
    );
}
