import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Plus, X } from "lucide-react";

interface NotionFormProps {
    config: any;
    onChange: (config: any) => void;
}

interface NotionFiltersFieldProps {
    value: any;
    onChange: (value: string) => void;
}

function serializeFilters(value: any) {
    return value ? JSON.stringify(value, null, 2) : "";
}

function NotionFiltersField({ value, onChange }: NotionFiltersFieldProps) {
    const [filtersText, setFiltersText] = useState(() => serializeFilters(value));

    return (
        <textarea
            value={filtersText}
            onChange={(e) => {
                const nextValue = e.target.value;
                setFiltersText(nextValue);
                onChange(nextValue);
            }}
            rows={4}
            placeholder='{"Status": {"select": {"equals": "Published"}}}'
            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
    );
}

export function NotionForm({ config, onChange }: NotionFormProps) {
    const databaseIds = config.database_ids || [""];
    const pageIds = config.page_ids || [];
    const credential = config.credential || {};

    const updateList = (key: string, index: number, value: string) => {
        const current = [...(config[key] || [])];
        current[index] = value;
        onChange({ ...config, [key]: current });
    };

    const addListItem = (key: string) => {
        const current = [...(config[key] || [])];
        current.push("");
        onChange({ ...config, [key]: current });
    };

    const removeListItem = (key: string, index: number) => {
        const current = [...(config[key] || [])];
        current.splice(index, 1);
        onChange({ ...config, [key]: current });
    };

    const setCredential = (next: Record<string, any>) => {
        const hasValue = Object.values(next).some((value) => String(value || "").trim());
        if (hasValue) {
            onChange({ ...config, credential: next });
        } else {
            const rest = { ...config };
            delete rest.credential;
            onChange(rest);
        }
    };

    const updateCredential = (key: string, value: string) => {
        setCredential({ ...credential, [key]: value });
    };

    const handleFiltersChange = (value: string) => {
        if (!value.trim()) {
            const rest = { ...config };
            delete rest.property_filters;
            onChange(rest);
            return;
        }
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === "object") {
                onChange({ ...config, property_filters: parsed });
            }
        } catch {
            // Keep last valid config
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Token d'integration</label>
                <input
                    type="password"
                    value={credential.token || ""}
                    onChange={(e) => updateCredential("token", e.target.value)}
                    placeholder="secret_abc123..."
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IDs de bases de donnees</label>
                <div className="space-y-2">
                    {databaseIds.map((id: string, index: number) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                value={id}
                                onChange={(e) => updateList("database_ids", index, e.target.value)}
                                placeholder="db-uuid-1"
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeListItem("database_ids", index)}
                                className="p-2 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addListItem("database_ids")}
                        type="button"
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter une base
                    </Button>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IDs de pages</label>
                <div className="space-y-2">
                    {pageIds.map((id: string, index: number) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                value={id}
                                onChange={(e) => updateList("page_ids", index, e.target.value)}
                                placeholder="page-uuid-1"
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeListItem("page_ids", index)}
                                className="p-2 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addListItem("page_ids")}
                        type="button"
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter une page
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
                <input
                    type="checkbox"
                    id="include-subpages"
                    checked={config.include_subpages === true}
                    onChange={(e) => onChange({ ...config, include_subpages: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="include-subpages" className="text-sm text-gray-700 dark:text-gray-300">Inclure les sous-pages</label>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pages maximum</label>
                <input
                    type="number"
                    min="1"
                    value={config.max_pages || 200}
                    onChange={(e) => onChange({ ...config, max_pages: parseInt(e.target.value) || 1 })}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filtres (JSON Notion)</label>
                <NotionFiltersField
                    key={serializeFilters(config.property_filters)}
                    value={config.property_filters}
                    onChange={handleFiltersChange}
                />
            </div>
        </div>
    );
}
