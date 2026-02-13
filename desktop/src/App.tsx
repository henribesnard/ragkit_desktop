import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { Chat } from "./pages/Chat";
import { Settings } from "./pages/Settings";
import { Dashboard } from "./pages/Dashboard";
import { useTheme } from "./hooks/useTheme";
import "./i18n";

export default function App() {
    useTheme(); // Applique le thème clair/sombre

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
