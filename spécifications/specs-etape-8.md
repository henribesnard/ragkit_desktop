# 🧰 RAGKIT Desktop — Spécifications Étape 8 : Reranking

> **Étape** : 8 — Reranking  
> **Tag cible** : `v0.9.0`  
> **Date** : 17 février 2026  
> **Dépôt** : https://github.com/henribesnard/ragkit_desktop.git  
> **Prérequis** : Étape 7 (Recherche hybride) implémentée et validée

---

## 1. Objectif

Ajouter une **couche de réordonnancement intelligent** (reranking) des résultats de recherche pour améliorer significativement la pertinence finale des chunks sélectionnés. Le reranking utilise un modèle **cross-encoder** qui évalue finement la pertinence de chaque paire (requête, chunk) avec une compréhension contextuelle bien supérieure à la similarité vectorielle seule.

Cette étape livre :
- Une section `PARAMÈTRES > Paramètres avancés > RERANKING` complète et fonctionnelle.
- Deux **providers de reranking** : **Cohere** (cloud, `rerank-v3.5`) et **Local** (HuggingFace cross-encoder, ex : `BAAI/bge-reranker-v2-m3`).
- L'intégration dans le **pipeline de retrieval complet** : recherche (sémantique / lexicale / hybride) → **reranking** → résultats finaux.
- Un **mode debug enrichi** montrant les scores **avant et après** reranking pour chaque chunk, avec les changements de classement.
- Un bouton **"Tester le reranker"** dans les paramètres pour valider la connexion et la qualité du réordonnancement.
- La gestion sécurisée de la **clé API Cohere** via le système de secrets existant (Étape 3).

Le reranking est **optionnel** et désactivé par défaut pour les profils qui n'en ont pas besoin. Quand il est activé, il apporte typiquement **+20-40% de précision** sur la pertinence des résultats.

**Pas de génération LLM** à cette étape. Le pipeline de retrieval est maintenant complet : recherche → fusion → reranking → résultats bruts. Le LLM sera ajouté à l'Étape 9.

---

## 2. Spécifications fonctionnelles

### 2.1 Section PARAMÈTRES > Paramètres avancés > RERANKING

#### Structure de l'onglet PARAMÈTRES à cette étape

```
PARAMÈTRES
├── Paramètres généraux
│   ├── Mode d'ingestion (Manuel / Automatique)          ← Étape 4
│   └── Type de recherche (Sémantique / Lexicale / Hybride)  ← Étape 7
└── Paramètres avancés
    ├── INGESTION & PRÉPROCESSING                         ← Étape 1
    ├── CHUNKING                                          ← Étape 2
    ├── EMBEDDING                                         ← Étape 3
    ├── BASE DE DONNÉES VECTORIELLE                       ← Étape 4
    ├── RECHERCHE SÉMANTIQUE                              ← Étape 5
    ├── RECHERCHE LEXICALE                                ← Étape 6
    ├── RECHERCHE HYBRIDE                                 ← Étape 7
    └── RERANKING                                         ← NOUVEAU
```

#### Layout de la section RERANKING

```
┌─────────────────────────────────────────────────────────────────┐
│  RERANKING                                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Activation ──────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  ☑ Activer le reranking                                   │ │
│  │                                                            │ │
│  │  ℹ️ Le reranking ré-évalue la pertinence de chaque         │ │
│  │  résultat en utilisant un modèle cross-encoder. Il         │ │
│  │  améliore significativement la qualité du classement       │ │
│  │  (+20-40% de précision) au prix d'une latence              │ │
│  │  supplémentaire.                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Provider et modèle ─────────────────────────────────────┐  │
│  │                                                            │ │
│  │  ┌─────────────────────────┐  ┌──────────────────────────┐│ │
│  │  │  ☁️ Cohere               │  │  🖥 Local (HuggingFace)  ││ │
│  │  │                         │  │                          ││ │
│  │  │  API cloud, rapide,     │  │  Modèle cross-encoder    ││ │
│  │  │  multilingue.           │  │  exécuté localement.     ││ │
│  │  │  Nécessite une clé API. │  │  Gratuit, données 100%  ││ │
│  │  │                         │  │  locales.                ││ │
│  │  │  ✓ SÉLECTIONNÉ         │  │                          ││ │
│  │  └─────────────────────────┘  └──────────────────────────┘│ │
│  │                                                            │ │
│  │  Modèle : [▾ rerank-v3.5                            ]     │ │
│  │                                                            │ │
│  │  ┌── Fiche modèle ──────────────────────────────────────┐ │ │
│  │  │  📏 Contexte max : 4 096 tokens                      │ │ │
│  │  │  🌐 Langues : Multilingue (100+)                     │ │ │
│  │  │  💰 Coût : ~$1 / 1 000 recherches                   │ │ │
│  │  │  ⚡ Latence : ~200-500 ms pour 40 candidats          │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │  Clé API Cohere : [••••••••••••••••] [👁] [✓ Valide]     │ │
│  │                                                            │ │
│  │  [🔌 Tester la connexion]                                  │ │
│  │  ✅ Connexion réussie — rerank-v3.5 · 320 ms              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Paramètres de sélection ────────────────────────────────┐  │
│  │                                                            │ │
│  │  Candidats envoyés au reranker :  [========◆==] 40        │ │
│  │  Résultats finaux après reranking (top_n) : [◆========] 5 │ │
│  │  Seuil de pertinence :            [◆=========] 0.0        │ │
│  │                                                            │ │
│  │  ℹ️ Le reranker reçoit les N meilleurs candidats de la     │ │
│  │  recherche, les ré-évalue, et retourne les top_n les      │ │
│  │  plus pertinents. Un seuil > 0 exclut les résultats       │ │
│  │  jugés non pertinents par le reranker.                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Test du reranker ───────────────────────────────────────┐  │
│  │                                                            │ │
│  │  Requête test :                                           │ │
│  │  [conditions de résiliation du contrat              ]     │ │
│  │                                                            │ │
│  │  Document test 1 :                                        │ │
│  │  [L'article 12 définit les conditions de résiliation]     │ │
│  │                                                            │ │
│  │  Document test 2 :                                        │ │
│  │  [Le contrat prend effet à la date de signature     ]     │ │
│  │                                                            │ │
│  │  [▶ Tester le reranking]                                   │ │
│  │                                                            │ │
│  │  Résultats :                                              │ │
│  │  #1 Doc 1 — Score : 0.987 — ✅ Très pertinent            │ │
│  │  #2 Doc 2 — Score : 0.124 — ❌ Peu pertinent             │ │
│  │  Latence : 287 ms                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ▸ Paramètres avancés                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Batch size :        [=◆========] 10                       │ │
│  │  Timeout (secondes) :[===◆======] 30                       │ │
│  │  Max retries :       [◆=========] 2                        │ │
│  │  ☐ Mode debug activé par défaut                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [↻ Réinitialiser au profil]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Providers de reranking

#### 2.2.1 Cohere (cloud)

| Propriété | Détail |
|-----------|--------|
| **Provider** | `cohere` |
| **Modèles** | `rerank-v3.5` (recommandé), `rerank-v3.0`, `rerank-multilingual-v3.0` |
| **Authentification** | Clé API Cohere (stockée via le système de secrets Étape 3) |
| **Protocole** | REST API `https://api.cohere.com/v2/rerank` |
| **Contexte max** | 4 096 tokens par document |
| **Langues** | 100+ langues (multilingue natif) |
| **Latence** | ~200-500 ms pour 40 candidats |
| **Coût** | ~$1 pour 1 000 recherches (40 candidats chacune) |
| **Score** | 0.0 – 1.0 (probabilité de pertinence) |

