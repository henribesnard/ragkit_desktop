import { useTranslation } from "react-i18next";
import { LayoutDashboard } from "lucide-react";

export function Dashboard() {
    const { t } = useTranslation();

    return (
        <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                <LayoutDashboard size={32} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {t("dashboard.placeholder")}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
                {t("dashboard.description")}
            </p>
        </div>
    );
}
