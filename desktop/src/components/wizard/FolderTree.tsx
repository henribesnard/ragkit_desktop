import { FileText, Folder } from "lucide-react";

interface FolderTreeProps {
    path: string | null;
    stats: any | null;
}

export function FolderTree({ path, stats }: FolderTreeProps) {
    if (!path) {
        return (
            <div className="border rounded-md p-8 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-sm h-48 flex flex-col items-center justify-center text-gray-400">
                <Folder className="w-8 h-8 mb-2 opacity-50" />
                <p>Veuillez sélectionner un dossier pour voir son contenu.</p>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="border rounded-md p-8 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-sm h-48 flex items-center justify-center text-gray-500 italic">
                Analyse du dossier en cours...
            </div>
        );
    }

    return (
        <div className="border rounded-md bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-sm h-48 flex flex-col">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider flex justify-between">
                <span>Contenu détecté</span>
                <span>{stats.files} fichiers</span>
            </div>

            <div className="overflow-y-auto flex-1 p-2">
                {stats.extension_counts && Object.keys(stats.extension_counts).length > 0 ? (
                    <div className="space-y-1">
                        {Object.entries(stats.extension_counts).map(([ext, count]: [string, any]) => (
                            <div key={ext} className="flex items-center justify-between px-2 py-1 rounded hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-3 h-3 text-blue-500" />
                                    <span className="font-mono text-xs">{ext}</span>
                                </div>
                                <span className="text-gray-500 text-xs">{count}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 italic">
                        Aucun fichier reconnu trouvé.
                    </div>
                )}
            </div>
        </div>
    );
}
