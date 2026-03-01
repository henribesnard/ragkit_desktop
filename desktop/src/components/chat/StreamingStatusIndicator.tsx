import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import type { StreamStatus } from "@/hooks/useChatStream";

interface StreamingStatusIndicatorProps {
    status: StreamStatus;
}

export function StreamingStatusIndicator({ status }: StreamingStatusIndicatorProps) {
    const { t } = useTranslation();

    let label = t(`chat.status.${status.step}`);
    if (status.step === "retrieved" && status.detail?.count !== undefined) {
        label = t("chat.status.retrieved", { count: status.detail.count });
    }

    return (
        <div className="flex items-center gap-2 py-2 px-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
            <span>{label}</span>
        </div>
    );
}
