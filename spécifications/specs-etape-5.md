# 🧰 RAGKIT Desktop — Spécifications Étape 5 : Recherche sémantique

> **Étape** : 5 — Recherche sémantique  
> **Tag cible** : `v0.6.0`  
> **Date** : 16 février 2026  
> **Dépôt** : https://github.com/henribesnard/ragkit_desktop.git  
> **Prérequis** : Étape 4 (Base de données vectorielle) implémentée et validée

---

## 1. Objectif

Ajouter le **premier mode de recherche fonctionnel** : la recherche sémantique par similarité vectorielle. L'utilisateur peut soumettre une requête en langage naturel dans le CHAT et voir les chunks les plus pertinents extraits de sa base de connaissances.

Cette étape livre :
- Une section `PARAMÈTRES > Paramètres avancés > RECHERCHE SÉMANTIQUE` complète et fonctionnelle.
- L'**activation de l'onglet CHAT** avec un champ de requête et un affichage structuré des résultats.
- Un **moteur de recherche sémantique** qui embed la requête utilisateur, interroge la BDD vectorielle, filtre et renvoie les chunks pertinents.
- Le support du **filtrage par métadonnées** (source, type de document, langue, date, catégorie).
- La **diversification des résultats** via MMR (Maximal Marginal Relevance) pour éviter la redondance.
- Un **mode debug** optionnel affichant les scores, latences et détails techniques de chaque résultat.

**Pas de génération LLM** à cette étape. Le chat affiche uniquement les résultats bruts de la recherche (chunks avec scores et sources). C'est un outil de validation de la qualité de l'ingestion avant l'ajout du LLM (Étape 9).

---

## 2. Spécifications fonctionnelles

### 2.1 Section PARAMÈTRES > Paramètres avancés > RECHERCHE SÉMANTIQUE

#### Structure de l'onglet PARAMÈTRES à cette étape

```
PARAMÈTRES
├── Paramètres généraux
│   └── Mode d'ingestion (Manuel / Automatique)     ← Étape 4
└── Paramètres avancés
    ├── INGESTION & PRÉPROCESSING                    ← Étape 1
    ├── CHUNKING                                     ← Étape 2
    ├── EMBEDDING                                    ← Étape 3
    ├── BASE DE DONNÉES VECTORIELLE                  ← Étape 4
    └── RECHERCHE SÉMANTIQUE                         ← NOUVEAU
```

#### Layout de la section RECHERCHE SÉMANTIQUE

```
┌─────────────────────────────────────────────────────────────────┐
│  RECHERCHE SÉMANTIQUE                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Paramètres principaux ───────────────────────────────────┐ │
│  │                                                            │ │
│  │  ☑ Recherche sémantique activée                           │ │
│  │                                                            │ │
│  │  Nombre de résultats (top_k) :  [===◆======] 15           │ │
│  │  Seuil de similarité :          [◆=========] 0.0          │ │
│  │  Poids (recherche hybride) :    [====◆=====] 0.5          │ │
│  │                                                            │ │
│  │  ℹ️ top_k : nombre de chunks retournés par la recherche.   │ │
│  │  Un seuil de similarité > 0 filtre les résultats peu      │ │
│  │  pertinents (0.0 = pas de filtre).                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Diversification (MMR) ───────────────────────────────────┐ │
│  │                                                            │ │
│  │  ☑ Activer MMR (Maximal Marginal Relevance)               │ │
│  │                                                            │ │
│  │  Lambda (pertinence ↔ diversité) : [=====◆====] 0.5       │ │
│  │                                                            │ │
│  │  ℹ️ MMR réduit la redondance en diversifiant les résultats.│ │
│  │  Lambda = 1.0 : max pertinence, Lambda = 0.0 : max        │ │
│  │  diversité. 0.5 est un bon compromis.                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Filtres par métadonnées ─────────────────────────────────┐ │
│  │                                                            │ │
│  │  ☐ Activer les filtres par défaut                         │ │
│  │                                                            │ │
│  │  (si activé :)                                            │ │
│  │  Source(s) :      [▾ Tous les documents          ] ☑      │ │
│  │  Type(s) :        [▾ Tous les types              ] ☑      │ │
│  │  Langue(s) :      [▾ Toutes les langues          ] ☑      │ │
│  │  Catégorie(s) :   [▾ Toutes les catégories       ] ☑      │ │
│  │                                                            │ │
│  │  ℹ️ Les filtres par défaut s'appliquent à toutes les       │ │
│  │  recherches. L'utilisateur peut aussi filtrer au cas       │ │
│  │  par cas dans le chat.                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ▸ Paramètres avancés                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ef_search (Qdrant) :    [=====◆======] 128               │ │
│  │  Prefetch multiplier :   [==◆=========] 3                 │ │
│  │  ☐ Mode debug activé par défaut                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [↻ Réinitialiser au profil]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Activation de l'onglet CHAT

L'onglet CHAT était un placeholder ("Le chat sera disponible après configuration") depuis l'Étape 0. À l'Étape 5, il devient fonctionnel.

**Prérequis pour activer le chat** : au moins une ingestion réussie (index non vide). Si l'index est vide, un message s'affiche :

```
┌─────────────────────────────────────────────────────────────┐
│  💬 CHAT                                                     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │                                                    │     │
│  │    📚 Base de connaissances vide                    │     │
│  │                                                    │     │
│  │    Lancez une ingestion depuis le Tableau de bord   │     │
│  │    pour pouvoir interroger vos documents.           │     │
│  │                                                    │     │
│  │    [→ Aller au Tableau de bord]                     │     │
│  │                                                    │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

