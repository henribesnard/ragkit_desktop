import { useState } from "react";
import { cn } from "@/lib/cn";

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div
            className={cn("relative inline-block", className)}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div className="absolute z-10 w-64 p-2 mt-2 text-xs text-white bg-gray-900 rounded-lg shadow-lg -translate-x-1/2 left-1/2 dark:bg-gray-700">
                    {content}
                    <div className="absolute w-2 h-2 bg-gray-900 rotate-45 -top-1 left-1/2 -translate-x-1/2 dark:bg-gray-700" />
                </div>
            )}
        </div>
    );
}
