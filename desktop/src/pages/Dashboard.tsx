import { useTranslation } from "react-i18next";
import { LayoutDashboard } from "lucide-react";
import { DashboardView } from "@/components/dashboard/DashboardView";

export function Dashboard() {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col p-4 overflow-auto gap-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <LayoutDashboard className="w-6 h-6" /> {t("dashboard.title")}
      </h1>
      <DashboardView />
    </div>
  );
}