#### Layout du CHAT (avec résultats)

```
┌─────────────────────────────────────────────────────────────────┐
│  💬 CHAT                                           [⚙ Options] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Barre de recherche ──────────────────────────────────────┐ │
│  │  🔍 [Posez votre question...                        ] [→]  │ │
│  │                                                            │ │
│  │  Filtres rapides :                                        │ │
│  │  [▾ Tous les documents] [▾ Toutes les langues]           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ── Résultats pour "conditions de résiliation du contrat" ──── │
│  ── 15 chunks trouvés · 245 ms ──────────────────────────────  │
│                                                                 │
│  ┌── Résultat #1 ─────────────── Score : 0.892 ──────────────┐ │
│  │                                                            │ │
│  │  📄 contrat-service-2024.pdf · Page 8                     │ │
│  │                                                            │ │
│  │  "Les conditions de résiliation anticipée sont définies    │ │
│  │  à l'article 12 du présent contrat. Le prestataire peut   │ │
│  │  résilier le contrat avec un préavis de 90 jours en cas   │ │
│  │  de manquement grave aux obligations..."                   │ │
│  │                                                            │ │
│  │  📁 Juridique · 🏷 contrat, résiliation · 🌐 fr          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Résultat #2 ─────────────── Score : 0.847 ──────────────┐ │
│  │                                                            │ │
│  │  📄 CGV-2024.pdf · Page 3                                 │ │
│  │                                                            │ │
│  │  "Article 7 — Résiliation. Le client peut mettre fin      │ │
│  │  au contrat à tout moment par lettre recommandée. Les     │ │
│  │  sommes versées ne sont remboursables que dans les         │ │
│  │  conditions prévues à l'article 9..."                      │ │
│  │                                                            │ │
│  │  📁 Juridique · 🏷 CGV, résiliation · 🌐 fr              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Résultat #3 ─────────────── Score : 0.783 ──────────────┐ │
│  │  ...                                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [▼ Voir plus de résultats] (affiche 5 par page)               │
│                                                                 │
│  ┌── Mode debug (si activé) ─────────────────────────────────┐ │
│  │  Requête : "conditions de résiliation du contrat"         │ │
│  │  Tokens requête : 7 · Embedding : 132 ms                 │ │
│  │  Recherche vectorielle : 113 ms · MMR : 8 ms             │ │
│  │  Total : 253 ms · Résultats avant filtre : 15            │ │
│  │  Résultats après seuil : 15 (seuil = 0.0)               │ │
│  │  Résultats après MMR : 15                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Flux de la recherche sémantique

```
1. L'utilisateur saisit une requête dans la barre de recherche
2. La requête est envoyée au backend
3. Le backend :
   a. Vectorise la requête (embed_query via le modèle d'embedding configuré)
   b. Interroge la BDD vectorielle (top_k × prefetch_multiplier résultats)
   c. Applique le seuil de similarité (filtre les scores < threshold)
   d. Applique les filtres par métadonnées (si configurés)
   e. Applique MMR (si activé) pour diversifier les résultats
   f. Tronque à top_k résultats finaux
4. Les résultats sont renvoyés au frontend
5. Le frontend affiche les résultats avec mise en forme
```

### 2.4 Affichage d'un résultat

Chaque résultat (chunk) est affiché dans une carte contenant :

| Élément | Source | Affichage |
|---------|--------|-----------|
| **Score** | Score de similarité (0.0–1.0) | Badge en haut à droite avec code couleur |
| **Source** | `payload.doc_title` ou `payload.doc_path` | 📄 Nom du document |
| **Page** | `payload.page_number` (si disponible) | "· Page N" |
| **Texte** | `payload.chunk_text` | Extrait du chunk (max 300 caractères, avec "..." si tronqué). La requête est surlignée dans le texte. |
| **Catégorie** | `payload.category` | 📁 Nom de catégorie |
| **Tags** | `payload.keywords` | 🏷 Tags séparés par virgule |
| **Langue** | `payload.doc_language` | 🌐 Code langue |

**Code couleur du score** :

| Score | Couleur | Label |
|-------|---------|-------|
| 0.85 — 1.0 | Vert | Très pertinent |
| 0.70 — 0.85 | Vert clair | Pertinent |
| 0.50 — 0.70 | Orange | Modéré |
| 0.0 — 0.50 | Rouge | Faible |

**Action sur clic** : cliquer sur la carte déploie le texte complet du chunk et affiche toutes les métadonnées détaillées (index du chunk, nombre de tokens, section source, hash du document, version d'ingestion).

### 2.5 Filtres rapides dans le chat

Sous la barre de recherche, des dropdowns permettent de filtrer les résultats :

| Filtre | Valeurs | Source |
|--------|---------|--------|
| **Documents** | Liste de tous les documents indexés | `payload.doc_title` distinct |
| **Langues** | Liste des langues détectées | `payload.doc_language` distinct |
| **Types** | PDF, DOCX, Markdown, TXT, HTML | `payload.doc_type` distinct |
| **Catégories** | Liste des catégories assignées | `payload.category` distinct |

**Comportements** :
- Les filtres sont des multi-sélections (on peut sélectionner plusieurs documents, plusieurs langues, etc.).
- "Tous" est la valeur par défaut (aucun filtre).
- Les filtres sont envoyés au backend comme conditions sur le `payload` de la recherche vectorielle.
- Les listes de valeurs disponibles sont chargées dynamiquement depuis l'index (requête `distinct` sur les payloads).

### 2.6 Diversification MMR

Le **Maximal Marginal Relevance** (MMR) est un algorithme qui ré-ordonne les résultats pour réduire la redondance. Il balance entre la pertinence (similarité avec la requête) et la diversité (dissimilarité entre les résultats).

**Algorithme** :

```
MMR(Di) = λ × Sim(Di, Q) - (1 - λ) × max(Sim(Di, Dj))
                                       j ∈ S

où :
  Di = candidat courant
  Q  = requête
  S  = résultats déjà sélectionnés
  λ  = paramètre lambda (0.0 = max diversité, 1.0 = max pertinence)
```

**Implémentation** :
1. Récupérer `top_k × prefetch_multiplier` résultats depuis la BDD vectorielle.
2. Sélectionner itérativement les résultats finaux en maximisant le score MMR.
3. Retourner `top_k` résultats.

### 2.7 Mode debug

Le mode debug affiche un panneau en bas des résultats avec les informations techniques de la recherche.

**Informations affichées** :

| Métrique | Description |
|----------|-------------|
| Requête | Texte de la requête originale |
| Tokens requête | Nombre de tokens de la requête |
| Latence embedding | Temps de vectorisation de la requête (ms) |
| Latence recherche | Temps de recherche dans la BDD vectorielle (ms) |
| Latence MMR | Temps de calcul MMR (ms) |
| Latence totale | Temps total bout-en-bout (ms) |
| Résultats bruts | Nombre de résultats retournés par la BDD vectorielle |
| Après seuil | Nombre de résultats après filtrage par seuil |
| Après filtres | Nombre de résultats après filtrage par métadonnées |
| Après MMR | Nombre de résultats finaux après MMR |

**Activation** :
- Toggle dans `PARAMÈTRES > Paramètres avancés > RECHERCHE SÉMANTIQUE > Paramètres avancés > Mode debug activé par défaut`.
- Toggle rapide dans le chat via le bouton "⚙ Options" en haut à droite → "Afficher le mode debug".

### 2.8 Bouton Options du CHAT

Le bouton "⚙ Options" en haut à droite du CHAT ouvre un panneau latéral ou un dropdown avec :

| Option | Type | Description |
|--------|------|-------------|
| Mode debug | Toggle | Afficher/masquer le panneau debug |
| Résultats par page | Dropdown | 5, 10, 15, 20 (défaut : 5) |
| Afficher les scores | Toggle | Montrer/cacher les scores de similarité |
| Afficher les métadonnées | Toggle | Montrer/cacher catégorie, tags, langue |

Ces options sont **locales au chat** (non persistées dans `settings.json`). Elles reviennent à leurs valeurs par défaut à chaque redémarrage.

---

## 3. Catalogue complet des paramètres RECHERCHE SÉMANTIQUE

### 3.1 Paramètres principaux

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Activée | `retrieval.semantic.enabled` | bool | — | — | `true` | Activer/désactiver la recherche sémantique |
| Top K | `retrieval.semantic.top_k` | int | 1 | 100 | Selon profil | Nombre maximum de chunks retournés |
| Seuil de similarité | `retrieval.semantic.threshold` | float | 0.0 | 1.0 | Selon profil | Score minimum pour inclure un résultat. 0.0 = pas de filtre. |
| Poids | `retrieval.semantic.weight` | float | 0.0 | 1.0 | Selon profil | Poids de la recherche sémantique dans le score hybride (utilisé aux Étapes 7+). |

### 3.2 Paramètres de diversification (MMR)

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| MMR activé | `retrieval.semantic.mmr_enabled` | bool | — | — | `false` | Activer la diversification par MMR |
| Lambda | `retrieval.semantic.mmr_lambda` | float | 0.0 | 1.0 | 0.5 | Balance pertinence (1.0) ↔ diversité (0.0) |

### 3.3 Filtres par métadonnées (par défaut)

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Filtres activés | `retrieval.semantic.default_filters_enabled` | bool | `false` | Appliquer des filtres par défaut à toutes les recherches |
| Documents | `retrieval.semantic.default_filters.doc_ids` | list[str] | `[]` | Liste de `doc_id` à inclure (vide = tous) |
| Types | `retrieval.semantic.default_filters.doc_types` | list[str] | `[]` | Types de documents (vide = tous) |
| Langues | `retrieval.semantic.default_filters.languages` | list[str] | `[]` | Langues (vide = toutes) |
| Catégories | `retrieval.semantic.default_filters.categories` | list[str] | `[]` | Catégories (vide = toutes) |

### 3.4 Paramètres avancés

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Prefetch multiplier | `retrieval.semantic.prefetch_multiplier` | int | 1 | 10 | 3 | Multiplier le `top_k` pour avoir plus de candidats avant MMR et filtrage. |
| Debug par défaut | `retrieval.semantic.debug_default` | bool | — | — | `false` | Activer le mode debug par défaut dans le chat |

### 3.5 Résumé des impacts

| Paramètre | Impact principal | Impact secondaire |
|-----------|-----------------|-------------------|
| `top_k` | **CRITIQUE** — Nombre de résultats. Trop peu = résultats manquants. Trop = bruit. | Latence de recherche (marginal pour <100) |
| `threshold` | Filtre les résultats peu pertinents | Risque de "0 résultat" si trop élevé |
| `weight` | Poids dans la recherche hybride (Étape 7) | Aucun impact à cette étape (utilisé seul) |
| `mmr_enabled` + `mmr_lambda` | Diversité des résultats | Légère augmentation de la latence |
| `prefetch_multiplier` | Qualité du pool de candidats pour MMR | Latence de recherche vectorielle |

---

## 4. Valeurs par défaut par profil

### 4.1 Matrice profil → paramètres de recherche sémantique

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|:---:|:---:|:---:|:---:|:---:|
| `enabled` | `true` | `true` | `true` | `true` | `true` |
| `top_k` | 15 | 5 | 20 | 15 | 10 |
| `threshold` | 0.0 | 0.3 | 0.0 | 0.0 | 0.0 |
| `weight` | 0.5 | 1.0 | 0.5 | 0.6 | 0.5 |
| `mmr_enabled` | `false` | `false` | `false` | `false` | `false` |
| `mmr_lambda` | 0.5 | 0.5 | 0.5 | 0.5 | 0.5 |
| `prefetch_multiplier` | 3 | 2 | 3 | 3 | 3 |
| `debug_default` | `false` | `false` | `false` | `false` | `false` |

### 4.2 Justification des choix

- **`faq_support` → `top_k=5`, `threshold=0.3`** : les bases FAQ ont des réponses courtes et ciblées. Un `top_k` faible avec un seuil non nul évite de noyer l'utilisateur. Le `weight=1.0` signifie qu'à terme (recherche hybride), le profil FAQ se base uniquement sur le sémantique.
- **`legal_compliance` → `top_k=20`** : le contexte juridique nécessite de remonter un maximum de chunks pertinents pour ne rien manquer. Le seuil est à 0 car tout document potentiellement pertinent doit être examiné.
- **`technical_documentation` → `top_k=15`** : bon compromis entre exhaustivité et pertinence pour de la doc technique. Le `weight=0.5` prépare la recherche hybride à 50/50 avec le lexical.
- **`reports_analysis` → `weight=0.6`** : les rapports bénéficient d'un poids sémantique légèrement supérieur car les requêtes sont souvent conceptuelles ("évolution du CA").

---

## 5. Spécifications techniques

### 5.1 Schéma Pydantic (backend)

```python
# ragkit/config/retrieval_schema.py
"""Pydantic schemas for semantic search configuration."""

from __future__ import annotations

from pydantic import BaseModel, Field


class MetadataFilters(BaseModel):
    """Default metadata filters applied to all searches."""
    doc_ids: list[str] = Field(default_factory=list)
    doc_types: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)


