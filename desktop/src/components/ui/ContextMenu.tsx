import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ContextMenuItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
}

interface ContextMenuSeparator {
    type: "separator";
}

type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

interface ContextMenuProps {
    items: ContextMenuEntry[];
    anchorRef: React.RefObject<HTMLElement | null>;
    open: boolean;
    onClose: () => void;
}

function isSeparator(entry: ContextMenuEntry): entry is ContextMenuSeparator {
    return "type" in entry && entry.type === "separator";
}

export function ContextMenu({ items, anchorRef, open, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (!open || !anchorRef.current) return;
        const rect = anchorRef.current.getBoundingClientRect();
        setPosition({
            top: rect.bottom + 4,
            left: rect.left,
        });
    }, [open, anchorRef]);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div
            ref={menuRef}
            className="animate-scale-in"
            style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                zIndex: 100,
                minWidth: 160,
            }}
        >
            <div
                className="rounded-lg border shadow-lg py-1"
                style={{
                    background: "var(--bg-primary)",
                    borderColor: "var(--border-default)",
                    boxShadow: "var(--shadow-lg)",
                }}
            >
                {items.map((entry, index) => {
                    if (isSeparator(entry)) {
                        return (
                            <div
                                key={`sep-${index}`}
                                className="my-1"
                                style={{
                                    height: 1,
                                    background: "var(--border-default)",
                                    margin: "4px 0",
                                }}
                            />
                        );
                    }
                    return (
                        <button
                            key={entry.label}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors"
                            style={{
                                color: entry.danger ? "var(--error)" : "var(--text-primary)",
                                background: "transparent",
                            }}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.background = "transparent";
                            }}
                            onClick={() => {
                                entry.onClick();
                                onClose();
                            }}
                        >
                            {entry.icon && <span className="w-4 h-4 flex-shrink-0">{entry.icon}</span>}
                            {entry.label}
                        </button>
                    );
                })}
            </div>
        </div>,
        document.body
    );
}
