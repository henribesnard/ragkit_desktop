import { Button } from "@/components/ui/Button";
import { FolderOpen, Plus, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

interface SourceSettingsProps {
    config: any;
    onChange: (key: string, value: any) => void;
}

const SUPPORTED_EXTENSIONS = ["pdf", "docx", "doc", "md", "txt", "html", "csv", "xml", "json", "yaml", "rst"];

export function SourceSettings({ config, onChange }: SourceSettingsProps) {
    if (!config) return null;
    const source = config.source;

    const handleBrowse = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                defaultPath: source.path || undefined,
            });
            if (selected) {
                onChange("source.path", selected);
            }
        } catch (error) {
            console.error("Failed to open dialog:", error);
        }
    };

    const handleFileTypeToggle = (ext: string) => {
        const current = source.file_types || [];
        if (current.includes(ext)) {
            onChange("source.file_types", current.filter((e: string) => e !== ext));
        } else {
            onChange("source.file_types", [...current, ext]);
        }
    };

    const handleAddExclusion = () => {
        const current = source.excluded_dirs || [];
        onChange("source.excluded_dirs", [...current, ""]);
    };

    const handleUpdateExclusion = (index: number, value: string) => {
        const current = [...(source.excluded_dirs || [])];
        current[index] = value;
        onChange("source.excluded_dirs", current);
    };

    const handleRemoveExclusion = (index: number) => {
        const current = [...(source.excluded_dirs || [])];
        current.splice(index, 1);
        onChange("source.excluded_dirs", current);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
                {/* Source Path */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Répertoire source</label>
                    <div className="flex gap-2">
                        <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm truncate font-mono">
                            {source.path || "Non configuré"}
                        </div>
                        <Button variant="outline" onClick={handleBrowse}>
                            <FolderOpen className="w-4 h-4 mr-2" />
                            Modifier
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={source.recursive}
                        onChange={(e) => onChange("source.recursive", e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label className="text-sm text-gray-700 dark:text-gray-300">Scanner les sous-dossiers</label>
                </div>

                {/* File Types */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Types de fichiers inclus</label>
                    <div className="flex flex-wrap gap-2">
                        {SUPPORTED_EXTENSIONS.map((ext) => (
                            <label key={ext} className="inline-flex items-center px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                                    checked={(source.file_types || []).includes(ext)}
                                    onChange={() => handleFileTypeToggle(ext)}
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300 uppercase">{ext}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Max File Size */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Taille maximale par fichier (Mo)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="500"
                            value={source.max_file_size_mb || 50}
                            onChange={(e) => onChange("source.max_file_size_mb", parseInt(e.target.value) || 50)}
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                    </div>

                    {/* Excluded Directories */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Dossiers exclus
                        </label>
                        <div className="space-y-2">
                            {(source.excluded_dirs || []).map((dir: string, index: number) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={dir}
                                        onChange={(e) => handleUpdateExclusion(index, e.target.value)}
                                        placeholder="Nom du dossier"
                                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                    />
                                    <button
                                        onClick={() => handleRemoveExclusion(index)}
                                        className="p-2 text-gray-400 hover:text-red-500"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <Button variant="ghost" size="sm" onClick={handleAddExclusion} className="text-blue-600 hover:text-blue-700 p-0 h-auto">
                                <Plus className="w-4 h-4 mr-1" />
                                Ajouter un dossier exclu
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
