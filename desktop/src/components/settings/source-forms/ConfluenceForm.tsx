import { Button } from "@/components/ui/Button";
import { Plus, X } from "lucide-react";

interface ConfluenceFormProps {
    config: any;
    onChange: (config: any) => void;
}

export function ConfluenceForm({ config, onChange }: ConfluenceFormProps) {
    const spaceKeys = config.space_keys || [""];
    const labelFilter = config.label_filter || [];
    const authType = config.auth_type || "api_token";
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
            const { credential: _removed, ...rest } = config;
            onChange(rest);
        }
    };

    const updateCredential = (key: string, value: string) => {
        setCredential({ ...credential, [key]: value });
    };

    const handleAuthTypeChange = (value: string) => {
        const { credential: _removed, ...rest } = config;
        onChange({ ...rest, auth_type: value });
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL de base</label>
                <input
                    type="url"
                    value={config.base_url || ""}
                    onChange={(e) => onChange({ ...config, base_url: e.target.value })}
                    placeholder="https://mycompany.atlassian.net/wiki"
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type d'authentification</label>
                <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                            type="radio"
                            name="confluence-auth"
                            value="api_token"
                            checked={authType === "api_token"}
                            onChange={(e) => handleAuthTypeChange(e.target.value)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        API Token
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                            type="radio"
                            name="confluence-auth"
                            value="pat"
                            checked={authType === "pat"}
                            onChange={(e) => handleAuthTypeChange(e.target.value)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Personal Access Token
                    </label>
                </div>
            </div>

            {authType === "api_token" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                        <input
                            type="email"
                            value={credential.email || ""}
                            onChange={(e) => updateCredential("email", e.target.value)}
                            placeholder="user@company.com"
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Token</label>
                        <input
                            type="password"
                            value={credential.api_token || ""}
                            onChange={(e) => updateCredential("api_token", e.target.value)}
                            placeholder="ATATT3x..."
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                    </div>
                </div>
            )}

            {authType === "pat" && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Token</label>
                    <input
                        type="password"
                        value={credential.token || ""}
                        onChange={(e) => updateCredential("token", e.target.value)}
                        placeholder="NjM..."
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Espaces (space keys)</label>
                <div className="space-y-2">
                    {spaceKeys.map((key: string, index: number) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                value={key}
                                onChange={(e) => updateList("space_keys", index, e.target.value)}
                                placeholder="DEV"
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeListItem("space_keys", index)}
                                className="p-2 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addListItem("space_keys")}
                        type="button"
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter un espace
                    </Button>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filtres labels</label>
                <div className="space-y-2">
                    {labelFilter.map((label: string, index: number) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                value={label}
                                onChange={(e) => updateList("label_filter", index, e.target.value)}
                                placeholder="documentation"
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeListItem("label_filter", index)}
                                className="p-2 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addListItem("label_filter")}
                        type="button"
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter un label
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 mt-6">
                    <input
                        type="checkbox"
                        id="include-attachments"
                        checked={config.include_attachments === true}
                        onChange={(e) => onChange({ ...config, include_attachments: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="include-attachments" className="text-sm text-gray-700 dark:text-gray-300">Inclure les pieces jointes</label>
                </div>
                <div className="flex items-center gap-2 mt-6">
                    <input
                        type="checkbox"
                        id="include-comments"
                        checked={config.include_comments === true}
                        onChange={(e) => onChange({ ...config, include_comments: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="include-comments" className="text-sm text-gray-700 dark:text-gray-300">Inclure les commentaires</label>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 mt-6">
                    <input
                        type="checkbox"
                        id="exclude-archived"
                        checked={config.exclude_archived !== false}
                        onChange={(e) => onChange({ ...config, exclude_archived: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="exclude-archived" className="text-sm text-gray-700 dark:text-gray-300">Exclure les pages archivees</label>
                </div>
                <div className="flex items-center gap-2 mt-6">
                    <input
                        type="checkbox"
                        id="expand-macros"
                        checked={config.expand_macros !== false}
                        onChange={(e) => onChange({ ...config, expand_macros: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="expand-macros" className="text-sm text-gray-700 dark:text-gray-300">Etendre les macros</label>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pages maximum</label>
                <input
                    type="number"
                    min="1"
                    value={config.page_limit || 500}
                    onChange={(e) => onChange({ ...config, page_limit: parseInt(e.target.value) || 1 })}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
            </div>
        </div>
    );
}