class SemanticSearchConfig(BaseModel):
    """Semantic search configuration."""

    enabled: bool = True
    top_k: int = Field(default=10, ge=1, le=100)
    threshold: float = Field(default=0.0, ge=0.0, le=1.0)
    weight: float = Field(default=0.5, ge=0.0, le=1.0,
        description="Weight in hybrid search (Étape 7)")

    # MMR
    mmr_enabled: bool = False
    mmr_lambda: float = Field(default=0.5, ge=0.0, le=1.0)

    # Default filters
    default_filters_enabled: bool = False
    default_filters: MetadataFilters = Field(
        default_factory=MetadataFilters)

    # Advanced
    prefetch_multiplier: int = Field(default=3, ge=1, le=10)
    debug_default: bool = False
```

### 5.2 Moteur de recherche sémantique (backend)

```python
# ragkit/retrieval/semantic_engine.py
"""Semantic search engine — vector similarity search with MMR."""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np

from ragkit.config.retrieval_schema import SemanticSearchConfig, MetadataFilters
from ragkit.embedding.engine import BaseEmbeddingProvider
from ragkit.storage.base import BaseVectorStore


@dataclass
class SearchResult:
    """A single search result (chunk with score and metadata)."""
    chunk_id: str
    score: float
    text: str
    metadata: dict
    # Populated from payload:
    doc_title: str | None = None
    doc_path: str | None = None
    doc_type: str | None = None
    page_number: int | None = None
    chunk_index: int | None = None
    chunk_total: int | None = None
    section_header: str | None = None
    doc_language: str | None = None
    category: str | None = None
    keywords: list[str] = field(default_factory=list)


