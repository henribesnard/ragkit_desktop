# 🧰 RAGKIT Desktop — Spécifications Étape 4 : Base de données vectorielle

> **Étape** : 4 — Base de données vectorielle  
> **Tag cible** : `v0.5.0`  
> **Date** : 16 février 2026  
> **Dépôt** : https://github.com/henribesnard/ragkit_desktop.git  
> **Prérequis** : Étape 3 (Embedding) implémentée et validée

---

## 1. Objectif

Ajouter le **stockage vectoriel**, compléter le **pipeline d'ingestion de bout en bout**, et permettre à l'utilisateur de **lancer et monitorer l'ingestion** depuis le tableau de bord. C'est l'étape charnière qui transforme RAGKIT d'un outil de configuration en une application fonctionnelle capable d'indexer des documents.

Cette étape livre :
- Une section `PARAMÈTRES > Paramètres avancés > BASE DE DONNÉES VECTORIELLE` complète et fonctionnelle.
- Le support de **2 providers de base vectorielle** : Qdrant (recommandé) et ChromaDB (alternative légère).
- Le **pipeline d'ingestion complet** : Parsing → Chunking → Embedding → Stockage vectoriel.
- L'**activation du TABLEAU DE BORD** avec monitoring temps réel de l'ingestion (barre de progression, compteurs, temps restant estimé, pause/annulation).
- La **détection de changements** dans le répertoire source (ajouts, modifications, suppressions).
- L'**ingestion incrémentale** (stratégie `upsert`) : seuls les documents ajoutés/modifiés sont réingérés.
- Le **versioning des ingestions** avec historique et rollback.
- Le premier paramètre dans `PARAMÈTRES > Paramètres généraux` : **Mode d'ingestion** (Manuel / Automatique).
- Les **notifications de réingestion** quand l'utilisateur modifie un paramètre d'ingestion (parsing, chunking, embedding, BDD vectorielle).

**La recherche (sémantique, lexicale, hybride) n'est pas encore implémentée.** L'utilisateur peut indexer ses documents mais ne peut pas encore les interroger via le chat.

---

## 2. Spécifications fonctionnelles

### 2.1 Section PARAMÈTRES > Paramètres avancés > BASE DE DONNÉES VECTORIELLE

#### Structure de l'onglet PARAMÈTRES à cette étape

```
PARAMÈTRES
├── Paramètres généraux
│   └── Mode d'ingestion (Manuel / Automatique)     ← NOUVEAU
└── Paramètres avancés
    ├── INGESTION & PRÉPROCESSING                    ← Étape 1
    ├── CHUNKING                                     ← Étape 2
    ├── EMBEDDING                                    ← Étape 3
    └── BASE DE DONNÉES VECTORIELLE                  ← NOUVEAU
```

#### Layout de la section BASE DE DONNÉES VECTORIELLE

```
┌─────────────────────────────────────────────────────────────────┐
│  BASE DE DONNÉES VECTORIELLE                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Provider ────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  Base vectorielle :    (•) Qdrant          ○ ChromaDB     │ │
│  │                                                            │ │
│  │  ℹ️ Qdrant : Haute performance, filtrage avancé,           │ │
│  │  HNSW paramétrable. Recommandé pour la production.         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Collection ──────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  Nom de la collection : [ragkit_default           ]       │ │
│  │  Mode de stockage :     [▾ persistent             ]       │ │
│  │  Chemin de stockage :   [~/.ragkit/data/qdrant    ] [📂]  │ │
│  │                                                            │ │
│  │  📊 Collection : 0 vecteurs · 1536 dimensions · 0 Mo      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Distance & Indexation ───────────────────────────────────┐ │
│  │                                                            │ │
│  │  Métrique de distance : [▾ cosine             ]           │ │
│  │                                                            │ │
│  │  ▸ Paramètres HNSW (Index)                                │ │
│  │  ┌────────────────────────────────────────────────────┐   │ │
│  │  │  ef_construction :  [=====◆======] 128             │   │ │
│  │  │  m :                [==◆=========] 16              │   │ │
│  │  │  ef_search :        [=====◆======] 128             │   │ │
│  │  │                                                    │   │ │
│  │  │  ℹ️ ef_construction élevé = meilleur recall         │   │ │
│  │  │  (construction plus lente). m élevé = plus de      │   │ │
│  │  │  mémoire mais meilleures recherches.               │   │ │
│  │  └────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Actions ─────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  [🔌 Tester la connexion]     🟢 Qdrant accessible        │ │
│  │                                                            │ │
│  │  [🗑 Supprimer la collection]  ⚠️ Action irréversible      │ │
│  │  [📋 Exporter les métadonnées]                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [↻ Réinitialiser au profil]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Providers de base vectorielle

#### Comparaison des providers

| Caractéristique | Qdrant | ChromaDB |
|----------------|--------|----------|
| **Mode** | Serveur embarqué (in-process) ou externe | In-process |
| **Persistance** | `memory` / `persistent` | `memory` / `persistent` |
| **Index** | HNSW (paramétrable) | HNSW (par défaut, non exposé) |
| **Filtrage** | Avancé (conditions sur métadonnées) | Basique (`where` clauses) |
| **Performance** | Optimisé pour des millions de vecteurs | Correct jusqu'à ~100K vecteurs |
| **Taille binaire** | ~30 Mo (Rust, embarqué via `qdrant-client`) | ~15 Mo (Python natif) |
| **Cas d'usage** | Production, gros volumes, filtrage complexe | Prototypage, petites bases, simplicité |

**Règles de sélection** :
- RAGKIT embarque les deux providers en tant que librairies Python. Il n'y a **pas** de serveur externe à installer.
- Qdrant utilise la variante **`qdrant-client`** en mode local (grpc/http vers un serveur Qdrant embarqué ou le mode `in-memory`/`persistent` direct via `qdrant_client.QdrantClient(path=...)`).
- ChromaDB utilise `chromadb.PersistentClient(path=...)` ou `chromadb.Client()` pour le mode mémoire.
- Le provider peut être changé à tout moment mais **nécessite une réingestion complète** (les vecteurs stockés ne sont pas transférables entre providers).

#### Fiche descriptive par provider (affichée sous le sélecteur)

| Provider | Description affichée |
|----------|---------------------|
| **Qdrant** | "Haute performance, filtrage avancé sur les métadonnées, HNSW paramétrable. Recommandé pour la plupart des cas d'usage." |
| **ChromaDB** | "Simple et léger, idéal pour les petites bases de connaissances (<100K chunks). Moins de paramètres à configurer." |

### 2.3 Configuration de la collection

| Paramètre | Qdrant | ChromaDB | Description |
|-----------|:---:|:---:|-------------|
| `collection_name` | ✅ | ✅ | Nom unique de la collection. Défaut : `ragkit_default`. Validation : `[a-z0-9_-]`, max 63 caractères. |
| `mode` | ✅ | ✅ | `memory` (volatile, rapide, dev) ou `persistent` (données sur disque, production). |
| `path` | ✅ | ✅ | Chemin du répertoire de stockage (mode persistent uniquement). Défaut : `~/.ragkit/data/{provider}/`. |

**Comportements** :
- En mode `memory`, le champ `path` est masqué et un avertissement s'affiche : "⚠️ Mode mémoire : les données seront perdues au redémarrage de l'application. Recommandé uniquement pour les tests."
- En mode `persistent`, le bouton 📂 ouvre un dialogue natif de sélection de répertoire (Tauri `dialog.open`).
- Si l'utilisateur change le nom de la collection, une nouvelle collection est créée (l'ancienne n'est pas supprimée automatiquement).
- Le panneau "📊 Collection" affiche en temps réel : nombre de vecteurs indexés, dimensions, taille sur disque estimée.

### 2.4 Métrique de distance

| Métrique | ID config | Description | Quand l'utiliser |
|----------|-----------|-------------|-----------------|
| **Cosine** | `cosine` | Similarité par angle entre vecteurs. Valeur de 0 à 1 (après normalisation). | **Défaut et recommandé** pour le texte. Indépendant de la magnitude. |
| **Euclidean** | `euclidean` | Distance L2 entre vecteurs. Plus petit = plus similaire. | Quand la magnitude a de l'importance. Rare pour le RAG. |
| **Dot product** | `dot` | Produit scalaire. Plus grand = plus similaire. | Vecteurs déjà normalisés. Équivalent à cosine si `embedding.normalize = true`. |

**Recommandation affichée** : "Pour la plupart des cas d'usage RAG, la métrique cosine est recommandée. Si vous avez activé la normalisation L2 dans les paramètres d'embedding, dot product et cosine sont équivalents."

### 2.5 Paramètres HNSW (Index)

Ces paramètres ne sont exposés que pour le provider **Qdrant**. Pour ChromaDB, ils ne sont pas configurables (HNSW avec valeurs par défaut internes).

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| `ef_construction` | `vector_store.hnsw.ef_construction` | int | 4 | 512 | 128 | Taille de la liste dynamique lors de la construction de l'index. Plus élevé = meilleur recall, construction plus lente. |
| `m` | `vector_store.hnsw.m` | int | 2 | 64 | 16 | Nombre de connexions bi-directionnelles par nœud. Plus élevé = meilleur recall, plus de mémoire (~8 octets × m par vecteur). |
| `ef_search` | `vector_store.hnsw.ef_search` | int | 1 | 512 | 128 | Taille de la liste dynamique lors de la recherche. Plus élevé = meilleur recall, recherche plus lente. Doit être ≥ `top_k` (Étape 5). |

**Section dépliable** : les paramètres HNSW sont dans une section `▸ Paramètres HNSW (Index)` fermée par défaut. Un avertissement s'affiche à l'ouverture : "⚠️ Paramètres avancés — modifier ces valeurs affecte les performances de recherche et nécessite une reconstruction de l'index."

### 2.6 Paramètres généraux — Mode d'ingestion

C'est le **premier paramètre** qui apparaît dans `PARAMÈTRES > Paramètres généraux` :

```
┌─────────────────────────────────────────────────────────────────┐
│  PARAMÈTRES GÉNÉRAUX                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Mode d'ingestion                                               │
│                                                                 │
│  (•) Manuel                                                     │
│      L'ingestion est lancée manuellement depuis le              │
│      tableau de bord. Vous contrôlez quand les documents        │
│      sont indexés.                                              │
│                                                                 │
│  ( ) Automatique                                                │
│      L'ingestion se relance automatiquement lorsque des         │
│      fichiers sont ajoutés, modifiés ou supprimés dans          │
│      le répertoire source.                                      │
│      Délai avant déclenchement : [===◆=====] 30 s              │
│                                                                 │
│  ℹ️ Le mode automatique surveille le répertoire source en        │
│  arrière-plan. Un délai de stabilisation évite les              │
│  déclenchements intempestifs lors de copies massives.           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Comportements** :
- En mode **Manuel** : l'utilisateur doit cliquer sur "Lancer l'ingestion" dans le TABLEAU DE BORD.
- En mode **Automatique** : un `FileWatcher` surveille le répertoire source. Après un délai de stabilisation (configurable, défaut : 30 secondes sans nouveau changement), l'ingestion se déclenche automatiquement.
- Le passage de Manuel à Automatique active immédiatement le FileWatcher (et déclenche une détection de changements).
- Le passage de Automatique à Manuel désactive le FileWatcher.