#### 2.2.2 Local (HuggingFace cross-encoder)

| Propriété | Détail |
|-----------|--------|
| **Provider** | `local` |
| **Modèles** | `BAAI/bge-reranker-v2-m3` (recommandé, multilingue), `cross-encoder/ms-marco-MiniLM-L-6-v2` (anglais, rapide) |
| **Authentification** | Aucune (modèle local) |
| **Backend** | `sentence-transformers` ou ONNX Runtime |
| **Contexte max** | 512 tokens (modèle dépendant) |
| **Langues** | Multilingue (bge-reranker) ou anglais seul (ms-marco) |
| **Latence** | ~500-2000 ms pour 40 candidats (CPU), ~100-300 ms (GPU) |
| **Coût** | Gratuit |
| **Score** | Logit brut, normalisé par sigmoid → 0.0–1.0 |
| **Téléchargement** | Automatique au premier usage dans `~/.ragkit/models/` |

#### 2.2.3 Comparaison des providers

| Critère | Cohere | Local |
|---------|--------|-------|
| Qualité | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Latence | ⭐⭐⭐⭐ (200-500 ms) | ⭐⭐⭐ (500-2000 ms CPU) |
| Confidentialité | ☁️ Données envoyées cloud | ✅ 100% local |
| Coût | 💰 ~$1/1000 recherches | 🆓 Gratuit |
| Configuration | Clé API requise | Aucune |
| Multilingue | ✅ 100+ langues | ✅ (bge-reranker) |

### 2.3 Intégration dans le pipeline de retrieval

Le reranking s'insère **après** la recherche (ou la fusion hybride) et **avant** la présentation des résultats :

```
Requête utilisateur
    │
    ▼
┌──────────────────────────────┐
│  RECHERCHE                   │
│  (Sémantique / Lexicale /   │
│   Hybride)                   │
│  → `candidates` résultats    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  RERANKING (si activé)       │
│                              │
│  Pour chaque candidat :      │
│    score = reranker(query, chunk)  │
│                              │
│  1. Trier par score desc     │
│  2. Filtrer < threshold      │
│  3. Tronquer à top_n        │
└──────────────┬───────────────┘
               │
               ▼
         Résultats finaux
         (top_n résultats rerankés)
```

**Points clés** :
- Le nombre de `candidates` envoyés au reranker est contrôlé séparément du `top_k` de la recherche. Par défaut, `candidates = 40` signifie que les 40 meilleurs résultats de la recherche sont envoyés au reranker.
- Le `top_n` détermine le nombre de résultats finaux après reranking. Typiquement `top_n ≪ candidates` (ex : top_n=5, candidates=40).
- Si le reranking est **désactivé**, le pipeline court-circuite directement vers les résultats de la recherche/fusion avec le `top_k` configuré (comportement Étape 7).

### 2.4 Coordination des top_k / candidates / top_n

La relation entre les différents paramètres `top_k` du pipeline est la suivante :

```
search.semantic.top_k (ex: 15)    ──┐
                                     ├── fusion → hybrid.top_k (ex: 10)
search.lexical.top_k (ex: 15)     ──┘
                                          │
                        (si reranking désactivé → résultats finaux)
                                          │
                        (si reranking activé :)
                                          │
                                  rerank.candidates (ex: 40)
                                          │
                                  reranker évalue les 40 candidats
                                          │
                                  rerank.top_n (ex: 5) → résultats finaux
```

**Ajustement automatique** : si `rerank.enabled = true`, le `hybrid.top_k` (ou `semantic.top_k` / `lexical.top_k` selon le mode) est automatiquement ajusté pour fournir au moins `rerank.candidates` résultats au reranker. Un warning s'affiche si `candidates > hybrid.top_k` :

