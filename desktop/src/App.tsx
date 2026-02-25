import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { Chat } from "./pages/Chat";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
import { Onboarding } from "./pages/Onboarding";
import { useTheme } from "./hooks/useTheme";
import { useSetupStatus } from "./hooks/useSetupStatus";
import "./i18n";

function SplashScreen() {
    return (
        <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-gray-900">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
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
            <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
                <Sidebar />
                <main className="flex-1 overflow-hidden">
                    <Routes>
                        <Route path="/chat" element={<Chat />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="*" element={<Navigate to="/chat" replace />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}
