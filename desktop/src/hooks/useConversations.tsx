import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ConversationListItem {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    archived: boolean;
}

export type TemporalGroup = "today" | "yesterday" | "last7days" | "last30days" | "older";

interface GroupedConversations {
    group: TemporalGroup;
    conversations: ConversationListItem[];
}

const STORAGE_KEY = "loko-conversations-index";

function getTemporalGroup(dateStr: string): TemporalGroup {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const last7 = new Date(today.getTime() - 7 * 86400000);
    const last30 = new Date(today.getTime() - 30 * 86400000);

    if (date >= today) return "today";
    if (date >= yesterday) return "yesterday";
    if (date >= last7) return "last7days";
    if (date >= last30) return "last30days";
    return "older";
}

function groupConversations(conversations: ConversationListItem[]): GroupedConversations[] {
    const groups: Record<TemporalGroup, ConversationListItem[]> = {
        today: [],
        yesterday: [],
        last7days: [],
        last30days: [],
        older: [],
    };

    const sorted = [...conversations]
        .filter((c) => !c.archived)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    for (const conv of sorted) {
        const group = getTemporalGroup(conv.updatedAt);
        groups[group].push(conv);
    }

    const order: TemporalGroup[] = ["today", "yesterday", "last7days", "last30days", "older"];
    return order
        .filter((g) => groups[g].length > 0)
        .map((g) => ({ group: g, conversations: groups[g] }));
}

function loadIndex(): ConversationListItem[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
}

function saveIndex(items: ConversationListItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// ---------------------------------------------------------------------------
// Internal hook — actual logic
// ---------------------------------------------------------------------------

function useConversationsInternal() {
    const [conversations, setConversations] = useState<ConversationListItem[]>(loadIndex);
    const [activeId, setActiveId] = useState<string | null>(null);

    // Persist changes
    useEffect(() => {
        saveIndex(conversations);
    }, [conversations]);

    const createConversation = useCallback(async (): Promise<string> => {
        const id = crypto.randomUUID();
        await invoke("new_conversation", { conversation_id: id });

        const now = new Date().toISOString();
        const newConv: ConversationListItem = {
            id,
            title: "",
            createdAt: now,
            updatedAt: now,
            messageCount: 0,
            archived: false,
        };
        setConversations((prev) => [newConv, ...prev]);
        setActiveId(id);
        return id;
    }, []);

    const deleteConversation = useCallback(async (id: string) => {
        // Clear backend memory + conversation file
        try {
            await invoke("new_conversation", { conversation_id: id });
        } catch {
            // best-effort cleanup
        }
        setConversations((prev) => prev.filter((c) => c.id !== id));
        setActiveId((prev) => (prev === id ? null : prev));
    }, []);

    const archiveConversation = useCallback((id: string) => {
        setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, archived: true } : c))
        );
    }, []);

    const unarchiveConversation = useCallback((id: string) => {
        setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, archived: false } : c))
        );
    }, []);

    const renameConversation = useCallback((id: string, title: string) => {
        setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, title } : c))
        );
    }, []);

    const updateConversationActivity = useCallback((id: string, messageCount: number, title?: string) => {
        setConversations((prev) =>
            prev.map((c) => {
                if (c.id !== id) return c;
                return {
                    ...c,
                    updatedAt: new Date().toISOString(),
                    messageCount,
                    ...(title !== undefined ? { title } : {}),
                };
            })
        );
    }, []);

    const openConversation = useCallback(async (id: string) => {
        setActiveId(id);
    }, []);

    const searchConversations = useCallback(
        (query: string): ConversationListItem[] => {
            if (!query.trim()) return conversations.filter((c) => !c.archived);
            const normalized = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return conversations.filter((c) => {
                if (c.archived) return false;
                const title = c.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return title.includes(normalized);
            });
        },
        [conversations]
    );

    const grouped = groupConversations(conversations);
    const archivedCount = conversations.filter((c) => c.archived).length;
    const archivedConversations = conversations.filter((c) => c.archived);

    return {
        conversations,
        grouped,
        activeId,
        archivedCount,
        archivedConversations,
        createConversation,
        openConversation,
        deleteConversation,
        archiveConversation,
        unarchiveConversation,
        renameConversation,
        updateConversationActivity,
        searchConversations,
        setActiveId,
    };
}

// ---------------------------------------------------------------------------
// Context — shared singleton between Sidebar and Chat
// ---------------------------------------------------------------------------

type ConversationsContextValue = ReturnType<typeof useConversationsInternal>;

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

export function ConversationsProvider({ children }: { children: ReactNode }) {
    const value = useConversationsInternal();
    return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>;
}

export function useConversations(): ConversationsContextValue {
    const ctx = useContext(ConversationsContext);
    if (!ctx) {
        throw new Error("useConversations must be used within ConversationsProvider");
    }
    return ctx;
}
