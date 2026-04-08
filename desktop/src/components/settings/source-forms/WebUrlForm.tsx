import { Button } from "@/components/ui/Button";
import { Plus, X } from "lucide-react";

interface WebUrlFormProps {
    config: any;
    onChange: (config: any) => void;
}

const EXTRACT_OPTIONS = [
    { value: "text", label: "Texte" },
    { value: "markdown", label: "Markdown" },
    { value: "html_clean", label: "HTML nettoye" },
];

export function WebUrlForm({ config, onChange }: WebUrlFormProps) {
    const urls = config.urls || [""];
    const includePatterns = config.include_patterns || [];
    const excludePatterns = config.exclude_patterns || [];

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

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URLs a crawler</label>
                <div className="space-y-2">
                    {urls.map((url: string, index: number) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => updateList("urls", index, e.target.value)}
                                placeholder="https://example.com/docs"
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeListItem("urls", index)}
                                className="p-2 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addListItem("urls")}
                        type="button"
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter une URL
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profondeur de crawl</label>
                    <input
                        type="range"
                        min="0"
                        max="3"
                        value={config.crawl_depth ?? 0}
                        onChange={(e) => onChange({ ...config, crawl_depth: parseInt(e.target.value) })}
                        className="w-full"
                    />
                    <div className="text-xs text-gray-500 mt-1">0 = page seule, 1 = liens directs</div>
                </div>
                <div className="flex items-center gap-2 mt-6">
                    <input
                        type="checkbox"
                        id="same-domain"
                        checked={config.crawl_same_domain_only !== false}
                        onChange={(e) => onChange({ ...config, crawl_same_domain_only: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="same-domain" className="text-sm text-gray-700 dark:text-gray-300">Meme domaine uniquement</label>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pages maximum</label>
                    <input
                        type="number"
                        min="1"
                        value={config.max_pages || 100}
                        onChange={(e) => onChange({ ...config, max_pages: parseInt(e.target.value) || 1 })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mode d'extraction</label>
                    <select
                        value={config.extract_mode || "text"}
                        onChange={(e) => onChange({ ...config, extract_mode: e.target.value })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                        {EXTRACT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Patterns d'inclusion</label>
                    <div className="space-y-2">
                        {includePatterns.map((pattern: string, index: number) => (
                            <div key={index} className="flex gap-2">
                                <input
                                    type="text"
                                    value={pattern}
                                    onChange={(e) => updateList("include_patterns", index, e.target.value)}
                                    placeholder="*/docs/*"
                                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeListItem("include_patterns", index)}
                                    className="p-2 text-gray-400 hover:text-red-500"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addListItem("include_patterns")}
                            type="button"
                            className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Ajouter un pattern
                        </Button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Patterns d'exclusion</label>
                    <div className="space-y-2">
                        {excludePatterns.map((pattern: string, index: number) => (
                            <div key={index} className="flex gap-2">
                                <input
                                    type="text"
                                    value={pattern}
                                    onChange={(e) => updateList("exclude_patterns", index, e.target.value)}
                                    placeholder="*/login*"
                                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeListItem("exclude_patterns", index)}
                                    className="p-2 text-gray-400 hover:text-red-500"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addListItem("exclude_patterns")}
                            type="button"
                            className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Ajouter un pattern
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 mt-6">
                    <input
                        type="checkbox"
                        id="robots"
                        checked={config.respect_robots_txt !== false}
                        onChange={(e) => onChange({ ...config, respect_robots_txt: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="robots" className="text-sm text-gray-700 dark:text-gray-300">Respecter robots.txt</label>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User-Agent</label>
                    <input
                        type="text"
                        value={config.user_agent || "LOKO-RAG/1.0"}
                        onChange={(e) => onChange({ ...config, user_agent: e.target.value })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delai entre requetes (ms)</label>
                    <input
                        type="number"
                        min="0"
                        value={config.request_delay_ms || 0}
                        onChange={(e) => onChange({ ...config, request_delay_ms: parseInt(e.target.value) || 0 })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timeout (secondes)</label>
                    <input
                        type="number"
                        min="1"
                        value={config.timeout_seconds || 30}
                        onChange={(e) => onChange({ ...config, timeout_seconds: parseInt(e.target.value) || 30 })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            </div>
        </div>
    );
}

