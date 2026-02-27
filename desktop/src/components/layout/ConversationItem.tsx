import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, Pencil, Archive, Trash2, Undo2 } from "lucide-react";
import { ContextMenu } from "../ui/ContextMenu";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import type { ConversationListItem } from "../../hooks/useConversations";

interface ConversationItemProps {
    conversation: ConversationListItem;
    isActive: boolean;
    onClick: () => void;
    onRename: (title: string) => void;
    onArchive: () => void;
    onDelete: () => void;
    onRestore?: () => void;
    isArchiveView?: boolean;
}

export function ConversationItem({
    conversation,
    isActive,
    onClick,
    onRename,
    onArchive,
    onDelete,
    onRestore,
    isArchiveView = false,
}: ConversationItemProps) {
    const { t } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(conversation.title);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const menuBtnRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const displayTitle = conversation.title || t("sidebar.newChat");

    const handleRename = () => {
        if (editTitle.trim() && editTitle.trim() !== conversation.title) {
            onRename(editTitle.trim());
        }
        setIsEditing(false);
    };

    const menuItems = isArchiveView
        ? [
            {
                label: t("sidebar.restore"),
                icon: <Undo2 size={14} />,
                onClick: () => onRestore?.(),
            },
            { type: "separator" as const },
            {
                label: t("sidebar.delete"),
                icon: <Trash2 size={14} />,
                onClick: () => setConfirmDelete(true),
                danger: true,
            },
        ]
        : [
            {
                label: t("sidebar.rename"),
                icon: <Pencil size={14} />,
                onClick: () => {
                    setEditTitle(conversation.title);
                    setIsEditing(true);
                    setTimeout(() => inputRef.current?.focus(), 50);
                },
            },
            {
                label: t("sidebar.archive"),
                icon: <Archive size={14} />,
                onClick: () => onArchive(),
            },
            { type: "separator" as const },
            {
                label: t("sidebar.delete"),
                icon: <Trash2 size={14} />,
                onClick: () => setConfirmDelete(true),
                danger: true,
            },
        ];

    return (
        <>
            <div
                className="group relative flex items-center cursor-pointer transition-colors"
                style={{
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    background: isActive ? "var(--bg-hover)" : "transparent",
                    borderLeft: isActive ? "2px solid var(--primary-500)" : "2px solid transparent",
                }}
                onClick={isEditing ? undefined : onClick}
                onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
            >
                {isEditing ? (
                    <input
                        ref={inputRef}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={handleRename}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename();
                            if (e.key === "Escape") setIsEditing(false);
                        }}
                        className="flex-1 text-sm bg-transparent outline-none border-b"
                        style={{
                            color: "var(--text-primary)",
                            borderColor: "var(--primary-500)",
                        }}
                        autoFocus
                    />
                ) : (
                    <span
                        className="flex-1 text-sm truncate"
                        style={{
                            color: "var(--text-primary)",
                            fontWeight: isActive ? 500 : 400,
                        }}
                    >
                        {displayTitle}
                    </span>
                )}

                {!isEditing && (
                    <button
                        ref={menuBtnRef}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded transition-opacity"
                        style={{ color: "var(--text-tertiary)" }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(true);
                        }}
                    >
                        <MoreHorizontal size={16} />
                    </button>
                )}
            </div>

            <ContextMenu
                items={menuItems}
                anchorRef={menuBtnRef}
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
            />

            <ConfirmDialog
                open={confirmDelete}
                title={t("sidebar.deleteConfirmTitle")}
                message={t("sidebar.deleteConfirmMessage", { title: displayTitle })}
                confirmLabel={t("sidebar.delete")}
                cancelLabel={t("sidebar.cancel")}
                danger
                onConfirm={() => {
                    setConfirmDelete(false);
                    onDelete();
                }}
                onCancel={() => setConfirmDelete(false)}
            />
        </>
    );
}
