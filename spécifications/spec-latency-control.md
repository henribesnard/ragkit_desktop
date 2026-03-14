# Spec : Controle de latence du pipeline RAG

**Date** : 14 mars 2026
**Statut** : A implementer
**Objectif** : Donner a l'utilisateur une visibilite totale sur l'impact latence de chaque parametre du pipeline RAG et un estimateur global de latence.

---

## 1. Contexte et probleme

### Latence mesuree avec Ollama local

Le tableau de bord montre une latence totale de **~90 secondes** pour une requete RAG avec Ollama local :

| Composant | Latence | % total | Nature | Code source |
|-----------|---------|---------|--------|-------------|
| **Analyzer** | 14.99s | 17% | 1 appel LLM (classification intent) | `ragkit/agents/query_analyzer.py:50-61` |
| **Rewriting** | ~8-10s | ~10% | 1 appel LLM (reformulation) | `ragkit/agents/query_rewriter.py:43-48` |
| **Retrieval** | 2.29s | 3% | Embedding + Qdrant + BM25 + fusion | `ragkit/desktop/api/retrieval/unified_api.py` |
| **Reranking** | 0.24s | 0.3% | Cross-encoder local | `ragkit/desktop/api/retrieval/unified_api.py:226-301` |
| **LLM Generation** | 63.60s | 71% | 1 appel LLM (reponse finale) | `ragkit/llm/response_generator.py` |

### Constat

Le pipeline execute **3 appels LLM sequentiels** (analyzer → rewriter → generation). Avec Ollama local, chaque appel prend 5-60s selon le modele et le nombre de tokens.

**Tous les parametres affectant la latence sont deja configurables** via les API REST et les settings UI. Ce qui manque :
1. **Aucun indicateur visuel** n'informe l'utilisateur de l'impact de chaque parametre sur la latence
2. **Aucun estimateur global** ne montre la latence totale attendue selon la configuration
3. **Les labels des parametres** sont techniques sans mention de l'impact performance

### Pipeline complet d'une requete RAG

```
Requete utilisateur
  │
  ├─ 1. ANALYZER (query_analyzer.py)
  │     └─ LLM.generate(prompt_analyzer, max_tokens=200) → intent + needs_rag
  │     └─ Skippable si always_retrieve=true (0s)
  │
  ├─ 2. QUERY REWRITING (query_rewriter.py)
  │     └─ LLM.generate(prompt_rewriting, max_tokens=200) × num_rewrites
  │     └─ Skippable si query_rewriting.enabled=false (0s)
  │
  ├─ 3. RETRIEVAL (unified_api.py)
  │     ├─ Embedding de la requete (Ollama/API)
  │     ├─ Recherche semantique Qdrant (top_k × prefetch_multiplier vecteurs)
  │     ├─ Recherche lexicale BM25 (top_k termes)
  │     └─ Fusion RRF/lineaire
  │
  ├─ 4. RERANKING (optionnel)
  │     └─ Cross-encoder sur N candidates → top_n resultats
  │     └─ Skippable si rerank.enabled=false (0s)
  │
  └─ 5. LLM GENERATION (response_generator.py)
        └─ LLM.generate(system_prompt + context + history + query, max_tokens=2000)
        └─ Context = context_max_chunks chunks, context_max_tokens tokens max
```

---

## 2. Audit des parametres a impact latence

### 2.1 Parametres a impact ELEVE (>5s de difference)

| Parametre | Config | Defaut | Impact | Deja dans UI |
|-----------|--------|--------|--------|--------------|
| `agents.always_retrieve` | AgentsConfig | `false` | Skip analyzer = -5 a -15s (Ollama) | Oui (AgentsSettings toggle) |
| `agents.query_rewriting.enabled` | AgentsConfig | `true` | Skip rewriting = -5 a -15s (Ollama) | Oui (AgentsSettings toggle) |
| `llm.provider` | LLMConfig | `ollama` | Ollama=30-90s vs API=2-5s total | Oui (LLMSettings select) |
| `llm.model` | LLMConfig | `llama3.2` | Modele 3B vs 8B = x2-3 en vitesse | Oui (LLMSettings select) |
| `llm.max_tokens` | LLMConfig | `2000` | Proportionnel au temps de generation | Oui (LLMSettings slider) |
| `llm.context_max_tokens` | LLMConfig | `4000` | Taille du prompt = prompt processing | Oui (LLMSettings slider) |

