import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MessageSquare, Settings, Moon, Sun, Languages } from "lucide-react";
import { useBackendHealth } from "../../hooks/useBackendHealth";
import { useTheme } from "../../hooks/useTheme";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function Sidebar() {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const isBackendHealthy = useBackendHealth();
    const { theme, toggle: toggleTheme } = useTheme();

    const toggleLanguage = () => {
        const newLang = i18n.language === "fr" ? "en" : "fr";
        i18n.changeLanguage(newLang);
        localStorage.setItem("ragkit-lang", newLang);
    };

    const navItems = [
        { path: "/chat", label: t("navigation.chat"), icon: MessageSquare },
        { path: "/settings", label: t("navigation.settings"), icon: Settings },
    ];

    return (
        <div className="flex flex-col w-52 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 h-screen">
            {/* Logo */}
            <div className="px-4 py-5 flex items-center gap-2.5">
                <div className="w-7 h-7 bg-black dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-black font-bold text-xs">
                    R
                </div>
                <span className="font-semibold text-base text-gray-900 dark:text-gray-100">{t("app.name")}</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 space-y-0.5">
                {navItems.map((item) => {
                    const isActive = location.pathname.startsWith(item.path);
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800/50"
                            )}
                        >
                            <Icon size={18} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                {/* Controls */}
                <div className="flex items-center justify-between px-1">
                    <button
                        onClick={toggleLanguage}
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title={i18n.language.toUpperCase()}
                    >
                        <Languages size={16} />
                    </button>
                    <button
                        onClick={toggleTheme}
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title={theme === "light" ? t("layout.darkMode") : t("layout.lightMode")}
                    >
                        {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
                    </button>
                    <div
                        className="flex items-center gap-1.5 px-1.5"
                        title={isBackendHealthy ? t("backend.connected") : t("backend.disconnected")}
                    >
                        <div className={cn("w-1.5 h-1.5 rounded-full", isBackendHealthy ? "bg-green-500" : "bg-red-500")} />
                        <span className="text-[10px] text-gray-400">{isBackendHealthy ? "Online" : "Offline"}</span>
                    </div>
                </div>
                {/* Version */}
                <div className="text-center text-[10px] text-gray-300 dark:text-gray-600">
                    {t("app.version")}
                </div>
            </div>
        </div>
    );
}
