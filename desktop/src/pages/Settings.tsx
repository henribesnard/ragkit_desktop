import { useTranslation } from "react-i18next";
import { Layers, FileText, Scissors, Brain, Database, Search, Activity, Shield } from "lucide-react";
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
    const active = activeSection === section;
    return (
      <button
        key={section}
        onClick={() => setActiveSection(section)}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors"
        style={{
          borderRadius: "var(--radius-md)",
          background: active ? "var(--bg-hover)" : "transparent",
          color: active ? "var(--primary-500)" : "var(--text-secondary)",
          borderLeft: active ? "2px solid var(--primary-500)" : "2px solid transparent",
        }}
        onMouseEnter={(e) => {
          if (!active) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: "var(--bg-primary)" }}
    >
      <div
        style={{
          maxWidth: "var(--settings-max-width)",
          margin: "0 auto",
          padding: "32px 20px",
        }}
      >
        <h1
          className="text-lg font-semibold mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          {t("settings.title")}
        </h1>

        <div className="flex gap-6">
          {/* Navigation sidebar */}
          <div
            className="flex-shrink-0"
            style={{
              width: 200,
              borderRight: "1px solid var(--border-default)",
              paddingRight: 16,
            }}
          >
            <nav className="space-y-1">
              {navButton("general", <Layers className="w-4 h-4" />, t("settings.general", "General"))}

              {(isVisible("ingestion") || isVisible("embedding") || isVisible("chunking") || isVisible("vector") || isVisible("semantic") || isVisible("lexical") || isVisible("hybrid") || isVisible("rerank") || isVisible("llm") || isVisible("agents") || isVisible("monitoring") || isVisible("security")) && (
                <div className="pt-4 pb-2">
                  <span
                    className="px-3 text-xs font-semibold uppercase"
                    style={{ color: "var(--text-tertiary)", letterSpacing: "0.05em" }}
                  >
                    {t("settings.advanced", "Avancé")}
                  </span>
                </div>
              )}

              {navButton("ingestion", <FileText className="w-4 h-4" />, t("settings.ingestion", "Ingestion & Preprocessing"))}
              {navButton("embedding", <Brain className="w-4 h-4" />, t("settings.embedding", "Embedding"))}
              {navButton("chunking", <Scissors className="w-4 h-4" />, t("settings.chunking", "Chunking"))}
              {navButton("vector", <Database className="w-4 h-4" />, t("settings.vectorStore", "Base vectorielle"))}
              {navButton("semantic", <Search className="w-4 h-4" />, t("settings.semanticSearch", "Recherche sémantique"))}
              {navButton("lexical", <Search className="w-4 h-4" />, t("settings.lexicalSearch", "Recherche lexicale"))}
              {navButton("hybrid", <Search className="w-4 h-4" />, t("settings.hybridSearch", "Recherche hybride"))}
              {navButton("rerank", <Search className="w-4 h-4" />, t("settings.reranking", "Reranking"))}
              {navButton("llm", <Search className="w-4 h-4" />, t("settings.llm", "LLM / Génération"))}
              {navButton("agents", <Search className="w-4 h-4" />, t("settings.agents", "Agents"))}
              {navButton("monitoring", <Activity className="w-4 h-4" />, t("settings.monitoring", "Monitoring"))}
              {navButton("security", <Shield className="w-4 h-4" />, t("settings.security", "Sécurité"))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
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
    </div>
  );
}
