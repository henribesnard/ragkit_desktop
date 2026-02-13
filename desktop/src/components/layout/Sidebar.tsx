import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MessageSquare, Settings, LayoutDashboard } from "lucide-react";
import { useBackendHealth } from "../../hooks/useBackendHealth";
import { cn } from "@/lib/cn";

export function Sidebar() {
    const { t } = useTranslation();
    const location = useLocation();
    const isBackendHealthy = useBackendHealth();

    const navItems = [
        { path: "/chat", label: t("navigation.chat"), icon: MessageSquare },
        { path: "/settings", label: t("navigation.settings"), icon: Settings },
        { path: "/dashboard", label: t("navigation.dashboard"), icon: LayoutDashboard },
    ];

    return (
        <div className="flex flex-col w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen transition-colors duration-200">
            <div className="p-4 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                    R
                </div>
                <span className="font-bold text-lg dark:text-gray-100">{t("app.name")}</span>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = location.pathname.startsWith(item.path);
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-blue-50 text-blue-700 dark:bg-gray-700 dark:text-blue-400"
                                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                            )}
                        >
                            <Icon size={20} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <span>{t("app.version")}</span>
                    <div className="flex items-center gap-1.5" title={isBackendHealthy ? t("backend.connected") : t("backend.disconnected")}>
                        <div className={cn("w-2 h-2 rounded-full", isBackendHealthy ? "bg-green-500" : "bg-red-500")} />
                        <span>Backend</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
