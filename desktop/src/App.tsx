import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { Chat } from "./pages/Chat";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
import { Onboarding } from "./pages/Onboarding";
import { useTheme } from "./hooks/useTheme";
import { useSetupStatus } from "./hooks/useSetupStatus";
import { ConversationsProvider } from "./hooks/useConversations";
import "./i18n";

/** Key-based wrapper: remounts Chat when conversation ID changes, resetting all state. */
function ChatPage() {
    const { id } = useParams<{ id: string }>();
    return <Chat key={id || "new"} />;
}

function SplashScreen() {
    return (
        <div
            className="h-screen w-screen flex items-center justify-center"
            style={{ background: "var(--bg-primary)" }}
        >
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: "var(--primary-500)" }}></div>
        </div>
    );
}

export default function App() {
    useTheme();
    const { hasCompletedSetup, isLoading } = useSetupStatus();

    if (isLoading) return <SplashScreen />;

    if (!hasCompletedSetup) {
        return (
            <BrowserRouter>
                <Onboarding />
            </BrowserRouter>
        );
    }

    return (
        <BrowserRouter>
            <ConversationsProvider>
                <div className="flex h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
                    <Sidebar />
                    <main className="flex-1 overflow-hidden">
                        <Routes>
                            <Route path="/chat" element={<ChatPage />} />
                            <Route path="/chat/:id" element={<ChatPage />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/settings/:section" element={<Settings />} />
                            <Route path="*" element={<Navigate to="/chat" replace />} />
                        </Routes>
                    </main>
                </div>
            </ConversationsProvider>
        </BrowserRouter>
    );
}