@dataclass
class SearchDebugInfo:
    """Debug information for a search query."""
    query_text: str
    query_tokens: int
    embedding_latency_ms: int
    search_latency_ms: int
    mmr_latency_ms: int
    total_latency_ms: int
    results_from_db: int
    results_after_threshold: int
    results_after_filters: int
    results_after_mmr: int


@dataclass
class SemanticSearchResponse:
    """Complete response from a semantic search."""
    query: str
    results: list[SearchResult]
    total_results: int
    debug: SearchDebugInfo | None = None


class SemanticSearchEngine:
    """Performs semantic search with optional MMR diversification."""

    def __init__(
        self,
        config: SemanticSearchConfig,
        embedder: BaseEmbeddingProvider,
        store: BaseVectorStore,
    ):
        self.config = config
        self.embedder = embedder
        self.store = store

    async def search(
        self,
        query: str,
        top_k: int | None = None,
        threshold: float | None = None,
        filters: MetadataFilters | None = None,
        mmr_enabled: bool | None = None,
        mmr_lambda: float | None = None,
        include_debug: bool = False,
    ) -> SemanticSearchResponse:
        """Execute a semantic search query."""

        # Use provided params or fall back to config defaults
        _top_k = top_k or self.config.top_k
        _threshold = threshold if threshold is not None else self.config.threshold
        _mmr = mmr_enabled if mmr_enabled is not None else self.config.mmr_enabled
        _lambda = mmr_lambda or self.config.mmr_lambda

        t_start = time.perf_counter()

        # 1. Embed the query
        t_embed_start = time.perf_counter()
        query_vector = await self.embedder.embed_query(query)
        t_embed = time.perf_counter() - t_embed_start

        # 2. Build metadata filter conditions
        filter_conditions = self._build_filters(filters)

        # 3. Search the vector store
        prefetch_k = _top_k * self.config.prefetch_multiplier if _mmr else _top_k
        t_search_start = time.perf_counter()
        raw_results = await self.store.search(
            vector=query_vector,
            limit=prefetch_k,
            filter_conditions=filter_conditions,
        )
        t_search = time.perf_counter() - t_search_start

        # 4. Apply similarity threshold
        filtered = [r for r in raw_results if r.score >= _threshold]

        # 5. Apply MMR if enabled
        t_mmr_start = time.perf_counter()
        if _mmr and len(filtered) > _top_k:
            final_results = self._apply_mmr(
                query_vector, filtered, _top_k, _lambda)
        else:
            final_results = filtered[:_top_k]
        t_mmr = time.perf_counter() - t_mmr_start

        t_total = time.perf_counter() - t_start

        # 6. Build response
        search_results = [
            self._to_search_result(r) for r in final_results
        ]

        debug = None
        if include_debug:
            debug = SearchDebugInfo(
                query_text=query,
                query_tokens=self._count_tokens(query),
                embedding_latency_ms=int(t_embed * 1000),
                search_latency_ms=int(t_search * 1000),
                mmr_latency_ms=int(t_mmr * 1000),
                total_latency_ms=int(t_total * 1000),
                results_from_db=len(raw_results),
                results_after_threshold=len(filtered),
                results_after_filters=len(filtered),
                results_after_mmr=len(final_results),
            )

        return SemanticSearchResponse(
            query=query,
            results=search_results,
            total_results=len(final_results),
            debug=debug,
        )

    def _apply_mmr(
        self,
        query_vector: list[float],
        candidates: list,
        top_k: int,
        lambda_param: float,
    ) -> list:
        """Apply Maximal Marginal Relevance re-ranking."""
        query_vec = np.array(query_vector)
        candidate_vecs = np.array([c.vector for c in candidates])

        selected = []
        remaining = list(range(len(candidates)))

        for _ in range(min(top_k, len(candidates))):
            best_idx = None
            best_score = -float("inf")

            for idx in remaining:
                # Relevance to query
                relevance = candidates[idx].score

                # Max similarity to already-selected results
                if selected:
                    selected_vecs = candidate_vecs[selected]
                    sim_to_selected = np.max(
                        np.dot(selected_vecs, candidate_vecs[idx])
                        / (np.linalg.norm(selected_vecs, axis=1)
                           * np.linalg.norm(candidate_vecs[idx]))
                    )
                else:
                    sim_to_selected = 0.0

                mmr_score = (
                    lambda_param * relevance
                    - (1 - lambda_param) * sim_to_selected
                )

                if mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = idx

            if best_idx is not None:
                selected.append(best_idx)
                remaining.remove(best_idx)

        return [candidates[i] for i in selected]

    def _build_filters(
        self, filters: MetadataFilters | None
    ) -> dict | None:
        """Build filter conditions for the vector store query."""
        active_filters = filters
        if active_filters is None and self.config.default_filters_enabled:
            active_filters = self.config.default_filters
        if active_filters is None:
            return None

        conditions = {}
        if active_filters.doc_ids:
            conditions["doc_id"] = {"$in": active_filters.doc_ids}
        if active_filters.doc_types:
            conditions["doc_type"] = {"$in": active_filters.doc_types}
        if active_filters.languages:
            conditions["doc_language"] = {"$in": active_filters.languages}
        if active_filters.categories:
            conditions["category"] = {"$in": active_filters.categories}

        return conditions if conditions else None
