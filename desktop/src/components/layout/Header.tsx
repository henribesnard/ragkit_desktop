import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Moon, Sun, Languages } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { Button } from "../ui/Button";

export function Header() {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const { theme, toggle } = useTheme();

    const getPageTitle = () => {
        switch (true) {
            case location.pathname.startsWith("/chat"): return t("navigation.chat");
            case location.pathname.startsWith("/settings"): return t("navigation.settings");
            case location.pathname.startsWith("/dashboard"): return t("navigation.dashboard");
            default: return "";
        }
    };

    const toggleLanguage = () => {
        const newLang = i18n.language === "fr" ? "en" : "fr";
        i18n.changeLanguage(newLang);
        localStorage.setItem("ragkit-lang", newLang);
    };

    return (
        <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 transition-colors duration-200">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {getPageTitle()}
            </h1>

            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={toggleLanguage} title={i18n.language.toUpperCase()}>
                    <Languages size={20} />
                    <span className="ml-1 text-xs font-bold">{i18n.language.toUpperCase()}</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={toggle} title={theme === "light" ? t("layout.darkMode") : t("layout.lightMode")}>
                    {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
                </Button>
            </div>
        </header>
    );
}
