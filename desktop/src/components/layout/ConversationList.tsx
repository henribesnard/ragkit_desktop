import { useTranslation } from "react-i18next";
import { ConversationItem } from "./ConversationItem";
import type { ConversationListItem, TemporalGroup } from "../../hooks/useConversations";

interface GroupedConversations {
    group: TemporalGroup;
    conversations: ConversationListItem[];
}

interface ConversationListProps {
    grouped: GroupedConversations[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onRename: (id: string, title: string) => void;
    onArchive: (id: string) => void;
    onDelete: (id: string) => void;
}

const GROUP_LABELS: Record<TemporalGroup, string> = {
    today: "sidebar.today",
    yesterday: "sidebar.yesterday",
    last7days: "sidebar.last7days",
    last30days: "sidebar.last30days",
    older: "sidebar.older",
};

export function ConversationList({
    grouped,
    activeId,
    onSelect,
    onRename,
    onArchive,
    onDelete,
}: ConversationListProps) {
    const { t } = useTranslation();

    if (grouped.length === 0) {
        return null;
    }

    return (
        <div className="space-y-1">
            {grouped.map((group, groupIndex) => (
                <div key={group.group}>
                    <div
                        className="px-3 pt-2 pb-1"
                        style={{
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "var(--text-tertiary)",
                            marginTop: groupIndex > 0 ? 8 : 0,
                            position: "sticky",
                            top: 0,
                            background: "var(--bg-secondary)",
                            zIndex: 1,
                        }}
                    >
                        {t(GROUP_LABELS[group.group])}
                    </div>
                    {group.conversations.map((conv) => (
                        <ConversationItem
                            key={conv.id}
                            conversation={conv}
                            isActive={conv.id === activeId}
                            onClick={() => onSelect(conv.id)}
                            onRename={(title) => onRename(conv.id, title)}
                            onArchive={() => onArchive(conv.id)}
                            onDelete={() => onDelete(conv.id)}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}
