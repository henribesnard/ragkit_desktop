# 🧰 RAGKIT Desktop — Spécifications Étape 2 : Chunking

> **Étape** : 2 — Chunking  
> **Tag cible** : `v0.3.0`  
> **Date** : 16 février 2026  
> **Dépôt** : https://github.com/henribesnard/ragkit_desktop.git  
> **Prérequis** : Étape 1 (Ingestion & Préprocessing) implémentée et validée

---

## 1. Objectif

Ajouter le **découpage intelligent des documents en chunks**, paramétrable selon la stratégie déterminée lors du profilage initial (Étape 1). Le chunking est la brique qui transforme les documents bruts parsés en unités de texte exploitables par les étapes suivantes (embedding, stockage vectoriel, recherche).

Cette étape livre :
- Une section `PARAMÈTRES > Paramètres avancés > CHUNKING` complète et fonctionnelle.
- **6 stratégies de chunking** implémentées : `fixed_size`, `sentence_based`, `paragraph_based`, `semantic`, `recursive`, `markdown_header`.
- Un **panneau de prévisualisation** permettant de tester le découpage sur un document-échantillon en temps réel.
- Le **pipeline interne parsing → chunking** fonctionnel de bout en bout.
- Les **statistiques de chunking** visibles dans l'interface (nombre de chunks, tailles, distribution).

**L'embedding, le stockage vectoriel et l'indexation ne sont pas encore implémentés.** Le chunking s'exécute pour la prévisualisation et la validation, mais les chunks ne sont pas encore vectorisés ni persistés dans une base vectorielle.

---

## 2. Spécifications fonctionnelles

### 2.1 Section PARAMÈTRES > Paramètres avancés > CHUNKING

#### Structure de l'onglet PARAMÈTRES à cette étape

```
PARAMÈTRES
├── Paramètres généraux              ← (vide pour l'instant)
└── Paramètres avancés
    ├── INGESTION & PRÉPROCESSING    ← Étape 1
    └── CHUNKING                     ← NOUVEAU
```

Lorsque l'utilisateur accède à `PARAMÈTRES > Paramètres avancés`, il voit maintenant deux sections dans la liste de gauche : **INGESTION & PRÉPROCESSING** et **CHUNKING**. Un clic sur CHUNKING affiche le panneau décrit ci-dessous.

#### Layout de la section CHUNKING

