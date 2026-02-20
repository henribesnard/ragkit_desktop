import { useTranslation } from "react-i18next";
import { Settings as SettingsIcon, Layers, FileText, Scissors, Brain, Database, Search, Activity, Shield } from "lucide-react";
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
import { AgentsSettings } from "@/components/settings/AgentsSettings";
import { MonitoringSettings } from "@/components/settings/MonitoringSettings";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { useExpertiseLevel } from "@/hooks/useExpertiseLevel";
import { isSectionVisible } from "@/lib/visibility";

type Section = "general" | "ingestion" | "chunking" | "embedding" | "vector" | "semantic" | "lexical" | "hybrid" | "rerank" | "llm" | "agents" | "monitoring" | "security";

const SECTION_VISIBILITY_MAP: Record<string, string> = {
  ingestion: "ingestion_source",
  embedding: "embedding_provider",
  chunking: "chunking_strategy",
  vector: "vector_db_provider",
  semantic: "semantic_search",
  lexical: "lexical_search",
  hybrid: "hybrid_alpha",
  rerank: "reranking",
  llm: "llm_provider",
  agents: "agents_intents",
  monitoring: "monitoring",
  security: "security",
};

export function Settings() {
  const { t } = useTranslation();
  const { level } = useExpertiseLevel();
  const [activeSection, setActiveSection] = useState<Section>("general");

  const isVisible = (section: Section) => {
    if (section === "general") return true;
    const visibilityKey = SECTION_VISIBILITY_MAP[section] || section;
    return isSectionVisible(visibilityKey, level);
  };

  const navButton = (section: Section, icon: React.ReactNode, label: string) => {
    if (!isVisible(section)) return null;
    return (
      <button
        key={section}
        onClick={() => setActiveSection(section)}
        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${activeSection === section ? "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
        <SettingsIcon className="w-6 h-6" />
        {t("settings.title")}
      </h1>

      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 pr-4">
          <nav className="space-y-1">
            {navButton("general", <Layers className="w-4 h-4" />, t("settings.general", "General"))}

            {(isVisible("ingestion") || isVisible("embedding") || isVisible("chunking") || isVisible("vector") || isVisible("semantic") || isVisible("lexical") || isVisible("hybrid") || isVisible("rerank") || isVisible("llm") || isVisible("agents") || isVisible("monitoring") || isVisible("security")) && (
              <div className="pt-4 pb-2">
                <span className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("settings.advanced", "Avance")}
                </span>
              </div>
            )}

            {navButton("ingestion", <FileText className="w-4 h-4" />, t("settings.ingestion", "Ingestion & Preprocessing"))}
            {navButton("embedding", <Brain className="w-4 h-4" />, t("settings.embedding", "Embedding"))}
            {navButton("chunking", <Scissors className="w-4 h-4" />, t("settings.chunking", "Chunking"))}
            {navButton("vector", <Database className="w-4 h-4" />, t("settings.vectorStore", "Base vectorielle"))}
            {navButton("semantic", <Search className="w-4 h-4" />, t("settings.semanticSearch", "Recherche semantique"))}
            {navButton("lexical", <Search className="w-4 h-4" />, t("settings.lexicalSearch", "Recherche lexicale"))}
            {navButton("hybrid", <Search className="w-4 h-4" />, t("settings.hybridSearch", "Recherche hybride"))}
            {navButton("rerank", <Search className="w-4 h-4" />, t("settings.reranking", "Reranking"))}
            {navButton("llm", <Search className="w-4 h-4" />, t("settings.llm", "LLM / Generation"))}
            {navButton("agents", <Search className="w-4 h-4" />, t("settings.agents", "Agents"))}
            {navButton("monitoring", <Activity className="w-4 h-4" />, t("settings.monitoring", "Monitoring"))}
            {navButton("security", <Shield className="w-4 h-4" />, t("settings.security", "Securite"))}
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
          {activeSection === "agents" && <AgentsSettings />}
          {activeSection === "monitoring" && <MonitoringSettings />}
          {activeSection === "security" && <SecuritySettings />}
        </div>
      </div>
    </div>
  );
}