### 2.2 Parametres a impact MOYEN (1-5s de difference)

| Parametre | Config | Defaut | Impact | Deja dans UI |
|-----------|--------|--------|--------|--------------|
| `agents.query_rewriting.num_rewrites` | AgentsConfig | `1` | Chaque rewrite = 1 appel LLM | Oui (AgentsSettings slider) |
| `agents.memory_strategy` | AgentsConfig | `sliding_window` | `summary` = appel LLM supplementaire | Oui (AgentsSettings select) |
| `agents.analyzer_timeout` | AgentsConfig | `15` | Timeout de l'analyzer | Oui (AgentsSettings slider) |
| `llm.context_max_chunks` | LLMConfig | `5` | Plus de chunks = prompt plus long | Oui (LLMSettings slider) |
| `llm.timeout` | LLMConfig | `60` | Timeout de generation | Oui (LLMSettings slider) |
| `retrieval.semantic.top_k` | SemanticSearchConfig | `10` | Plus de candidats a traiter | Oui (SemanticSearchSettings) |
| `retrieval.semantic.prefetch_multiplier` | SemanticSearchConfig | `3` | Multiplie vecteurs interroges | Oui (SemanticSearchSettings) |
| `rerank.enabled` | RerankConfig | `false` | Ajoute 200ms-2s | Oui (RerankSettings toggle) |
| `rerank.candidates` | RerankConfig | `40` | Plus de candidats = plus lent | Oui (RerankSettings slider) |
| `embedding.cache_enabled` | EmbeddingConfig | `true` | Cache miss = 100-500ms vs hit = 1ms | Oui (EmbeddingSettings) |

### 2.3 Parametres a impact FAIBLE (<1s de difference)

| Parametre | Config | Defaut | Impact | Deja dans UI |
|-----------|--------|--------|--------|--------------|
| `llm.temperature` | LLMConfig | `0.1` | Impact negligeable | Oui |
| `llm.top_p` | LLMConfig | `0.9` | Impact negligeable | Oui |
| `retrieval.semantic.mmr_enabled` | SemanticSearchConfig | `false` | +50-200ms | Oui |
| `retrieval.lexical.top_k` | LexicalSearchConfig | `15` | BM25 tres rapide | Oui |
| `retrieval.hybrid.fusion_method` | HybridSearchConfig | `rrf` | RRF vs lineaire negligeable | Oui |
| `rerank.top_n` | RerankConfig | `5` | Taille sortie uniquement | Oui |

### 2.4 Bilan

**Tous les parametres a impact latence sont deja exposes dans l'UI**. Aucun nouveau parametre backend a ajouter. Le travail est 100% frontend : ajouter des indicateurs visuels d'impact.

---

## 3. Design des composants

### 3.1 Composant `LatencyImpactBadge`

**Fichier** : `desktop/src/components/ui/LatencyImpactBadge.tsx`

Badge compact affiche a cote d'un parametre pour indiquer son impact latence.

```
┌─────────────────────────────────────────────────────┐
│ ⚡ Impact eleve : +5-15s (Ollama) / +1-2s (API)    │
└─────────────────────────────────────────────────────┘
```

**Props** :
```tsx
interface LatencyImpactBadgeProps {
  level: "high" | "medium" | "low";
  description: string;  // cle i18n traduite
}
```

**Style** :
| Niveau | Fond | Texte | Icone |
|--------|------|-------|-------|
| `high` | `#FFF7ED` (orange-50) | `#C2410C` (orange-700) | Zap (lucide) |
| `medium` | `#FEFCE8` (yellow-50) | `#A16207` (yellow-700) | Clock (lucide) |
| `low` | `#F9FAFB` (gray-50) | `#6B7280` (gray-500) | Info (lucide) |