```
┌─────────────────────────────────────────────────────────────────┐
│  CHUNKING                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Stratégie de découpage ──────────────────────────────────┐ │
│  │  Stratégie :           [▾ recursive            ]          │ │
│  │                                                            │ │
│  │  ℹ️ Découpe récursivement avec une liste ordonnée de      │ │
│  │  séparateurs. Recommandé pour la documentation structurée. │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Paramètres de taille ────────────────────────────────────┐ │
│  │  Taille des chunks :   [====◆========] 512 tokens         │ │
│  │  Chevauchement :       [==◆==========] 100 tokens         │ │
│  │  Taille minimale :     [◆============]  50 tokens         │ │
│  │  Taille maximale :     [==========◆==] 2000 tokens        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Options avancées ────────────────────────────────────────┐ │
│  │  ☑ Préserver les phrases (ne pas couper en milieu)        │ │
│  │  ☑ Propager les métadonnées du document parent            │ │
│  │  ☑ Ajouter l'index du chunk                               │ │
│  │  ☑ Ajouter le titre du document                           │ │
│  │  ☐ Conserver les séparateurs                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Séparateurs (stratégie récursive) ───────────────────────┐ │
│  │  Séparateurs :  ["\n\n", "\n", ". ", " "]                 │ │
│  │  [+ Ajouter]  [↻ Réinitialiser]                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ▸ Chunking sémantique (affiché si stratégie = semantic)       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Seuil de similarité :  [=====◆====] 0.75                │ │
│  │  Niveaux de titres :    [▾ 1, 2, 3           ]           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Prévisualisation ────────────────────────────────────────┐ │
│  │  Document-échantillon : [▾ contrat_2024.pdf    ] [🔄]     │ │
│  │                                                            │ │
│  │  [▶ Prévisualiser le chunking]                            │ │
│  │                                                            │ │
│  │  ┌── Résultat ──────────────────────────────────────────┐ │ │
│  │  │  📊 42 chunks · Moy: 487 tokens · Min: 52 · Max: 512│ │ │
│  │  │                                                      │ │ │
│  │  │  ┌─ Chunk 1/42 ─────────── 512 tokens ──────────┐  │ │ │
│  │  │  │ **Source**: contrat_2024.pdf · **Page**: 1     │  │ │ │
│  │  │  │                                               │  │ │ │
│  │  │  │ Article 1 — Objet du contrat                  │  │ │ │
│  │  │  │ Le présent contrat a pour objet de définir    │  │ │ │
│  │  │  │ les conditions dans lesquelles le Prestataire │  │ │ │
│  │  │  │ s'engage à fournir les services décrits...    │  │ │ │
│  │  │  └───────────────────────────────────────────────┘  │ │ │
│  │  │                                                      │ │ │
│  │  │  ┌─ Chunk 2/42 ─────────── 498 tokens ──────────┐  │ │ │
│  │  │  │ **Source**: contrat_2024.pdf · **Page**: 1-2   │  │ │ │
│  │  │  │                                               │  │ │ │
│  │  │  │ ...les services décrits en Annexe A.          │  │ │ │
│  │  │  │                                               │  │ │ │
│  │  │  │ Article 2 — Durée                             │  │ │ │
│  │  │  │ Le contrat est conclu pour une durée de...    │  │ │ │
│  │  │  └───────────────────────────────────────────────┘  │ │ │
│  │  │                                                      │ │ │
│  │  │  [← Précédent]  Chunk 1-2 / 42  [Suivant →]        │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Distribution des tailles ────────────────────────────────┐ │
│  │  ▁▃▅▇█▇▅▃▁   Histogramme des tailles de chunks           │ │
│  │  50  256  512  768  1024  tokens                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [↻ Réinitialiser au profil]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Affichage conditionnel des paramètres selon la stratégie

Certains paramètres ne sont pertinents que pour certaines stratégies. L'interface masque dynamiquement les sections non applicables :

| Paramètre / Section | `fixed_size` | `sentence_based` | `paragraph_based` | `semantic` | `recursive` | `markdown_header` |
|---------------------|:---:|:---:|:---:|:---:|:---:|:---:|
| Taille des chunks | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Chevauchement | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Taille minimale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Taille maximale | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Préserver les phrases | ✅ | ❌ (toujours vrai) | ❌ (toujours vrai) | ❌ | ✅ | ❌ |
| Séparateurs | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Conserver séparateurs | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Seuil similarité sémantique | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Niveaux de titres | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

**Comportements** :
- Quand l'utilisateur change de stratégie, les sections non pertinentes s'animent en fondu sortant et les sections pertinentes en fondu entrant.
- Les paramètres masqués conservent leur valeur en mémoire (pas de réinitialisation au changement de stratégie).
- Un encadré informatif ℹ️ sous le sélecteur de stratégie affiche une description courte de la stratégie sélectionnée (voir section 2.3).

### 2.3 Descriptions des stratégies de chunking

Chaque stratégie dispose d'une description affichée sous le sélecteur :

| Stratégie | Description (FR) | Description (EN) |
|-----------|-----------------|-----------------|
| `fixed_size` | Découpe le texte en blocs de taille fixe (en tokens). Simple et prévisible. | Splits text into fixed-size blocks (in tokens). Simple and predictable. |
| `sentence_based` | Regroupe des phrases complètes jusqu'à atteindre la taille cible. Respecte les frontières de phrases. | Groups complete sentences until reaching the target size. Respects sentence boundaries. |
| `paragraph_based` | Découpe au niveau des paragraphes. Idéal pour des FAQ ou du contenu structuré en blocs courts. | Splits at paragraph level. Ideal for FAQs or content structured in short blocks. |
| `semantic` | Découpe quand le sujet change, en mesurant la similarité sémantique entre phrases adjacentes. Plus lent mais plus intelligent. | Splits when the topic changes, by measuring semantic similarity between adjacent sentences. Slower but smarter. |
| `recursive` | Découpe récursivement avec une liste ordonnée de séparateurs (paragraphes, lignes, phrases, mots). Recommandé pour la documentation structurée. | Recursively splits using an ordered list of separators (paragraphs, lines, sentences, words). Recommended for structured documentation. |
| `markdown_header` | Découpe selon la hiérarchie des titres Markdown (# ## ###). Idéal pour les fichiers .md ou les documents avec des titres bien détectés. | Splits according to Markdown heading hierarchy (# ## ###). Ideal for .md files or documents with well-detected headings. |

### 2.4 Panneau de prévisualisation

Le panneau de prévisualisation est la fonctionnalité clé de cette étape. Il permet à l'utilisateur de voir concrètement l'effet de ses paramètres de chunking sur un document réel.

**Fonctionnement** :

1. **Sélection du document-échantillon** : dropdown listant tous les documents détectés à l'Étape 1 (issus de `/api/ingestion/documents`). Le premier document de la liste est sélectionné par défaut.
2. **Bouton "Prévisualiser le chunking"** : lance le processus de chunking sur le document sélectionné avec les paramètres courants. Le bouton affiche un spinner pendant l'exécution.
3. **Barre de statistiques** : affichée immédiatement après le chunking :
   - Nombre total de chunks
   - Taille moyenne en tokens
   - Taille min et max
4. **Liste paginée des chunks** : affichage de 2 chunks à la fois avec navigation (Précédent / Suivant). Chaque chunk affiche :
   - Son index (ex : `Chunk 1/42`)
   - Sa taille en tokens
   - Les métadonnées propagées (source, page, titre du document)
   - La zone de chevauchement surlignée en jaune pâle (si `chunk_overlap > 0`)
   - Le contenu textuel du chunk (tronqué à 500 caractères avec "…" si plus long, clic pour déplier)
5. **Histogramme de distribution** : graphique en barres montrant la distribution des tailles de chunks (par tranches de 50 tokens). Permet de détecter visuellement des anomalies (trop de micro-chunks, distribution bimodale, etc.).

**Comportements** :
- Le bouton de rafraîchissement 🔄 à côté du sélecteur de document recharge la liste des documents (utile si la config source a changé).
- La prévisualisation n'est **pas automatique** au changement de paramètre — l'utilisateur doit cliquer sur "Prévisualiser" explicitement (pour éviter des recalculs coûteux en boucle, surtout avec la stratégie `semantic`).
- Si le document sélectionné contient plus de 200 chunks, un avertissement s'affiche : "Ce document produit beaucoup de chunks (N). Vérifiez vos paramètres de taille."
- Si aucun document n'est disponible (pas encore d'analyse Étape 1), un message invite l'utilisateur à compléter l'Étape 1 d'abord.
- Si la stratégie `semantic` est sélectionnée mais qu'aucun modèle d'embedding n'est configuré (Étape 3 pas encore faite), un avertissement s'affiche : "La stratégie sémantique nécessite un modèle d'embedding. Un modèle léger intégré sera utilisé pour la prévisualisation." Le backend utilise alors un modèle embarqué léger (ex : `all-MiniLM-L6-v2` via sentence-transformers) uniquement pour la prévisualisation.

### 2.5 Zone de chevauchement (overlap)

Dans la prévisualisation, la zone de chevauchement entre deux chunks consécutifs est identifiée visuellement :
- Le texte commun entre le chunk N et le chunk N+1 est surligné en **jaune pâle** (`bg-amber-50` en thème clair, `bg-amber-900/20` en thème sombre).
- Un label discret "↔ Chevauchement : 100 tokens" est affiché en dessous de la zone surlignée.
- Cela permet à l'utilisateur de vérifier que le chevauchement est suffisant pour ne pas perdre de contexte aux frontières.

### 2.6 Bouton "Réinitialiser au profil"

En bas de la section CHUNKING, un bouton "↻ Réinitialiser au profil" restaure tous les paramètres de chunking à leurs valeurs par défaut calculées par le wizard (profil + modificateurs de calibrage). L'action demande confirmation via une modale :

> ⚠️ Réinitialiser les paramètres de chunking aux valeurs du profil « Juridique / Réglementaire » ? Les modifications manuelles seront perdues.

### 2.7 Badge "Modifié"

Comme pour l'Étape 1, chaque paramètre dont la valeur diffère de la valeur par défaut du profil affiche un badge 🔵 "Modifié" à côté du label. Cela permet à l'utilisateur de repérer rapidement ses personnalisations.

---

## 3. Catalogue complet des paramètres CHUNKING

### 3.1 Paramètres de stratégie

| Paramètre | Clé config | Type | Options | Défaut | Description |
|-----------|------------|------|---------|--------|-------------|
| Stratégie de chunking | `chunking.strategy` | enum | `fixed_size` \| `sentence_based` \| `paragraph_based` \| `semantic` \| `recursive` \| `markdown_header` | Selon profil | Méthode de découpage des documents en chunks. **Impact critique** sur la qualité du RAG. |

### 3.2 Paramètres de taille

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Taille des chunks | `chunking.chunk_size` | int (tokens) | 64 | 4096 | Selon profil | Taille cible de chaque chunk. Trop petit = perte de contexte. Trop grand = mélange de sujets. |
| Chevauchement | `chunking.chunk_overlap` | int (tokens) | 0 | `chunk_size / 2` | Selon profil | Nombre de tokens partagés entre chunks consécutifs. 10-20% de `chunk_size` est recommandé. |
| Taille minimale | `chunking.min_chunk_size` | int (tokens) | 10 | `chunk_size` | Selon profil | Les chunks inférieurs à cette taille sont fusionnés avec le précédent ou supprimés. Évite les micro-chunks. |
| Taille maximale | `chunking.max_chunk_size` | int (tokens) | `chunk_size` | 8192 | Selon profil | Taille absolue au-delà de laquelle un chunk est forcément re-découpé. Garde-fou contre les chunks géants. |

**Validation croisée des tailles** :
- `chunk_overlap` < `chunk_size` (erreur sinon)
- `min_chunk_size` ≤ `chunk_size` (erreur sinon)
- `max_chunk_size` ≥ `chunk_size` (erreur sinon)
- `chunk_overlap` ≤ `chunk_size / 2` (avertissement sinon : "Un chevauchement supérieur à 50% de la taille des chunks est inhabituel.")

L'interface affiche les erreurs de validation en rouge sous le champ concerné et désactive le bouton de prévisualisation tant qu'il y a une erreur.

### 3.3 Paramètres d'options avancées

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Préserver les phrases | `chunking.preserve_sentences` | bool | `true` | Ne jamais couper un chunk au milieu d'une phrase. Le chunk peut légèrement dépasser `chunk_size` pour finir la phrase. |
| Propagation métadonnées | `chunking.metadata_propagation` | bool | `true` | Chaque chunk hérite des métadonnées de son document parent (titre, auteur, langue, source, etc.). |
| Index du chunk | `chunking.add_chunk_index` | bool | Selon profil | Ajoute l'index positionnel du chunk dans le document (0, 1, 2…). Permet de reconstruire l'ordre original. |
| Titre du document | `chunking.add_document_title` | bool | `true` | Ajoute le titre du document parent dans les métadonnées de chaque chunk. Améliore la recherche contextuelle. |
| Conserver séparateurs | `chunking.keep_separator` | bool | Selon profil | Conserve les séparateurs dans le texte du chunk (au lieu de les supprimer). Pertinent pour les documents juridiques. |

### 3.4 Paramètres spécifiques aux stratégies

| Paramètre | Clé config | Type | Défaut | Applicable à | Description |
|-----------|------------|------|--------|-------------|-------------|
| Séparateurs | `chunking.separators` | string[] | Selon profil | `recursive` | Liste ordonnée de séparateurs. Le chunker essaie le premier, puis passe au suivant si les chunks sont trop grands. |
| Seuil similarité | `chunking.similarity_threshold` | float (0-1) | Selon profil | `semantic` | Seuil en dessous duquel deux phrases adjacentes sont considérées comme traitant de sujets différents → frontière de chunk. |
| Niveaux de titres | `chunking.header_levels` | int[] | Selon profil | `markdown_header` | Niveaux de titres Markdown qui déclenchent un nouveau chunk (ex: `[1, 2, 3]` = h1, h2, h3). |

### 3.5 Résumé des impacts

| Paramètre | Impact principal | Impact secondaire |
|-----------|-----------------|-------------------|
| `strategy` | **CRITIQUE** — Cohérence contextuelle de chaque chunk | Temps de traitement (semantic est le plus lent) |
| `chunk_size` | Balance entre contexte et précision | Affecte le nombre de chunks (et donc la taille de la BDD vectorielle) |
| `chunk_overlap` | Continuité d'information aux frontières | Augmente le nombre de chunks (~10-20% supplémentaires) |
| `min_chunk_size` | Élimine les chunks non informatifs | Peut perdre de l'info si trop haut |
| `max_chunk_size` | Garde-fou pour les modèles d'embedding | Rarement atteint en pratique |
| `preserve_sentences` | Chunks plus lisibles et cohérents | Taille des chunks légèrement variable |
| `metadata_propagation` | Traçabilité et capacité de filtrage | Légère augmentation de la taille stockée |
| `separators` | Qualité du découpage récursif | L'ordre est crucial : du plus grossier au plus fin |
| `similarity_threshold` | Granularité du découpage sémantique | Seuil bas = gros chunks, seuil haut = petits chunks |

---

## 4. Valeurs par défaut par profil

Les valeurs par défaut sont déjà calculées et stockées dans `settings.json` par le wizard de l'Étape 1 (section `chunking`). Cette étape **active et utilise** ces valeurs.

### 4.1 Matrice profil → paramètres de chunking

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|:---:|:---:|:---:|:---:|:---:|
| `strategy` | `recursive` | `paragraph_based` | `recursive` | `paragraph_based` | `fixed_size` |
| `chunk_size` | 512 | 256 | 1024 | 768 | 512 |
| `chunk_overlap` | 100 | 50 | 200 | 100 | 50 |
| `min_chunk_size` | 50 | 30 | 100 | 50 | 30 |
| `max_chunk_size` | 2000 | 1000 | 4000 | 3000 | 2000 |
| `preserve_sentences` | `true` | `true` | `true` | `true` | `true` |
| `metadata_propagation` | `true` | `true` | `true` | `true` | `true` |
| `add_chunk_index` | `true` | `false` | `true` | `true` | `true` |
| `add_document_title` | `true` | `true` | `true` | `true` | `true` |
| `keep_separator` | `false` | `false` | `true` | `false` | `false` |
| `separators` | `["\n\n", "\n", ". ", " "]` | `["\n\n", "\n"]` | `["\n\n", "\n", ". "]` | `["\n\n", "\n", ". ", " "]` | `["\n\n", "\n", ". ", " "]` |
| `similarity_threshold` | 0.75 | 0.80 | 0.70 | 0.75 | 0.75 |
| `header_levels` | `[1, 2, 3]` | `[1, 2]` | `[1, 2, 3, 4]` | `[1, 2, 3]` | `[1, 2, 3]` |

### 4.2 Justification des choix par profil

#### 📘 `technical_documentation`

La documentation technique est bien structurée avec des titres, sous-titres, blocs de code et paragraphes distincts. La stratégie `recursive` avec les séparateurs `["\n\n", "\n", ". ", " "]` exploite cette structure en essayant d'abord de couper aux paragraphes, puis aux lignes, puis aux phrases. La taille de 512 tokens est un bon compromis entre contexte suffisant et précision. L'index du chunk est activé pour pouvoir reconstruire l'ordre des sections.

#### ❓ `faq_support`

Les FAQ sont naturellement organisées en paires question/réponse courtes. La stratégie `paragraph_based` isole chaque Q/R dans son propre chunk. La taille de 256 tokens est adaptée à ces contenus courts. L'index du chunk est désactivé car l'ordre importe peu dans une FAQ.

#### 📜 `legal_compliance`

Les documents juridiques nécessitent un contexte large — un article de loi perd son sens s'il est coupé. La taille de 1024 tokens et le `max_chunk_size` de 4000 garantissent des chunks substantiels. Le chevauchement de 200 tokens est élevé pour ne perdre aucune continuité. `keep_separator: true` préserve la numérotation des articles. Les niveaux de titres incluent h4 pour capturer les sous-articles.

#### 📊 `reports_analysis`

Les rapports sont narratifs avec des sections d'analyse longues. La stratégie `paragraph_based` à 768 tokens capture des passages complets. Les tableaux de données (extraits en Markdown à l'Étape 1) sont conservés dans leurs chunks.

#### 📚 `general`

Le profil universel utilise `fixed_size` à 512 tokens — le choix le plus robuste quand la structure du contenu est inconnue ou variée. Les paramètres sont équilibrés et constituent un bon point de départ pour tout type de contenu.

### 4.3 Impact des modificateurs de calibrage sur le chunking

Rappel : les questions de calibrage de l'Étape 1 modifient les valeurs de base. Voici les modificateurs qui impactent le chunking :

| Question | Si OUI → Modifications sur le chunking |
|----------|----------------------------------------|
| **Q3** : Documents > 50 pages ? | `chunk_size` ×= 1.5, `chunk_overlap` ×= 1.5, `max_chunk_size` ×= 1.5, `min_chunk_size` ×= 2 |
| **Q6** : Citations avec sources ? | `add_chunk_index` → `true`, `metadata_propagation` → `true`, `add_document_title` → `true` |

Les autres questions (Q1, Q2, Q4, Q5) n'impactent pas directement les paramètres de chunking.

---

## 5. Spécifications techniques

### 5.1 Schéma Pydantic (backend)

```python
# ragkit/config/chunking_schema.py
"""Pydantic schemas for chunking configuration."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class ChunkingStrategy(str, Enum):
    FIXED_SIZE = "fixed_size"
    SENTENCE_BASED = "sentence_based"
    PARAGRAPH_BASED = "paragraph_based"
    SEMANTIC = "semantic"
    RECURSIVE = "recursive"
    MARKDOWN_HEADER = "markdown_header"


class ChunkingConfig(BaseModel):
    """Complete chunking configuration."""

    strategy: ChunkingStrategy = ChunkingStrategy.RECURSIVE
    chunk_size: int = Field(default=512, ge=64, le=4096,
        description="Target chunk size in tokens")
    chunk_overlap: int = Field(default=100, ge=0,
        description="Overlap between consecutive chunks in tokens")
    min_chunk_size: int = Field(default=50, ge=10,
        description="Minimum chunk size; smaller chunks are merged or discarded")
    max_chunk_size: int = Field(default=2000, le=8192,
        description="Absolute maximum chunk size")
    preserve_sentences: bool = Field(default=True,
        description="Never split in the middle of a sentence")
    metadata_propagation: bool = Field(default=True,
        description="Propagate parent document metadata to chunks")
    add_chunk_index: bool = Field(default=True,
        description="Add positional index to each chunk")
    add_document_title: bool = Field(default=True,
        description="Add document title to chunk metadata")
    keep_separator: bool = Field(default=False,
        description="Keep separators in chunk text (recursive strategy)")

    # Strategy-specific parameters
    separators: list[str] = Field(
        default=["\n\n", "\n", ". ", " "],
        description="Ordered list of separators (recursive strategy)")
    similarity_threshold: float = Field(
        default=0.75, ge=0.0, le=1.0,
        description="Semantic similarity threshold for topic change detection")
    header_levels: list[int] = Field(
        default=[1, 2, 3],
        description="Markdown heading levels that trigger new chunks")

    @model_validator(mode="after")
    def validate_size_constraints(self) -> "ChunkingConfig":
        """Ensure size parameters are logically consistent."""
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError(
                f"chunk_overlap ({self.chunk_overlap}) must be less than "
                f"chunk_size ({self.chunk_size})")
        if self.min_chunk_size > self.chunk_size:
            raise ValueError(
                f"min_chunk_size ({self.min_chunk_size}) must be ≤ "
                f"chunk_size ({self.chunk_size})")
        if self.max_chunk_size < self.chunk_size:
            raise ValueError(
                f"max_chunk_size ({self.max_chunk_size}) must be ≥ "
                f"chunk_size ({self.chunk_size})")
        return self

    @field_validator("header_levels")
    @classmethod
    def validate_header_levels(cls, v: list[int]) -> list[int]:
        for level in v:
            if level < 1 or level > 6:
                raise ValueError(
                    f"Header level {level} out of range (1-6)")
        return sorted(set(v))


class ChunkMetadata(BaseModel):
    """Metadata attached to each chunk."""
    chunk_id: str
    chunk_index: int
    document_id: str
    document_title: str | None = None
    source_file: str
    page_start: int | None = None
    page_end: int | None = None
    language: str | None = None
    chunk_size_tokens: int
    overlap_tokens_before: int = 0
    overlap_tokens_after: int = 0


class Chunk(BaseModel):
    """A single chunk produced by the chunking pipeline."""
    content: str
    metadata: ChunkMetadata
```

### 5.2 Moteur de chunking (backend)

```python
# ragkit/chunking/engine.py
"""Chunking engine — dispatches to strategy implementations."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ragkit.config.chunking_schema import Chunk, ChunkingConfig, ChunkingStrategy


