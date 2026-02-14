import { WizardState } from "@/hooks/useWizard";
import { Button } from "@/components/ui/Button";
import { FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { FolderTree } from "./FolderTree";

interface FolderStepProps {
    state: WizardState;
    onNext: () => void;
    onPrev: () => void;
    setFolderPath: (path: string) => void;
    setFolderStats: (stats: any, tree: any) => void; // Update signature
    toggleExclusion: (path: string) => void;
    excludedFolders: string[];
}

export function FolderStep({ state, onNext, onPrev, setFolderPath, setFolderStats, toggleExclusion, excludedFolders }: FolderStepProps) {
    const [error, setError] = useState<string | null>(null);
    const [isValidating, setIsValidating] = useState(false);

    const handleSelectFolder = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                recursive: true,
            });

            if (selected && typeof selected === "string") {
                setFolderPath(selected);
                validateFolder(selected);
            }
        } catch (err) {
            console.error(err);
            setError("Erreur lors de la sélection du dossier");
        }
    };

    const validateFolder = async (path: string) => {
        setIsValidating(true);
        setError(null);
        try {
            const res: any = await invoke("validate_folder", { path });
            if (res.valid) {
                setFolderStats(res.stats, res.tree);
            } else {
                setError(res.error || "Dossier invalide");
                setFolderStats(null, null);
            }
        } catch (err) {
            setError("Erreur de validation: " + err);
        } finally {
            setIsValidating(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto h-full flex flex-col">
            <div className="flex-1">
                <h2 className="text-xl font-bold mb-6 text-center">Sélectionnez le répertoire de vos documents</h2>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
                    <div className="flex gap-4 mb-4">
                        <div className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-700 dark:text-gray-300 font-mono truncate flex items-center">
                            {state.folderPath || "Aucun dossier sélectionné"}
                        </div>
                        <Button onClick={handleSelectFolder} variant="outline" className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4" />
                            Parcourir
                        </Button>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm mb-4 bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-100 dark:border-red-900">
                            {error}
                        </div>
                    )}

                    {state.folderStats && (
                        <div className="flex items-center gap-4 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-100 dark:border-green-900 mb-4">
                            <span className="font-semibold">✓ Dossier valide</span>
                            <span>{state.folderStats.files} fichiers trouvés</span>
                            <span>{(state.folderStats.size_mb).toFixed(1)} Mo</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                            Inclure les sous-dossiers
                        </label>

                        <FolderTree
                            path={state.folderPath}
                            tree={state.folderTree}
                            excludedFolders={excludedFolders}
                            onToggleExclusion={toggleExclusion}
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
                <Button variant="ghost" onClick={onPrev}>← Retour</Button>
                <Button onClick={onNext} disabled={!state.folderPath || !!error || isValidating}>
                    {isValidating ? "Validation..." : "Suivant →"}
                </Button>
            </div>
        </div>
    );
}