Le badge est pliable (clic pour afficher/masquer la description). Par defaut, seuls l'icone et le niveau sont visibles pour ne pas surcharger l'UI.

### 3.2 Hook `useLatencyEstimator`

**Fichier** : `desktop/src/hooks/useLatencyEstimator.ts`

Calcule une estimation de latence totale basee sur les configurations actuelles. Ne fait AUCUN appel backend - calcul purement frontend a partir des configs deja chargees.

**Interface de sortie** :
```tsx
interface StepEstimate {
  min: number;    // secondes
  max: number;    // secondes
  skipped: boolean;
  label: string;  // nom de l'etape
}

interface LatencyEstimate {
  steps: {
    analyzer: StepEstimate;
    rewriting: StepEstimate;
    retrieval: StepEstimate;
    reranking: StepEstimate;
    generation: StepEstimate;
  };
  total: { min: number; max: number };
  provider: string;
  model: string;
}
```

**Interface d'entree** :
```tsx
interface LatencyEstimatorInput {
  provider: string;
  model: string;
  maxTokens: number;
  contextMaxTokens: number;
  contextMaxChunks: number;
  alwaysRetrieve: boolean;
  queryRewritingEnabled: boolean;
  numRewrites: number;
  rerankEnabled: boolean;
  rerankCandidates: number;
  semanticTopK: number;
  prefetchMultiplier: number;
}

function useLatencyEstimator(input: LatencyEstimatorInput): LatencyEstimate;
```

**Heuristiques de calcul** :

```
SI provider == "ollama" :
  LLM_CALL_BASE = { min: 5, max: 15 }  // secondes par appel simple (200 tokens)
  GENERATION_FACTOR = max_tokens / 500   // proportionnel aux tokens generes
  CONTEXT_FACTOR = 1 + (context_max_tokens / 8000)  // overhead du prompt processing
SINON (API cloud) :
  LLM_CALL_BASE = { min: 0.5, max: 2 }
  GENERATION_FACTOR = max_tokens / 1000
  CONTEXT_FACTOR = 1 + (context_max_tokens / 16000)

analyzer = always_retrieve ? SKIP : LLM_CALL_BASE
rewriting = !query_rewriting_enabled ? SKIP : LLM_CALL_BASE × num_rewrites
retrieval = { min: 0.5, max: 3 }  // relativement stable
reranking = !rerank_enabled ? SKIP : { min: 0.1, max: 2 }
generation = LLM_CALL_BASE × GENERATION_FACTOR × CONTEXT_FACTOR
total = somme de toutes les etapes non-skippees
```

### 3.3 Composant `PipelineLatencyEstimator`

**Fichier** : `desktop/src/components/settings/PipelineLatencyEstimator.tsx`

Panneau compact sticky en haut de la zone Settings.