class BaseChunker(ABC):
    """Abstract base class for all chunking strategies."""

    def __init__(self, config: ChunkingConfig):
        self.config = config

    @abstractmethod
    def chunk(self, text: str, metadata: dict) -> list[Chunk]:
        """Split text into chunks with metadata."""
        ...


class FixedSizeChunker(BaseChunker):
    """Splits text into fixed-size token windows."""
    ...


class SentenceBasedChunker(BaseChunker):
    """Groups complete sentences up to chunk_size."""
    ...


class ParagraphBasedChunker(BaseChunker):
    """Splits at paragraph boundaries."""
    ...


class SemanticChunker(BaseChunker):
    """Splits based on semantic similarity between adjacent sentences."""
    ...


class RecursiveChunker(BaseChunker):
    """Recursively splits using an ordered list of separators."""
    ...


class MarkdownHeaderChunker(BaseChunker):
    """Splits according to Markdown heading hierarchy."""
    ...


# Strategy registry
CHUNKER_REGISTRY: dict[ChunkingStrategy, type[BaseChunker]] = {
    ChunkingStrategy.FIXED_SIZE: FixedSizeChunker,
    ChunkingStrategy.SENTENCE_BASED: SentenceBasedChunker,
    ChunkingStrategy.PARAGRAPH_BASED: ParagraphBasedChunker,
    ChunkingStrategy.SEMANTIC: SemanticChunker,
    ChunkingStrategy.RECURSIVE: RecursiveChunker,
    ChunkingStrategy.MARKDOWN_HEADER: MarkdownHeaderChunker,
}


