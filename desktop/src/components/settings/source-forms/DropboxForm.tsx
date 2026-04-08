import { OAuthButton } from "@/components/settings/OAuthButton";
import { CloudFolderPicker } from "@/components/settings/CloudFolderPicker";
import { Button } from "@/components/ui/Button";
import { Plus, X } from "lucide-react";

interface DropboxFormProps {
    config: any;
    onChange: (config: any) => void;
    sourceId?: string;
    connected?: boolean;
    onConnected?: () => void;
}

export function DropboxForm({ config, onChange, sourceId, connected, onConnected }: DropboxFormProps) {
    const fileTypes = config.file_types || [];

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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Connexion Dropbox</label>
                <OAuthButton provider="dropbox" sourceId={sourceId} connected={connected} onConnected={onConnected} />
                {!sourceId && (
                    <p className="text-xs text-gray-500 mt-1">Enregistrez la source pour activer OAuth.</p>
                )}
            </div>

            <CloudFolderPicker
                label="Chemins de dossiers Dropbox"
                value={config.folder_paths || []}
                onChange={(value) => onChange({ ...config, folder_paths: value })}
                disabled={!connected}
                placeholder="/Documents"
            />

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Extensions autorisees</label>
                <div className="space-y-2">
                    {fileTypes.map((ft: string, index: number) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                value={ft}
                                onChange={(e) => updateList("file_types", index, e.target.value)}
                                placeholder="pdf"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 mt-6">
                    <input
                        type="checkbox"
                        id="db-recursive"
                        checked={config.recursive !== false}
                        onChange={(e) => onChange({ ...config, recursive: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="db-recursive" className="text-sm text-gray-700 dark:text-gray-300">Scanner les sous-dossiers</label>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Taille max (Mo)</label>
                    <input
                        type="number"
                        min="1"
                        value={config.max_file_size_mb || 50}
                        onChange={(e) => onChange({ ...config, max_file_size_mb: parseInt(e.target.value) || 50 })}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                </div>
            </div>
        </div>
    );
}