**Layout** :

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚡ Latence estimee : ~25-40s                                       │
│                                                                     │
│ ┌──────────┬──────────┬──────────┬──────────┬───────────────────┐  │
│ │ Analyzer │ Rewrite  │ Retrieval│ Reranking│      LLM          │  │
│ │  5-15s   │ 5-10s    │  1-3s    │  skip    │    15-30s         │  │
│ └──────────┴──────────┴──────────┴──────────┴───────────────────┘  │
│                                                                     │
│ Ollama (llama3.2) • max_tokens: 2000 • context: 4000 tokens       │
└─────────────────────────────────────────────────────────────────────┘
```

**Comportement** :
- Les segments ont une largeur proportionnelle a leur poids relatif
- Les segments "skip" sont grises et reduits
- Le total se recalcule en temps reel quand les configs changent
- Couleur du total : vert (<10s), orange (10-30s), rouge (>30s)
- Le panneau est pliable/depliable pour economiser l'espace
- Visible uniquement sur les onglets relatifs au pipeline : LLM, Agents, Semantic, Lexical, Hybrid, Reranking, Embedding

---

## 4. Placement des badges par composant Settings

### 4.1 AgentsSettings.tsx

| Parametre | Badge | Description (FR) |
|-----------|-------|------------------|
| Toggle `always_retrieve` | `high` | "Desactive l'analyzer. Economise un appel LLM (~5-15s Ollama / ~1-2s API). Attention : des requetes comme 'Bonjour' declencheront aussi une recherche dans les documents." |
| Toggle `query_rewriting.enabled` | `high` | "La reformulation ajoute un appel LLM par requete (~5-15s Ollama / ~1s API). Utile pour les conversations multi-tour." |
| Slider `num_rewrites` | `medium` | "Chaque reformulation supplementaire = 1 appel LLM additionnel." |
| Select `memory_strategy = summary` | `medium` | "Le mode Resume genere un resume de l'historique via le LLM, ajoutant un appel supplementaire." |

### 4.2 LLMSettings.tsx

| Parametre | Badge | Description (FR) |
|-----------|-------|------------------|
| Select `provider` (si Ollama) | `high` | "Ollama local : latence elevee (~30-90s total) mais gratuit et prive. Les providers API (OpenAI, DeepSeek) reduisent la latence a ~2-5s total." |
| Slider `max_tokens` | `high` | "Directement proportionnel au temps de generation. Reduire de 2000 a 800 peut diviser le temps par 2-3." |
| Slider `context_max_tokens` | `high` | "Plus de contexte = plus de tokens a traiter par le LLM. Impact direct sur le temps de prompt processing." |
| Slider `context_max_chunks` | `medium` | "Plus de chunks injectes = prompt plus long = inference plus lente." |

### 4.3 SemanticSearchSettings.tsx

| Parametre | Badge | Description (FR) |
|-----------|-------|------------------|
| Slider `top_k` | `medium` | "Plus de resultats = plus de candidats a traiter en fusion et reranking." |
| Slider `prefetch_multiplier` | `medium` | "Multiplie le nombre de vecteurs interroges dans Qdrant (top_k x N)." |
| Toggle `mmr_enabled` | `low` | "La diversification MMR ajoute ~50-200ms." |

### 4.4 LexicalSearchSettings.tsx

| Parametre | Badge | Description (FR) |
|-----------|-------|------------------|
| Slider `top_k` | `low` | "La recherche BM25 est tres rapide. Impact negligeable sur la latence totale." |

### 4.5 RerankSettings.tsx

| Parametre | Badge | Description (FR) |
|-----------|-------|------------------|
| Toggle `enabled` | `medium` | "Le reranking ameliore la precision mais ajoute ~200ms-2s selon le provider et le nombre de candidats." |
| Slider `candidates` | `medium` | "Plus de candidats a reranker = traitement plus long." |

### 4.6 EmbeddingSettings.tsx

| Parametre | Badge | Description (FR) |
|-----------|-------|------------------|
| Toggle `cache_enabled` | `medium` | "Le cache d'embedding reduit la latence de ~100-500ms a ~1ms pour les requetes deja vues." |

---

## 5. Traductions i18n

### Cles a ajouter dans `desktop/src/locales/fr.json`

```json
{
  "latency": {
    "impact": "Impact latence",
    "high": "Impact eleve",
    "medium": "Impact moyen",
    "low": "Impact faible",
    "estimated": "Latence estimee",
    "skipped": "Desactive",
    "pipelineTitle": "Pipeline de reponse",
    "totalRange": "~{{min}}s - {{max}}s",
    "providerLine": "{{provider}} ({{model}})",
    "configLine": "max_tokens: {{maxTokens}} | contexte: {{contextTokens}} tokens",
    "colorGreen": "Rapide",
    "colorOrange": "Moderee",
    "colorRed": "Lente",
    "analyzerSkipDesc": "Desactive l'analyzer. Economise un appel LLM (~5-15s Ollama / ~1-2s API). Attention : des requetes comme 'Bonjour' declencheront aussi une recherche.",
    "analyzerActiveDesc": "Chaque requete est analysee par le LLM pour determiner si une recherche est necessaire (~5-15s Ollama / ~1-2s API).",
    "rewritingActiveDesc": "La reformulation ajoute un appel LLM par requete (~5-15s Ollama / ~1s API). Utile pour les conversations multi-tour.",
    "rewritingSkipDesc": "La requete originale est utilisee telle quelle, sans reformulation.",
    "rewriteCountDesc": "Chaque reformulation supplementaire = 1 appel LLM additionnel.",
    "summaryStrategyDesc": "Le mode Resume genere un resume de l'historique via le LLM, ajoutant un appel supplementaire.",
    "providerOllamaDesc": "Ollama local : latence elevee (~30-90s total) mais gratuit et prive. Les providers API (OpenAI, DeepSeek) reduisent la latence a ~2-5s total.",
    "providerApiDesc": "Provider API : latence faible (~2-5s total), payant.",
    "maxTokensDesc": "Directement proportionnel au temps de generation. Reduire de 2000 a 800 peut diviser le temps par 2-3.",
    "contextTokensDesc": "Plus de contexte = plus de tokens a traiter par le LLM. Impact direct sur le prompt processing.",
    "contextChunksDesc": "Plus de chunks injectes = prompt plus long = inference plus lente.",
    "topKSemanticDesc": "Plus de resultats = plus de candidats a traiter en fusion et reranking.",
    "prefetchDesc": "Multiplie le nombre de vecteurs interroges dans Qdrant (top_k x N).",
    "mmrDesc": "La diversification MMR ajoute ~50-200ms.",
    "topKLexicalDesc": "La recherche BM25 est tres rapide. Impact negligeable.",
    "rerankEnabledDesc": "Le reranking ameliore la precision mais ajoute ~200ms-2s.",
    "rerankCandidatesDesc": "Plus de candidats a reranker = traitement plus long.",
    "cacheEnabledDesc": "Le cache d'embedding reduit la latence de ~100-500ms a ~1ms pour les requetes deja vues."
  }
}
```

### Cles a ajouter dans `desktop/src/locales/en.json`

```json
{
  "latency": {
    "impact": "Latency impact",
    "high": "High impact",
    "medium": "Medium impact",
    "low": "Low impact",
    "estimated": "Estimated latency",
    "skipped": "Disabled",
    "pipelineTitle": "Response pipeline",
    "totalRange": "~{{min}}s - {{max}}s",
    "providerLine": "{{provider}} ({{model}})",
    "configLine": "max_tokens: {{maxTokens}} | context: {{contextTokens}} tokens",
    "colorGreen": "Fast",
    "colorOrange": "Moderate",
    "colorRed": "Slow",
    "analyzerSkipDesc": "Disables the analyzer. Saves one LLM call (~5-15s Ollama / ~1-2s API). Warning: queries like 'Hello' will also trigger a document search.",
    "analyzerActiveDesc": "Each query is analyzed by the LLM to determine if a search is needed (~5-15s Ollama / ~1-2s API).",
    "rewritingActiveDesc": "Query rewriting adds one LLM call per query (~5-15s Ollama / ~1s API). Useful for multi-turn conversations.",
    "rewritingSkipDesc": "The original query is used as-is, without rewriting.",
    "rewriteCountDesc": "Each additional rewrite = 1 additional LLM call.",
    "summaryStrategyDesc": "Summary mode generates a conversation summary via the LLM, adding an extra call.",
    "providerOllamaDesc": "Ollama local: high latency (~30-90s total) but free and private. API providers (OpenAI, DeepSeek) reduce latency to ~2-5s total.",
    "providerApiDesc": "API provider: low latency (~2-5s total), paid.",
    "maxTokensDesc": "Directly proportional to generation time. Reducing from 2000 to 800 can cut time by 2-3x.",
    "contextTokensDesc": "More context = more tokens for the LLM to process. Direct impact on prompt processing.",
    "contextChunksDesc": "More injected chunks = longer prompt = slower inference.",
    "topKSemanticDesc": "More results = more candidates to process in fusion and reranking.",
    "prefetchDesc": "Multiplies the number of vectors queried from Qdrant (top_k x N).",
    "mmrDesc": "MMR diversification adds ~50-200ms.",
    "topKLexicalDesc": "BM25 search is very fast. Negligible latency impact.",
    "rerankEnabledDesc": "Reranking improves precision but adds ~200ms-2s.",
    "rerankCandidatesDesc": "More candidates to rerank = longer processing.",
    "cacheEnabledDesc": "Embedding cache reduces latency from ~100-500ms to ~1ms for previously seen queries."
  }
}
```

---

## 6. Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `desktop/src/components/ui/LatencyImpactBadge.tsx` | **Creer** - composant badge |
| `desktop/src/hooks/useLatencyEstimator.ts` | **Creer** - hook estimateur |
| `desktop/src/components/settings/PipelineLatencyEstimator.tsx` | **Creer** - panneau estimateur |
| `desktop/src/components/settings/AgentsSettings.tsx` | **Modifier** - ajouter 4 badges |
| `desktop/src/components/settings/LLMSettings.tsx` | **Modifier** - ajouter 4 badges |
| `desktop/src/components/settings/SemanticSearchSettings.tsx` | **Modifier** - ajouter 3 badges |
| `desktop/src/components/settings/LexicalSearchSettings.tsx` | **Modifier** - ajouter 1 badge |
| `desktop/src/components/settings/RerankSettings.tsx` | **Modifier** - ajouter 2 badges |
| `desktop/src/components/settings/EmbeddingSettings.tsx` | **Modifier** - ajouter 1 badge |
| `desktop/src/pages/Settings.tsx` | **Modifier** - integrer estimateur sticky |
| `desktop/src/locales/fr.json` | **Modifier** - ajouter cles `latency.*` |
| `desktop/src/locales/en.json` | **Modifier** - ajouter cles `latency.*` |

**Aucune modification backend** - tous les parametres sont deja exposes via les API existantes.

---

## 7. Ordre d'implementation

1. Creer `LatencyImpactBadge.tsx` (composant UI pur, pas de dependances)
2. Creer `useLatencyEstimator.ts` (hook avec heuristiques)
3. Creer `PipelineLatencyEstimator.tsx` (utilise le hook)
4. Ajouter les cles i18n dans `fr.json` et `en.json`
5. Modifier `AgentsSettings.tsx` - ajouter les 4 badges
6. Modifier `LLMSettings.tsx` - ajouter les 4 badges
7. Modifier `SemanticSearchSettings.tsx` - ajouter les 3 badges
8. Modifier `RerankSettings.tsx` - ajouter les 2 badges
9. Modifier `EmbeddingSettings.tsx` - ajouter le badge cache
10. Modifier `LexicalSearchSettings.tsx` - ajouter le badge top_k
11. Integrer `PipelineLatencyEstimator` dans `Settings.tsx`

---

## 8. Verification

- [ ] `npm run dev` dans desktop/ - pas d'erreurs TypeScript
- [ ] Naviguer dans chaque onglet Settings relatif au pipeline
- [ ] Verifier que les badges s'affichent correctement (couleur, icone, texte)
- [ ] Verifier que les badges sont pliables (clic pour afficher/masquer description)
- [ ] Changer provider Ollama ↔ OpenAI → estimateur se met a jour
- [ ] Activer/desactiver analyzer → estimateur recalcule
- [ ] Activer/desactiver rewriting → estimateur recalcule
- [ ] Activer/desactiver reranking → estimateur recalcule
- [ ] Modifier max_tokens → estimateur recalcule
- [ ] Modifier context_max_tokens → estimateur recalcule
- [ ] Tester en francais et en anglais
- [ ] Comparer les estimations avec les latences reelles du dashboard
- [ ] Verifier que l'estimateur est masque sur les onglets non-pipeline (General, Ingestion, Security)