def create_chunker(config: ChunkingConfig) -> BaseChunker:
    """Factory function to create the appropriate chunker."""
    chunker_cls = CHUNKER_REGISTRY[config.strategy]
    return chunker_cls(config)
```

### 5.3 Tokenizer

Le comptage de tokens est central dans le chunking. Le backend utilise `tiktoken` (tokenizer d'OpenAI, modèle `cl100k_base`) comme référence pour le comptage.

```python
# ragkit/chunking/tokenizer.py
"""Token counting utility for chunking."""

import tiktoken


class TokenCounter:
    """Counts tokens using tiktoken (cl100k_base encoding)."""

    def __init__(self, encoding_name: str = "cl100k_base"):
        self.encoder = tiktoken.get_encoding(encoding_name)

    def count(self, text: str) -> int:
        """Count the number of tokens in a text."""
        return len(self.encoder.encode(text))

    def truncate(self, text: str, max_tokens: int) -> str:
        """Truncate text to a maximum number of tokens."""
        tokens = self.encoder.encode(text)
        if len(tokens) <= max_tokens:
            return text
        return self.encoder.decode(tokens[:max_tokens])
```

> **Note** : le choix de `tiktoken` est provisoire. À l'Étape 3 (Embedding), si le modèle d'embedding utilise un tokenizer différent, le tokenizer de chunking pourra être aligné. Pour l'instant, `cl100k_base` est un standard raisonnable.

### 5.4 API REST (routes backend)

#### 5.4.1 Routes Chunking Config

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/chunking/config` | GET | Config chunking courante | — | `ChunkingConfig` |
| `/api/chunking/config` | PUT | Met à jour la config | `ChunkingConfig` (partiel) | `ChunkingConfig` |
| `/api/chunking/config/reset` | POST | Réinitialise au profil actif | — | `ChunkingConfig` |
| `/api/chunking/config/validate` | POST | Valide une config sans la sauver | `ChunkingConfig` | `{ valid: bool, errors: string[] }` |

