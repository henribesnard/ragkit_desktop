import { useState } from "react";
import { ChevronDown, ChevronUp, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import type { LatencyEstimate, StepEstimate } from "@/hooks/useLatencyEstimator";

interface PipelineLatencyEstimatorProps {
  estimate: LatencyEstimate;
  className?: string;
}

function totalColor(max: number): string {
  if (max <= 10) return "text-green-600 dark:text-green-400";
  if (max <= 30) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function segmentColor(step: StepEstimate, totalMax: number): string {
  if (step.skipped) return "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500";
  const ratio = totalMax > 0 ? step.max / totalMax : 0;
  if (ratio > 0.5) return "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300";
  if (ratio > 0.2) return "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300";
  return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300";
}

function segmentWidth(step: StepEstimate): string {
  if (step.skipped) return "min-w-[60px]";
  return "min-w-[60px]";
}

function formatRange(step: StepEstimate): string {
  if (step.skipped) return "skip";
  if (step.min === step.max) return `${step.min}s`;
  return `${step.min}-${step.max}s`;
}

export function PipelineLatencyEstimator({ estimate, className }: PipelineLatencyEstimatorProps) {
  const [expanded, setExpanded] = useState(true);
  const { t } = useTranslation();
  const { steps, total } = estimate;
  const orderedSteps = [steps.analyzer, steps.rewriting, steps.retrieval, steps.reranking, steps.generation];

  return (
    <div
      className={cn(
        "border rounded-lg bg-white dark:bg-gray-900 shadow-sm overflow-hidden",
        className,
      )}
    >
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium">
            {t("latency.estimated", "Latence estimee")}
          </span>
          <span className={cn("text-sm font-semibold", totalColor(total.max))}>
            ~{total.min}s - {total.max}s
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {estimate.provider === "ollama" ? "Ollama" : estimate.provider} ({estimate.model})
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {/* Pipeline bar */}
          <div className="flex gap-1">
            {orderedSteps.map((step) => {
              const flexGrow = step.skipped ? 0 : Math.max(1, Math.round((step.max / Math.max(total.max, 1)) * 10));
              return (
                <div
                  key={step.label}
                  className={cn(
                    "rounded px-2 py-1.5 text-center transition-all",
                    segmentColor(step, total.max),
                    segmentWidth(step),
                  )}
                  style={{ flexGrow: step.skipped ? 0 : flexGrow }}
                >
                  <div className="text-[10px] font-medium uppercase tracking-wide">{step.label}</div>
                  <div className={cn("text-xs font-semibold", step.skipped && "line-through")}>
                    {formatRange(step)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
