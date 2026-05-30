import { cn } from "@/lib/cn";

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    className?: string;
}

/**
 * Toggle component using LOKO design system
 * Uses .loko-switch CSS class from index.css
 */
export function Toggle({ checked, onChange, label, className }: ToggleProps) {
    return (
        <div className={cn("flex items-center gap-3", className)}>
            <div
                className={cn("loko-switch", checked && "on")}
                onClick={() => onChange(!checked)}
                role="switch"
                aria-checked={checked}
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onChange(!checked);
                    }
                }}
            />
            {label && (
                <span
                    className="text-sm font-medium cursor-pointer select-none"
                    style={{ color: "var(--text)" }}
                    onClick={() => onChange(!checked)}
                >
                    {label}
                </span>
            )}
        </div>
    );
}