#### 5.4.2 Routes Prévisualisation

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/chunking/preview` | POST | Chunke un document avec la config courante | `{ document_id: string }` | `ChunkingPreviewResult` |
| `/api/chunking/preview/custom` | POST | Chunke avec une config personnalisée (non sauvée) | `{ document_id: string, config: ChunkingConfig }` | `ChunkingPreviewResult` |

#### 5.4.3 Modèles de réponse

```python
class ChunkPreview(BaseModel):
    """A chunk in the preview result."""
    index: int
    content: str                    # Contenu textuel du chunk
    content_truncated: str          # Tronqué à 500 caractères pour l'affichage
    size_tokens: int
    page_start: int | None
    page_end: int | None
    overlap_before: str | None      # Texte de chevauchement avec le chunk précédent
    overlap_before_tokens: int
    overlap_after: str | None       # Texte de chevauchement avec le chunk suivant
    overlap_after_tokens: int
    metadata: dict                  # Métadonnées propagées


class ChunkingStats(BaseModel):
    """Statistics about the chunking result."""
    total_chunks: int
    avg_size_tokens: float
    min_size_tokens: int
    max_size_tokens: int
    median_size_tokens: float
    total_overlap_tokens: int       # Total de tokens dans les zones de chevauchement
    size_distribution: list[SizeBucket]


