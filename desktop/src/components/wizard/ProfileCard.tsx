import { cn } from "@/lib/cn";

interface ProfileCardProps {
    id: string;
    name: string;
    icon: string;
    description: string;
    selected: boolean;
    onSelect: (id: string) => void;
}

export function ProfileCard({ id, name, icon, description, selected, onSelect }: ProfileCardProps) {
    return (
        <div
            onClick={() => onSelect(id)}
            className={cn(
                "cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center text-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800",
                selected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            )}
        >
            <div className="text-3xl mb-1">{icon}</div>
            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 leading-tight">
                {name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                {description}
            </div>
            {selected && (
                <div className="absolute top-2 right-2 text-blue-500">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                </div>
            )}
        </div>
    );
}