---

## 3. Spécifications fonctionnelles — TABLEAU DE BORD

L'Étape 4 **active le TABLEAU DE BORD** qui était jusqu'ici un placeholder. Il devient le centre de contrôle de l'ingestion.

### 3.1 Layout du TABLEAU DE BORD

```
┌─────────────────────────────────────────────────────────────────┐
│  TABLEAU DE BORD                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── État de la base de connaissances ────────────────────────┐ │
│  │                                                            │ │
│  │  📁 Source : /home/user/documents  (42 fichiers · 156 Mo)  │ │
│  │  📊 Index : 1 247 chunks · 1536 dimensions · 23 Mo        │ │
│  │  🕐 Dernière ingestion : 15 fév 2026 à 14:32 (v3)        │ │
│  │  🟢 Base à jour — aucun changement détecté                │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Changements détectés ────────────────────────────────────┐ │
│  │                                                            │ │
│  │  🟡 3 changements détectés depuis la dernière ingestion    │ │
│  │                                                            │ │
│  │   + rapport-Q4-2025.pdf          (nouveau · 2.3 Mo)       │ │
│  │   ~ guide-utilisateur.docx       (modifié · 15 fév)       │ │
│  │   − ancien-contrat.pdf           (supprimé)               │ │
│  │                                                            │ │
│  │  [▶ Lancer l'ingestion]  [▶ Ingestion incrémentale]       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Progression (visible pendant une ingestion) ─────────────┐ │
│  │                                                            │ │
│  │  ████████████░░░░░░░░ 60%  ·  25/42 documents             │ │
│  │                                                            │ │
│  │  📄 En cours : guide-utilisateur.docx (chunking)          │ │
│  │  🕐 Temps écoulé : 02:34 · Restant estimé : ~01:42       │ │
│  │                                                            │ │
│  │  ✅ Réussis : 24   ⚠️ Avertissements : 1   ❌ Échecs : 0  │ │
│  │                                                            │ │
│  │  [⏸ Pause]  [⏹ Annuler]                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Historique des ingestions ────────────────────────────────┐ │
│  │                                                            │ │
│  │  Version │ Date             │ Docs │ Chunks │ Durée │ Stat │ │
│  │  ────────┼──────────────────┼──────┼────────┼───────┼──────│ │
│  │  v3      │ 15 fév 14:32    │ 42   │ 1 247  │ 4:12  │ ✅  │ │
│  │  v2      │ 14 fév 10:15    │ 40   │ 1 180  │ 3:58  │ ✅  │ │
│  │  v1      │ 13 fév 16:00    │ 38   │ 1 102  │ 4:45  │ ⚠️  │ │
│  │                                                            │ │
│  │  [↩ Restaurer v2]                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Journal d'ingestion ─────────────────────────────────────┐ │
│  │                                                            │ │
│  │  14:32:01  ✅ rapport-Q3.pdf — 32 chunks (0.8s)           │ │
│  │  14:32:02  ⚠️ scan-facture.pdf — OCR requis (2.1s)        │ │
│  │  14:32:05  ✅ guide-api.md — 18 chunks (0.3s)             │ │
│  │  14:32:06  ✅ contrat-2024.docx — 45 chunks (1.2s)        │ │
│  │  ...                                                       │ │
│  │                                                            │ │
│  │  [📋 Exporter le journal]  [🗑 Effacer]                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Panneau "État de la base de connaissances"

Toujours visible en haut du tableau de bord. Affiche un résumé condensé :

| Élément | Source | Détail |
|---------|--------|--------|
| **Source** | Config `ingestion.source.path` | Chemin du répertoire, nombre de fichiers, taille totale |
| **Index** | Requête à la BDD vectorielle | Nombre de vecteurs, dimensions, taille estimée sur disque |
| **Dernière ingestion** | Historique des ingestions | Date, heure, numéro de version |
| **Statut** | Comparaison source ↔ index | 🟢 "À jour" / 🟡 "Changements détectés" / 🔴 "Aucune ingestion" / 🔵 "Ingestion en cours" |

### 3.3 Panneau "Changements détectés"

Ce panneau apparaît uniquement lorsque des changements sont détectés entre le répertoire source et l'index actuel.

**Mécanisme de détection** :
1. Au démarrage de l'application, le backend compare les fichiers du répertoire source avec le registre de la dernière ingestion.
2. En mode Automatique, le `FileWatcher` détecte les changements en temps réel.
3. En mode Manuel, un scan est effectué à chaque ouverture du TABLEAU DE BORD et toutes les 60 secondes.

**Comparaison par hash** :
- Chaque fichier est identifié par un hash SHA-256 de son contenu.
- Le registre d'ingestion stocke pour chaque document : `file_path`, `file_hash`, `file_size`, `last_modified`.
- Un fichier est considéré comme "modifié" si son hash a changé.

**Types de changements affichés** :

| Icône | Type | Couleur | Description |
|:---:|------|---------|-------------|
| `+` | Nouveau | Vert | Fichier présent dans le répertoire mais absent du registre |
| `~` | Modifié | Orange | Fichier présent mais hash différent |
| `−` | Supprimé | Rouge | Fichier dans le registre mais absent du répertoire |

**Actions disponibles** :
- **"Lancer l'ingestion"** : relance l'ingestion complète de tous les documents.
- **"Ingestion incrémentale"** : traite uniquement les changements détectés (nouveaux + modifiés + supprime les vecteurs des documents supprimés).

### 3.4 Panneau "Progression"

Ce panneau n'est visible que pendant une ingestion active. Il affiche le monitoring temps réel.

#### Communication temps réel : SSE (Server-Sent Events)

Le monitoring utilise un endpoint SSE pour pousser les mises à jour du backend vers le frontend sans polling :

```
Frontend                      Backend
    │                            │
    │  GET /api/ingestion/       │
    │      progress/stream       │
    │ ─────────────────────────> │
    │                            │
    │  event: progress           │
    │  data: {                   │
    │    phase: "embedding",     │
    │    doc_index: 25,          │
    │    doc_total: 42,          │
    │    current_doc: "guide..", │
    │    ...                     │
    │  }                         │
    │ <───────────────────────── │
    │                            │
    │  event: doc_complete       │
    │  data: { doc_id: "...",    │
    │    chunks: 32, status: "ok"│
    │  }                         │
    │ <───────────────────────── │
    │         ...                │
    │  event: complete           │
    │  data: { version: "v4",    │
    │    total_chunks: 1280,     │
    │    duration_s: 252,        │
    │    ...                     │
    │  }                         │
    │ <───────────────────────── │