class SizeBucket(BaseModel):
    """A bucket in the size distribution histogram."""
    range_start: int                # Ex: 0
    range_end: int                  # Ex: 50
    count: int                      # Nombre de chunks dans cette tranche


class ChunkingPreviewResult(BaseModel):
    """Complete result of a chunking preview."""
    document_id: str
    document_title: str | None
    config_used: ChunkingConfig
    stats: ChunkingStats
    chunks: list[ChunkPreview]
    processing_time_ms: int         # Temps d'exécution en millisecondes
    warnings: list[str]             # Avertissements éventuels
```

### 5.5 Commandes Tauri (Rust) — ajouts

```rust
// desktop/src-tauri/src/commands.rs (ajouts Étape 2)

// Chunking config
#[tauri::command]
pub async fn get_chunking_config() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn update_chunking_config(config: serde_json::Value) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn reset_chunking_config() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn validate_chunking_config(config: serde_json::Value) -> Result<serde_json::Value, String> { ... }

// Chunking preview
#[tauri::command]
pub async fn preview_chunking(document_id: String) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn preview_chunking_custom(
    document_id: String,
    config: serde_json::Value
) -> Result<serde_json::Value, String> { ... }
```

### 5.6 Composants React — arborescence

```
desktop/src/
├── components/
│   ├── settings/
│   │   ├── IngestionSettings.tsx          ← existant (Étape 1)
│   │   ├── SourceSettings.tsx             ← existant (Étape 1)
│   │   ├── ParsingSettings.tsx            ← existant (Étape 1)
│   │   ├── PreprocessingSettings.tsx      ← existant (Étape 1)
│   │   ├── MetadataTable.tsx              ← existant (Étape 1)
│   │   ├── ChunkingSettings.tsx           ← NOUVEAU : section complète
│   │   ├── StrategySelector.tsx           ← NOUVEAU : sélecteur + description
│   │   ├── SizeParametersPanel.tsx        ← NOUVEAU : sliders taille/overlap/min/max
│   │   ├── AdvancedOptionsPanel.tsx       ← NOUVEAU : toggles options avancées
│   │   ├── SeparatorsEditor.tsx           ← NOUVEAU : éditeur de liste de séparateurs
│   │   └── ChunkingPreview.tsx            ← NOUVEAU : panneau de prévisualisation
│   ├── charts/
│   │   └── SizeDistributionChart.tsx      ← NOUVEAU : histogramme distribution
│   └── ui/
│       └── ... (existants Étape 1)
├── hooks/
│   ├── useWizard.ts                       ← existant (Étape 1)
│   ├── useIngestionConfig.ts              ← existant (Étape 1)
│   ├── useDocuments.ts                    ← existant (Étape 1)
│   ├── useChunkingConfig.ts               ← NOUVEAU : hook config chunking
│   └── useChunkingPreview.ts              ← NOUVEAU : hook prévisualisation
├── lib/
│   └── ipc.ts                             ← MODIFIER : ajouter routes chunking
└── locales/
    ├── fr.json                            ← MODIFIER : ajouter clés chunking
    └── en.json                            ← MODIFIER : ajouter clés chunking
