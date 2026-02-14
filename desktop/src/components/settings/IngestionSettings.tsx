import { useState } from "react";
import { useIngestionConfig } from "@/hooks/useIngestionConfig";
import { useDocuments } from "@/hooks/useDocuments";
import { SourceSettings } from "./SourceSettings";
import { ParsingSettings } from "./ParsingSettings";
import { PreprocessingSettings } from "./PreprocessingSettings";
import { MetadataTable } from "./MetadataTable";
import { Button } from "@/components/ui/Button";
import { RefreshCw, RotateCcw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export function IngestionSettings() {
    const { config, loading, error, saveError, updateConfig, fetchConfig } = useIngestionConfig();
    const { documents, loading: loadingDocs, analyzing, progress, analyzeDocuments, fetchDocuments } = useDocuments();
    const [activeTab, setActiveTab] = useState<"config" | "metadata">("config");
    const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | null>(null);

    if (loading) return <div>Chargement de la configuration...</div>;
    if (error) return <div className="text-red-500">Erreur : {error}</div>;

    const handleConfigChange = async (key: string, value: any) => {
        setSaveStatus("saving");
        // Clone config deeply to avoiding mutation issues
        const newConfig = JSON.parse(JSON.stringify(config));

        // Set value by path (e.g. "parsing.engine")
        const parts = key.split(".");
        let current = newConfig;
        for (let i = 0; i < parts.length - 1; i++) {
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;

        const success = await updateConfig(newConfig);
        if (success) {
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus(null), 2000);
        } else {
            setSaveStatus(null);
        }
    };

    const handleReanalyze = async () => {
        await analyzeDocuments();
    };

    const handleReset = async () => {
        if (confirm("Voulez-vous vraiment réinitialiser la configuration aux valeurs par défaut du profil ?")) {
            try {
                await invoke("reset_ingestion_config");
                fetchConfig();
            } catch (e) {
                console.error(e);
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700 w-full">
                    <button
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'config' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        onClick={() => setActiveTab("config")}
                    >
                        Configuration
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'metadata' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        onClick={() => setActiveTab("metadata")}
                    >
                        Métadonnées ({documents?.length || 0})
                    </button>
                </div>
            </div>

            {saveError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong className="font-bold">Erreur de sauvegarde : </strong>
                    <span className="block sm:inline">{saveError}</span>
                </div>
            )}

            {saveStatus === "saved" && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded fixed bottom-4 right-4 shadow-lg animate-in fade-in slide-in-from-bottom-2 z-50">
                    Configuration sauvegardée
                </div>
            )}

            {activeTab === "config" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                    <section>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-100 dark:border-gray-800">Source</h3>
                        <SourceSettings config={config} onChange={handleConfigChange} />
                    </section>

                    <section>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-100 dark:border-gray-800">Parsing & OCR</h3>
                        <ParsingSettings config={config} onChange={handleConfigChange} />
                    </section>

                    <section>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b pb-2 border-gray-100 dark:border-gray-800">Prétraitement</h3>
                        <PreprocessingSettings config={config} onChange={handleConfigChange} />
                    </section>

                    <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button variant="outline" onClick={handleReanalyze}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Réanalyser les documents
                        </Button>
                        <Button variant="ghost" onClick={handleReset} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Réinitialiser le profil
                        </Button>
                    </div>
                </div>
            )}

            {activeTab === "metadata" && (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                    {analyzing ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500 space-y-4">
                            <div className="w-full max-w-md space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Analyse en cours...</span>
                                    <span className="font-medium">{progress?.percent || 0}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-600 transition-all duration-500 ease-out"
                                        style={{ width: `${progress?.percent || 0}%` }}
                                    />
                                </div>
                                <div className="text-xs text-center text-gray-400 truncate">
                                    {progress?.current_file ? `Traitement de : ${progress.current_file}` : "Préparation..."}
                                </div>
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>{progress?.processed || 0} / {progress?.total || "?"} fichiers</span>
                                    {progress?.errors ? <span className="text-red-400">{progress.errors} erreurs</span> : null}
                                </div>
                            </div>
                        </div>
                    ) : loadingDocs ? (
                        <div>Chargement des documents...</div>
                    ) : (
                        <MetadataTable documents={documents} onRefresh={fetchDocuments} />
                    )}
                </div>
            )}
        </div>
    );
}
