import { useTranslation } from "react-i18next";
import { Settings as SettingsIcon, Layers, FileText, Scissors, Brain, Database, Search } from "lucide-react";
import { useState } from "react";
import { IngestionSettings } from "@/components/settings/IngestionSettings";
import { ChunkingSettings } from "@/components/settings/ChunkingSettings";
import { EmbeddingSettings } from "@/components/settings/EmbeddingSettings";
import { VectorStoreSettings } from "@/components/settings/VectorStoreSettings";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { SemanticSearchSettings } from "@/components/settings/SemanticSearchSettings";
import { LexicalSearchSettings } from "@/components/settings/LexicalSearchSettings";
import { HybridSearchSettings } from "@/components/settings/HybridSearchSettings";
import { RerankSettings } from "@/components/settings/RerankSettings";
import { LLMSettings } from "@/components/settings/LLMSettings";

export function Settings() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<
    "general" | "ingestion" | "chunking" | "embedding" | "vector" | "semantic" | "lexical" | "hybrid" | "rerank" | "llm"
  >("ingestion");

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
        <SettingsIcon className="w-6 h-6" />
        {t("settings.title")}
      </h1>

      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 pr-4">
          <nav className="space-y-1">
            <button onClick={() => setActiveSection("general")} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${activeSection === "general" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}><Layers className="w-4 h-4" />General</button>
            <div className="pt-4 pb-2"><span className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Avance</span></div>
            <button onClick={() => setActiveSection("ingestion")} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${activeSection === "ingestion" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}><FileText className="w-4 h-4" />Ingestion & Preprocessing</button>
            <button onClick={() => setActiveSection("embedding")} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${activeSection === "embedding" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}><Brain className="w-4 h-4" />Embedding</button>
            <button onClick={() => setActiveSection("chunking")} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${activeSection === "chunking" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}><Scissors className="w-4 h-4" />Chunking</button>
            <button onClick={() => setActiveSection("vector")} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${activeSection === "vector" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}><Database className="w-4 h-4" />Base vectorielle</button>
            <button onClick={() => setActiveSection("semantic")} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${activeSection === "semantic" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}><Search className="w-4 h-4" />Recherche semantique</button>
            <button onClick={() => setActiveSection("lexical")} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${activeSection === "lexical" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}><Search className="w-4 h-4" />Recherche lexicale</button>
            <button onClick={() => setActiveSection("hybrid")} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${activeSection === "hybrid" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}><Search className="w-4 h-4" />Recherche hybride</button>
            <button onClick={() => setActiveSection("rerank")} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${activeSection === "rerank" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}><Search className="w-4 h-4" />Reranking</button>
            <button onClick={() => setActiveSection("llm")} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${activeSection === "llm" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}><Search className="w-4 h-4" />LLM / Generation</button>
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto pl-2">
          {activeSection === "general" && <GeneralSettings />}
          {activeSection === "ingestion" && <IngestionSettings />}
          {activeSection === "embedding" && <EmbeddingSettings />}
          {activeSection === "chunking" && <ChunkingSettings />}
          {activeSection === "vector" && <VectorStoreSettings />}
          {activeSection === "semantic" && <SemanticSearchSettings />}
          {activeSection === "lexical" && <LexicalSearchSettings />}
          {activeSection === "hybrid" && <HybridSearchSettings />}
          {activeSection === "rerank" && <RerankSettings />}
          {activeSection === "llm" && <LLMSettings />}
        </div>
      </div>
    </div>
  );
}
