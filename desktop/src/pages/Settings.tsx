import { useTranslation } from "react-i18next";
import { Settings as SettingsIcon, Layers, FileText, Scissors } from "lucide-react";
import { useState } from "react";
import { IngestionSettings } from "@/components/settings/IngestionSettings";
import { ChunkingSettings } from "@/components/settings/ChunkingSettings";

export function Settings() {
    const { t } = useTranslation();
    const [activeSection, setActiveSection] = useState<"general" | "ingestion" | "chunking">("ingestion");

    return (
        <div className="h-full flex flex-col">
            <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                <SettingsIcon className="w-6 h-6" />
                {t("settings.title")}
            </h1>

            <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Sidebar Settings */}
                <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 pr-4">
                    <nav className="space-y-1">
                        <button
                            onClick={() => setActiveSection("general")}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeSection === "general"
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200"
                                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                }`}
                        >
                            <Layers className="w-4 h-4" />
                            Général
                        </button>
                        <div className="pt-4 pb-2">
                            <span className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Avancé
                            </span>
                        </div>
                        <button
                            onClick={() => setActiveSection("ingestion")}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeSection === "ingestion"
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200"
                                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                }`}
                        >
                            <FileText className="w-4 h-4" />
                            Ingestion & Préprocessing
                        </button>
                        <button
                            onClick={() => setActiveSection("chunking")}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeSection === "chunking"
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200"
                                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                }`}
                        >
                            <Scissors className="w-4 h-4" />
                            Chunking
                        </button>
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto pl-2">
                    {activeSection === "general" && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                                <SettingsIcon size={32} className="text-gray-400 dark:text-gray-500" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                                {t("settings.placeholder")}
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 max-w-md">
                                {t("settings.description")}
                            </p>
                        </div>
                    )}

                    {activeSection === "ingestion" && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                                    Configuration de l'ingestion
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    Gérez comment vos documents sont analysés et transformés.
                                </p>
                            </div>
                            <IngestionSettings />
                        </div>
                    )}


                    {activeSection === "chunking" && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                                    Configuration du chunking
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    Ajustez la stratégie de découpage et prévisualisez les résultats en temps réel.
                                </p>
                            </div>
                            <ChunkingSettings />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