```

#### Phases du pipeline

Chaque document passe par 4 phases affichées dans la barre de progression :

| Phase | Icône | Description |
|-------|:---:|-------------|
| `parsing` | 📄 | Extraction du texte brut |
| `chunking` | ✂️ | Découpage en chunks |
| `embedding` | 🧬 | Vectorisation des chunks |
| `storing` | 💾 | Stockage dans la BDD vectorielle |

**Affichage de la phase courante** : "📄 En cours : guide-utilisateur.docx (chunking)" — le nom du document et la phase active.

#### Estimation du temps restant

L'estimation utilise une **moyenne mobile pondérée** des temps de traitement par document :

```
temps_restant = moyenne_temps_par_doc × docs_restants
```

L'estimation se stabilise après les 5 premiers documents traités. Avant cela, elle affiche "~calcul en cours…".

#### Boutons Pause et Annuler

| Bouton | Comportement |
|--------|-------------|
| **⏸ Pause** | Suspend l'ingestion à la fin du document en cours (pas de coupure en milieu de traitement). Le bouton devient "▶ Reprendre". L'index reste dans un état cohérent (tous les documents terminés sont indexés). |
| **⏹ Annuler** | Annule l'ingestion après confirmation. Les documents déjà indexés dans cette session sont **conservés** (pas de rollback automatique à l'état précédent). Un avertissement s'affiche : "L'index contient les N documents déjà traités. Vous pouvez relancer l'ingestion ultérieurement." |

### 3.5 Panneau "Historique des ingestions"

Affiche un tableau des ingestions passées, ordonnées par date décroissante.

| Colonne | Contenu |
|---------|---------|
| **Version** | Numéro incrémental (`v1`, `v2`, `v3`…) |
| **Date** | Date et heure de fin de l'ingestion |
| **Docs** | Nombre de documents traités |
| **Chunks** | Nombre total de chunks dans l'index |
| **Durée** | Durée totale de l'ingestion |
| **Statut** | ✅ Succès / ⚠️ Avec avertissements / ❌ Échouée / ⏹ Annulée |

**Action "Restaurer"** :
- Le bouton "↩ Restaurer vN" permet de revenir à l'état d'un index précédent.
- La restauration est disponible uniquement en mode `persistent`.
- Une confirmation est demandée : "Voulez-vous restaurer l'index à la version vN ? L'index actuel (vM) sera remplacé."
- La restauration copie le snapshot de la version sélectionnée comme index actif.

### 3.6 Panneau "Journal d'ingestion"

Log scrollable des événements de l'ingestion courante ou de la dernière ingestion.

| Type | Icône | Exemple |
|------|:---:|---------|
| Succès | ✅ | `rapport-Q3.pdf — 32 chunks (0.8s)` |
| Avertissement | ⚠️ | `scan-facture.pdf — OCR requis, qualité limitée (2.1s)` |
| Erreur | ❌ | `fichier-corrompu.pdf — Échec du parsing : fichier corrompu` |
| Info | ℹ️ | `Ingestion incrémentale : 3 documents à traiter` |

**Actions** :
- "📋 Exporter le journal" : exporte le journal en fichier `.log` (texte brut).
- "🗑 Effacer" : efface le journal affiché (les logs structurés restent dans `~/.ragkit/logs/`).

---

## 4. Pipeline d'ingestion complet

### 4.1 Architecture du pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    PIPELINE D'INGESTION                      │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ PARSING  │→ │ CHUNKING │→ │EMBEDDING │→ │  STOCKAGE   │ │
│  │ (Ét. 1)  │  │ (Ét. 2)  │  │ (Ét. 3)  │  │ (Ét. 4)    │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘ │
│       │              │              │              │          │
│   Texte brut     Chunks[]      Vecteurs[]    Points dans    │
│  + métadonnées  + métadonnées  (float[])     la collection  │
│                                                              │
│  ─── Monitoring SSE ──────────────────────────────────────── │
│  Événements : progress, doc_complete, warning, error, done   │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Flux d'exécution détaillé

Pour chaque document :

```
1. PARSING (Étape 1)
   ├─ Lecture du fichier
   ├─ Extraction du texte brut (unstructured / docling / pypdf)
   ├─ Extraction des métadonnées (titre, auteur, langue, pages…)
   ├─ Préprocessing (normalisation Unicode, nettoyage)
   └─ → DocumentContent { text, metadata }

2. CHUNKING (Étape 2)
   ├─ Sélection de la stratégie (fixed_size, recursive, etc.)
   ├─ Découpage du texte en chunks
   ├─ Propagation des métadonnées aux chunks
   ├─ Ajout des métadonnées de chunk (index, position, overlap)
   └─ → Chunk[] { text, metadata }

3. EMBEDDING (Étape 3)
   ├─ Vérification du cache (hash du texte + model_id)
   ├─ Découpage en batches de `batch_size`
   ├─ Envoi au provider d'embedding (avec retries)
   ├─ Normalisation L2 si activée
   ├─ Mise en cache des résultats
   └─ → Vector[] (float[][])

4. STOCKAGE (Étape 4)
   ├─ Conversion en points (id, vector, payload)
   ├─ Upsert dans la collection vectorielle
   ├─ Vérification de la cohérence (count post-upsert)
   └─ → Confirmation de stockage
