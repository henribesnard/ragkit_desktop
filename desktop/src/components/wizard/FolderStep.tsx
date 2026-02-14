import { WizardState } from "@/hooks/useWizard";
import { Button } from "@/components/ui/Button";
import { FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useState, useMemo } from "react";
import { FolderTree } from "./FolderTree";

interface FolderStepProps {
    state: WizardState;
    onNext: () => void;
    onPrev: () => void;
    setFolderPath: (path: string) => void;
    setFolderStats: (stats: any, tree: any) => void;
    setRecursive: (recursive: boolean) => void;
    toggleExclusion: (path: string) => void;
    excludedFolders: string[];
}

// Helper to check if a path is excluded or is a child of an excluded path
// Helper to check if a path is excluded or is a child of an excluded path
// (Unused for now as we use exact match in tree traversal, allowing subtree pruning)
// const isPathExcluded = ... 

// Recursive function to calculate stats
// Note: We need to traverse the tree. 
// If a node is explicitly excluded (it's in excludedFolders), we subtract it?
// Better: We sum up only included nodes.
// Problem: folderTree is a single root node usually.
// If root is excluded, result is 0.
// If root is included, we take its total count/size? No, that includes children.
// Method: Start with Total. Subtract "Top-level excluded nodes".
// A "top-level excluded node" is one that is in excludedFolders BUT its parent is NOT (or it has no parent).
// Since we don't have parent links easily, we traverse from root.
const calculateStats = (node: any, excludedFolders: string[]): { files: number, size_mb: number } => {
    if (!node) return { files: 0, size_mb: 0 };

    // Check if this node itself is in excludedFolders
    if (excludedFolders.includes(node.path)) {
        return { files: 0, size_mb: 0 };
    }

    // If not excluded, we need its contributions.
    // Since node.file_count and size_bytes are aggregated totals,
    // we can't just return node.stats because that includes excluded children.
    // We must manually sum the "files in this specific folder" + stats of included children.

    // BUT we don't have "files in this specific folder" in the Node model I defined!
    // I only defined aggregated `file_count`.
    // This is a blocker for precise calculation unless I assume:
    // Files in this folder = Total Aggregated - Sum(Children Aggregated).
    // Let's assume this holds true (it should).

    let directFiles = node.file_count;
    let directSize = node.size_bytes; // This allows us to deduce direct content

    let includedFiles = 0;
    let includedSize = 0;

    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            // Subtract child totals from parent totals to isolate "direct" (files in current dir)
            directFiles -= child.file_count;
            directSize -= child.size_bytes;

            // Recurse
            const childStats = calculateStats(child, excludedFolders);
            includedFiles += childStats.files;
            includedSize += childStats.size_mb;
        }
    }

    // Add direct files (those in the folder itself, not subfolders)
    includedFiles += directFiles;
    includedSize += directSize;

    return { files: includedFiles, size_mb: includedSize };
};


export function FolderStep({ state, onNext, onPrev, setFolderPath, setFolderStats, setRecursive, toggleExclusion, excludedFolders }: FolderStepProps) {
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

    const validateFolder = async (path: string, recursive?: boolean) => {
        setIsValidating(true);
        setError(null);
        try {
            const res: any = await invoke("validate_folder", {
                path,
                recursive: recursive ?? state.recursive,
            });
            if (res.valid) {
                // res.tree now includes size_bytes thanks to my backend update
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

    const handleRecursiveToggle = (checked: boolean) => {
        setRecursive(checked);
        if (state.folderPath) {
            validateFolder(state.folderPath, checked);
        }
    };

    // Calculate effective stats
    const effectiveStats = useMemo(() => {
        if (!state.folderTree) {
            return state.folderStats || { files: 0, size_mb: 0 };
        }

        // If recursive is off, current stats are correct (no exclusions possible in UI usually if not recursive, or logic simple)
        if (!state.recursive) {
            return state.folderStats;
        }

        const calculated = calculateStats(state.folderTree, excludedFolders);
        // Convert bytes to MB
        return {
            files: calculated.files,
            size_mb: calculated.size_mb / (1024 * 1024)
        };

    }, [state.folderTree, state.folderStats, excludedFolders, state.recursive]);

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
                            <span>{effectiveStats.files} fichiers sélectionnés</span>
                            <span>{effectiveStats.size_mb.toFixed(1)} Mo</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                className="rounded border-gray-300"
                                checked={state.recursive}
                                onChange={(e) => handleRecursiveToggle(e.target.checked)}
                            />
                            Inclure les sous-dossiers
                        </label>

                        {state.recursive && (
                            <FolderTree
                                path={state.folderPath}
                                tree={state.folderTree}
                                excludedFolders={excludedFolders}
                                onToggleExclusion={toggleExclusion}
                            />
                        )}
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
