import { useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SquarePen, LayoutDashboard, Settings, Moon, Sun, Globe, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useBackendHealth } from "../../hooks/useBackendHealth";
import { useTheme } from "../../hooks/useTheme";
import { useConversations } from "../../hooks/useConversations";
import { usePersistentIngestion } from "@/hooks/usePersistentIngestion";
import { useAppUpdater } from "@/hooks/useAppUpdater";
import { ConversationList } from "./ConversationList";
import { ConversationSearch } from "./ConversationSearch";

export function Sidebar() {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const { isHealthy: isBackendHealthy, version: backendVersion } = useBackendHealth();
    const { theme, toggle: toggleTheme } = useTheme();
    const {
        grouped,
        activeId,
        conversations,
        archivedCount,
        createConversation,
        openConversation,
        deleteConversation,
        archiveConversation,
        renameConversation,
        searchConversations,
    } = useConversations();
    const { isRunning: isIngesting, progress: ingestionProgress } = usePersistentIngestion();
    const {
        status: updateStatus,
        availableVersion: updateVersion,
        dismissedVersion: dismissedUpdateVersion,
    } = useAppUpdater();
    const badgeVersion =
        updateStatus === "available" ? updateVersion : dismissedUpdateVersion;
    const hasUpdate = Boolean(badgeVersion);

    const [searchQuery, setSearchQuery] = useState("");
    const [isConversationsOpen, setIsConversationsOpen] = useState(true);

    const toggleLanguage = () => {
        const newLang = i18n.language === "fr" ? "en" : "fr";
        i18n.changeLanguage(newLang);
        localStorage.setItem("loko-lang", newLang);
    };

    const filteredConversations = useMemo(() => {
        if (!searchQuery.trim()) return null;
        return searchConversations(searchQuery);
    }, [searchQuery, searchConversations]);

    const showSearch = conversations.filter((c) => !c.archived).length > 5;

    const handleNewConversation = async () => {
        try {
            const id = await createConversation();
            navigate(`/chat/${id}`);
        } catch (error) {
            console.warn("[Sidebar] Failed to create conversation:", error);
        }
    };

    const handleSelectConversation = (id: string) => {
        openConversation(id);
        navigate(`/chat/${id}`);
    };

    const isNavActive = (path: string) => location.pathname.startsWith(path);

    return (
        <div
            className="flex flex-col h-screen"
            style={{
                width: "var(--sidebar-width)",
                background: "var(--bg-secondary)",
                borderRight: "1px solid var(--border-default)",
                padding: 8,
                flexShrink: 0,
            }}
        >
            {/* Header — LOKO Wordmark */}
            <div style={{ padding: "4px 8px", marginBottom: 4 }}>
                <span
                    style={{
                        fontSize: 18,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        color: theme === "dark" ? "var(--primary-400)" : "var(--primary-800)",
                    }}
                >
                    LOKO
                </span>
            </div>

            {/* New Conversation Button */}
            <button
                onClick={handleNewConversation}
                className="flex items-center gap-2 w-full transition-colors"
                style={{
                    padding: "6px 10px",
                    borderRadius: "var(--radius-md)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    fontWeight: 500,
                    height: 32,
                }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
            >
                <SquarePen size={18} />
                {t("sidebar.newChat")}
            </button>

            {/* Separator */}
            <div
                style={{
                    height: 1,
                    background: "var(--border-default)",
                    margin: "6px 8px 4px",
                }}
            />

            {/* Conversations Header */}
            <button
                onClick={() => setIsConversationsOpen(!isConversationsOpen)}
                className="w-full flex items-center justify-between transition-colors"
                style={{
                    padding: "4px 10px",
                    background: "transparent",
                    color: "var(--text-tertiary)",
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                }}
                onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                }}
                onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
                }}
            >
                {t("sidebar.conversations", "Conversations")}
                {isConversationsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {/* Search (if > 5 conversations) */}
            {showSearch && isConversationsOpen && (
                <div style={{ padding: "2px 0 6px 0" }}>
                    <ConversationSearch
                        value={searchQuery}
                        onChange={setSearchQuery}
                    />
                </div>
            )}

            {/* Conversations List — Scrollable */}
            {isConversationsOpen && (
                <div
                    className="flex-1 overflow-y-auto"
                    style={{ marginBottom: 4 }}
                >
                    {filteredConversations ? (
                        // Search results — flat list
                        <div className="space-y-0.5">
                            {filteredConversations.length === 0 ? (
                                <div
                                    className="text-center py-4 text-xs"
                                    style={{ color: "var(--text-tertiary)" }}
                                >
                                    {t("chat.emptyResults")}
                                </div>
                            ) : (
                                filteredConversations.map((conv) => (
                                    <div
                                        key={conv.id}
                                        className="cursor-pointer transition-colors"
                                        style={{
                                            padding: "6px 10px",
                                            borderRadius: "var(--radius-md)",
                                            background: conv.id === activeId ? "var(--bg-hover)" : "transparent",
                                        }}
                                        onClick={() => handleSelectConversation(conv.id)}
                                        onMouseEnter={(e) => {
                                            (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                                        }}
                                        onMouseLeave={(e) => {
                                            if (conv.id !== activeId) {
                                                (e.currentTarget as HTMLElement).style.background = "transparent";
                                            }
                                        }}
                                    >
                                        <span
                                            className="text-sm truncate block"
                                            style={{ color: "var(--text-primary)" }}
                                        >
                                            {conv.title || t("sidebar.newChat")}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <ConversationList
                            grouped={grouped}
                            activeId={activeId}
                            onSelect={handleSelectConversation}
                            onRename={renameConversation}
                            onArchive={archiveConversation}
                            onDelete={deleteConversation}
                        />
                    )}

                    {/* Archives link */}
                    {archivedCount > 0 && !filteredConversations && (
                        <div
                            className="text-xs mt-4 px-3 cursor-pointer transition-colors"
                            style={{ color: "var(--text-tertiary)" }}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
                            }}
                        >
                            📁 {t("sidebar.archiveCount", { count: archivedCount })}
                        </div>
                    )}
                </div>
            )}

            {!isConversationsOpen && <div className="flex-1" />}

            {/* Ingestion Status */}
            {isIngesting && (
                <div
                    className="flex items-center gap-2 mx-1 mb-2"
                    style={{
                        padding: "6px 8px",
                        borderRadius: "var(--radius-md)",
                        background: theme === "dark" ? "rgba(6, 78, 59, 0.25)" : "var(--primary-50)",
                        color: theme === "dark" ? "var(--primary-300)" : "var(--primary-700)",
                        fontSize: 12,
                        fontWeight: 500,
                    }}
                >
                    <Loader2 size={14} className="animate-spin flex-shrink-0" />
                    <span className="truncate">
                        {t("chat.ingestionInProgress")}
                        {ingestionProgress > 0 && ` (${ingestionProgress}%)`}
                    </span>
                </div>
            )}

            {/* Separator */}
            <div
                style={{
                    height: 1,
                    background: "var(--border-default)",
                    margin: "0 8px 6px",
                }}
            />

            {/* Secondary Navigation */}
            <nav className="space-y-0.5 mb-2">
                {[
                    { path: "/dashboard", label: t("navigation.dashboard"), icon: LayoutDashboard },
                    { path: "/settings", label: t("navigation.settings"), icon: Settings },
                ].map((item) => {
                    const active = isNavActive(item.path);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className="flex items-center gap-2 transition-colors"
                            style={{
                                padding: "6px 10px",
                                borderRadius: "var(--radius-md)",
                                fontSize: 13,
                                color: active ? "var(--primary-500)" : "var(--text-secondary)",
                                background: active ? "var(--bg-hover)" : "transparent",
                                fontWeight: active ? 500 : 400,
                            }}
                            onMouseEnter={(e) => {
                                if (!active) {
                                    (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                                    (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!active) {
                                    (e.currentTarget as HTMLElement).style.background = "transparent";
                                    (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                                }
                            }}
                        >
                            <Icon size={18} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Separator */}
            <div
                style={{
                    height: 1,
                    background: "var(--border-default)",
                    margin: "0 8px 6px",
                }}
            />

            {/* Footer */}
            <div
                className="flex items-center justify-between"
                style={{ padding: "0 4px" }}
            >
                {/* Language Toggle */}
                <button
                    onClick={toggleLanguage}
                    className="flex items-center gap-1 transition-colors"
                    style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--text-tertiary)",
                        background: "transparent",
                        padding: "4px 6px",
                        borderRadius: "var(--radius-sm)",
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
                    }}
                    title={i18n.language.toUpperCase()}
                >
                    <Globe size={14} />
                    {i18n.language.toUpperCase()}
                </button>

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="transition-colors"
                    style={{
                        color: "var(--text-tertiary)",
                        background: "transparent",
                        padding: 6,
                        borderRadius: "var(--radius-sm)",
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
                    }}
                    title={theme === "light" ? t("layout.darkMode") : t("layout.lightMode")}
                >
                    {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
                </button>

                {/* Backend Status + Update Badge */}
                <div
                    className="flex items-center gap-1.5 cursor-pointer"
                    title={
                        hasUpdate
                            ? t("updater.newVersionAvailable") + " (" + (badgeVersion ?? "") + ")"
                            : isBackendHealthy ? t("backend.connected") : t("backend.disconnected")
                    }
                    onClick={() => navigate("/settings")}
                >
                    <div
                        className="w-2 h-2 rounded-full"
                        style={{
                            background: isBackendHealthy ? "var(--success)" : "var(--error)",
                        }}
                    />
                    <span
                        style={{
                            fontSize: 10,
                            color: "var(--text-tertiary)",
                        }}
                    >
                        {backendVersion ? `v${backendVersion}` : "..."}
                    </span>
                    {hasUpdate && (
                        <div
                            className="w-2 h-2 rounded-full animate-pulse"
                            style={{ background: "var(--primary-500)" }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
