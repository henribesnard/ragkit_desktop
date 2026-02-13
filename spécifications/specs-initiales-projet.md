# 🧰 RAGKIT Desktop — Spécifications Initiales du Projet

> **Version** : 3.0 (Refonte)  
> **Date** : 13 février 2026  
> **Dépôt** : https://github.com/henribesnard/ragkit_desktop.git  
> **Licence** : MIT

---

## 1. Contexte et objectifs

### 1.1 Contexte

RAGKIT Desktop est une application de bureau permettant à un utilisateur de créer un système RAG (Retrieval-Augmented Generation) local et privé à partir de ses documents. L'application existante (v2.1.1) a accumulé une dette technique significative et des problèmes d'architecture qui nécessitent une refonte complète.

### 1.2 Objectifs de la refonte

- **Repartir de zéro** avec une architecture propre, modulaire et testable.
- **Développement incrémental** : chaque étape produit un livrable fonctionnel et distribuable.
- **Capitaliser sur l'existant** : réutiliser les briques éprouvées (profils, wizard, config YAML, agents) tout en nettoyant le code.
- **Expérience utilisateur** : wizard guidé, paramètres progressifs, monitoring temps réel.

### 1.3 Périmètre V1

L'application couvre le pipeline RAG complet en local :

```
Documents → Parsing → Chunking → Embedding → Stockage vectoriel
    → Recherche (sémantique + lexicale + hybride) → Reranking
    → Génération LLM → Réponse avec citations
```

---

## 2. Architecture technique

