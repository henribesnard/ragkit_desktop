import { useState } from "react";
import { Clock, Info, Zap } from "lucide-react";

import { cn } from "@/lib/cn";

type ImpactLevel = "high" | "medium" | "low";

interface LatencyImpactBadgeProps {
  level: ImpactLevel;
  description: string;
  className?: string;
}

const config: Record<ImpactLevel, { bg: string; text: string; icon: typeof Zap; label: string }> = {
  high: {
    bg: "bg-orange-50 dark:bg-orange-950",
    text: "text-orange-700 dark:text-orange-300",
    icon: Zap,
    label: "Impact latence",
  },
  medium: {
    bg: "bg-yellow-50 dark:bg-yellow-950",
    text: "text-yellow-700 dark:text-yellow-300",
    icon: Clock,
    label: "Impact latence",
  },
  low: {
    bg: "bg-gray-50 dark:bg-gray-800",
    text: "text-gray-500 dark:text-gray-400",
    icon: Info,
    label: "Impact latence",
  },
};

export function LatencyImpactBadge({ level, description, className }: LatencyImpactBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const { bg, text, icon: Icon } = config[level];

  return (
    <button
      type="button"
      onClick={() => setExpanded((prev) => !prev)}
      className={cn(
        "inline-flex items-start gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
        bg,
        text,
        "hover:opacity-80 cursor-pointer text-left",
        className,
      )}
    >
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      {expanded ? (
        <span>{description}</span>
      ) : (
        <span className="truncate max-w-[200px]">{description}</span>
      )}
    </button>
  );
}
