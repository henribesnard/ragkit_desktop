# LOKO - RAG Desktop

**LOKO** est un système RAG (Retrieval-Augmented Generation) local et privé qui vous permet de discuter avec vos documents. Construit avec Tauri v2, React et FastAPI.

> **v1.3.8** - Application de bureau multi-plateforme (Windows, macOS, Linux)

---

## Fonctionnalités

### Chat intelligent
- Conversations multi-sessions avec persistance et historique
- Streaming en temps réel avec indicateurs de progression (analyse, recherche, generation)
- Titres de conversation auto-generees par le LLM
- Citations des sources avec titre, page et apercu du texte
- Feedback positif/negatif par reponse
- Mode debug optionnel (latences, tokens, couts)

### Recherche avancee
- **Semantique** : recherche vectorielle avec top-k, seuil de similarite, MMR
- **Lexicale (BM25/BM25+)** : stemming FR/EN, stopwords, n-grammes configurables
- **Hybride** : fusion RRF ou somme ponderee, alpha reglable, normalisation Min-Max/Z-Score
- **Reranking** : Cohere Rerank v3.5, BGE Reranker v2 m3, MS MARCO MiniLM (local)

### Agents & orchestration
- **Analyseur de requetes** : detection d'intention (question, salutation, hors-sujet, clarification)
- **Reecrivain de requetes** : reformulation contextuelle multi-tentatives
- **Memoire conversationnelle** : fenetre glissante ou compression par resume
- **Orchestrateur** : routage conditionnel RAG / non-RAG avec fallback

### Ingestion de documents
- **Formats** : PDF, DOCX, DOC, TXT, MD, RST, HTML, CSV, JSON, YAML, XML
- **Parsing** : Unstructured, PyPDF, Docling avec detection automatique
- **OCR** : Tesseract, EasyOCR (FR/EN)
- **Chunking** : fixe, phrase, paragraphe, semantique, recursif, Markdown header
- **Preprocessing** : deduplication (exact, fuzzy, semantique), detection de langue, normalisation Unicode
- Extraction de tables, captioning d'images, detection de hierarchie

### Fournisseurs supportes

| Type | Fournisseurs |
|------|-------------|
| **LLM** | OpenAI (GPT-4o), Anthropic (Claude 3.5), Ollama (Llama 3, Mistral, Phi-3), Mistral AI, DeepSeek |
| **Embeddings** | OpenAI, Ollama, HuggingFace (E5, MiniLM), Cohere, Voyage AI, Mistral |
| **Vector Store** | Qdrant (primaire), Chroma |
| **Reranking** | Cohere, Local (BGE, MS MARCO) |

### Monitoring & analytics
- Tableau de bord avec metriques temps reel (succes, latence, couts)
- Graphiques d'activite quotidienne (RAG vs non-RAG)
- Distribution des intentions et tendances de feedback
- Decomposition de latence par etape du pipeline
- Systeme d'alertes configurable (latence P95, taux de succes, feedback negatif)
- Logs de requetes exportables avec filtres avancees

### Securite
- Detection et anonymisation de PII (email, telephone, IBAN, carte de credit)
- Chiffrement optionnel des logs
- Retention configurable avec auto-purge
- Gestion securisee des cles API via keyring systeme
- Classification de confidentialite des documents

### Configuration
- Assistant de configuration guide (wizard) avec profils pre-optimises
- 5 profils : Documentation technique, FAQ/Support, Legal, Rapports, General
- Questionnaire de calibration adaptatif
- Export/import de configuration (`.loko-config`)
- 3 niveaux d'expertise (Simple, Intermediaire, Expert)
- 15 sections de parametres dans l'interface

### Interface
- Theme clair/sombre
- Localisation FR/EN complete
- Detection d'environnement (GPU, RAM, Ollama, modeles locaux)
- Fonctionnement 100% local possible (Ollama + embeddings locaux + Qdrant)

---

## Architecture

```
┌────────────────────────────────────────────┐
│              Frontend (React)              │
│  Chat  │  Dashboard  │  Settings  │  Wizard│
├────────────────────────────────────────────┤
│            Tauri v2 (Rust bridge)          │
│         SSE streaming + IPC commands       │
├────────────────────────────────────────────┤
│           Backend (FastAPI sidecar)        │
│  Orchestrator → Analyzer → Rewriter       │
│  Retrieval → Reranking → Generation       │
├────────────────────────────────────────────┤
│    Qdrant    │  Embeddings  │  LLM APIs   │
└────────────────────────────────────────────┘
```

---

## Developpement

### Prerequis
- Node.js 20+
- Python 3.10+
- Rust (stable)

### Installation

```bash
# Frontend
cd desktop
npm install

# Backend
pip install -e ".[desktop]"
```

### Lancement en dev

```bash
cd desktop
npm run tauri dev
```

### Lint & build

```bash
cd desktop
npm run lint          # ESLint
npx tsc --noEmit     # TypeScript check
npm run tauri build   # Build de production
```

### Structure du projet

```
ragkit_desktop/
├── desktop/              # Application Tauri
│   ├── src/              # Frontend React + TypeScript
│   ├── src-tauri/        # Bridge Rust (commands, backend, SSE)
│   └── package.json
├── ragkit/               # Backend Python
│   ├── agents/           # Orchestrateur, analyseur, reecrivain, memoire
│   ├── config/           # Schemas Pydantic (LLM, retrieval, agents, etc.)
│   ├── desktop/          # API FastAPI + services
│   ├── ingestion/        # Pipeline d'ingestion de documents
│   ├── llm/              # Fournisseurs LLM (OpenAI, Anthropic, Ollama, etc.)
│   ├── monitoring/       # Logs de requetes, metriques, alertes
│   ├── reranking/        # Reranking Cohere + local
│   ├── search/           # Recherche semantique, lexicale, hybride
│   ├── security/         # Detection PII, chiffrement
│   └── vectorstore/      # Qdrant, Chroma
├── pyproject.toml
└── .github/workflows/    # CI/CD multi-plateforme
```

---

## CI/CD

Le workflow GitHub Actions se declenche sur les tags `v*` et produit des builds pour Windows, macOS et Linux. Le backend Python est empaquete via PyInstaller en sidecar Tauri.

---

## Licence

MIT
