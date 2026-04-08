import { Button } from "@/components/ui/Button";
import { Plus, X } from "lucide-react";

interface RestApiFormProps {
    config: any;
    onChange: (config: any) => void;
}

const PAGINATION_OPTIONS = [
    { value: "none", label: "Aucune" },
    { value: "offset", label: "Offset" },
    { value: "page", label: "Page" },
    { value: "cursor", label: "Cursor" },
];

export function RestApiForm({ config, onChange }: RestApiFormProps) {
    const headers = Object.entries(config.headers || {}).map(([key, value]) => ({ key, value }));
    const queryParams = Object.entries(config.query_params || {}).map(([key, value]) => ({ key, value }));

    const updatePairs = (key: string, index: number, valueKey: "key" | "value", value: string) => {
        const current = [...(key === "headers" ? headers : queryParams)];
        current[index] = { ...current[index], [valueKey]: value };
        const mapped = current.filter((item) => item.key).reduce((acc: any, item) => {
            acc[item.key] = item.value;
            return acc;
        }, {});
        onChange({ ...config, [key]: mapped });
    };

    const addPair = (key: string) => {
        const mapped = key === "headers" ? { ...config.headers } : { ...config.query_params };
        mapped[""] = "";
        onChange({ ...config, [key]: mapped });
    };

    const removePair = (key: string, index: number) => {
        const current = [...(key === "headers" ? headers : queryParams)];
        current.splice(index, 1);
        const mapped = current.filter((item) => item.key).reduce((acc: any, item) => {
            acc[item.key] = item.value;
            return acc;
        }, {});
        onChange({ ...config, [key]: mapped });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base URL</label>
                    <input
                        type="url"
                        value={config.base_url || ""}
                        onChange={(e) => onChange({ ...config, base_url: e.target.value })}
                        placeholder="https://api.example.com"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Endpoint</label>
                    <input
                        type="text"
                        value={config.endpoint || ""}
                        onChange={(e) => onChange({ ...config, endpoint: e.target.value })}
                        placeholder="/v1/articles"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Methode</label>
                <select
                    value={config.method || "GET"}
                    onChange={(e) => onChange({ ...config, method: e.target.value })}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Headers</label>
                <div className="space-y-2">
                    {headers.map((item, index) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                value={item.key}
                                onChange={(e) => updatePairs("headers", index, "key", e.target.value)}
                                placeholder="Authorization"
                                className="block w-1/2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <input
                                type="text"
                                value={item.value}
                                onChange={(e) => updatePairs("headers", index, "value", e.target.value)}
                                placeholder="Bearer ${API_KEY}"
                                className="block w-1/2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removePair("headers", index)}
                                className="p-2 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addPair("headers")}
                        type="button"
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter un header
                    </Button>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Query params</label>
                <div className="space-y-2">
                    {queryParams.map((item, index) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                value={item.key}
                                onChange={(e) => updatePairs("query_params", index, "key", e.target.value)}
                                placeholder="status"
                                className="block w-1/2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <input
                                type="text"
                                value={item.value as string}
                                onChange={(e) => updatePairs("query_params", index, "value", e.target.value)}
                                placeholder="published"
                                className="block w-1/2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removePair("query_params", index)}
                                className="p-2 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addPair("query_params")}
                        type="button"
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter un parametre
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pagination</label>
                    <select
                        value={config.pagination_type || "none"}
                        onChange={(e) => onChange({ ...config, pagination_type: e.target.value })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                        {PAGINATION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Taille page</label>
                    <input
                        type="number"
                        min="1"
                        value={config.page_size || 50}
                        onChange={(e) => onChange({ ...config, page_size: parseInt(e.target.value) || 1 })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Param pagination</label>
                    <input
                        type="text"
                        value={config.pagination_param || ""}
                        onChange={(e) => onChange({ ...config, pagination_param: e.target.value })}
                        placeholder="offset"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Param taille</label>
                    <input
                        type="text"
                        value={config.pagination_size_param || ""}
                        onChange={(e) => onChange({ ...config, pagination_size_param: e.target.value })}
                        placeholder="limit"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Items path</label>
                    <input
                        type="text"
                        value={config.response_items_path || ""}
                        onChange={(e) => onChange({ ...config, response_items_path: e.target.value })}
                        placeholder="$.data.items"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID path</label>
                    <input
                        type="text"
                        value={config.response_id_path || ""}
                        onChange={(e) => onChange({ ...config, response_id_path: e.target.value })}
                        placeholder="$.id"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content path</label>
                    <input
                        type="text"
                        value={config.response_content_path || ""}
                        onChange={(e) => onChange({ ...config, response_content_path: e.target.value })}
                        placeholder="$.body"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title path</label>
                    <input
                        type="text"
                        value={config.response_title_path || ""}
                        onChange={(e) => onChange({ ...config, response_title_path: e.target.value })}
                        placeholder="$.title"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date path</label>
                    <input
                        type="text"
                        value={config.response_date_path || ""}
                        onChange={(e) => onChange({ ...config, response_date_path: e.target.value })}
                        placeholder="$.updated_at"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max items</label>
                    <input
                        type="number"
                        min="1"
                        value={config.max_items || 1000}
                        onChange={(e) => onChange({ ...config, max_items: parseInt(e.target.value) || 1 })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            </div>
        </div>
    );
}
