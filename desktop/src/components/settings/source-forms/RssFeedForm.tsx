import { Button } from "@/components/ui/Button";
import { Plus, X } from "lucide-react";

interface RssFeedFormProps {
    config: any;
    onChange: (config: any) => void;
}

export function RssFeedForm({ config, onChange }: RssFeedFormProps) {
    const feedUrls = config.feed_urls || [""];
    const selectors = config.content_selectors || [];

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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URLs des flux RSS/Atom</label>
                <div className="space-y-2">
                    {feedUrls.map((url: string, index: number) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => updateList("feed_urls", index, e.target.value)}
                                placeholder="https://example.com/rss.xml"
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeListItem("feed_urls", index)}
                                className="p-2 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addListItem("feed_urls")}
                        type="button"
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter un flux
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Articles maximum par flux</label>
                    <input
                        type="number"
                        min="1"
                        value={config.max_articles || 50}
                        onChange={(e) => onChange({ ...config, max_articles: parseInt(e.target.value) || 1 })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Age max (jours)</label>
                    <input
                        type="number"
                        min="1"
                        value={config.max_age_days || ""}
                        onChange={(e) => onChange({ ...config, max_age_days: e.target.value ? parseInt(e.target.value) : null })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="Optionnel"
                    />
                </div>
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="fetch-full"
                    checked={config.fetch_full_content === true}
                    onChange={(e) => onChange({ ...config, fetch_full_content: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="fetch-full" className="text-sm text-gray-700 dark:text-gray-300">Recuperer le contenu complet</label>
            </div>

            {config.fetch_full_content && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Selecteurs CSS (optionnel)</label>
                    <div className="space-y-2">
                        {selectors.map((selector: string, index: number) => (
                            <div key={index} className="flex gap-2">
                                <input
                                    type="text"
                                    value={selector}
                                    onChange={(e) => updateList("content_selectors", index, e.target.value)}
                                    placeholder="article, .post-content"
                                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeListItem("content_selectors", index)}
                                    className="p-2 text-gray-400 hover:text-red-500"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addListItem("content_selectors")}
                            type="button"
                            className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Ajouter un selecteur
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