```

### 4.3 Structure d'un point vectoriel stocké

Chaque chunk est stocké comme un "point" dans la BDD vectorielle :

```python
# Structure d'un point Qdrant
{
    "id": "a1b2c3d4-...",           # UUID déterministe (hash du texte + doc_path)
    "vector": [0.012, -0.034, ...], # float[1536] (ou dimensions du modèle)
    "payload": {
        # Métadonnées du document
        "doc_id": "doc_abc123",
        "doc_path": "/home/user/documents/rapport-Q3.pdf",
        "doc_title": "Rapport financier Q3 2024",
        "doc_author": "Direction Financière",
        "doc_type": "pdf",
        "doc_language": "fr",

        # Métadonnées du chunk
        "chunk_index": 5,
        "chunk_total": 32,
        "chunk_text": "Le chiffre d'affaires a progressé de 12%...",
        "chunk_tokens": 487,
        "page_number": 3,
        "section_header": "3. Résultats financiers",

        # Métadonnées d'ingestion
        "ingestion_version": "v3",
        "ingested_at": "2026-02-15T14:32:01Z",
        "file_hash": "sha256:a1b2c3d4...",

        # Métadonnées optionnelles (selon config)
        "domain": "finance",
        "category": "rapports",
        "keywords": ["chiffre d'affaires", "Q3", "croissance"]
    }
}
```

### 4.4 Ingestion incrémentale (stratégie upsert)

L'ingestion incrémentale compare l'état actuel du répertoire source avec le registre de la dernière ingestion :

| Cas | Action |
|-----|--------|
| **Fichier nouveau** | Pipeline complet (parsing → chunking → embedding → stockage) |
| **Fichier modifié** (hash différent) | Supprimer les anciens points du document → pipeline complet |
| **Fichier supprimé** | Supprimer tous les points associés à ce `doc_id` |
| **Fichier inchangé** (même hash) | Aucune action (skip) |

**Registre d'ingestion** : fichier SQLite `~/.ragkit/data/ingestion_registry.db` :

```sql
CREATE TABLE ingestion_registry (
    doc_id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    last_modified TEXT NOT NULL,
    chunk_count INTEGER NOT NULL,
    ingestion_version TEXT NOT NULL,
    ingested_at TEXT NOT NULL
);

CREATE TABLE ingestion_history (
    version TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL,           -- running, completed, failed, cancelled
    total_docs INTEGER,
    total_chunks INTEGER,
    docs_added INTEGER DEFAULT 0,
    docs_modified INTEGER DEFAULT 0,
    docs_removed INTEGER DEFAULT 0,
    docs_skipped INTEGER DEFAULT 0,
    docs_failed INTEGER DEFAULT 0,
    duration_seconds REAL,
    is_incremental BOOLEAN DEFAULT FALSE,
    config_snapshot TEXT             -- JSON snapshot des paramètres utilisés
);
```

### 4.5 Versioning et snapshots

Chaque ingestion crée une **version horodatée** :

1. **Avant l'ingestion** : un snapshot de l'index actuel est créé (Qdrant : `create_snapshot()` ; Chroma : copie du répertoire de stockage).
2. **Pendant l'ingestion** : l'index est modifié progressivement (les documents déjà indexés restent accessibles).
3. **Après l'ingestion** : le numéro de version est incrémenté dans `ingestion_history`.
4. **Stockage des snapshots** : `~/.ragkit/data/snapshots/{version}/`.

**Politique de rétention** : les 5 derniers snapshots sont conservés. Les plus anciens sont automatiquement supprimés. Ce seuil est configurable dans les paramètres avancés de la base vectorielle (`vector_store.snapshot_retention`, défaut : 5).

### 4.6 Notification de réingestion

Lorsque l'utilisateur modifie un paramètre qui impacte l'index (dans les sections Ingestion, Chunking, Embedding, ou BDD Vectorielle), un avertissement s'affiche :

```
┌────────────────────────────────────────────────────────┐
│  ⚠️ Réingestion nécessaire                             │
│                                                        │
│  La modification de ce paramètre nécessite une         │
│  réingestion complète de tous les documents.            │
│                                                        │
│  Paramètre modifié : chunking.chunk_size (512 → 768)  │
│                                                        │
│  [ Annuler ]  [ Appliquer et réingérer maintenant ]    │
│               [ Appliquer (réingérer plus tard) ]      │
└────────────────────────────────────────────────────────┘
```

**Paramètres déclenchant une réingestion** :

| Section | Paramètres concernés |
|---------|---------------------|
| INGESTION | `parsing.engine`, `ocr.*`, `preprocessing.*`, `source.path`, `source.patterns` |
| CHUNKING | `strategy`, `chunk_size`, `chunk_overlap`, `min_chunk_size`, `max_chunk_size`, `separators`, `preserve_sentences`, `similarity_threshold` |
| EMBEDDING | `provider`, `model`, `dimensions`, `normalize` |
| BDD VECTORIELLE | `provider`, `distance_metric`, `collection_name` |

**Paramètres ne nécessitant PAS de réingestion** : `batch_size`, `cache_*`, `timeout`, `max_retries`, `rate_limit_rpm`, `truncation`, `mode`, `path`, `hnsw.*` (sauf si collection recréée).

### 4.7 FileWatcher (mode automatique)

Le `FileWatcher` surveille le répertoire source configuré et détecte les changements en temps réel.

**Implémentation** : `watchdog` (Python) avec un `Observer` sur le répertoire source.

**Événements surveillés** :
- `FileCreatedEvent` : nouveau fichier
- `FileModifiedEvent` : fichier modifié
- `FileDeletedEvent` : fichier supprimé
- `FileMovedEvent` : fichier déplacé (traité comme suppression + création)

**Filtre** : seuls les fichiers correspondant aux patterns configurés (`*.pdf`, `*.docx`, etc.) sont pris en compte. Les fichiers temporaires (`.tmp`, `~$*`, `.swp`) sont ignorés.

**Délai de stabilisation** (`debounce`) :
- Défaut : 30 secondes.
- Après le dernier événement détecté, le FileWatcher attend le délai de stabilisation avant de déclencher l'ingestion.
- Cela évite les déclenchements intempestifs lors d'une copie massive de fichiers.
- Le délai est configurable : `vector_store.auto_ingestion_delay` (5–300 secondes).

---

## 5. Catalogue complet des paramètres BASE DE DONNÉES VECTORIELLE

### 5.1 Paramètres du provider

| Paramètre | Clé config | Type | Options | Défaut | Description |
|-----------|------------|------|---------|--------|-------------|
| Provider | `vector_store.provider` | enum | `qdrant` \| `chroma` | Selon profil | Moteur de base vectorielle |
| Mode | `vector_store.mode` | enum | `memory` \| `persistent` | `persistent` | Mode de stockage |
| Chemin | `vector_store.path` | string | — | `~/.ragkit/data/{provider}/` | Répertoire de stockage (mode persistent) |
| Collection | `vector_store.collection_name` | string | `[a-z0-9_-]{1,63}` | `ragkit_default` | Nom de la collection |

### 5.2 Paramètres de distance et d'index

| Paramètre | Clé config | Type | Options | Défaut | Provider |
|-----------|------------|------|---------|--------|----------|
| Distance | `vector_store.distance_metric` | enum | `cosine` \| `euclidean` \| `dot` | `cosine` | Tous |
| ef_construction | `vector_store.hnsw.ef_construction` | int | 4–512 | 128 | Qdrant |
| m | `vector_store.hnsw.m` | int | 2–64 | 16 | Qdrant |
| ef_search | `vector_store.hnsw.ef_search` | int | 1–512 | 128 | Qdrant |

### 5.3 Paramètres d'ingestion automatique

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Mode d'ingestion | `ingestion.mode` | enum | — | — | `manual` | `manual` ou `auto` |
| Délai auto | `ingestion.auto_delay_seconds` | int | 5 | 300 | 30 | Délai de stabilisation avant déclenchement automatique |
| Rétention snapshots | `vector_store.snapshot_retention` | int | 1 | 20 | 5 | Nombre de snapshots conservés |

### 5.4 Visibilité conditionnelle des paramètres

| Paramètre | Condition de visibilité |
|-----------|------------------------|
| `path` | `mode == "persistent"` |
| `hnsw.*` | `provider == "qdrant"` |
| `auto_delay_seconds` | `ingestion.mode == "auto"` |

### 5.5 Résumé des impacts

| Paramètre | Impact principal | Réingestion nécessaire |
|-----------|-----------------|:---:|
| `provider` | Moteur de stockage, performance, fonctionnalités | ✅ |
| `mode` | Persistance des données entre redémarrages | ❌ (mais données perdues si memory→persistent) |
| `collection_name` | Isolation des données | ✅ (nouvelle collection) |
| `distance_metric` | Qualité du ranking des résultats | ✅ |
| `hnsw.ef_construction` | Qualité de l'index (construction) | ✅ (reconstruction index) |
| `hnsw.m` | Mémoire et qualité du recall | ✅ (reconstruction index) |
| `hnsw.ef_search` | Vitesse et qualité de la recherche | ❌ (appliqué à la volée) |

---

## 6. Valeurs par défaut par profil

### 6.1 Matrice profil → paramètres de base vectorielle

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|:---:|:---:|:---:|:---:|:---:|
| `provider` | `qdrant` | `chroma` | `qdrant` | `qdrant` | `qdrant` |
| `mode` | `persistent` | `persistent` | `persistent` | `persistent` | `persistent` |
| `collection_name` | `ragkit_default` | `ragkit_default` | `ragkit_default` | `ragkit_default` | `ragkit_default` |
| `distance_metric` | `cosine` | `cosine` | `cosine` | `cosine` | `cosine` |
| `hnsw.ef_construction` | 128 | — | 200 | 128 | 128 |
| `hnsw.m` | 16 | — | 24 | 16 | 16 |
| `hnsw.ef_search` | 128 | — | 200 | 128 | 128 |
| `ingestion.mode` | `manual` | `manual` | `manual` | `manual` | `manual` |

### 6.2 Justification des choix

- **`faq_support` → ChromaDB** : les bases FAQ sont généralement petites (<10K chunks) et ne nécessitent pas les fonctionnalités avancées de Qdrant. ChromaDB est plus simple et suffisant.
- **`legal_compliance` → HNSW agressif** : `ef_construction=200` et `m=24` pour maximiser le recall (il est critique de ne rien manquer en contexte juridique), au détriment d'un usage mémoire légèrement plus élevé et d'une construction d'index plus lente.
- **Tous `persistent`** : le mode `memory` est réservé aux tests. En production, les données doivent survivre aux redémarrages.
- **Tous `cosine`** : la similarité cosinus est la métrique standard pour les embeddings textuels. Combinée à la normalisation L2 (Étape 3), elle offre des scores cohérents entre 0 et 1.

---

## 7. Spécifications techniques

### 7.1 Schéma Pydantic (backend)

```python
# ragkit/config/vector_store_schema.py
"""Pydantic schemas for vector store configuration."""

