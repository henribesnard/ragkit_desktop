import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { Chat } from "./pages/Chat";
import { Settings } from "./pages/Settings";
import { Dashboard } from "./pages/Dashboard";
import { Onboarding } from "./pages/Onboarding";
import { useTheme } from "./hooks/useTheme";
import { useSetupStatus } from "./hooks/useSetupStatus";
import "./i18n";

function SplashScreen() {
    return (
        <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-gray-900">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );
}

export default function App() {
    useTheme();
    const { hasCompletedSetup, isLoading } = useSetupStatus();

    if (isLoading) return <SplashScreen />;

    if (!hasCompletedSetup) {
        // Wrap in Router because Wizard/Onboarding might use Link or useNavigate internally
        // In our current implementation, WizardContainer uses useNavigate
        return (
            <BrowserRouter>
                <Onboarding />
            </BrowserRouter>
        );
    }

    return (
        <BrowserRouter>
            <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <Sidebar />
                <div className="flex flex-col flex-1 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-auto p-6">
                        <Routes>
                            <Route path="/chat" element={<Chat />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="*" element={<Navigate to="/chat" replace />} />
                        </Routes>
                    </main>
                </div>
            </div>
        </BrowserRouter>
    );
}