```

### 5.7 Détail des composants clés

#### `ChunkingSettings.tsx`

Composant principal de la section. Orchestre l'affichage conditionnel des sous-composants selon la stratégie sélectionnée.

```tsx
// Structure simplifiée
export function ChunkingSettings() {
  const { config, updateConfig, resetConfig, isDirty } = useChunkingConfig();
  const strategy = config.strategy;

  return (
    <SettingsSection title="CHUNKING">
      <StrategySelector
        value={strategy}
        onChange={(s) => updateConfig({ strategy: s })}
      />

      {strategy !== "markdown_header" && (
        <SizeParametersPanel config={config} onChange={updateConfig} />
      )}

      <AdvancedOptionsPanel
        config={config}
        strategy={strategy}
        onChange={updateConfig}
      />

      {strategy === "recursive" && (
        <SeparatorsEditor
          separators={config.separators}
          keepSeparator={config.keep_separator}
          onChange={updateConfig}
        />
      )}

      {strategy === "semantic" && (
        <SemanticParametersPanel config={config} onChange={updateConfig} />
      )}

      {strategy === "markdown_header" && (
        <HeaderLevelsSelector
          levels={config.header_levels}
          onChange={(levels) => updateConfig({ header_levels: levels })}
        />
      )}

      <ChunkingPreview config={config} />

      <ResetButton onClick={resetConfig} disabled={!isDirty} />
    </SettingsSection>
  );
}
```

#### `SeparatorsEditor.tsx`

Éditeur interactif pour la liste de séparateurs :

```
┌── Séparateurs ────────────────────────────────────────────┐
│                                                            │
│  1. ["\n\n"]  (double retour à la ligne)         [✕]      │
│  2. ["\n"]    (retour à la ligne)                [✕]      │
│  3. [". "]    (point + espace)                   [✕]      │
│  4. [" "]     (espace)                           [✕]      │
│                                                            │
│  [+ Ajouter un séparateur]                                 │
│                                                            │
│  ℹ️ L'ordre est important : le chunker essaie le premier   │
│  séparateur, puis passe au suivant si les chunks sont      │
│  encore trop grands.                                       │
│                                                            │
│  [↻ Réinitialiser]                                         │
└────────────────────────────────────────────────────────────┘
```

**Comportements** :
- Les séparateurs sont affichés en version lisible entre crochets, avec une description en gris.
- Drag-and-drop pour réordonner.
- Bouton ✕ pour supprimer (min 1 séparateur obligatoire).
- Bouton "+ Ajouter" ouvre un champ texte pour saisir un nouveau séparateur (avec échappement automatique des caractères spéciaux).
- Caractères spéciaux courants proposés via des boutons rapides : `\n\n`, `\n`, `. `, ` `, `---`, `\t`.

### 5.8 Persistance

La config chunking est stockée dans la même structure `settings.json` existante :

```json
{
  "version": "1.0.0",
  "setup_completed": true,
  "profile": "legal_compliance",
  "calibration_answers": { "...": "..." },
  "ingestion": { "...": "..." },
  "chunking": {
    "strategy": "recursive",
    "chunk_size": 1536,
    "chunk_overlap": 300,
    "min_chunk_size": 200,
    "max_chunk_size": 6000,
    "preserve_sentences": true,
    "metadata_propagation": true,
    "add_chunk_index": true,
    "add_document_title": true,
    "keep_separator": true,
    "separators": ["\n\n", "\n", ". "],
    "similarity_threshold": 0.70,
    "header_levels": [1, 2, 3, 4]
  },
  "embedding": { "...": "valeurs calculées, utilisées à l'Étape 3" },
  "retrieval": { "...": "valeurs calculées, utilisées aux Étapes 5-7" },
  "rerank": { "...": "valeurs calculées, utilisées à l'Étape 8" },
  "llm": { "...": "valeurs calculées, utilisées à l'Étape 9" },
  "agents": { "...": "valeurs calculées, utilisées à l'Étape 10" }
}
```

> **Note** : l'exemple ci-dessus montre un profil `legal_compliance` avec Q3=OUI et Q6=OUI (valeurs modifiées par les modificateurs de calibrage).

### 5.9 Dépendances Python ajoutées

```toml
# pyproject.toml — ajouts aux dependencies pour Étape 2
dependencies = [
    # ... (existants Étape 0 + Étape 1)
    "tiktoken>=0.5",               # Comptage de tokens (tokenizer OpenAI)
    "nltk>=3.8",                   # Sentence tokenization (PunktSentenceTokenizer)
    "sentence-transformers>=2.2",  # Embedding léger pour chunking sémantique (preview only)
]
```

> **Note sur `sentence-transformers`** : cette dépendance est nécessaire uniquement pour la stratégie `semantic` en mode prévisualisation. Le modèle léger `all-MiniLM-L6-v2` (~80 Mo) est utilisé. Il sera optionnellement remplacé à l'Étape 3 par le modèle d'embedding configuré par l'utilisateur. Si l'utilisateur n'utilise pas la stratégie sémantique, le modèle n'est jamais téléchargé/chargé.

### 5.10 Algorithmes de chunking — comportements attendus

#### `fixed_size`

1. Compter les tokens du texte complet.
2. Découper en fenêtres de `chunk_size` tokens avec un décalage de `chunk_size - chunk_overlap`.
3. Si `preserve_sentences: true`, ajuster la fin du chunk pour ne pas couper une phrase (tolérance : +20% de `chunk_size`).
4. Supprimer les chunks < `min_chunk_size` (fusionner avec le précédent si possible).

#### `sentence_based`

1. Segmenter le texte en phrases via `nltk.sent_tokenize()`.
2. Accumuler des phrases jusqu'à atteindre `chunk_size` tokens.
3. Créer le chunk avec les phrases accumulées.
4. Le chevauchement reprend les N dernières phrases du chunk précédent pour atteindre `chunk_overlap` tokens.

#### `paragraph_based`

1. Séparer le texte par `\n\n` (double retour à la ligne).
2. Accumuler des paragraphes jusqu'à atteindre `chunk_size`.
3. Si un seul paragraphe dépasse `max_chunk_size`, le re-découper en mode `sentence_based`.
4. Chevauchement : reprendre le dernier paragraphe du chunk précédent.

#### `semantic`

1. Segmenter le texte en phrases.
2. Calculer l'embedding de chaque phrase via le modèle léger embarqué.
3. Calculer la similarité cosinus entre chaque paire de phrases consécutives.
4. Placer une frontière de chunk quand la similarité tombe sous `similarity_threshold`.
5. Si un chunk résultant dépasse `max_chunk_size`, le re-découper en mode `sentence_based`.
6. Si un chunk est inférieur à `min_chunk_size`, le fusionner avec le voisin le plus similaire.

#### `recursive`

1. Tenter de découper avec le premier séparateur de la liste.
2. Pour chaque segment : si ≤ `chunk_size`, accepter comme chunk.
3. Si > `chunk_size`, re-découper avec le séparateur suivant.
4. Si plus aucun séparateur, découper en `fixed_size`.
5. Appliquer le chevauchement entre chunks.
6. Si `keep_separator: true`, conserver le séparateur au début du chunk suivant.

#### `markdown_header`

1. Détecter les lignes commençant par `#`, `##`, `###`, etc. (selon `header_levels`).
2. Chaque titre dans `header_levels` déclenche un nouveau chunk.
3. Le titre est inclus en en-tête du chunk.
4. La hiérarchie est préservée dans les métadonnées (ex : `section: "2.3.1 — Obligations du prestataire"`).
5. Si un chunk dépasse `max_chunk_size`, le re-découper en mode `paragraph_based`.
6. Si un chunk est inférieur à `min_chunk_size`, le fusionner avec le suivant de même niveau.

