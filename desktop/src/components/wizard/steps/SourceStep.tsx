import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { FolderOpen, Loader2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { FolderTree } from "../FolderTree";

export function SourceStep({ wizard }: { wizard: any }) {
    const { state, updateConfig } = wizard;
    const sourceCfg = state.config?.ingestion?.source || {
        path: "",
        recursive: true,
        excluded_dirs: [],
        file_types: ["pdf", "docx", "doc", "md", "txt"]
    };

    const [isValidating, setIsValidating] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [folderTree, setFolderTree] = useState<any>(null);
    const [scanResult, setScanResult] = useState<any>(null);

    const updateSource = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.ingestion) cfg.ingestion = {};
            if (!cfg.ingestion.source) cfg.ingestion.source = {};
            cfg.ingestion.source = { ...cfg.ingestion.source, ...patch };
            return cfg;
        });
    };

    const handleSelectFolder = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                recursive: true,
            });
            if (selected && typeof selected === "string") {
                updateSource({ path: selected, excluded_dirs: [] });
            }
        } catch (err) {
            console.error(err);
            setError("Erreur lors de la sélection du dossier");
        }
    };

    // 1. Validate tree structure
    useEffect(() => {
        if (!sourceCfg.path) return;
        const validate = async () => {
            setIsValidating(true);
            try {
                const res: any = await invoke("validate_folder", {
                    path: sourceCfg.path,
                    recursive: sourceCfg.recursive,
                });
                if (res.valid) {
                    setFolderTree(res.tree);
                    setError(null);
                } else {
                    setError(res.error || "Dossier invalide");
                    setFolderTree(null);
                }
            } catch (err) {
                setError("Erreur de validation: " + err);
            } finally {
                setIsValidating(false);
            }
        };
        validate();
    }, [sourceCfg.path, sourceCfg.recursive]);

    // 2. Scan file types based on exclusions
    useEffect(() => {
        if (!sourceCfg.path || isValidating || !!error) return;
        const scan = async () => {
            setIsScanning(true);
            try {
                const res: any = await invoke("scan_folder", {
                    params: {
                        folder_path: sourceCfg.path,
                        recursive: sourceCfg.recursive,
                        excluded_dirs: sourceCfg.excluded_dirs,
                    }
                });
                setScanResult(res);

                // Auto-include all supported types from the scan by default
                if (res.supported_types?.length > 0) {
                    const allSupported = res.supported_types.map((t: any) => t.extension.replace(".", ""));
                    updateSource({ file_types: allSupported });
                }
            } catch (err) {
                console.error("Scan error:", err);
            } finally {
                setIsScanning(false);
            }
        };
        // Debounce slightly if needed, but direct calls are fine for desktop
        const t = setTimeout(scan, 300);
        return () => clearTimeout(t);
    }, [sourceCfg.path, sourceCfg.recursive, sourceCfg.excluded_dirs, isValidating, error]);

    const toggleExclusion = (path: string) => {
        const current = [...(sourceCfg.excluded_dirs || [])];
        const idx = current.indexOf(path);
        if (idx >= 0) {
            current.splice(idx, 1);
        } else {
            current.push(path);
        }
        updateSource({ excluded_dirs: current });
    };

    const handleToggleType = (ext: string) => {
        const cleanExt = ext.replace(".", "");
        const current = [...(sourceCfg.file_types || [])];
        const idx = current.indexOf(cleanExt);
        if (idx >= 0) {
            current.splice(idx, 1);
        } else {
            current.push(cleanExt);
        }
        updateSource({ file_types: current });
    };

    const isIncluded = (ext: string) => {
        return (sourceCfg.file_types || []).includes(ext.replace(".", ""));
    };

    return (
        <div className="max-w-3xl mx-auto h-full flex flex-col">
            <div className="flex-1 overflow-y-auto pr-2">
                <h2 className="text-xl font-bold mb-6 text-center">Sélection de la Source de Documents</h2>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
                    <div className="flex gap-4 mb-4">
                        <div className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-700 dark:text-gray-300 font-mono truncate flex items-center">
                            {sourceCfg.path || "Aucun dossier sélectionné"}
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

                    <div className="space-y-4">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                className="rounded border-gray-300"
                                checked={sourceCfg.recursive}
                                onChange={(e) => updateSource({ recursive: e.target.checked })}
                            />
                            Inclure les sous-dossiers
                        </label>

                        {sourceCfg.recursive && folderTree && (
                            <FolderTree
                                path={sourceCfg.path}
                                tree={folderTree}
                                excludedFolders={sourceCfg.excluded_dirs}
                                onToggleExclusion={toggleExclusion}
                            />
                        )}
                    </div>
                </div>

                {/* Second block: File Types */}
                {(isScanning || scanResult) && !error && (
                    <div className="bg-white dark:bg-gray-800 p-6 flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
                        <h3 className="font-semibold flex items-center gap-2">
                            Types de Fichiers détectés
                            {isScanning && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                        </h3>

                        {!isScanning && scanResult?.supported_types && (
                            <div className="space-y-2">
                                {scanResult.supported_types.map((type: any) => (
                                    <div key={type.extension} className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-lg transition-colors cursor-pointer" onClick={() => handleToggleType(type.extension)}>
                                        <input
                                            type="checkbox"
                                            checked={isIncluded(type.extension)}
                                            onChange={() => { }}
                                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                        />
                                        <span className="font-mono text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded uppercase w-16 text-center">
                                            {type.display_name}
                                        </span>
                                        <div className="flex-1 flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                            <span>{type.count} fichiers</span>
                                            <span>{type.size_mb.toFixed(2)} Mo</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {!isScanning && scanResult?.supported_types?.length === 0 && (
                            <p className="text-sm text-gray-500 italic">Aucun fichier supporté trouvé.</p>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
                <Button variant="ghost" onClick={() => wizard.prevStep()}>← Retour</Button>
                <Button onClick={() => wizard.nextStep()} disabled={!sourceCfg.path || !!error || isValidating || isScanning}>
                    Suivant →
                </Button>
            </div>
        </div>
    );
}