```

### 5.3 Extension du BaseVectorStore — méthode `search`

L'Étape 4 a défini `BaseVectorStore` avec `upsert`, `delete_by_doc_id`, etc. L'Étape 5 **ajoute** la méthode `search` :

```python
# ragkit/storage/base.py — ajouts Étape 5

@dataclass
class SearchHit:
    """Raw result from a vector store search."""
    id: str
    score: float
    vector: list[float] | None    # Needed for MMR computation
    payload: dict


class BaseVectorStore(ABC):
    # ... (méthodes existantes Étape 4) ...

    @abstractmethod
    async def search(
        self,
        vector: list[float],
        limit: int = 10,
        filter_conditions: dict | None = None,
        with_vectors: bool = False,
    ) -> list[SearchHit]:
        """Search for nearest vectors. Returns results sorted by score desc."""
        ...

    @abstractmethod
    async def get_distinct_values(
        self, field_name: str
    ) -> list[str]:
        """Get distinct values for a payload field (for filter dropdowns)."""
        ...
```

**Implémentation Qdrant** :

```python
# ragkit/storage/qdrant_store.py — méthode search

async def search(
    self,
    vector: list[float],
    limit: int = 10,
    filter_conditions: dict | None = None,
    with_vectors: bool = False,
) -> list[SearchHit]:
    """Search Qdrant collection by vector similarity."""
    from qdrant_client.models import Filter, FieldCondition, MatchAny

    qdrant_filter = None
    if filter_conditions:
        must_conditions = []
        for field, condition in filter_conditions.items():
            if "$in" in condition:
                must_conditions.append(
                    FieldCondition(
                        key=field,
                        match=MatchAny(any=condition["$in"]),
                    )
                )
        if must_conditions:
            qdrant_filter = Filter(must=must_conditions)

    results = self._client.search(
        collection_name=self.config.collection_name,
        query_vector=vector,
        limit=limit,
        query_filter=qdrant_filter,
        with_vectors=with_vectors,
        score_threshold=None,  # Threshold applied in engine
    )

    return [
        SearchHit(
            id=str(r.id),
            score=r.score,
            vector=r.vector if with_vectors else None,
            payload=r.payload or {},
        )
        for r in results
    ]