---

## 6. Critères d'acceptation

### 6.1 Fonctionnels

| # | Critère |
|---|---------|
| F1 | La section `PARAMÈTRES > Paramètres avancés > CHUNKING` est accessible et affiche tous les paramètres |
| F2 | Le sélecteur de stratégie propose les 6 stratégies avec une description informative |
| F3 | Les paramètres non pertinents pour la stratégie sélectionnée sont masqués dynamiquement |
| F4 | Les sliders de taille (chunk_size, overlap, min, max) sont fonctionnels avec validation croisée |
| F5 | Les erreurs de validation (overlap ≥ chunk_size, etc.) s'affichent en rouge sous le champ |
| F6 | Le badge "Modifié" apparaît à côté de chaque paramètre dont la valeur diffère du profil |
| F7 | L'éditeur de séparateurs permet d'ajouter, supprimer et réordonner (drag-and-drop) |
| F8 | Le bouton "Prévisualiser le chunking" chunke le document sélectionné et affiche les résultats |
| F9 | La prévisualisation affiche les statistiques (total, moyenne, min, max) |
| F10 | Les chunks sont affichés avec pagination (2 par page), index, taille et métadonnées |
| F11 | La zone de chevauchement est surlignée en jaune pâle dans la prévisualisation |
| F12 | L'histogramme de distribution des tailles est affiché |
| F13 | Un avertissement s'affiche si > 200 chunks sont produits |
| F14 | Un avertissement s'affiche pour la stratégie `semantic` sans modèle d'embedding configuré |
| F15 | Le bouton "Réinitialiser au profil" restaure les valeurs par défaut avec confirmation |
| F16 | Tous les textes sont traduits FR/EN via i18n |

### 6.2 Techniques

| # | Critère |
|---|---------|
| T1 | `GET /api/chunking/config` retourne la config chunking courante |
| T2 | `PUT /api/chunking/config` valide et persiste les modifications |
| T3 | `POST /api/chunking/config/validate` détecte les erreurs (overlap ≥ size, etc.) |
| T4 | `POST /api/chunking/config/reset` restaure les valeurs du profil actif |
| T5 | `POST /api/chunking/preview` retourne les chunks avec stats pour un document donné |
| T6 | Les 6 stratégies produisent des chunks valides sur des documents PDF, DOCX, MD et TXT |
| T7 | Le comptage de tokens est cohérent (tiktoken `cl100k_base`) |
| T8 | `preserve_sentences: true` ne produit jamais un chunk coupant une phrase en deux |
| T9 | `chunk_overlap` produit le bon texte commun entre chunks consécutifs (vérifiable en preview) |
| T10 | Les métadonnées sont correctement propagées quand `metadata_propagation: true` |
| T11 | La config chunking est persistée dans `settings.json` sous la clé `chunking` |
| T12 | Le pipeline parsing → chunking fonctionne de bout en bout (parsing Étape 1 → chunking Étape 2) |
| T13 | `tsc --noEmit` ne produit aucune erreur TypeScript |
| T14 | Le CI passe sur les 4 targets (lint + build) |

---

## 7. Périmètre exclus (Étape 2)

- **Embedding** : sera ajouté à l'Étape 3.
- **Stockage vectoriel** : sera ajouté à l'Étape 4.
- **Ingestion persistante** : le chunking s'exécute pour la prévisualisation mais les chunks ne sont pas persistés (pas de BDD vectorielle).
- **Paramètres généraux** : restent vides à cette étape.
- **Chat fonctionnel** : reste un placeholder.
- **Tableau de bord fonctionnel** : reste un placeholder.
- **Chunking parent-child** : prévu en amélioration future (pas dans cette étape). Les paramètres `parent_chunk_size`, `child_chunk_size` et `sentence_window_size` du guide exhaustif ne sont pas exposés.
- **Chunking sémantique avec le modèle d'embedding utilisateur** : à l'Étape 2, seul un modèle léger embarqué est utilisé pour le sémantique. L'intégration avec le modèle d'embedding configuré sera faite à l'Étape 3.

---

## 8. Estimation

| Tâche | Effort estimé |
|-------|---------------|
| Schéma Pydantic chunking + validation croisée | 0.5 jour |
| Implémentation `FixedSizeChunker` | 0.5 jour |
| Implémentation `SentenceBasedChunker` (+ intégration nltk) | 1 jour |
| Implémentation `ParagraphBasedChunker` | 0.5 jour |
| Implémentation `SemanticChunker` (+ modèle léger embarqué) | 1.5 jours |
| Implémentation `RecursiveChunker` | 1 jour |
| Implémentation `MarkdownHeaderChunker` | 1 jour |
| Tokenizer (`tiktoken`) + utilitaires de comptage | 0.5 jour |
| Routes API chunking (config CRUD + validation + preview) | 1 jour |
| Commandes Tauri (Rust) | 0.5 jour |
| Composant `ChunkingSettings.tsx` (orchestrateur + affichage conditionnel) | 1 jour |
| Composant `StrategySelector.tsx` + descriptions | 0.5 jour |
| Composant `SizeParametersPanel.tsx` (sliders + validation) | 0.5 jour |
| Composant `SeparatorsEditor.tsx` (drag-and-drop + édition) | 1 jour |
| Composant `ChunkingPreview.tsx` (prévisualisation paginée + overlap surligné) | 1.5 jours |
| Composant `SizeDistributionChart.tsx` (histogramme) | 0.5 jour |
| Hook `useChunkingConfig.ts` + `useChunkingPreview.ts` | 0.5 jour |
| Traductions i18n (FR + EN) — chunking + stratégies | 0.5 jour |
| Tests unitaires chunkers (6 stratégies × documents variés) | 2 jours |
| Tests d'intégration (pipeline parsing → chunking) | 1 jour |
| Tests manuels + corrections | 1 jour |
| **Total** | **~17 jours** |