from __future__ import annotations

from enum import Enum
from pathlib import Path

from pydantic import BaseModel, Field, field_validator


class VectorStoreProvider(str, Enum):
    QDRANT = "qdrant"
    CHROMA = "chroma"


class StorageMode(str, Enum):
    MEMORY = "memory"
    PERSISTENT = "persistent"


class DistanceMetric(str, Enum):
    COSINE = "cosine"
    EUCLIDEAN = "euclidean"
    DOT = "dot"


class IngestionMode(str, Enum):
    MANUAL = "manual"
    AUTO = "auto"


class HNSWConfig(BaseModel):
    """HNSW index parameters (Qdrant only)."""
    ef_construction: int = Field(default=128, ge=4, le=512)
    m: int = Field(default=16, ge=2, le=64)
    ef_search: int = Field(default=128, ge=1, le=512)


class VectorStoreConfig(BaseModel):
    """Complete vector store configuration."""

    provider: VectorStoreProvider = VectorStoreProvider.QDRANT
    mode: StorageMode = StorageMode.PERSISTENT
    path: str = Field(
        default="~/.ragkit/data/qdrant/",
        description="Storage directory (persistent mode only)")
    collection_name: str = Field(
        default="ragkit_default",
        pattern=r"^[a-z0-9_-]{1,63}$")
    distance_metric: DistanceMetric = DistanceMetric.COSINE

    # HNSW (Qdrant only)
    hnsw: HNSWConfig = Field(default_factory=HNSWConfig)

    # Snapshots
    snapshot_retention: int = Field(default=5, ge=1, le=20)

    @field_validator("path")
    @classmethod
    def expand_path(cls, v: str) -> str:
        return str(Path(v).expanduser())


class IngestionConfig(BaseModel):
    """Ingestion mode and auto-ingestion settings."""
    mode: IngestionMode = IngestionMode.MANUAL
    auto_delay_seconds: int = Field(default=30, ge=5, le=300)
```

### 7.2 Abstraction du vector store (backend)

```python
# ragkit/storage/base.py
"""Abstract base class for vector store providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from ragkit.config.vector_store_schema import VectorStoreConfig


@dataclass
class VectorPoint:
    """A single point (vector + payload) to store."""
    id: str
    vector: list[float]
    payload: dict


@dataclass
class CollectionStats:
    """Statistics about a collection."""
    name: str
    vectors_count: int
    dimensions: int
    size_bytes: int
    status: str  # "ready", "indexing", "error"


class BaseVectorStore(ABC):
    """Abstract base class for all vector store providers."""

    def __init__(self, config: VectorStoreConfig):
        self.config = config

    @abstractmethod
    async def initialize(self, dimensions: int) -> None:
        """Create the collection if it doesn't exist."""
        ...

    @abstractmethod
    async def upsert(self, points: list[VectorPoint]) -> int:
        """Insert or update points. Returns count of upserted points."""
        ...

    @abstractmethod
    async def delete_by_doc_id(self, doc_id: str) -> int:
        """Delete all points for a document. Returns count deleted."""
        ...

    @abstractmethod
    async def delete_collection(self) -> None:
        """Delete the entire collection."""
        ...

    @abstractmethod
    async def collection_stats(self) -> CollectionStats:
        """Get statistics about the collection."""
        ...

    @abstractmethod
    async def test_connection(self) -> ConnectionTestResult:
        """Test that the vector store is accessible."""
        ...

    @abstractmethod
    async def create_snapshot(self, version: str) -> str:
        """Create a snapshot. Returns snapshot path."""
        ...

    @abstractmethod
    async def restore_snapshot(self, version: str) -> None:
        """Restore a snapshot."""
        ...

    @abstractmethod
    async def close(self) -> None:
        """Clean up resources."""
        ...


class QdrantVectorStore(BaseVectorStore):
    """Qdrant vector store implementation."""
    ...


class ChromaVectorStore(BaseVectorStore):
    """ChromaDB vector store implementation."""
    ...


# Provider registry
STORE_REGISTRY: dict[str, type[BaseVectorStore]] = {
    "qdrant": QdrantVectorStore,
    "chroma": ChromaVectorStore,
}


def create_vector_store(config: VectorStoreConfig) -> BaseVectorStore:
    """Factory function to create the appropriate vector store."""
    store_cls = STORE_REGISTRY[config.provider.value]
    return store_cls(config)
```

### 7.3 Orchestrateur d'ingestion (backend)

```python
# ragkit/ingestion/orchestrator.py
"""Ingestion orchestrator — runs the full pipeline with monitoring."""

from __future__ import annotations

import asyncio
import hashlib
import time
from enum import Enum
from pathlib import Path

from pydantic import BaseModel

