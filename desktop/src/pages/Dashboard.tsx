import { LayoutDashboard } from "lucide-react";
import { DashboardPanels } from "@/components/dashboard/DashboardPanels";

export function Dashboard() {
  return (
    <div className="h-full flex flex-col p-4 overflow-auto gap-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <LayoutDashboard className="w-6 h-6" /> TABLEAU DE BORD
      </h1>
      <DashboardPanels />
    </div>
  );
}
