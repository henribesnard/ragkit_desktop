import { Button } from "@/components/ui/Button";
import { FolderOpen } from "lucide-react";

interface SourceSettingsProps {
    config: any;
    onChange: (key: string, value: any) => void;
}

export function SourceSettings({ config, onChange }: SourceSettingsProps) {
    if (!config) return null;
    const source = config.source;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Répertoire source</label>
                    <div className="flex gap-2">
                        <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm truncate font-mono">
                            {source.path || "Non configuré"}
                        </div>
                        {/* Read-only for Step 1 manual validation context mostly, or re-open dialog */}
                        <Button variant="outline" disabled className="opacity-50 cursor-not-allowed">
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
            </div>
        </div>
    );
}