from ragkit.ingestion.registry import IngestionRegistry
from ragkit.ingestion.chunkers.base import BaseChunker
from ragkit.embedding.engine import BaseEmbeddingProvider
from ragkit.storage.base import BaseVectorStore


class IngestionPhase(str, Enum):
    SCANNING = "scanning"
    PARSING = "parsing"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    STORING = "storing"
    FINALIZING = "finalizing"


class IngestionStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class IngestionProgress(BaseModel):
    """Real-time progress of an ingestion run."""
    status: IngestionStatus
    version: str
    is_incremental: bool
    phase: IngestionPhase
    doc_index: int
    doc_total: int
    current_doc: str | None = None
    current_phase: IngestionPhase | None = None
    elapsed_seconds: float
    estimated_remaining_seconds: float | None = None
    docs_succeeded: int = 0
    docs_warnings: int = 0
    docs_failed: int = 0
    docs_skipped: int = 0
    total_chunks: int = 0


class DocumentResult(BaseModel):
    """Result of processing a single document."""
    doc_id: str
    file_path: str
    status: str                  # "ok", "warning", "error"
    chunk_count: int
    duration_seconds: float
    warning: str | None = None
    error: str | None = None


class IngestionOrchestrator:
    """Orchestrates the full ingestion pipeline."""

    def __init__(
        self,
        parser,
        chunker: BaseChunker,
        embedder: BaseEmbeddingProvider,
        store: BaseVectorStore,
        registry: IngestionRegistry,
    ):
        self.parser = parser
        self.chunker = chunker
        self.embedder = embedder
        self.store = store
        self.registry = registry
        self._status = IngestionStatus.IDLE
        self._pause_event = asyncio.Event()
        self._pause_event.set()  # Not paused initially
        self._cancel_requested = False

    async def run(
        self,
        files: list[Path],
        incremental: bool = False,
        progress_callback=None,
    ) -> IngestionResult:
        """Run the ingestion pipeline on a list of files."""
        ...

    async def pause(self) -> None:
        self._pause_event.clear()
        self._status = IngestionStatus.PAUSED

    async def resume(self) -> None:
        self._pause_event.set()
        self._status = IngestionStatus.RUNNING

    async def cancel(self) -> None:
        self._cancel_requested = True
        self._pause_event.set()  # Unblock if paused

    async def _process_document(self, file_path: Path) -> DocumentResult:
        """Process a single document through the full pipeline."""
        # 1. Check pause/cancel
        await self._pause_event.wait()
        if self._cancel_requested:
            raise CancelledError()

        # 2. Parse
        doc_content = await self.parser.parse(file_path)

        # 3. Chunk
        chunks = self.chunker.chunk(doc_content.text, doc_content.metadata)

        # 4. Embed
        texts = [c.text for c in chunks]
        vectors = await self.embedder.embed_texts(texts)

        # 5. Store
        points = [
            VectorPoint(
                id=self._make_point_id(file_path, i),
                vector=vectors[i],
                payload=self._make_payload(doc_content, chunks[i], i, len(chunks))
            )
            for i in range(len(chunks))
        ]
        await self.store.upsert(points)

        return DocumentResult(
            doc_id=doc_content.metadata.doc_id,
            file_path=str(file_path),
            status="ok",
            chunk_count=len(chunks),
            duration_seconds=...,
        )
```

### 7.4 FileWatcher (backend)

```python
# ragkit/ingestion/file_watcher.py
"""File system watcher for auto-ingestion mode."""

from __future__ import annotations

import asyncio
from pathlib import Path

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from ragkit.config.schema import SourceConfig


class IngestionFileWatcher:
    """Watches the source directory for file changes."""

    def __init__(
        self,
        source_config: SourceConfig,
        debounce_seconds: int = 30,
        on_changes_detected=None,
    ):
        self.source_config = source_config
        self.debounce_seconds = debounce_seconds
        self.on_changes_detected = on_changes_detected
        self._observer: Observer | None = None
        self._debounce_task: asyncio.Task | None = None
        self._pending_changes: list[dict] = []

    def start(self) -> None:
        """Start watching the source directory."""
        handler = _ChangeHandler(
            patterns=self.source_config.patterns,
            on_event=self._on_file_event,
        )
        self._observer = Observer()
        self._observer.schedule(
            handler,
            str(self.source_config.path),
            recursive=self.source_config.recursive,
        )
        self._observer.start()

    def stop(self) -> None:
        """Stop watching."""
        if self._observer:
            self._observer.stop()
            self._observer.join()

    async def _on_file_event(self, event_type: str, path: str) -> None:
        """Handle a file system event with debounce."""
        self._pending_changes.append({
            "type": event_type,
            "path": path
        })
        # Reset debounce timer
        if self._debounce_task:
            self._debounce_task.cancel()
        self._debounce_task = asyncio.create_task(
            self._debounce_trigger()
        )

    async def _debounce_trigger(self) -> None:
        """Wait for debounce period, then trigger callback."""
        await asyncio.sleep(self.debounce_seconds)
        changes = self._pending_changes.copy()
        self._pending_changes.clear()
        if self.on_changes_detected and changes:
            await self.on_changes_detected(changes)


class _ChangeHandler(FileSystemEventHandler):
    """Watchdog event handler with pattern filtering."""
    IGNORED_PATTERNS = {"*.tmp", "~$*", "*.swp", ".DS_Store", "Thumbs.db"}
    ...
```

### 7.5 API REST (routes backend)

#### 7.5.1 Routes Vector Store Config

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/vector-store/config` | GET | Config BDD vectorielle courante | — | `VectorStoreConfig` |
| `/api/vector-store/config` | PUT | Met à jour la config | `VectorStoreConfig` (partiel) | `VectorStoreConfig` |
| `/api/vector-store/config/reset` | POST | Réinitialise au profil actif | — | `VectorStoreConfig` |
| `/api/vector-store/test-connection` | POST | Teste l'accès à la BDD | — | `ConnectionTestResult` |
| `/api/vector-store/collection/stats` | GET | Statistiques de la collection | — | `CollectionStats` |
| `/api/vector-store/collection/delete` | DELETE | Supprime la collection | — | `{ success: bool }` |

#### 7.5.2 Routes Ingestion

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/ingestion/start` | POST | Lance l'ingestion | `{ incremental?: bool }` | `{ version: string, status: string }` |
| `/api/ingestion/pause` | POST | Met en pause | — | `{ status: string }` |
| `/api/ingestion/resume` | POST | Reprend après pause | — | `{ status: string }` |
| `/api/ingestion/cancel` | POST | Annule l'ingestion | — | `{ status: string }` |
| `/api/ingestion/status` | GET | Statut courant | — | `IngestionProgress` |
| `/api/ingestion/progress/stream` | GET (SSE) | Flux SSE de progression | — | `EventStream<IngestionEvent>` |

#### 7.5.3 Routes Changements & Historique

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/ingestion/changes` | GET | Détecte les changements dans le répertoire source | — | `ChangeDetectionResult` |
| `/api/ingestion/history` | GET | Historique des ingestions | `?limit=10` | `IngestionHistoryEntry[]` |
| `/api/ingestion/history/{version}/restore` | POST | Restaure un snapshot | — | `{ success: bool }` |
| `/api/ingestion/log` | GET | Journal de la dernière ingestion | `?version=v3` | `IngestionLogEntry[]` |
| `/api/ingestion/log/export` | GET | Exporte le journal en fichier | `?version=v3` | Fichier `.log` |

#### 7.5.4 Routes Mode d'ingestion (Paramètres généraux)

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/settings/general` | GET | Paramètres généraux | — | `GeneralSettings` |
| `/api/settings/general` | PUT | Met à jour les paramètres généraux | `GeneralSettings` (partiel) | `GeneralSettings` |

#### 7.5.5 Modèles de réponse

```python
class ChangeDetectionResult(BaseModel):
    has_changes: bool
    added: list[FileChange]
    modified: list[FileChange]
    removed: list[FileChange]
    total_changes: int
    last_scan_at: str