```

### 5.4 API REST (routes backend)

#### 5.4.1 Routes Recherche sémantique Config

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/retrieval/semantic/config` | GET | Config recherche sémantique courante | — | `SemanticSearchConfig` |
| `/api/retrieval/semantic/config` | PUT | Met à jour la config | `SemanticSearchConfig` (partiel) | `SemanticSearchConfig` |
| `/api/retrieval/semantic/config/reset` | POST | Réinitialise au profil actif | — | `SemanticSearchConfig` |

#### 5.4.2 Routes Recherche

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/search/semantic` | POST | Exécute une recherche sémantique | `SearchQuery` | `SemanticSearchResponse` |
| `/api/search/filters/values` | GET | Valeurs disponibles pour les filtres | `?field=doc_type` | `{ values: string[] }` |

#### 5.4.3 Routes Chat

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/chat/ready` | GET | Vérifie si le chat est prêt (index non vide) | — | `{ ready: bool, vectors_count: int }` |

#### 5.4.4 Modèles de requête et réponse

```python
class SearchQuery(BaseModel):
    """Search query from the chat interface."""
    query: str = Field(..., min_length=1, max_length=2000)
    top_k: int | None = None              # Override config default
    threshold: float | None = None        # Override config default
    filters: SearchFilters | None = None  # Runtime filters from chat
    mmr_enabled: bool | None = None       # Override config default
    mmr_lambda: float | None = None       # Override config default
    include_debug: bool = False
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=5, ge=1, le=50)

class SearchFilters(BaseModel):
    """Runtime filters from the chat interface."""
    doc_ids: list[str] | None = None
    doc_types: list[str] | None = None
    languages: list[str] | None = None
    categories: list[str] | None = None

class SemanticSearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]
    total_results: int
    page: int
    page_size: int
    has_more: bool
    debug: SearchDebugInfo | None = None

class SearchResultItem(BaseModel):
    chunk_id: str
    score: float
    text: str
    text_preview: str             # Tronqué à 300 caractères
    doc_title: str | None
    doc_path: str | None
    doc_type: str | None
    page_number: int | None
    chunk_index: int | None
    chunk_total: int | None
    chunk_tokens: int | None
    section_header: str | None
    doc_language: str | None
    category: str | None
    keywords: list[str]
    ingestion_version: str | None

class SearchDebugInfo(BaseModel):
    query_text: str
    query_tokens: int
    embedding_latency_ms: int
    search_latency_ms: int
    mmr_latency_ms: int
    total_latency_ms: int
    results_from_db: int
    results_after_threshold: int
    results_after_filters: int
    results_after_mmr: int
```

### 5.5 Commandes Tauri (Rust) — ajouts

```rust
// desktop/src-tauri/src/commands.rs (ajouts Étape 5)

// Retrieval config
#[tauri::command]
pub async fn get_semantic_search_config() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn update_semantic_search_config(config: serde_json::Value) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn reset_semantic_search_config() -> Result<serde_json::Value, String> { ... }

// Search
#[tauri::command]
pub async fn semantic_search(query: serde_json::Value) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn get_filter_values(field: String) -> Result<serde_json::Value, String> { ... }

// Chat readiness
#[tauri::command]
pub async fn is_chat_ready() -> Result<serde_json::Value, String> { ... }
```

### 5.6 Composants React — arborescence

