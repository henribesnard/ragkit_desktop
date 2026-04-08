import { Button } from "@/components/ui/Button";
import { Plus, X } from "lucide-react";

interface GitRepoFormProps {
    config: any;
    onChange: (config: any) => void;
}

export function GitRepoForm({ config, onChange }: GitRepoFormProps) {
    const fileTypes = config.file_types || [];
    const excludedDirs = config.excluded_dirs || [];
    const credential = config.credential || {};

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL du depot</label>
                    <input
                        type="text"
                        value={config.repo_url || ""}
                        onChange={(e) => onChange({ ...config, repo_url: e.target.value })}
                        placeholder="https://github.com/org/repo.git"
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Branche</label>
                    <input
                        type="text"
                        value={config.branch || "main"}
                        onChange={(e) => onChange({ ...config, branch: e.target.value })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Token (optionnel)</label>
                    <input
                        type="password"
                        value={credential.token || ""}
                        onChange={(e) => updateCredential("token", e.target.value)}
                        placeholder="ghp_..."
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profondeur clone</label>
                    <input
                        type="number"
                        min="1"
                        value={config.clone_depth || 1}
                        onChange={(e) => onChange({ ...config, clone_depth: parseInt(e.target.value) || 1 })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Types de fichiers</label>
                <div className="space-y-2">
                    {fileTypes.map((ft: string, index: number) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                value={ft}
                                onChange={(e) => updateList("file_types", index, e.target.value)}
                                placeholder="md"
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeListItem("file_types", index)}
                                className="p-2 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addListItem("file_types")}
                        type="button"
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter un type
                    </Button>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dossiers exclus</label>
                <div className="space-y-2">
                    {excludedDirs.map((dir: string, index: number) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                value={dir}
                                onChange={(e) => updateList("excluded_dirs", index, e.target.value)}
                                placeholder="node_modules"
                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => removeListItem("excluded_dirs", index)}
                                className="p-2 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addListItem("excluded_dirs")}
                        type="button"
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter un dossier
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 mt-6">
                    <input
                        type="checkbox"
                        id="readme-only"
                        checked={config.include_readme_only === true}
                        onChange={(e) => onChange({ ...config, include_readme_only: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="readme-only" className="text-sm text-gray-700 dark:text-gray-300">Documentation uniquement</label>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Taille max (Mo)</label>
                    <input
                        type="number"
                        min="1"
                        value={config.max_file_size_mb || 5}
                        onChange={(e) => onChange({ ...config, max_file_size_mb: parseInt(e.target.value) || 1 })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            </div>
        </div>
    );
}
