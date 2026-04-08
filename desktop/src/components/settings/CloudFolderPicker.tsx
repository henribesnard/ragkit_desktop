import { Button } from "@/components/ui/Button";
import { Plus, X } from "lucide-react";

interface CloudFolderPickerProps {
    label: string;
    value: string[];
    onChange: (value: string[]) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function CloudFolderPicker({
    label,
    value,
    onChange,
    disabled = false,
    placeholder,
}: CloudFolderPickerProps) {
    const folders = value?.length ? value : [""];

    const updateItem = (index: number, v: string) => {
        const next = [...folders];
        next[index] = v;
        onChange(next);
    };

    const addItem = () => {
        onChange([...(folders || []), ""]);
    };

    const removeItem = (index: number) => {
        const next = [...folders];
        next.splice(index, 1);
        onChange(next.length ? next : [""]);
    };

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
            <div className="space-y-2">
                {folders.map((folder, index) => (
                    <div key={index} className="flex gap-2">
                        <input
                            type="text"
                            value={folder}
                            disabled={disabled}
                            onChange={(e) => updateItem(index, e.target.value)}
                            placeholder={placeholder}
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => removeItem(index)}
                            className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-40"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={addItem}
                    disabled={disabled}
                    className="text-blue-600 hover:text-blue-700 p-0 h-auto disabled:opacity-40"
                >
                    <Plus className="w-4 h-4 mr-1" />
                    Ajouter un dossier
                </Button>
            </div>
        </div>
    );
}

