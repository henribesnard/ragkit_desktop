import { useTranslation } from "react-i18next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export function Dashboard() {
  const { t } = useTranslation();

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: "var(--bg-primary)" }}
    >
      <div
        style={{
          maxWidth: "var(--settings-max-width)",
          margin: "0 auto",
          padding: "32px 20px",
        }}
      >
        <h1
          className="text-lg font-semibold mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          {t("dashboard.title")}
        </h1>
        <DashboardView />
      </div>
    </div>
  );
}
