import { cn } from "@/lib/cn";

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    className?: string;
}

export function Toggle({ checked, onChange, label, className }: ToggleProps) {
    return (
        <div className={cn("flex items-center gap-3 cursor-pointer", className)} onClick={() => onChange(!checked)}>
            <div
                className={cn(
                    "w-11 h-6 bg-gray-200 rounded-full relative transition-colors duration-200 ease-in-out",
                    checked ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                )}
            >
                <div
                    className={cn(
                        "absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow transition-transform duration-200 ease-in-out",
                        checked ? "translate-x-5" : "translate-x-0"
                    )}
                />
            </div>
            {label && <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>}
        </div>
    );
}