### 2.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                      RAGKIT Desktop                             │
├──────────────────────┬──────────────────────────────────────────┤
│   Frontend (Webview) │            Shell natif (Rust)            │
│                      │                                          │
│  React 18 + TS       │  Tauri 2.0                               │
│  Tailwind CSS 3      │  ├── Lifecycle management                │
│  React Router 6      │  ├── IPC bridge (invoke)                 │
│  i18next (FR/EN)     │  ├── Sidecar management                  │
│  Lucide icons        │  ├── Native dialogs (file picker)        │
│                      │  └── System tray & notifications         │
├──────────────────────┴──────────────────────────────────────────┤
│                     Backend (Sidecar Python)                     │
│                                                                  │
│  FastAPI + Uvicorn                                               │
│  ├── REST API (/api/*)                                           │
│  ├── SSE streaming (/api/v1/chat/stream)                         │
│  ├── WebSocket events (/api/v1/admin/ws)                         │
│  └── Modules métier :                                            │
│      ├── Config (YAML, profils, wizard)                          │
│      ├── Ingestion (parsing, chunking)                           │
│      ├── Embedding (OpenAI, Ollama, ONNX, HuggingFace)          │
│      ├── Storage (Qdrant, ChromaDB)                              │
│      ├── Retrieval (sémantique, BM25, hybride, reranking)       │
│      ├── LLM (LiteLLM : OpenAI, Anthropic, Ollama, Mistral)     │
│      ├── Agents (Query Analyzer, Response Generator)             │
│      └── Metrics (SQLite, observabilité)                         │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Communication Frontend ↔ Backend

```
React (Webview)
    │
    │  invoke("command_name", { params })
    ▼
Tauri Rust (commands.rs)
    │
    │  HTTP request (reqwest)
    ▼
Python FastAPI (localhost:{port})
    │
    │  JSON response
    ▼
Tauri Rust → React (Promise resolved)
```

Le backend Python tourne comme un processus **sidecar** :
- **Dev** : `python -m ragkit.desktop.main --port {port}`
- **Prod** : binaire PyInstaller bundlé `ragkit-backend-{target}{.exe}`

Le port est alloué dynamiquement au démarrage (premier port libre à partir de 8100).

### 2.3 Stockage local

```
~/.ragkit/                          # Racine de données utilisateur
├── config/
│   ├── settings.json               # Paramètres applicatifs
│   └── credentials.enc             # Clés API chiffrées (AES-256)
├── data/
│   ├── ragkit.db                   # SQLite (conversations, métriques, historique)
│   ├── qdrant/                     # Stockage Qdrant persistant
│   └── chroma/                     # Stockage ChromaDB persistant
├── models/
│   ├── embeddings/                 # Modèles ONNX / HuggingFace locaux
│   └── rerankers/                  # Modèles de reranking locaux
├── ingestion/
│   ├── versions/                   # Historique des ingestions versionné
│   └── cache/                      # Cache d'embeddings
└── logs/
    └── ragkit-desktop.log.*        # Logs rotatifs journaliers
```

---

## 3. Stack technologique

### 3.1 Frontend (Desktop)

| Composant | Technologie | Version | Justification |
|-----------|-------------|---------|---------------|
| Shell natif | **Tauri** | 2.0 | Léger (~10 Mo vs ~200 Mo Electron), cross-platform, Rust performant |
| UI Framework | **React** | 18.x | Écosystème riche, hooks, composants réutilisables |
| Langage | **TypeScript** | 5.x | Typage statique, maintenabilité |
| Styling | **Tailwind CSS** | 3.x | Utility-first, design system cohérent, dark mode natif |
| Routing | **React Router** | 6.x | Navigation SPA standard |
| i18n | **i18next** + react-i18next | 23.x / 14.x | Français par défaut, anglais prêt |
| Icônes | **Lucide React** | 0.441+ | Icônes SVG légères et cohérentes |
| Utilitaires CSS | **clsx** + **tailwind-merge** | — | Composition propre de classes conditionnelles |
| Build | **Vite** | 5.x | HMR rapide, tree-shaking |

### 3.2 Backend (Python)

| Composant | Technologie | Version | Justification |
|-----------|-------------|---------|---------------|
| Framework API | **FastAPI** | ≥0.100 | Async natif, Pydantic, OpenAPI auto |
| Serveur ASGI | **Uvicorn** | ≥0.20 | Performances, hot-reload dev |
| Validation | **Pydantic** | ≥2.0 | Modèles typés, serialization |
| Configuration | **PyYAML** + Pydantic Settings | — | Fichier YAML + validation |
| LLM Abstraction | **LiteLLM** | ≥1.0 | Interface unifiée OpenAI/Anthropic/Ollama/Mistral |
| Vector Store | **Qdrant Client** | ≥1.6 | Haute perf, filtrage avancé |
| Vector Store (alt) | **ChromaDB** | ≥0.4 | Option légère pour dev/test |
| Recherche lexicale | **rank-bm25** | ≥0.2 | BM25 pur Python, léger |
| Parsing docs | **unstructured** | ≥0.10 | PDF, DOCX, HTML, Markdown |
| Détection langue | **langdetect** | ≥1.0 | Détection automatique de langue |
| Env vars | **python-dotenv** | ≥1.0 | Chargement `.env` |
| Logging | **structlog** | ≥23.0 | Logging structuré JSON |
| Embedding local | **onnxruntime** | ≥1.16 | Inference locale rapide |
| Tokenizers | **tokenizers** (HF) | ≥0.15 | Tokenisation rapide |
| Modèles locaux | **huggingface_hub** | ≥0.20 | Téléchargement modèles |
| Secrets | **keyring** | ≥24.0 | Trousseau système natif |
| Chiffrement | **cryptography** | ≥41.0 | AES-256 pour credentials |
| Packaging | **PyInstaller** | — | Binaire autonome pour sidecar |

### 3.3 Rust (Tauri Shell)

| Composant | Crate | Version | Justification |
|-----------|-------|---------|---------------|
| Framework | **tauri** | 2.x | Shell natif cross-platform |
| HTTP client | **reqwest** | 0.12 | Requêtes vers le backend Python |
| Serialization | **serde** + serde_json | 1.x | Sérialisation des commandes IPC |
| Async runtime | **tokio** | 1.x | Async pour sidecar et HTTP |
| Error handling | **anyhow** | 1.x | Gestion d'erreurs ergonomique |
| Logging | **tracing** + tracing-subscriber + tracing-appender | 0.1/0.3/0.2 | Logs fichier rotatifs |
| Plugins Tauri | **tauri-plugin-shell**, **tauri-plugin-dialog** | 2.x | Sidecar + dialogues natifs |

### 3.4 CI/CD

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| CI | **GitHub Actions** | Intégré au repo |
| Lint Python | **Ruff** | Linting + formatting ultra-rapide |
| Type check Python | **mypy** | Vérification types statique |
| Tests Python | **pytest** + pytest-asyncio + pytest-cov | Tests unitaires et async |
| Lint Frontend | **ESLint** + Prettier | Standard TypeScript/React |
| Type check Frontend | **tsc --noEmit** | Vérification TypeScript |
| Build multi-plateforme | GitHub Actions matrix | Windows (NSIS/MSI), macOS (DMG), Linux (AppImage/DEB) |

---

## 4. Structure du dépôt

```
ragkit_desktop/
│
├── .github/
│   └── workflows/
│       ├── desktop.yml              # CI : lint + build multi-plateforme
│       └── release.yml              # CD : release GitHub avec artefacts
│
├── ragkit/                          # Package Python (backend)
│   ├── __init__.py
│   ├── cli/                         # CLI (typer)
│   │   └── main.py
│   ├── config/                      # Configuration et profilage
│   │   ├── defaults.py              # Valeurs par défaut
│   │   ├── profiles.py              # Profils par type de base
│   │   ├── schema.py                # Schéma Pydantic principal
│   │   ├── schema_v2.py             # Schéma étendu (parsing avancé)
│   │   └── wizard.py                # Logique wizard (analyse réponses)
│   ├── desktop/                     # Backend desktop (FastAPI)
│   │   ├── __init__.py
│   │   ├── main.py                  # Point d'entrée FastAPI + Uvicorn
│   │   ├── api.py                   # Routes REST principales
│   │   ├── wizard_api.py            # Routes wizard
│   │   ├── state.py                 # État applicatif global
│   │   └── logging_utils.py         # Capture de logs
│   ├── agents/                      # Agents LLM
│   │   ├── query_analyzer.py        # Analyse d'intention
│   │   ├── response_generator.py    # Génération de réponse
│   │   └── orchestrator.py          # Orchestration du pipeline
│   ├── embedding/                   # Providers d'embedding
│   │   ├── base.py
│   │   ├── openai_provider.py
│   │   ├── ollama_provider.py
│   │   └── onnx_provider.py
│   ├── ingestion/                   # Pipeline d'ingestion
│   │   ├── parsers/                 # Extraction de contenu
│   │   ├── chunkers/                # Stratégies de chunking
│   │   └── sources/                 # Sources de documents
│   ├── llm/                         # Providers LLM
│   │   └── litellm_provider.py      # Router LiteLLM
│   ├── retrieval/                   # Moteur de recherche
│   │   └── engine.py                # Recherche hybride + reranking
│   ├── storage/                     # Stockage vectoriel
│   │   ├── qdrant_store.py
│   │   └── chroma_store.py
│   ├── metrics/                     # Métriques et observabilité
│   │   └── __init__.py
│   ├── models.py                    # Modèles de données partagés
│   └── utils/
│       └── hardware.py              # Détection GPU/Ollama
│
├── desktop/                         # Application desktop (Tauri + React)
│   ├── package.json                 # Dépendances Node.js
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html                   # Point d'entrée HTML
│   │
│   ├── src/                         # Code source React
│   │   ├── main.tsx                 # Bootstrap React
│   │   ├── App.tsx                  # Composant racine + routing
│   │   ├── index.css                # Styles globaux Tailwind
│   │   │
│   │   ├── components/              # Composants réutilisables
│   │   │   ├── ui/                  # Primitives UI (Button, Input, Select, etc.)
│   │   │   ├── layout/              # Layout (Sidebar, Header, TabNav)
│   │   │   └── common/              # Composants communs (LoadingSpinner, etc.)
│   │   │
│   │   ├── pages/                   # Pages / vues principales
│   │   │   ├── Chat.tsx             # Onglet CHAT
│   │   │   ├── Settings.tsx         # Onglet PARAMÈTRES
│   │   │   ├── Dashboard.tsx        # Onglet TABLEAU DE BORD
│   │   │   ├── Onboarding.tsx       # Container wizard
│   │   │   └── Wizard/              # Étapes du wizard
│   │   │       ├── index.tsx        # Orchestrateur wizard
│   │   │       ├── WelcomeStep.tsx
│   │   │       ├── ProfileStep.tsx
│   │   │       ├── ModelsStep.tsx
│   │   │       ├── FolderStep.tsx
│   │   │       └── SummaryStep.tsx
│   │   │
│   │   ├── lib/                     # Utilitaires
│   │   │   ├── ipc.ts              # Client IPC (invoke Tauri)
│   │   │   ├── cn.ts               # Utilitaire className (clsx + twMerge)
│   │   │   └── constants.ts        # Constantes applicatives
│   │   │
│   │   ├── hooks/                   # React hooks personnalisés
│   │   │   ├── useTheme.ts
│   │   │   ├── useBackendHealth.ts
│   │   │   └── useSettings.ts
│   │   │
│   │   ├── stores/                  # État global (si nécessaire)
│   │   │   └── appStore.ts
│   │   │
│   │   └── locales/                 # Traductions
│   │       ├── fr.json
│   │       └── en.json
│   │
│   └── src-tauri/                   # Code Rust (Tauri)
│       ├── Cargo.toml
│       ├── Cargo.lock
│       ├── tauri.conf.json          # Configuration Tauri
│       ├── build.rs
│       ├── capabilities/
│       │   └── default.json         # Permissions Tauri
│       ├── binaries/
│       │   └── .gitkeep             # Placeholder pour le sidecar PyInstaller
│       ├── icons/                   # Icônes multi-résolution
│       └── src/
│           ├── main.rs              # Point d'entrée Rust
│           ├── backend.rs           # Gestion lifecycle sidecar
│           └── commands.rs          # Commandes Tauri (proxy → Python)
│
├── templates/                       # Templates de configuration
│   └── ragkit-v1-config.yaml        # Config YAML de référence
│
├── tests/                           # Tests Python
│   ├── unit/
│   │   ├── test_agents.py
│   │   ├── test_config.py
│   │   └── test_wizard.py
│   └── integration/
│
├── docs/                            # Documentation
│   ├── specs-initiales-projet.md    # CE DOCUMENT
│   ├── specs-etape-0.md             # Specs fonctionnelles & techniques Étape 0
│   ├── roadmap-incremental.md       # Plan de développement incrémental
│   ├── configuration.md             # Guide de configuration
│   └── wizard.md                    # Documentation du wizard
│
├── ragkit-backend.spec              # Spec PyInstaller pour le sidecar
├── pyproject.toml                   # Configuration Python (deps, build)
├── Dockerfile                       # Build Docker (optionnel, pour web UI)
├── docker-compose.yml
├── .gitignore
├── .env.example
├── README.md
└── LICENSE
```

---

## 5. Configuration de référence (YAML)

Le fichier `ragkit-v1-config.yaml` est le contrat d'interface entre le frontend et le backend. Il définit toutes les sections configurables :

```yaml
version: "1.0"

project:
  name: "my-ragkit-project"
  description: "Assistant RAG documentaire"
  environment: "development"        # development | staging | production

ingestion:
  sources:
    - type: "local"
      path: "./data/documents"
      patterns: ["*.pdf", "*.docx", "*.md", "*.txt"]
      recursive: true
  parsing:
    engine: "auto"                  # auto | unstructured | docling | pypdf
    ocr:
      enabled: false
      engine: "tesseract"
      languages: ["fra", "eng"]
  chunking:
    strategy: "fixed"               # fixed | semantic
    fixed:
      chunk_size: 512
      chunk_overlap: 50

embedding:
  document_model:
    provider: "openai"              # openai | ollama | onnx | huggingface
    model: "text-embedding-3-small"
    api_key_env: "OPENAI_API_KEY"
  query_model:
    same_as_document: true
  params:
    batch_size: 100
    cache_enabled: true

vector_store:
  provider: "qdrant"                # qdrant | chroma
  qdrant:
    mode: "persistent"              # memory | persistent
    path: "./data/qdrant"

retrieval:
  architecture: "hybrid_rerank"     # semantic | lexical | hybrid | hybrid_rerank
  semantic:
    enabled: true
    weight: 0.5
    top_k: 20
  lexical:
    enabled: true
    weight: 0.5
    top_k: 20
    params: { k1: 1.5, b: 0.75 }
  rerank:
    enabled: true
    provider: "cohere"
    model: "rerank-v3.5"
    top_n: 5
  fusion:
    method: "reciprocal_rank_fusion"
  context:
    max_chunks: 5
    max_tokens: 4000

llm:
  primary:
    provider: "openai"
    model: "gpt-4o-mini"
    params: { temperature: 0.7, max_tokens: 2000 }
  fast:
    provider: "openai"
    model: "gpt-4o-mini"
    params: { temperature: 0.3, max_tokens: 500 }

agents:
  mode: "default"
  query_analyzer:
    llm: "fast"
    behavior:
      always_retrieve: false
      query_rewriting: { enabled: true, num_rewrites: 1 }
  response_generator:
    llm: "primary"
    behavior:
      cite_sources: true
      admit_uncertainty: true
      response_language: "auto"

conversation:
  memory:
    enabled: true
    type: "buffer_window"
    window_size: 10

api:
  streaming: { enabled: true, type: "sse" }

observability:
  logging: { level: "INFO", format: "json" }
```

---

## 6. Conventions de développement

### 6.1 Git

- **Branche principale** : `main`
- **Branches de feature** : `feature/etape-{N}-{description}`
- **Branches de fix** : `fix/{description}`
- **Tags de release** : `v{major}.{minor}.{patch}` (ex : `v0.1.0` pour l'Étape 0)
- **Commits conventionnels** : `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`, `chore:`

### 6.2 Python

- **Version** : Python ≥ 3.10
- **Style** : Ruff (lint + format), mypy (types)
- **Imports** : `from __future__ import annotations` dans chaque fichier
- **Docstrings** : style Google
- **Tests** : pytest, nommage `test_{module}.py`

### 6.3 TypeScript / React

- **Style** : ESLint + Prettier
- **Composants** : fonctionnels avec hooks (pas de classes)
- **Nommage** : PascalCase pour les composants, camelCase pour les fonctions/variables
- **Fichiers** : un composant = un fichier `.tsx`
- **État** : hooks React (useState, useReducer) ; store global uniquement si nécessaire

### 6.4 Rust

- **Edition** : 2021
- **Style** : `cargo fmt`, `cargo clippy`
- **Gestion d'erreurs** : `anyhow::Result` pour les commandes Tauri

---

## 7. Flux de données

### 7.1 Pipeline d'ingestion

```
Répertoire de documents
    │
    ▼
[1] Scanning (sources.py)
    │   Liste des fichiers selon patterns et exclusions
    ▼
[2] Parsing (parsers/)
    │   Extraction du texte brut + métadonnées
    │   OCR si activé, extraction tables si activé
    ▼
[3] Preprocessing (preprocessing.py)
    │   Normalisation Unicode, déduplication, nettoyage
    ▼
[4] Chunking (chunkers/)
    │   Découpage selon stratégie (fixed/semantic/recursive)
    │   Propagation des métadonnées du document parent
    ▼
[5] Embedding (embedding/)
    │   Vectorisation de chaque chunk (batch)
    │   Cache optionnel
    ▼
[6] Stockage (storage/)
    │   Insertion dans la base vectorielle
    │   Index BM25 mis à jour en parallèle
    ▼
[7] Versioning
        Sauvegarde de la version d'ingestion
```

### 7.2 Pipeline de requête

```
Question utilisateur
    │
    ▼
[1] Query Analyzer (agents/query_analyzer.py)
    │   Intent detection + reformulation
    │   → Si greeting/chitchat → réponse directe (pas de RAG)
    ▼
[2] Recherche sémantique (retrieval/engine.py)
    │   top_k résultats par similarité vectorielle
    │
    ├── Recherche lexicale BM25 (si hybrid)
    │   top_k résultats par correspondance lexicale
    │
    ▼
[3] Fusion (si hybrid)
    │   Weighted sum ou RRF
    ▼
[4] Reranking (si activé)
    │   Réordonnancement par modèle cross-encoder
    │   Filtrage par relevance_threshold
    ▼
[5] Context assembly
    │   Sélection top_n chunks, déduplication, max_tokens
    ▼
[6] Response Generator (agents/response_generator.py)
    │   Prompt système + contexte + question → LLM
    ▼
[7] Réponse finale
        Texte + citations [Source: nom_doc] + latence
```

---

## 8. Sécurité

| Aspect | Implémentation |
|--------|----------------|
| Clés API | Chiffrées via `keyring` (trousseau système natif) + fichier `credentials.enc` (AES-256) |
| Communication frontend↔backend | localhost uniquement (127.0.0.1), port dynamique |
| CSP | Désactivée dans Tauri (webview locale uniquement) |
| Données utilisateur | 100% local, aucune télémétrie, aucun envoi hors API choisies par l'utilisateur |
| Logs | Stockage local uniquement, rotation journalière |
| Build | NSIS signé (Windows), DMG (macOS) |

---

## 9. Plateformes cibles

| Plateforme | Target | Format de distribution |
|------------|--------|----------------------|
| Windows x64 | `x86_64-pc-windows-msvc` | NSIS `.exe` + MSI |
| macOS x64 | `x86_64-apple-darwin` | DMG |
| macOS ARM | `aarch64-apple-darwin` | DMG |
| Linux x64 | `x86_64-unknown-linux-gnu` | AppImage + DEB |

---

## 10. Plan de releases

| Étape | Tag | Contenu principal |
|-------|-----|-------------------|
| 0 | `v0.1.0` | Ossature : .exe avec coquille vide (3 onglets) |
| 1 | `v0.2.0` | Wizard + ingestion & préprocessing |
| 2 | `v0.3.0` | Chunking paramétrable |
| 3 | `v0.4.0` | Embedding configurable |
| 4 | `v0.5.0` | BDD vectorielle + pipeline d'ingestion complet |
| 5 | `v0.6.0` | Recherche sémantique |
| 6 | `v0.7.0` | Recherche lexicale BM25 |
| 7 | `v0.8.0` | Recherche hybride |
| 8 | `v0.9.0` | Reranking |
| 9 | `v0.10.0` | Chat RAG complet (LLM + génération) |
| 10 | `v0.11.0` | Agents & orchestration |
| 11 | `v0.12.0` | Monitoring & évaluation |
| 12 | `v1.0.0` | Release finale : sécurité, UX, polish |