```
desktop/src/
├── components/
│   ├── settings/
│   │   ├── SemanticSearchSettings.tsx         ← NOUVEAU : section complète
│   │   ├── MMRPanel.tsx                       ← NOUVEAU : paramètres de diversification
│   │   ├── MetadataFiltersConfig.tsx          ← NOUVEAU : filtres par défaut
│   │   └── ... (existants)
│   ├── chat/
│   │   ├── ChatView.tsx                       ← MODIFIER : activer (plus de placeholder)
│   │   ├── SearchBar.tsx                      ← NOUVEAU : barre de recherche
│   │   ├── FilterBar.tsx                      ← NOUVEAU : filtres rapides (dropdowns)
│   │   ├── SearchResults.tsx                  ← NOUVEAU : liste des résultats
│   │   ├── SearchResultCard.tsx               ← NOUVEAU : carte d'un résultat
│   │   ├── SearchResultDetail.tsx             ← NOUVEAU : détail déplié d'un résultat
│   │   ├── SearchDebugPanel.tsx               ← NOUVEAU : panneau debug
│   │   ├── ChatOptions.tsx                    ← NOUVEAU : bouton ⚙ Options
│   │   ├── EmptyIndex.tsx                     ← NOUVEAU : placeholder index vide
│   │   └── ScoreBadge.tsx                     ← NOUVEAU : badge score avec couleur
│   └── ui/
│       ├── HighlightedText.tsx                ← NOUVEAU : surlignage de la requête
│       ├── MultiSelect.tsx                    ← NOUVEAU : sélecteur multi-valeurs
│       └── ... (existants)
├── hooks/
│   ├── useSemanticSearchConfig.ts             ← NOUVEAU : hook config
│   ├── useSemanticSearch.ts                   ← NOUVEAU : hook exécution recherche
│   ├── useFilterValues.ts                     ← NOUVEAU : hook valeurs de filtres
│   ├── useChatReady.ts                        ← NOUVEAU : hook état du chat
│   └── ... (existants)
├── lib/
│   └── ipc.ts                                 ← MODIFIER : ajouter routes search + chat
└── locales/
    ├── fr.json                                ← MODIFIER : ajouter clés chat + search
    └── en.json                                ← MODIFIER : ajouter clés chat + search
```

### 5.7 Détail du composant `SearchResultCard.tsx`

```tsx
interface SearchResultCardProps {
  result: SearchResultItem;
  query: string;
  rank: number;
  showScore: boolean;
  showMetadata: boolean;
}

export function SearchResultCard({
  result, query, rank, showScore, showMetadata
}: SearchResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>📄 {result.doc_title || result.doc_path}</span>
          {result.page_number && <span>· Page {result.page_number}</span>}
        </div>
        {showScore && (
          <ScoreBadge score={result.score} />
        )}
      </div>

      <div className="mt-2">
        <HighlightedText
          text={expanded ? result.text : result.text_preview}
          query={query}
        />
      </div>

      {showMetadata && (
        <div className="mt-2 flex gap-3 text-xs text-gray-400">
          {result.category && <span>📁 {result.category}</span>}
          {result.keywords.length > 0 && (
            <span>🏷 {result.keywords.join(", ")}</span>
          )}
          {result.doc_language && <span>🌐 {result.doc_language}</span>}
        </div>
      )}

      {expanded && (
        <SearchResultDetail result={result} />
      )}
    </div>
  );
}
```

### 5.8 Persistance

La config de recherche sémantique est stockée dans `settings.json` :

```json
{
  "version": "1.0.0",
  "ingestion": { "...": "..." },
  "chunking": { "...": "..." },
  "embedding": { "...": "..." },
  "vector_store": { "...": "..." },
  "general": { "...": "..." },
  "retrieval": {
    "architecture": "hybrid_rerank",
    "semantic": {
      "enabled": true,
      "top_k": 15,
      "threshold": 0.0,
      "weight": 0.5,
      "mmr_enabled": false,
      "mmr_lambda": 0.5,
      "default_filters_enabled": false,
      "default_filters": {
        "doc_ids": [],
        "doc_types": [],
        "languages": [],
        "categories": []
      },
      "prefetch_multiplier": 3,
      "debug_default": false
    },
    "lexical": { "...": "valeurs stockées, utilisées à l'Étape 6" },
    "hybrid": { "...": "valeurs stockées, utilisées à l'Étape 7" }
  }
}
```

### 5.9 Dépendances Python ajoutées

```toml
# pyproject.toml — ajouts aux dependencies pour Étape 5
dependencies = [
    # ... (existants Étapes 0-4)
    # numpy est déjà présent (Étape 3)
    # Aucune nouvelle dépendance Python requise pour cette étape.
    # La recherche sémantique utilise :
    # - qdrant-client / chromadb (Étape 4) pour la requête vectorielle
    # - numpy (Étape 3) pour le calcul MMR
    # - L'embedding provider (Étape 3) pour vectoriser la requête
]
```

---

## 6. Critères d'acceptation

### 6.1 Fonctionnels

| # | Critère |
|---|---------|
| F1 | La section `PARAMÈTRES > Paramètres avancés > RECHERCHE SÉMANTIQUE` est accessible et affiche tous les paramètres |
| F2 | Le toggle `enabled` active/désactive la recherche sémantique |
| F3 | Le slider `top_k` modifie le nombre de résultats retournés |
| F4 | Le slider `threshold` filtre les résultats en dessous du seuil |
| F5 | Le toggle MMR active la diversification des résultats |
| F6 | Le slider `mmr_lambda` ajuste la balance pertinence/diversité |
| F7 | La section "Filtres par métadonnées" permet de configurer des filtres par défaut |
| F8 | L'onglet CHAT est activé et fonctionnel quand l'index contient des vecteurs |
| F9 | L'onglet CHAT affiche un placeholder "Base vide" si aucune ingestion n'a été faite |
| F10 | La barre de recherche accepte une requête texte et déclenche la recherche |
| F11 | Les résultats s'affichent sous forme de cartes avec score, source, extrait, métadonnées |
| F12 | Le score de chaque résultat est affiché avec un code couleur (vert → rouge) |
| F13 | Le texte de la requête est surligné dans les extraits des résultats |
| F14 | Cliquer sur un résultat déploie le texte complet et les métadonnées détaillées |
| F15 | Les filtres rapides (documents, langues, types, catégories) fonctionnent dans le chat |
| F16 | Les listes de filtres sont dynamiquement chargées depuis l'index |
| F17 | Le mode debug affiche les latences et compteurs de résultats |
| F18 | Le bouton "⚙ Options" permet de toggler debug, scores, métadonnées |
| F19 | La pagination "Voir plus de résultats" charge les résultats suivants |
| F20 | Le badge "Modifié" apparaît à côté de chaque paramètre modifié |
| F21 | Le bouton "Réinitialiser au profil" restaure les valeurs par défaut |
| F22 | Tous les textes sont traduits FR/EN via i18n |

