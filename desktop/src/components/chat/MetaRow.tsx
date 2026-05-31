import { Zap, Layers, Cpu, Copy } from "lucide-react";
import type { ReactNode } from "react";

interface MetaRowProps {
    sourcesCount: number;
    elapsedMs?: number;
    modelName?: string;
    onCopy: () => void;
    feedbackNode?: ReactNode;
}

export function MetaRow({ sourcesCount, elapsedMs, modelName, onCopy, feedbackNode }: MetaRowProps) {
    return (
        <div className="chat-meta">
            {elapsedMs != null && elapsedMs > 0 && (
                <span className="meta-item">
                    <Zap size={13} style={{ color: "var(--brand)" }} />
                    {elapsedMs} ms
                </span>
            )}
            {sourcesCount > 0 && (
                <span className="meta-item">
                    <Layers size={13} />
                    {sourcesCount} passages
                </span>
            )}
            {modelName && (
                <span className="meta-item">
                    <Cpu size={13} />
                    {modelName}
                </span>
            )}
            <div style={{ flex: 1 }} />
            <button className="btn btn-ghost btn-sm btn-icon" onClick={onCopy} title="Copier">
                <Copy size={15} />
            </button>
            {feedbackNode}
        </div>
    );
}
