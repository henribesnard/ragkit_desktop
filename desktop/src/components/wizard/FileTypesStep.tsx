import { WizardState } from "@/hooks/useWizard";
import { Button } from "@/components/ui/Button";
import { ProfileSummary } from "./ProfileSummary";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

interface FileTypesStepProps {
    state: WizardState;
    onPrev: () => void;
    onComplete: () => Promise<void>;
    setIncludedFileTypes: (types: string[]) => void;
}

interface FileTypeInfo {
    extension: string;
    display_name: string;
    count: number;
    size_mb: number;
    supported: boolean;
}

interface ScanResult {
    supported_types: FileTypeInfo[];
    unsupported_types: FileTypeInfo[];
    total_files: number;
    total_size_mb: number;
}

export function FileTypesStep({ state, onPrev, onComplete, setIncludedFileTypes }: FileTypesStepProps) {
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleComplete = async () => {
        setCompleting(true);
        setError(null);
        try {
            await onComplete();
        } catch (e) {
            console.error("Completion failed:", e);
            setError("Erreur lors de la finalisation. Veuillez réessayer.");
            setCompleting(false);
        }
    };

    useEffect(() => {
        const scan = async () => {
            if (!state.folderPath) return;
            setLoading(true);
            try {
                const res: ScanResult = await invoke("scan_folder", {
                    params: {
                        folder_path: state.folderPath,
                        recursive: state.recursive,
                        excluded_dirs: state.excludedFolders,
                    }
                });
                setScanResult(res);

                // Initialize included types with all supported types found
                if (state.includedFileTypes.length === 5 && res.supported_types.length > 0) { // If default list
                    const allSupported = res.supported_types.map(t => t.extension.replace(".", ""));
                    setIncludedFileTypes(allSupported);
                }
            } catch (err) {
                console.error(err);
                setError("Erreur lors de l'analyse des types de fichiers");
            } finally {
                setLoading(false);
            }
        };
        scan();
    }, [state.folderPath, state.recursive, state.excludedFolders]); // Re-scan if these change

    const handleToggleType = (ext: string) => {
        const cleanExt = ext.replace(".", "");
        const current = state.includedFileTypes;
        if (current.includes(cleanExt)) {
            setIncludedFileTypes(current.filter(e => e !== cleanExt));
        } else {
            setIncludedFileTypes([...current, cleanExt]);
        }
    };

    const isIncluded = (ext: string) => {
        return state.includedFileTypes.includes(ext.replace(".", ""));
    };

    return (
        <div className="max-w-3xl mx-auto h-full flex flex-col">
            <div className="flex-1 overflow-y-auto px-1">
                <h2 className="text-xl font-bold mb-6 text-center">Types de documents trouvés</h2>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <Loader2 className="w-8 h-8 animate-spin mb-4" />
                        <p>Analyse des fichiers en cours...</p>
                    </div>
                ) : error ? (
                    <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-md text-center">
                        <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                        {error}
                    </div>
                ) : scanResult ? (
                    <>
                        <div className="grid gap-6 mb-8">
                            {/* Supported Types */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 font-medium text-sm flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                        Fichiers supportés (à indexer)
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {scanResult.supported_types.reduce((acc, t) => acc + t.count, 0)} fichiers
                                    </span>
                                </div>
                                <div className="p-4 space-y-2">
                                    {scanResult.supported_types.length > 0 ? (
                                        scanResult.supported_types.map((type) => (
                                            <div key={type.extension} className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-lg transition-colors cursor-pointer" onClick={() => handleToggleType(type.extension)}>
                                                <input
                                                    type="checkbox"
                                                    checked={isIncluded(type.extension)}
                                                    onChange={() => { }} // Handle click on div
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
                                        ))
                                    ) : (
                                        <div className="text-center py-4 text-gray-500 italic text-sm">
                                            Aucun fichier supporté trouvé
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Unsupported Types */}
                            {scanResult.unsupported_types.length > 0 && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden opacity-80">
                                    <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 font-medium text-sm flex justify-between items-center text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" />
                                            Fichiers non supportés (ignorés)
                                        </div>
                                        <span className="text-xs">
                                            {scanResult.unsupported_types.reduce((acc, t) => acc + t.count, 0)} fichiers
                                        </span>
                                    </div>
                                    <div className="p-4 space-y-2">
                                        {scanResult.unsupported_types.map((type) => (
                                            <div key={type.extension} className="flex items-center gap-3 p-2 text-gray-400">
                                                <input type="checkbox" disabled checked={false} className="rounded border-gray-300 bg-gray-100" />
                                                <span className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded uppercase w-16 text-center">
                                                    {type.display_name}
                                                </span>
                                                <div className="flex-1 flex justify-between text-sm">
                                                    <span>{type.count} fichiers</span>
                                                    <span>{type.size_mb.toFixed(2)} Mo</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="text-center text-sm text-gray-500 mb-6 font-medium">
                            📊 Total analysé : {scanResult.total_files} fichiers · {scanResult.total_size_mb} Mo
                        </div>
                    </>
                ) : null}

                <ProfileSummary profile={state.profile} calibration={state.calibration} />
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
                <Button variant="ghost" onClick={onPrev} disabled={completing}>← Retour</Button>
                <Button onClick={handleComplete} variant="default" disabled={state.includedFileTypes.length === 0 || completing}>
                    {completing ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enregistrement...</>
                    ) : (
                        "✓ Terminer la configuration"
                    )}
                </Button>
            </div>
        </div>
    );
}