### 6.2 Techniques

| # | Critère |
|---|---------|
| T1 | `GET /api/retrieval/semantic/config` retourne la config courante |
| T2 | `PUT /api/retrieval/semantic/config` valide et persiste les modifications |
| T3 | `POST /api/retrieval/semantic/config/reset` restaure les valeurs du profil actif |
| T4 | `POST /api/search/semantic` retourne les résultats de la recherche vectorielle |
| T5 | La requête est vectorisée via le modèle d'embedding configuré (Étape 3) |
| T6 | Le seuil de similarité filtre correctement les résultats |
| T7 | Le filtrage par métadonnées fonctionne pour chaque champ (doc_type, language, category, doc_id) |
| T8 | L'algorithme MMR produit des résultats diversifiés (vérifiable : les résultats MMR ont une similarité inter-résultat inférieure aux résultats bruts) |
| T9 | La recherche fonctionne avec Qdrant |
| T10 | La recherche fonctionne avec ChromaDB |
| T11 | `GET /api/search/filters/values?field=doc_type` retourne les valeurs distinctes du champ |
| T12 | `GET /api/chat/ready` retourne `{ ready: true }` quand l'index contient des vecteurs |
| T13 | La latence totale d'une recherche est inférieure à 500 ms pour un index de 10K vecteurs |
| T14 | La pagination retourne les résultats corrects (page 1 = résultats 1-5, page 2 = 6-10, etc.) |
| T15 | La config recherche sémantique est persistée dans `settings.json` sous `retrieval.semantic` |
| T16 | `tsc --noEmit` ne produit aucune erreur TypeScript |
| T17 | Le CI passe sur les 4 targets (lint + build) |

---

## 7. Périmètre exclus (Étape 5)

- **Recherche lexicale (BM25)** : sera ajoutée à l'Étape 6.
- **Recherche hybride** (fusion sémantique + lexicale) : sera ajoutée à l'Étape 7.
- **Reranking** : sera ajouté à l'Étape 8.
- **Génération LLM** : sera ajoutée à l'Étape 9. Le chat affiche uniquement les résultats bruts.
- **Historique de conversation** : pas de mémoire de conversation à cette étape. Chaque requête est indépendante.
- **Query expansion** (synonymes, reformulation) : sera ajoutée à l'Étape 10 (Agents).
- **HyDE** (Hypothetical Document Embeddings) : amélioration future.
- **Multi-query** (génération de requêtes multiples) : sera ajoutée à l'Étape 10 (Agents).
- **Sélecteur de mode de recherche** dans le chat : sera ajouté à l'Étape 6 (quand le second mode sera disponible).

---

## 8. Estimation

| Tâche | Effort estimé |
|-------|---------------|
| Schéma Pydantic `SemanticSearchConfig` + validation | 0.5 jour |
| `SemanticSearchEngine` (recherche + MMR + filtres + debug) | 2 jours |
| Extension `BaseVectorStore.search()` + `get_distinct_values()` | 0.5 jour |
| Implémentation `QdrantVectorStore.search()` avec filtrage | 1 jour |
| Implémentation `ChromaVectorStore.search()` avec filtrage | 0.5 jour |
| Routes API config (CRUD) | 0.5 jour |
| Routes API recherche (`/api/search/semantic`, `/api/search/filters/values`) | 1 jour |
| Route `/api/chat/ready` | 0.5 jour |
| Commandes Tauri (Rust) | 0.5 jour |
| Composant `SemanticSearchSettings.tsx` (section paramètres) | 1 jour |
| Composant `MMRPanel.tsx` + `MetadataFiltersConfig.tsx` | 0.5 jour |
| Composant `ChatView.tsx` (activation + layout) | 0.5 jour |
| Composant `SearchBar.tsx` + `FilterBar.tsx` | 1 jour |
| Composant `SearchResults.tsx` + `SearchResultCard.tsx` | 1.5 jours |
| Composant `SearchResultDetail.tsx` (vue détaillée déployable) | 0.5 jour |
| Composant `SearchDebugPanel.tsx` | 0.5 jour |
| Composant `ChatOptions.tsx` (panneau Options) | 0.5 jour |
| Composants UI (`ScoreBadge`, `HighlightedText`, `MultiSelect`, `EmptyIndex`) | 1 jour |
| Hooks (`useSemanticSearch`, `useSemanticSearchConfig`, `useFilterValues`, `useChatReady`) | 1 jour |
| Traductions i18n (FR + EN) — chat + recherche | 0.5 jour |
| Tests unitaires `SemanticSearchEngine` (recherche, MMR, filtres, seuil) | 1.5 jours |
| Tests unitaires `search()` pour Qdrant et ChromaDB | 1 jour |
| Tests d'intégration (pipeline complet : requête → embedding → recherche → résultats) | 1 jour |
| Tests manuels + corrections | 1 jour |
| **Total** | **~19 jours** |
