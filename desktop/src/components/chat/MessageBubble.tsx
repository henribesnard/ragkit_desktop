import type { ReactNode } from "react";
import { LokoGlyph } from "@/components/brand/LokoGlyph";
import type { ChatSource } from "@/hooks/useChat";

interface UserBubbleProps {
    content: string;
}

interface AssistantBubbleProps {
    content: string;
    sources?: ChatSource[] | null;
    metaRow?: ReactNode;
    onCiteClick?: (index: number) => void;
}

/** Render simple markdown: **bold**, *italic*, `code` */
function renderSimpleMarkdown(text: string): ReactNode[] {
    const parts: ReactNode[] = [];
    // Split into segments: **bold**, *italic*, `code`, and plain text
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        // Add plain text before match
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }

        if (match[2]) {
            // **bold**
            parts.push(<b key={match.index}>{match[2]}</b>);
        } else if (match[3]) {
            // *italic*
            parts.push(<i key={match.index}>{match[3]}</i>);
        } else if (match[4]) {
            // `code`
            parts.push(<code key={match.index} className="msg-code">{match[4]}</code>);
        }

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
}

/** Render content with paragraphs and simple markdown */
function renderContent(text: string): ReactNode[] {
    return text.split("\n\n").map((para, pi) => {
        if (!para.trim()) return null;
        const lines = para.split("\n").map((line, li) => (
            <span key={li}>
                {li > 0 && <br />}
                {renderSimpleMarkdown(line)}
            </span>
        ));
        return (
            <p key={pi} style={{ marginBottom: 12 }}>
                {lines}
            </p>
        );
    });
}

export function UserBubble({ content }: UserBubbleProps) {
    return (
        <div style={{ display: "flex", gap: 14, justifyContent: "flex-end", marginBottom: 30 }}>
            <div style={{
                maxWidth: 560,
                background: "var(--brand)",
                color: "var(--brand-fg)",
                padding: "12px 16px",
                borderRadius: "14px 14px 4px 14px",
                fontSize: 14.5,
                lineHeight: 1.55,
            }}>
                <div style={{ whiteSpace: "pre-wrap" }}>{content}</div>
            </div>
            <div style={{
                width: 30, height: 30, borderRadius: 9,
                background: "var(--surface-3)", color: "var(--text-2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 600, flex: "0 0 auto",
            }}>
                SM
            </div>
        </div>
    );
}

export function AssistantBubble({ content, sources, metaRow, onCiteClick }: AssistantBubbleProps) {
    return (
        <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
            <div style={{
                width: 30, height: 30, flex: "0 0 auto",
                filter: "drop-shadow(0 2px 4px rgba(15,125,99,.25))",
            }}>
                <LokoGlyph size={30} radius={8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--text)" }}>
                    {renderContent(content)}
                </div>

                {/* Source citation chips */}
                {sources && sources.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                        <span style={{ fontSize: 12, color: "var(--text-3)", alignSelf: "center", marginRight: 2 }}>
                            Sources :
                        </span>
                        {sources.map((src, i) => (
                            <span
                                key={`${src.chunk_id}-${i}`}
                                className="cite"
                                onClick={() => onCiteClick?.(i)}
                            >
                                <span className="num">{i + 1}</span>
                                {src.title}
                                {src.page ? ` · p.${src.page}` : ""}
                            </span>
                        ))}
                    </div>
                )}

                {/* Meta row (latency, passages, feedback, actions) */}
                {metaRow}
            </div>
        </div>
    );
}