> ⚠️ Le reranker attend 40 candidats mais la recherche hybride ne retourne que 10 résultats. Les paramètres top_k de la recherche seront automatiquement étendus.

### 2.5 Affichage des résultats après reranking

Quand le reranking est actif, l'affichage des résultats dans le chat est enrichi :

```
┌─────────────────────────────────────────────────────────────────┐
│  ── Résultats pour "conditions de résiliation" ───────────────  │
│  ── Mode : Hybride + Reranking · 5 résultats · 542 ms ──────  │
│                                                                 │
│  ┌── Résultat #1 ──────── Rerank : 0.987 (was #3) ──────────┐ │
│  │                                                            │ │
│  │  📄 contrat-service-2024.pdf · Page 8                     │ │
│  │                                                            │ │
│  │  "Les conditions de résiliation anticipée sont définies    │ │
│  │  à l'article 12 du présent contrat..."                     │ │
│  │                                                            │ │
│  │  📁 Juridique · 🏷 contrat, résiliation · 🌐 fr          │ │
│  │                                                            │ │
│  │  📊 Avant : #3 (score fusion 0.0245)                      │ │
│  │  📊 Après : #1 (score rerank 0.987) ▲+2                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Résultat #2 ──────── Rerank : 0.934 (was #1) ──────────┐ │
│  │                                                            │ │
│  │  📄 CGV-2024.pdf · Page 3                                 │ │
│  │                                                            │ │
│  │  "Article 7 — Résiliation..."                              │ │
│  │                                                            │ │
│  │  📊 Avant : #1 (score fusion 0.0312)                      │ │
│  │  📊 Après : #2 (score rerank 0.934) ▼-1                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Mode debug (si activé) ─────────────────────────────────┐ │
│  │  Pipeline : Hybride (α=0.50, RRF) → Reranking (cohere)   │ │
│  │  Candidats envoyés : 40 · Retenus : 5 · Éliminés : 35    │ │
│  │  Seuil : 0.0 · Reranker : rerank-v3.5                    │ │
│  │  Latence recherche : 287 ms · Latence reranking : 255 ms  │ │
│  │  Latence totale : 542 ms                                   │ │
│  │                                                            │ │
│  │  Mouvement top 5 :                                         │ │
│  │  #1 contrat-service  : fusion #3 → rerank #1 (0.987) ▲+2 │ │
│  │  #2 CGV-2024         : fusion #1 → rerank #2 (0.934) ▼-1 │ │
│  │  #3 avenant-2023     : fusion #5 → rerank #3 (0.891) ▲+2 │ │
│  │  #4 guide-juridique  : fusion #2 → rerank #4 (0.756) ▼-2 │ │
│  │  #5 faq-résiliation  : fusion #8 → rerank #5 (0.623) ▲+3 │ │
│  │                                                            │ │
│  │  Éliminés (< seuil ou hors top_n) :                       │ │
│  │  fusion #4 (0.024) → rerank score 0.089                   │ │
│  │  fusion #6 (0.019) → rerank score 0.045                   │ │
│  │  ...                                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Indicateurs de mouvement

Chaque résultat affiche un indicateur de changement de rang :

| Indicateur | Signification |
|------------|---------------|
| `▲+2` | Le chunk a gagné 2 positions grâce au reranking |
| `▼-1` | Le chunk a perdu 1 position |
| `═` | Le chunk n'a pas changé de position |
| `(was #3)` | Le rang original avant reranking |

Le badge de score affiche le **score du reranker** (0–1) au lieu du score de fusion/similarité.

### 2.6 Test du reranker

Le panneau "Test du reranker" dans les paramètres permet de valider la qualité du réordonnancement :

**Fonctionnement** :
1. L'utilisateur entre une requête test et deux documents tests (pré-remplis avec des exemples adaptés au profil).
2. Le bouton "Tester le reranking" envoie la paire (requête, [doc1, doc2]) au reranker.
3. Le résultat affiche les deux documents reclassés avec leur score et un qualificatif (Très pertinent / Pertinent / Peu pertinent).

**Qualificatifs de score** :

| Score | Qualificatif | Couleur |
|-------|-------------|---------|
| 0.80 — 1.0 | Très pertinent | Vert |
| 0.50 — 0.80 | Pertinent | Vert clair |
| 0.20 — 0.50 | Modéré | Orange |
| 0.0 — 0.20 | Peu pertinent | Rouge |

---

## 3. Catalogue complet des paramètres RERANKING

### 3.1 Paramètres principaux

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Activé | `rerank.enabled` | bool | — | — | Selon profil | Activer/désactiver le reranking |
| Provider | `rerank.provider` | enum | — | — | Selon profil | `cohere` \| `local` \| `none` |
| Modèle | `rerank.model` | string | — | — | Selon profil | Modèle de reranking |

### 3.2 Paramètres de sélection

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Candidats | `rerank.candidates` | int | 5 | 200 | 40 | Nombre de résultats envoyés au reranker |
| Top N | `rerank.top_n` | int | 1 | 50 | 5 | Nombre de résultats finaux après reranking |
| Seuil de pertinence | `rerank.relevance_threshold` | float | 0.0 | 1.0 | Selon profil | Score minimum du reranker pour retenir un résultat. 0.0 = pas de filtre. |

### 3.3 Paramètres avancés

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Batch size | `rerank.batch_size` | int | 1 | 100 | 10 | Nombre de documents par batch pour le reranking |
| Timeout | `rerank.timeout` | int | 5 | 120 | 30 | Timeout en secondes pour l'appel au reranker |
| Max retries | `rerank.max_retries` | int | 0 | 5 | 2 | Nombre de tentatives en cas d'erreur |
| Debug | `rerank.debug_default` | bool | — | — | `false` | Mode debug par défaut |

### 3.4 Visibilité conditionnelle

| Paramètre | Condition de visibilité |
|-----------|------------------------|
| Tous les paramètres sauf `enabled` | `enabled == true` |
| Champ clé API | `provider == "cohere"` |
| Sélecteur de modèle | `provider != "none"` |
| Fiche modèle | Un modèle est sélectionné |
| Panneau test | `enabled == true` et connexion testée avec succès |

### 3.5 Catalogue des modèles

#### Cohere

| Modèle | Clé | Contexte max | Langues | Qualité | Latence |
|--------|-----|:---:|---------|:---:|:---:|
| Rerank v3.5 | `rerank-v3.5` | 4 096 tokens | 100+ | ⭐⭐⭐⭐⭐ | ~300 ms |
| Rerank v3.0 | `rerank-v3.0` | 4 096 tokens | 100+ | ⭐⭐⭐⭐ | ~250 ms |
| Rerank multilingual v3 | `rerank-multilingual-v3.0` | 4 096 tokens | 100+ | ⭐⭐⭐⭐ | ~300 ms |

#### Local (HuggingFace)

| Modèle | Clé | Contexte max | Langues | Qualité | Taille |
|--------|-----|:---:|---------|:---:|:---:|
| BGE Reranker v2 M3 | `BAAI/bge-reranker-v2-m3` | 512 tokens | Multilingue | ⭐⭐⭐⭐ | ~1.1 Go |
| MS MARCO MiniLM | `cross-encoder/ms-marco-MiniLM-L-6-v2` | 512 tokens | Anglais | ⭐⭐⭐ | ~80 Mo |
| BGE Reranker Large | `BAAI/bge-reranker-large` | 512 tokens | Anglais + Chinois | ⭐⭐⭐⭐ | ~1.3 Go |

### 3.6 Résumé des impacts

| Paramètre | Impact principal | Impact secondaire |
|-----------|-----------------|-------------------|
| `enabled` | Active/désactive toute la couche de reranking | Latence : +200-2000 ms quand activé |
| `provider` | Qualité et confidentialité du reranking | Cohere = cloud + coût, Local = gratuit + confidentiel |
| `model` | Qualité du réordonnancement, langues supportées | Taille du modèle (local) |
| `candidates` | **IMPORTANT** — Plus de candidats = meilleure chance de trouver les chunks les plus pertinents | Latence proportionnelle au nombre de candidats |
| `top_n` | Nombre de résultats finaux. **IMPORTANT** — Doit être ≤ `candidates`. | Détermine le contexte disponible pour le LLM (Étape 9) |
| `relevance_threshold` | Filtre les résultats peu pertinents | Risque de retourner < top_n résultats si seuil trop élevé |

---

## 4. Valeurs par défaut par profil

### 4.1 Matrice profil → paramètres de reranking

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|:---:|:---:|:---:|:---:|:---:|
| `enabled` | `true` | `false` | `true` | `false` | `false` |
| `provider` | `cohere` | `none` | `cohere` | `none` | `none` |
| `model` | `rerank-v3.5` | — | `rerank-v3.5` | — | — |
| `candidates` | 40 | — | 40 | — | — |
| `top_n` | 5 | — | 5 | — | — |
| `relevance_threshold` | 0.0 | — | 0.1 | — | — |
| `batch_size` | 10 | 10 | 10 | 10 | 10 |
| `timeout` | 30 | 30 | 30 | 30 | 30 |
| `max_retries` | 2 | 2 | 2 | 2 | 2 |
| `debug_default` | `false` | `false` | `false` | `false` | `false` |

### 4.2 Justification des choix

- **`technical_documentation` → `enabled=true`** : la doc technique contient souvent des chunks de qualité variable (code mélangé avec du texte, headers répétitifs). Le reranking permet de remonter les chunks les plus informatifs. Le `relevance_threshold=0.0` ne filtre rien car même les résultats moyens peuvent contenir des informations utiles.
- **`faq_support` → `enabled=false`** : les bases FAQ sont petites et les réponses sont courtes et directes. Avec `top_k=5` et un seuil sémantique à 0.3, le reranking n'apporte pas assez de valeur pour justifier la latence et le coût supplémentaires.
- **`legal_compliance` → `enabled=true`, `relevance_threshold=0.1`** : le contexte juridique nécessite une pertinence maximale. Le seuil non nul élimine les résultats faiblement pertinents qui pourraient induire en erreur. Le reranking est critique pour la qualité dans ce domaine.
- **`reports_analysis` → `enabled=false`** : les rapports sont interrogés avec des questions conceptuelles larges. La recherche hybride (alpha=0.6) est généralement suffisante. Le reranking peut être activé manuellement si nécessaire.
- **`general` → `enabled=false`** : le profil généraliste ne présuppose pas un besoin de précision maximale. Le reranking est disponible mais désactivé pour garder la configuration simple.

---

## 5. Spécifications techniques

### 5.1 Schéma Pydantic (backend)

```python
# ragkit/config/rerank_schema.py
"""Pydantic schemas for reranking configuration."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field, model_validator


class RerankProvider(str, Enum):
    COHERE = "cohere"
    LOCAL = "local"
    NONE = "none"


class RerankConfig(BaseModel):
    """Reranking configuration."""

    enabled: bool = False
    provider: RerankProvider = RerankProvider.NONE
    model: str | None = None

    # Selection
    candidates: int = Field(default=40, ge=5, le=200)
    top_n: int = Field(default=5, ge=1, le=50)
    relevance_threshold: float = Field(default=0.0, ge=0.0, le=1.0)

    # Advanced
    batch_size: int = Field(default=10, ge=1, le=100)
    timeout: int = Field(default=30, ge=5, le=120)
    max_retries: int = Field(default=2, ge=0, le=5)
    debug_default: bool = False

    @model_validator(mode="after")
    def validate_top_n_vs_candidates(self) -> "RerankConfig":
        if self.top_n > self.candidates:
            raise ValueError(
                f"top_n ({self.top_n}) must be <= candidates ({self.candidates})"
            )
        return self

    @model_validator(mode="after")
    def validate_provider_model(self) -> "RerankConfig":
        if self.enabled and self.provider == RerankProvider.NONE:
            raise ValueError("Provider must be set when reranking is enabled")
        if self.enabled and self.provider != RerankProvider.NONE and not self.model:
            raise ValueError("Model must be set when reranking is enabled")
        return self
```

### 5.2 Abstraction Reranker (backend)

```python
# ragkit/retrieval/reranker/base.py
"""Abstract base class for rerankers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class RerankCandidate:
    """Input candidate for reranking."""
    chunk_id: str
    text: str
    original_rank: int
    original_score: float
    metadata: dict


@dataclass
class RerankResult:
    """Output result from reranking."""
    chunk_id: str
    text: str
    rerank_score: float           # 0.0 – 1.0
    original_rank: int
    original_score: float
    rank_change: int              # new_rank - original_rank (negative = improved)
    metadata: dict


@dataclass
class RerankTestResult:
    """Result from a reranking test."""
    success: bool
    results: list[dict]           # [{text, score, rank}]
    latency_ms: int
    model: str
    error: str | None = None


class BaseReranker(ABC):
    """Abstract base for reranking providers."""

    @abstractmethod
    async def rerank(
        self,
        query: str,
        candidates: list[RerankCandidate],
        top_n: int,
        relevance_threshold: float = 0.0,
    ) -> list[RerankResult]:
        """Rerank candidates and return top_n results."""
        ...

    @abstractmethod
    async def test_connection(self) -> RerankTestResult:
        """Test the reranker connection with sample data."""
        ...
```

### 5.3 Provider Cohere (backend)

```python
# ragkit/retrieval/reranker/cohere_reranker.py
"""Cohere reranking provider."""

from __future__ import annotations

import time

import httpx

from ragkit.config.rerank_schema import RerankConfig
from ragkit.retrieval.reranker.base import (
    BaseReranker, RerankCandidate, RerankResult, RerankTestResult,
)


class CohereReranker(BaseReranker):
    """Cohere Rerank API provider."""

    API_URL = "https://api.cohere.com/v2/rerank"

    def __init__(self, config: RerankConfig, api_key: str):
        self.config = config
        self.api_key = api_key

    async def rerank(
        self,
        query: str,
        candidates: list[RerankCandidate],
        top_n: int,
        relevance_threshold: float = 0.0,
    ) -> list[RerankResult]:
        documents = [c.text for c in candidates]

        async with httpx.AsyncClient(timeout=self.config.timeout) as client:
            response = await client.post(
                self.API_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.config.model,
                    "query": query,
                    "documents": documents,
                    "top_n": len(candidates),  # Get all scores, filter later
                    "return_documents": False,
                },
            )
            response.raise_for_status()
            data = response.json()

        # Parse results
        scored = []
        for item in data["results"]:
            idx = item["index"]
            candidate = candidates[idx]
            scored.append(RerankResult(
                chunk_id=candidate.chunk_id,
                text=candidate.text,
                rerank_score=item["relevance_score"],
                original_rank=candidate.original_rank,
                original_score=candidate.original_score,
                rank_change=0,  # Computed below
                metadata=candidate.metadata,
            ))

        # Sort by rerank score desc
        scored.sort(key=lambda x: x.rerank_score, reverse=True)

        # Filter by threshold
        scored = [r for r in scored if r.rerank_score >= relevance_threshold]

        # Truncate to top_n
        scored = scored[:top_n]

        # Compute rank changes
        for new_rank, result in enumerate(scored, 1):
            result.rank_change = result.original_rank - new_rank

        return scored

    async def test_connection(self) -> RerankTestResult:
        t_start = time.perf_counter()
        try:
            results = await self.rerank(
                query="test query",
                candidates=[
                    RerankCandidate("1", "relevant doc about the test query", 1, 0.9, {}),
                    RerankCandidate("2", "unrelated doc about cooking recipes", 2, 0.8, {}),
                ],
                top_n=2,
            )
            latency = int((time.perf_counter() - t_start) * 1000)
            return RerankTestResult(
                success=True,
                results=[
                    {"text": r.text[:80], "score": r.rerank_score, "rank": i + 1}
                    for i, r in enumerate(results)
                ],
                latency_ms=latency,
                model=self.config.model or "",
            )
        except Exception as e:
            return RerankTestResult(
                success=False, results=[], latency_ms=0,
                model=self.config.model or "", error=str(e),
            )
```

### 5.4 Provider Local HuggingFace (backend)

```python
# ragkit/retrieval/reranker/local_reranker.py
"""Local cross-encoder reranking provider."""

from __future__ import annotations

import time
from pathlib import Path

import numpy as np
import torch
from sentence_transformers import CrossEncoder

from ragkit.config.rerank_schema import RerankConfig
from ragkit.retrieval.reranker.base import (
    BaseReranker, RerankCandidate, RerankResult, RerankTestResult,
)


class LocalReranker(BaseReranker):
    """Local HuggingFace cross-encoder reranker."""

    MODELS_DIR = Path("~/.ragkit/models/").expanduser()

    def __init__(self, config: RerankConfig):
        self.config = config
        self._model: CrossEncoder | None = None

    def _load_model(self) -> CrossEncoder:
        if self._model is None:
            device = "cuda" if torch.cuda.is_available() else (
                "mps" if torch.backends.mps.is_available() else "cpu"
            )
            self._model = CrossEncoder(
                self.config.model,
                max_length=512,
                device=device,
                cache_folder=str(self.MODELS_DIR),
            )
        return self._model

    async def rerank(
        self,
        query: str,
        candidates: list[RerankCandidate],
        top_n: int,
        relevance_threshold: float = 0.0,
    ) -> list[RerankResult]:
        model = self._load_model()

        # Build pairs (query, document)
        pairs = [(query, c.text) for c in candidates]

        # Score all pairs in batches
        raw_scores = model.predict(
            pairs,
            batch_size=self.config.batch_size,
            show_progress_bar=False,
        )

        # Normalize with sigmoid to get 0-1 scores
        scores = 1 / (1 + np.exp(-np.array(raw_scores)))

        # Build results
        scored = []
        for i, (candidate, score) in enumerate(zip(candidates, scores)):
            scored.append(RerankResult(
                chunk_id=candidate.chunk_id,
                text=candidate.text,
                rerank_score=float(score),
                original_rank=candidate.original_rank,
                original_score=candidate.original_score,
                rank_change=0,
                metadata=candidate.metadata,
            ))

        scored.sort(key=lambda x: x.rerank_score, reverse=True)
        scored = [r for r in scored if r.rerank_score >= relevance_threshold]
        scored = scored[:top_n]

        for new_rank, result in enumerate(scored, 1):
            result.rank_change = result.original_rank - new_rank

        return scored

    async def test_connection(self) -> RerankTestResult:
        t_start = time.perf_counter()
        try:
            results = await self.rerank(
                query="test query",
                candidates=[
                    RerankCandidate("1", "relevant doc about the test query", 1, 0.9, {}),
                    RerankCandidate("2", "unrelated doc about cooking recipes", 2, 0.8, {}),
                ],
                top_n=2,
            )
            latency = int((time.perf_counter() - t_start) * 1000)
            return RerankTestResult(
                success=True,
                results=[
                    {"text": r.text[:80], "score": r.rerank_score, "rank": i + 1}
                    for i, r in enumerate(results)
                ],
                latency_ms=latency,
                model=self.config.model or "",
            )
        except Exception as e:
            return RerankTestResult(
                success=False, results=[], latency_ms=0,
                model=self.config.model or "", error=str(e),
            )
```

### 5.5 Factory et registre

```python
# ragkit/retrieval/reranker/__init__.py
"""Reranker factory."""

from ragkit.config.rerank_schema import RerankConfig, RerankProvider
from ragkit.retrieval.reranker.base import BaseReranker
from ragkit.retrieval.reranker.cohere_reranker import CohereReranker
from ragkit.retrieval.reranker.local_reranker import LocalReranker


def create_reranker(
    config: RerankConfig,
    api_key: str | None = None,
) -> BaseReranker | None:
    """Create a reranker instance based on config."""
    if not config.enabled or config.provider == RerankProvider.NONE:
        return None
    if config.provider == RerankProvider.COHERE:
        if not api_key:
            raise ValueError("Cohere API key is required")
        return CohereReranker(config, api_key)
    if config.provider == RerankProvider.LOCAL:
        return LocalReranker(config)
    raise ValueError(f"Unknown rerank provider: {config.provider}")
```

### 5.6 Extension du SearchRouter

Le `SearchRouter` (Étape 7) est étendu pour intégrer le reranking :

```python
# ragkit/retrieval/search_router.py — modifications Étape 8

class SearchRouter:
    def __init__(
        self,
        semantic, lexical, hybrid,
        reranker: BaseReranker | None = None,  # ← NOUVEAU
        rerank_config: RerankConfig | None = None,  # ← NOUVEAU
        default_type: SearchType = SearchType.HYBRID,
    ):
        ...
        self.reranker = reranker
        self.rerank_config = rerank_config

    async def search(self, query: str, search_type=None, **kwargs):
        _type = search_type or self.default_type

        # Execute search
        if _type == SearchType.SEMANTIC:
            response = await self.semantic.search(query, **kwargs)
        elif _type == SearchType.LEXICAL:
            response = await self.lexical.search(query, **kwargs)
        else:
            response = await self.hybrid.search(query, **kwargs)

        # Apply reranking if enabled
        if self.reranker and self.rerank_config and self.rerank_config.enabled:
            response = await self._apply_reranking(query, response)

        return response

    async def _apply_reranking(self, query: str, response):
        """Apply reranking to search results."""
        candidates = [
            RerankCandidate(
                chunk_id=r.chunk_id,
                text=r.text,
                original_rank=i + 1,
                original_score=r.score,
                metadata=r.metadata,
            )
            for i, r in enumerate(response.results)
        ]

        reranked = await self.reranker.rerank(
            query=query,
            candidates=candidates[:self.rerank_config.candidates],
            top_n=self.rerank_config.top_n,
            relevance_threshold=self.rerank_config.relevance_threshold,
        )

        # Convert back to response format with rerank metadata
        ...
        return reranked_response
```

### 5.7 API REST (routes backend)

#### 5.7.1 Routes Config reranking

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/rerank/config` | GET | Config reranking courante | — | `RerankConfig` |
| `/api/rerank/config` | PUT | Met à jour la config | `RerankConfig` (partiel) | `RerankConfig` |
| `/api/rerank/config/reset` | POST | Réinitialise au profil actif | — | `RerankConfig` |

#### 5.7.2 Routes Actions reranking

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/rerank/test-connection` | POST | Test de connexion au reranker | — | `RerankTestResult` |
| `/api/rerank/test` | POST | Test de reranking avec données personnalisées | `RerankTestQuery` | `RerankTestResult` |
| `/api/rerank/models` | GET | Liste des modèles disponibles par provider | `?provider=cohere` | `RerankModelInfo[]` |

#### 5.7.3 Modèles de requête et réponse

```python
class RerankTestQuery(BaseModel):
    """Custom rerank test with user-provided data."""
    query: str
    documents: list[str] = Field(..., min_length=2, max_length=10)

class RerankTestResult(BaseModel):
    success: bool
    results: list[RerankTestResultItem]
    latency_ms: int
    model: str
    error: str | None = None

class RerankTestResultItem(BaseModel):
    text: str
    score: float
    rank: int

class RerankModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    max_context: int
    languages: str
    quality_rating: int        # 1-5
    size_mb: int | None        # For local models
    cost_per_1k: str | None    # For cloud models

# Extension du UnifiedSearchResultItem (Étape 7)
class UnifiedSearchResultItem(BaseModel):
    # ... (champs existants Étape 7)

    # Reranking metadata (Étape 8)
    rerank_score: float | None = None
    original_rank: int | None = None
    original_score: float | None = None
    rank_change: int | None = None
    is_reranked: bool = False
```

### 5.8 Commandes Tauri (Rust) — ajouts

```rust
// desktop/src-tauri/src/commands.rs (ajouts Étape 8)

#[tauri::command]
pub async fn get_rerank_config() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn update_rerank_config(config: serde_json::Value) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn reset_rerank_config() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn test_rerank_connection() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn test_rerank(query: serde_json::Value) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn get_rerank_models(provider: String) -> Result<serde_json::Value, String> { ... }
```

### 5.9 Composants React — arborescence

```
desktop/src/
├── components/
│   ├── settings/
│   │   ├── RerankSettings.tsx                 ← NOUVEAU : section complète
│   │   ├── RerankProviderSelector.tsx         ← NOUVEAU : cartes Cohere / Local
│   │   ├── RerankModelSelector.tsx            ← NOUVEAU : dropdown + fiche modèle
│   │   ├── RerankSelectionParams.tsx          ← NOUVEAU : candidates, top_n, threshold
│   │   ├── RerankTestPanel.tsx                ← NOUVEAU : test interactif du reranker
│   │   └── ... (existants)
│   ├── chat/
│   │   ├── RerankIndicator.tsx                ← NOUVEAU : badge "▲+2" / "▼-1"
│   │   ├── RerankDebugPanel.tsx               ← NOUVEAU : debug avant/après
│   │   ├── ChatView.tsx                       ← MODIFIER : intégrer reranking
│   │   └── ... (existants)
│   └── ui/
│       └── ... (existants)
├── hooks/
│   ├── useRerankConfig.ts                     ← NOUVEAU : hook config
│   ├── useRerankTest.ts                       ← NOUVEAU : hook test
│   └── ... (existants)
├── lib/
│   └── ipc.ts                                 ← MODIFIER : ajouter routes rerank
└── locales/
    ├── fr.json                                ← MODIFIER : ajouter clés reranking
    └── en.json                                ← MODIFIER : ajouter clés reranking
```

### 5.10 Persistance

```json
{
  "rerank": {
    "enabled": true,
    "provider": "cohere",
    "model": "rerank-v3.5",
    "candidates": 40,
    "top_n": 5,
    "relevance_threshold": 0.0,
    "batch_size": 10,
    "timeout": 30,
    "max_retries": 2,
    "debug_default": false
  }
}
```

La clé API Cohere est stockée via le système de secrets (Étape 3) sous la clé `cohere_api_key`, et non dans `settings.json`.

### 5.11 Dépendances Python ajoutées

```toml
# pyproject.toml — ajouts pour Étape 8
dependencies = [
    # ... (existants Étapes 0-7)
    "httpx>=0.25",              # Client HTTP async pour Cohere API
    "sentence-transformers>=2.2",  # Cross-encoder pour reranking local
    # torch est déjà une dépendance de sentence-transformers
    # numpy est déjà présent (Étape 3)
]
```

**Note** : `httpx` est utilisé à la place de `requests` pour le support async natif. `sentence-transformers` est la même bibliothèque que celle utilisée pour les embeddings locaux (Étape 3) — elle inclut le support des CrossEncoder.

---

## 6. Critères d'acceptation

### 6.1 Fonctionnels

| # | Critère |
|---|---------|
| F1 | La section `PARAMÈTRES > Paramètres avancés > RERANKING` est accessible et affiche tous les paramètres |
| F2 | Le toggle `enabled` active/désactive le reranking et contrôle la visibilité des autres paramètres |
| F3 | Le sélecteur de provider propose Cohere et Local avec description |
| F4 | Le champ clé API est visible uniquement pour Cohere et le masquage fonctionne |
| F5 | La fiche modèle affiche les caractéristiques (contexte, langues, coût/taille, latence) |
| F6 | Le bouton "Tester la connexion" valide la connexion au reranker |
| F7 | Les sliders `candidates` et `top_n` respectent la contrainte `top_n ≤ candidates` |
| F8 | Le panneau "Test du reranker" fonctionne et affiche les scores avec qualificatifs |
| F9 | Les résultats dans le CHAT affichent le score du reranker quand le reranking est actif |
| F10 | L'indicateur de mouvement (▲/▼/═) est affiché sur chaque résultat rerankés |
| F11 | L'en-tête des résultats indique le pipeline complet (ex : "Hybride + Reranking") |
| F12 | Le mode debug montre les scores avant/après reranking et les mouvements |
| F13 | Un avertissement s'affiche si `candidates > hybrid.top_k` |
| F14 | Si le reranking est désactivé, le pipeline court-circuite et les résultats sont identiques à l'Étape 7 |
| F15 | Le badge "Modifié" apparaît à côté de chaque paramètre modifié |
| F16 | Le bouton "Réinitialiser au profil" restaure les valeurs par défaut |
| F17 | Tous les textes sont traduits FR/EN via i18n |

### 6.2 Techniques

| # | Critère |
|---|---------|
| T1 | `GET /api/rerank/config` retourne la config courante |
| T2 | `PUT /api/rerank/config` valide et persiste les modifications (incluant la contrainte `top_n ≤ candidates`) |
| T3 | `POST /api/rerank/config/reset` restaure les valeurs du profil actif |
| T4 | `POST /api/rerank/test-connection` teste la connexion avec le provider configuré |
| T5 | `POST /api/rerank/test` reranke des documents personnalisés et retourne les scores |
| T6 | Le provider Cohere appelle l'API `https://api.cohere.com/v2/rerank` avec la bonne authentification |
| T7 | Le provider Cohere retourne des scores entre 0.0 et 1.0 |
| T8 | Le provider Local charge le modèle cross-encoder depuis HuggingFace |
| T9 | Le provider Local normalise les logits bruts en scores 0.0–1.0 via sigmoid |
| T10 | Le provider Local détecte et utilise GPU (CUDA/MPS) si disponible |
| T11 | Le `relevance_threshold` filtre correctement les résultats sous le seuil |
| T12 | Le `top_n` tronque correctement les résultats après reranking |
| T13 | Le pipeline complet (recherche → fusion → reranking → résultats) fonctionne de bout en bout |
| T14 | Le pipeline ajuste automatiquement les `top_k` de recherche quand `candidates` est supérieur |
| T15 | Les `rank_change` sont calculés correctement (positif = amélioration, négatif = dégradation) |
| T16 | La clé API Cohere est stockée dans le keyring (pas dans `settings.json`) |
| T17 | La config reranking est persistée dans `settings.json` sous `rerank` |
| T18 | Le timeout et les retries fonctionnent pour le provider Cohere |
| T19 | `tsc --noEmit` ne produit aucune erreur TypeScript |
| T20 | Le CI passe sur les 4 targets (lint + build) |

---

## 7. Périmètre exclus (Étape 8)

- **Génération LLM** : sera ajoutée à l'Étape 9. Le pipeline de retrieval est maintenant complet mais le chat affiche toujours uniquement les résultats bruts.
- **Reranking multi-étapes** (cascade de rerankers rapide puis précis) : amélioration future. Un seul reranker est supporté.
- **Reranking par LLM** (utiliser GPT-4/Claude comme reranker) : amélioration future. Latence élevée et coût important.
- **ColBERT** (interaction fine token-to-token) : amélioration future. Nécessite une infrastructure spécifique.
- **Reranking conditionnel** (activer/désactiver automatiquement selon la confiance de la recherche) : amélioration future.
- **Cache des scores de reranking** (éviter de re-ranker les mêmes paires query-chunk) : amélioration future. Le reranking est rapide et le cache complexifierait le code.
- **Modèles ONNX optimisés** pour le reranking local : amélioration future. sentence-transformers fonctionne en mode PyTorch pour la V1.

---

## 8. Estimation

| Tâche | Effort estimé |
|-------|---------------|
| Schéma Pydantic `RerankConfig` + validation (contrainte top_n ≤ candidates) | 0.5 jour |
| Abstraction `BaseReranker` + dataclasses (`RerankCandidate`, `RerankResult`) | 0.5 jour |
| `CohereReranker` (appel API, parsing, scores, test) | 1.5 jours |
| `LocalReranker` (chargement cross-encoder, scoring, sigmoid, GPU detection) | 2 jours |
| Factory `create_reranker` + registre | 0.5 jour |
| Extension `SearchRouter` (intégration reranking dans le pipeline) | 1 jour |
| Ajustement automatique des top_k quand candidates > top_k | 0.5 jour |
| Routes API config (CRUD) | 0.5 jour |
| Routes API actions (test-connection, test, models) | 1 jour |
| Commandes Tauri (Rust) | 0.5 jour |
| Composant `RerankSettings.tsx` (section paramètres complète) | 1 jour |
| Composants `RerankProviderSelector.tsx`, `RerankModelSelector.tsx` | 1 jour |
| Composant `RerankSelectionParams.tsx` (candidates, top_n, threshold) | 0.5 jour |
| Composant `RerankTestPanel.tsx` (test interactif) | 1 jour |
| Composants chat `RerankIndicator.tsx`, `RerankDebugPanel.tsx` | 1 jour |
| Modification `ChatView.tsx` (affichage résultats rerankés) | 0.5 jour |
| Hooks (`useRerankConfig`, `useRerankTest`) | 0.5 jour |
| Traductions i18n (FR + EN) | 0.5 jour |
| Tests unitaires `CohereReranker` (mock API, scores, erreurs) | 1 jour |
| Tests unitaires `LocalReranker` (chargement, scoring, sigmoid, GPU) | 1 jour |
| Tests unitaires `SearchRouter` (pipeline complet avec reranking) | 0.5 jour |
| Tests d'intégration (recherche → fusion → reranking → résultats) | 1 jour |
| Tests manuels + corrections | 1 jour |
| **Total** | **~18 jours** |