class FileChange(BaseModel):
    file_path: str
    file_name: str
    file_size: int | None = None   # null for removed
    change_type: str               # "added", "modified", "removed"
    detected_at: str

class IngestionHistoryEntry(BaseModel):
    version: str
    started_at: str
    completed_at: str | None
    status: str                     # "completed", "failed", "cancelled"
    total_docs: int
    total_chunks: int
    docs_added: int
    docs_modified: int
    docs_removed: int
    docs_skipped: int
    docs_failed: int
    duration_seconds: float | None
    is_incremental: bool
    can_restore: bool               # snapshot still available

class IngestionLogEntry(BaseModel):
    timestamp: str
    level: str                      # "info", "warning", "error"
    message: str
    doc_id: str | None = None
    doc_name: str | None = None
    chunk_count: int | None = None
    duration_seconds: float | None = None

class IngestionEvent(BaseModel):
    """SSE event sent during ingestion."""
    event_type: str                 # "progress", "doc_complete",
                                    # "doc_warning", "doc_error", "complete"
    data: dict

class ConnectionTestResult(BaseModel):
    success: bool
    provider: str
    collection_exists: bool
    vectors_count: int | None = None
    latency_ms: int | None = None
    error: str | None = None

class GeneralSettings(BaseModel):
    ingestion_mode: IngestionMode = IngestionMode.MANUAL
    auto_ingestion_delay: int = 30
```

### 7.6 Commandes Tauri (Rust) — ajouts

```rust
// desktop/src-tauri/src/commands.rs (ajouts Étape 4)

// Vector store config
#[tauri::command]
pub async fn get_vector_store_config() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn update_vector_store_config(config: serde_json::Value) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn reset_vector_store_config() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn test_vector_store_connection() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn get_collection_stats() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn delete_collection() -> Result<serde_json::Value, String> { ... }

// Ingestion control
#[tauri::command]
pub async fn start_ingestion(incremental: bool) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn pause_ingestion() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn resume_ingestion() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn cancel_ingestion() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn get_ingestion_status() -> Result<serde_json::Value, String> { ... }

// Changes & History
#[tauri::command]
pub async fn detect_changes() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn get_ingestion_history(limit: Option<u32>) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn restore_ingestion_version(version: String) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn get_ingestion_log(version: Option<String>) -> Result<serde_json::Value, String> { ... }

// General settings
#[tauri::command]
pub async fn get_general_settings() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn update_general_settings(settings: serde_json::Value) -> Result<serde_json::Value, String> { ... }
```

**SSE depuis Tauri** : pour le flux SSE de progression, le frontend utilise directement `EventSource` vers le backend Python (contournant le bridge Rust), car Tauri ne supporte pas nativement le relais SSE :

```typescript
// desktop/src/hooks/useIngestionProgress.ts
const eventSource = new EventSource(
  `http://localhost:${backendPort}/api/ingestion/progress/stream`
);
eventSource.addEventListener("progress", (event) => {
  const data = JSON.parse(event.data);
  setProgress(data);
});
```

### 7.7 Composants React — arborescence

```
desktop/src/
├── components/
│   ├── settings/
│   │   ├── IngestionSettings.tsx              ← existant (Étape 1)
│   │   ├── ChunkingSettings.tsx               ← existant (Étape 2)
│   │   ├── EmbeddingSettings.tsx              ← existant (Étape 3)
│   │   ├── VectorStoreSettings.tsx            ← NOUVEAU : section complète
│   │   ├── VectorStoreProviderSelector.tsx    ← NOUVEAU : sélecteur Qdrant/Chroma
│   │   ├── CollectionConfig.tsx               ← NOUVEAU : nom, mode, chemin
│   │   ├── HNSWParamsPanel.tsx                ← NOUVEAU : paramètres HNSW dépliable
│   │   ├── GeneralSettings.tsx                ← NOUVEAU : Paramètres généraux
│   │   └── ReingestionWarning.tsx             ← NOUVEAU : modal avertissement
│   ├── dashboard/
│   │   ├── Dashboard.tsx                      ← MODIFIER : activer (plus de placeholder)
│   │   ├── KnowledgeBaseStatus.tsx            ← NOUVEAU : panneau état de la base
│   │   ├── ChangeDetectionPanel.tsx           ← NOUVEAU : changements détectés
│   │   ├── IngestionProgressPanel.tsx         ← NOUVEAU : progression temps réel
│   │   ├── IngestionHistoryTable.tsx          ← NOUVEAU : historique des versions
│   │   ├── IngestionLogPanel.tsx              ← NOUVEAU : journal scrollable
│   │   └── IngestionControls.tsx              ← NOUVEAU : boutons lancer/pause/annuler
│   └── ui/
│       ├── ProgressBar.tsx                    ← NOUVEAU : barre de progression
│       ├── PhaseIndicator.tsx                 ← NOUVEAU : indicateur de phase pipeline
│       ├── DurationDisplay.tsx                ← NOUVEAU : affichage temps écoulé/restant
│       ├── ConfirmDialog.tsx                  ← NOUVEAU : modal de confirmation générique
│       └── ... (existants)
├── hooks/
│   ├── useVectorStoreConfig.ts                ← NOUVEAU : hook config BDD vectorielle
│   ├── useIngestionControl.ts                 ← NOUVEAU : hook lancer/pause/annuler
│   ├── useIngestionProgress.ts                ← NOUVEAU : hook SSE progression
│   ├── useChangeDetection.ts                  ← NOUVEAU : hook détection changements
│   ├── useIngestionHistory.ts                 ← NOUVEAU : hook historique
│   ├── useGeneralSettings.ts                  ← NOUVEAU : hook paramètres généraux
│   └── ... (existants)
├── lib/
│   └── ipc.ts                                 ← MODIFIER : ajouter routes vector store + ingestion
└── locales/
    ├── fr.json                                ← MODIFIER : ajouter clés dashboard + vector store
    └── en.json                                ← MODIFIER : ajouter clés dashboard + vector store
