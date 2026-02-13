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
    const { config, loading, error, updateConfig, fetchConfig } = useIngestionConfig();
    const { documents, loading: loadingDocs, fetchDocuments } = useDocuments();
    const [activeTab, setActiveTab] = useState<"config" | "metadata">("config");

    if (loading) return <div>Chargement de la configuration...</div>;
    if (error) return <div className="text-red-500">Erreur : {error}</div>;

    const handleConfigChange = async (key: string, value: any) => {
        // Clone config deeply to avoiding mutation issues
        const newConfig = JSON.parse(JSON.stringify(config));

        // Set value by path (e.g. "parsing.engine")
        const parts = key.split(".");
        let current = newConfig;
        for (let i = 0; i < parts.length - 1; i++) {
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;

        await updateConfig(newConfig);
    };

    const handleReanalyze = async () => {
        try {
            await invoke("analyze_documents");
            fetchDocuments();
        } catch (e) {
            console.error(e);
        }
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
                    {loadingDocs ? <div>Chargement des documents...</div> : <MetadataTable documents={documents} />}
                </div>
            )}
        </div>
    );
}
