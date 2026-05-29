import { useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    SquarePen,
    MessagesSquare,
    LayoutDashboard,
    SlidersHorizontal,
    Moon,
    Sun,
    Globe,
    ChevronDown,
    ChevronRight,
    Loader2,
} from "lucide-react";
import { useBackendHealth } from "../../hooks/useBackendHealth";
import { useTheme } from "../../hooks/useTheme";
import { useConversations } from "../../hooks/useConversations";
import { usePersistentIngestion } from "@/hooks/usePersistentIngestion";
import { useAppUpdater } from "@/hooks/useAppUpdater";
import { ConversationList } from "./ConversationList";
import { ConversationSearch } from "./ConversationSearch";
import { LokoGlyph } from "../brand/LokoGlyph";

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
        <nav
            className="flex flex-col h-screen"
            style={{
                width: "var(--sidebar-width)",
                background: "var(--surface)",
                borderRight: "1px solid var(--border)",
                padding: "16px 14px",
                flexShrink: 0,
            }}
        >
            {/* Brand lockup */}
            <div className="nav-brand">
                <LokoGlyph size={28} />
                <span className="wm">LOKO</span>
            </div>

            {/* Primary nav section */}
            <div className="nav-section">{t("sidebar.workspace", "Espace de travail")}</div>

            {/* Chat nav item */}
            <div
                className={`nav-item${isNavActive("/chat") ? " active" : ""}`}
                onClick={() => navigate("/chat")}
            >
                <MessagesSquare size={18} />
                <span className="lbl">{t("navigation.chat", "Chat")}</span>
                <SquarePen
                    size={15}
                    style={{ color: "var(--text-3)", cursor: "pointer" }}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleNewConversation();
                    }}
                />
            </div>

            {/* Conversations toggle */}
            <button
                onClick={() => setIsConversationsOpen(!isConversationsOpen)}
                className="w-full flex items-center justify-between"
                style={{
                    padding: "4px 10px",
                    marginTop: 4,
                    background: "transparent",
                    color: "var(--text-3)",
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    border: "none",
                    cursor: "pointer",
                }}
            >
                {t("sidebar.conversations", "Conversations")}
                {isConversationsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {/* Search */}
            {showSearch && isConversationsOpen && (
                <div style={{ padding: "2px 0 6px 0" }}>
                    <ConversationSearch value={searchQuery} onChange={setSearchQuery} />
                </div>
            )}

            {/* Conversations List */}
            {isConversationsOpen && (
                <div className="flex-1 overflow-y-auto loko-scroll" style={{ marginBottom: 4 }}>
                    {filteredConversations ? (
                        <div className="space-y-0.5">
                            {filteredConversations.length === 0 ? (
                                <div className="text-center py-4 text-xs" style={{ color: "var(--text-3)" }}>
                                    {t("chat.emptyResults")}
                                </div>
                            ) : (
                                filteredConversations.map((conv) => (
                                    <div
                                        key={conv.id}
                                        className="cursor-pointer"
                                        style={{
                                            padding: "6px 10px",
                                            borderRadius: 9,
                                            background: conv.id === activeId ? "var(--brand-weak)" : "transparent",
                                            color: conv.id === activeId ? "var(--brand)" : "var(--text-2)",
                                            fontSize: 13.5,
                                            fontWeight: 500,
                                        }}
                                        onClick={() => handleSelectConversation(conv.id)}
                                        onMouseEnter={(e) => {
                                            if (conv.id !== activeId) (e.currentTarget.style.background = "var(--surface-2)");
                                        }}
                                        onMouseLeave={(e) => {
                                            if (conv.id !== activeId) (e.currentTarget.style.background = "transparent");
                                        }}
                                    >
                                        <span className="truncate block">
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

                    {archivedCount > 0 && !filteredConversations && (
                        <div
                            className="text-xs mt-4 px-3 cursor-pointer"
                            style={{ color: "var(--text-3)" }}
                            onMouseEnter={(e) => { (e.currentTarget.style.color = "var(--text-2)"); }}
                            onMouseLeave={(e) => { (e.currentTarget.style.color = "var(--text-3)"); }}
                        >
                            {t("sidebar.archiveCount", { count: archivedCount })}
                        </div>
                    )}
                </div>
            )}

            {!isConversationsOpen && <div className="flex-1" />}

            {/* Secondary navigation */}
            <div className="nav-section">{t("sidebar.navigation", "Navigation")}</div>

            <Link
                to="/dashboard"
                className={`nav-item${isNavActive("/dashboard") ? " active" : ""}`}
                style={{ textDecoration: "none" }}
            >
                <LayoutDashboard size={18} />
                <span className="lbl">{t("navigation.dashboard", "Tableau de bord")}</span>
            </Link>

            <Link
                to="/settings"
                className={`nav-item${isNavActive("/settings") ? " active" : ""}`}
                style={{ textDecoration: "none" }}
            >
                <SlidersHorizontal size={18} />
                <span className="lbl">{t("navigation.settings", "Paramètres")}</span>
                {hasUpdate && (
                    <span
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ background: "var(--brand)" }}
                    />
                )}
            </Link>

            {/* Ingestion Status */}
            {isIngesting && (
                <div
                    className="flex items-center gap-2"
                    style={{
                        padding: "8px 10px",
                        marginTop: 6,
                        borderRadius: 10,
                        background: "var(--brand-weak)",
                        color: "var(--brand)",
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

            <div className="nav-spacer" />

            {/* Backend status card */}
            <div
                className="nav-status"
                style={{ cursor: "pointer" }}
                onClick={() => navigate("/settings")}
                title={
                    hasUpdate
                        ? t("updater.newVersionAvailable") + " (" + (badgeVersion ?? "") + ")"
                        : isBackendHealthy
                            ? t("backend.connected")
                            : t("backend.disconnected")
                }
            >
                <span
                    className="dot"
                    style={
                        isBackendHealthy
                            ? {}
                            : { background: "var(--danger)", boxShadow: "0 0 0 3px var(--danger-bg)" }
                    }
                />
                <div style={{ flex: 1 }}>
                    <b>
                        {isBackendHealthy
                            ? t("backend.connected", "Backend actif")
                            : t("backend.disconnected", "Backend inactif")}
                    </b>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                        {backendVersion ? `v${backendVersion}` : "..."}
                        {hasUpdate && (
                            <span style={{ marginLeft: 6, color: "var(--brand)" }}>
                                {badgeVersion}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between" style={{ padding: "10px 4px 0" }}>
                <button
                    onClick={toggleLanguage}
                    className="flex items-center gap-1"
                    style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--text-3)",
                        background: "transparent",
                        padding: "4px 6px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                    }}
                    title={i18n.language.toUpperCase()}
                >
                    <Globe size={14} />
                    {i18n.language.toUpperCase()}
                </button>

                <button
                    onClick={toggleTheme}
                    style={{
                        color: "var(--text-3)",
                        background: "transparent",
                        padding: 6,
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 11.5,
                    }}
                    title={theme === "light" ? t("layout.darkMode") : t("layout.lightMode")}
                >
                    {theme === "light" ? <Sun size={14} /> : <Moon size={14} />}
                    {theme === "light" ? t("layout.light", "Clair") : t("layout.dark", "Sombre")}
                </button>
            </div>
        </nav>
    );
}
