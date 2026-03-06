import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ipc } from "@/lib/ipc";

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

// ---------------------------------------------------------------------------
// Internal hook — actual logic (backed by SQLite via backend API)
// ---------------------------------------------------------------------------

function useConversationsInternal() {
    const [conversations, setConversations] = useState<ConversationListItem[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshList = useCallback(async () => {
        try {
            const list = await ipc.listConversations() as ConversationListItem[];
            setConversations(Array.isArray(list) ? list : []);
            setLoading(false);
            return true;
        } catch {
            // Backend may not be ready yet — keep current state
            return false;
        }
    }, []);

    // Fetch conversation list from backend on mount, with retries while backend starts
    const retryRef = useRef(0);
    useEffect(() => {
        let active = true;
        const maxRetries = 15;
        const retryDelayMs = 2000;

        const tryLoad = async () => {
            const ok = await refreshList();
            if (ok || !active) return;
            retryRef.current++;
            if (retryRef.current < maxRetries && active) {
                setTimeout(tryLoad, retryDelayMs);
            } else if (active) {
                setLoading(false);
            }
        };

        void tryLoad();
        return () => { active = false; };
    }, [refreshList]);

    const createConversation = useCallback(async (): Promise<string> => {
        const id = crypto.randomUUID();
        try {
            await ipc.newConversation(id);
        } catch {
            // Best effort — backend may not be ready yet
        }
        // Optimistic update
        const now = new Date().toISOString();
        setConversations((prev) => [
            { id, title: "", createdAt: now, updatedAt: now, messageCount: 0, archived: false },
            ...prev,
        ]);
        setActiveId(id);
        return id;
    }, []);

    const deleteConversation = useCallback(async (id: string) => {
        try {
            await ipc.deleteConversation(id);
        } catch {
            // best-effort
        }
        setConversations((prev) => prev.filter((c) => c.id !== id));
        setActiveId((prev) => (prev === id ? null : prev));
    }, []);

    const archiveConversation = useCallback(async (id: string) => {
        try {
            await ipc.archiveConversation(id, true);
        } catch { /* best-effort */ }
        setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, archived: true } : c))
        );
    }, []);

    const unarchiveConversation = useCallback(async (id: string) => {
        try {
            await ipc.archiveConversation(id, false);
        } catch { /* best-effort */ }
        setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, archived: false } : c))
        );
    }, []);

    const renameConversation = useCallback(async (id: string, title: string) => {
        try {
            await ipc.renameConversation(id, title);
        } catch { /* best-effort */ }
        setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, title } : c))
        );
    }, []);

    const updateConversationActivity = useCallback((id: string, messageCount: number, title?: string) => {
        // Optimistic local update — backend updates automatically when messages are added
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
        // If title was provided, persist it to backend
        if (title !== undefined) {
            ipc.renameConversation(id, title).catch(() => {});
        }
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
        loading,
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
        refreshList,
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

// eslint-disable-next-line react-refresh/only-export-components
export function useConversations(): ConversationsContextValue {
    const ctx = useContext(ConversationsContext);
    if (!ctx) {
        throw new Error("useConversations must be used within ConversationsProvider");
    }
    return ctx;
}