```

### 7.8 Persistance

La config vector store est stockée dans `settings.json` :

```json
{
  "version": "1.0.0",
  "setup_completed": true,
  "profile": "legal_compliance",
  "ingestion": { "...": "..." },
  "chunking": { "...": "..." },
  "embedding": { "...": "..." },
  "vector_store": {
    "provider": "qdrant",
    "mode": "persistent",
    "path": "~/.ragkit/data/qdrant/",
    "collection_name": "ragkit_default",
    "distance_metric": "cosine",
    "hnsw": {
      "ef_construction": 200,
      "m": 24,
      "ef_search": 200
    },
    "snapshot_retention": 5
  },
  "general": {
    "ingestion_mode": "manual",
    "auto_ingestion_delay": 30
  }
}
```

### 7.9 Dépendances Python ajoutées

```toml
# pyproject.toml — ajouts aux dependencies pour Étape 4
dependencies = [
    # ... (existants Étapes 0-3)
    "qdrant-client>=1.6",           # Client Qdrant (mode local embarqué)
    "chromadb>=0.4",                # ChromaDB (alternative légère)
    "watchdog>=3.0",                # Surveillance du système de fichiers
]
```

---

## 8. Critères d'acceptation

### 8.1 Fonctionnels

| # | Critère |
|---|---------|
| F1 | La section `PARAMÈTRES > Paramètres avancés > BASE DE DONNÉES VECTORIELLE` est accessible et affiche tous les paramètres |
| F2 | Le sélecteur de provider propose Qdrant et ChromaDB avec fiches descriptives |
| F3 | Les paramètres HNSW n'apparaissent que pour Qdrant (visibilité conditionnelle) |
| F4 | Le mode `memory` masque le champ `path` et affiche un avertissement |
| F5 | Le bouton "Tester la connexion" vérifie l'accès au provider vectoriel |
| F6 | Les statistiques de la collection (vecteurs, dimensions, taille) s'affichent en temps réel |
| F7 | La section `PARAMÈTRES > Paramètres généraux` affiche le mode d'ingestion (Manuel / Automatique) |
| F8 | Le TABLEAU DE BORD affiche l'état de la base de connaissances (source, index, dernière ingestion) |
| F9 | Le panneau "Changements détectés" liste les fichiers ajoutés, modifiés et supprimés |
| F10 | Le bouton "Lancer l'ingestion" déclenche le pipeline complet (parsing → chunking → embedding → stockage) |
| F11 | Le bouton "Ingestion incrémentale" ne traite que les changements détectés |
| F12 | La barre de progression se met à jour en temps réel (pourcentage, document courant, phase) |
| F13 | Le temps écoulé et le temps restant estimé s'affichent pendant l'ingestion |
| F14 | Les compteurs (réussis, avertissements, échecs) se mettent à jour en temps réel |
| F15 | Le bouton "Pause" suspend l'ingestion à la fin du document en cours |
| F16 | Le bouton "Annuler" stoppe l'ingestion après confirmation |
| F17 | L'historique des ingestions affiche toutes les versions avec statut |
| F18 | Le bouton "Restaurer" permet de revenir à une version précédente |
| F19 | Le journal d'ingestion affiche le détail de chaque document traité |
| F20 | En mode Automatique, l'ingestion se déclenche après le délai de stabilisation |
| F21 | La modification d'un paramètre critique affiche l'avertissement de réingestion |
| F22 | Le badge "Modifié" apparaît à côté de chaque paramètre modifié |
| F23 | Le bouton "Réinitialiser au profil" restaure les valeurs par défaut |
| F24 | Tous les textes sont traduits FR/EN via i18n |

### 8.2 Techniques

| # | Critère |
|---|---------|
| T1 | `GET /api/vector-store/config` retourne la config courante |
| T2 | `PUT /api/vector-store/config` valide et persiste les modifications |
| T3 | `POST /api/vector-store/config/reset` restaure les valeurs du profil actif |
| T4 | Le provider Qdrant fonctionne en mode `persistent` (données survivent au redémarrage) |
| T5 | Le provider ChromaDB fonctionne en mode `persistent` |
| T6 | Le provider Qdrant fonctionne en mode `memory` |
| T7 | Le pipeline complet parsing → chunking → embedding → stockage fonctionne pour un document PDF |
| T8 | Le pipeline fonctionne pour un document DOCX |
| T9 | Le pipeline fonctionne pour un document Markdown |
| T10 | L'ingestion incrémentale ne traite que les fichiers nouveaux/modifiés |
| T11 | L'ingestion incrémentale supprime les vecteurs des fichiers supprimés |
| T12 | Les vecteurs stockés ont le bon nombre de dimensions (cohérence avec le modèle d'embedding) |
| T13 | Le payload de chaque vecteur contient toutes les métadonnées requises |
| T14 | Le flux SSE `/api/ingestion/progress/stream` émet les événements de progression |
| T15 | La pause suspend effectivement le traitement (aucun nouveau document n'est traité) |
| T16 | L'annulation stoppe le pipeline sans corrompre l'index |
| T17 | Les snapshots sont créés avant chaque ingestion |
| T18 | La restauration d'un snapshot restaure effectivement l'index à l'état précédent |
| T19 | Le FileWatcher détecte les ajouts, modifications et suppressions de fichiers |
| T20 | Le délai de stabilisation (debounce) fonctionne correctement |
| T21 | Le registre d'ingestion (`ingestion_registry.db`) est correctement mis à jour |
| T22 | La config vector store est persistée dans `settings.json` sous la clé `vector_store` |
| T23 | `tsc --noEmit` ne produit aucune erreur TypeScript |
| T24 | Le CI passe sur les 4 targets (lint + build) |

---

## 9. Périmètre exclus (Étape 4)

- **Recherche** (sémantique, lexicale, hybride) : sera ajoutée aux Étapes 5-7.
- **Chat fonctionnel** : le chat reste un placeholder.
- **Reranking** : Étape 8.
- **Génération LLM** : Étape 9.
- **Quantification des vecteurs** (scalar, binary) : amélioration future.
- **Sharding et réplication** : non pertinent pour une application desktop locale.
- **Filtrage pré-recherche sur métadonnées** : sera ajouté avec la recherche (Étape 5).
- **Ingestion multi-thread** (traitement parallèle de plusieurs documents) : amélioration future — le pipeline traite les documents séquentiellement à cette étape.
- **Migration entre providers** (Qdrant ↔ Chroma sans réingestion) : non supporté, réingestion nécessaire.

---

## 10. Estimation

| Tâche | Effort estimé |
|-------|---------------|
| Schéma Pydantic `VectorStoreConfig` + `IngestionConfig` + validation | 0.5 jour |
| Abstraction `BaseVectorStore` + interface commune | 0.5 jour |
| Implémentation `QdrantVectorStore` (init, upsert, delete, stats, snapshot, restore) | 2 jours |
| Implémentation `ChromaVectorStore` (init, upsert, delete, stats, snapshot, restore) | 1.5 jours |
| `IngestionOrchestrator` (pipeline complet avec monitoring) | 2.5 jours |
| `IngestionRegistry` (SQLite : registre documents + historique) | 1 jour |
| `FileWatcher` (watchdog + debounce + filtrage patterns) | 1 jour |
| Détection de changements (comparaison hash source ↔ registre) | 0.5 jour |
| Endpoint SSE `/api/ingestion/progress/stream` | 1 jour |
| Routes API vector store (config CRUD + test + stats + delete) | 1 jour |
| Routes API ingestion (start/pause/resume/cancel + changes + history + log) | 1.5 jours |
| Routes API paramètres généraux | 0.5 jour |
| Commandes Tauri (Rust) — vector store + ingestion + general settings | 1 jour |
| Composant `VectorStoreSettings.tsx` (orchestrateur section) | 1 jour |
| Composant `GeneralSettings.tsx` (mode d'ingestion) | 0.5 jour |
| Composant `Dashboard.tsx` (activation + layout) | 0.5 jour |
| Composant `KnowledgeBaseStatus.tsx` (état de la base) | 0.5 jour |
| Composant `ChangeDetectionPanel.tsx` (changements détectés) | 1 jour |
| Composant `IngestionProgressPanel.tsx` (barre + phases + temps) + hook SSE | 1.5 jours |
| Composant `IngestionControls.tsx` (lancer, pause, annuler, incrémental) | 0.5 jour |
| Composant `IngestionHistoryTable.tsx` (historique + restauration) | 1 jour |
| Composant `IngestionLogPanel.tsx` (journal scrollable + export) | 0.5 jour |
| Composant `ReingestionWarning.tsx` (modal paramètres critiques) | 0.5 jour |
| Composants UI (`ProgressBar`, `PhaseIndicator`, `DurationDisplay`, `ConfirmDialog`) | 1 jour |
| Hooks (`useVectorStoreConfig`, `useIngestionControl`, `useIngestionProgress`, etc.) | 1 jour |
| Traductions i18n (FR + EN) — dashboard + vector store + ingestion | 0.5 jour |
| Tests unitaires vector stores (Qdrant + Chroma, mode memory pour tests) | 1.5 jours |
| Tests unitaires orchestrateur (pipeline, pause, cancel, incrémental) | 1.5 jours |
| Tests FileWatcher (mock filesystem events) | 0.5 jour |
| Tests d'intégration (pipeline complet parsing → stockage, 3 formats) | 1.5 jours |
| Tests SSE (flux de progression, événements) | 0.5 jour |
| Tests manuels + corrections | 1.5 jours |
| **Total** | **~29 jours** |
