# 🧰 RAGKIT Desktop — Spécifications Étape 7 : Recherche hybride

> **Étape** : 7 — Recherche hybride  
> **Tag cible** : `v0.8.0`  
> **Date** : 17 février 2026  
> **Dépôt** : https://github.com/henribesnard/ragkit_desktop.git  
> **Prérequis** : Étape 6 (Recherche lexicale) implémentée et validée

---

## 1. Objectif

Fusionner les recherches **sémantique** (Étape 5) et **lexicale** (Étape 6) en une **recherche hybride paramétrable**, offrant le meilleur des deux approches. La recherche hybride est le mode de recherche recommandé pour la plupart des cas d'usage RAG.

Cette étape livre :
- Une section `PARAMÈTRES > Paramètres avancés > RECHERCHE HYBRIDE` complète et fonctionnelle.
- Un **moteur de fusion** supportant deux méthodes : **Reciprocal Rank Fusion (RRF)** et **Weighted Sum** avec normalisation des scores.
- Le paramètre **alpha** : le curseur le plus important du pipeline de recherche, qui contrôle la balance entre sémantique et lexical.
- Un **nouveau paramètre dans Paramètres généraux** : **Type de recherche** (Sémantique seule / Lexicale seule / Hybride), qui détermine le mode par défaut du chat.
- L'ajout du mode **"Hybride"** dans le sélecteur de mode du CHAT (qui ne proposait que Sémantique et Lexicale depuis l'Étape 6).
- Un **mode debug enrichi** montrant les scores issus de chaque source (sémantique et lexicale) et le score fusionné final.
- Un **slider alpha interactif** dans le panneau Options du chat pour tester rapidement différentes balances sans aller dans les paramètres.

**Pas de reranking** à cette étape. Les résultats fusionnés sont affichés directement. Le reranking sera ajouté à l'Étape 8.

---

## 2. Spécifications fonctionnelles

### 2.1 Section PARAMÈTRES > Paramètres avancés > RECHERCHE HYBRIDE

#### Structure de l'onglet PARAMÈTRES à cette étape

```
PARAMÈTRES
├── Paramètres généraux
│   ├── Mode d'ingestion (Manuel / Automatique)          ← Étape 4
│   └── Type de recherche (Sémantique / Lexicale / Hybride)  ← NOUVEAU
└── Paramètres avancés
    ├── INGESTION & PRÉPROCESSING                         ← Étape 1
    ├── CHUNKING                                          ← Étape 2
    ├── EMBEDDING                                         ← Étape 3
    ├── BASE DE DONNÉES VECTORIELLE                       ← Étape 4
    ├── RECHERCHE SÉMANTIQUE                              ← Étape 5
    ├── RECHERCHE LEXICALE                                ← Étape 6
    └── RECHERCHE HYBRIDE                                 ← NOUVEAU
```

#### Layout de la section RECHERCHE HYBRIDE

```
┌─────────────────────────────────────────────────────────────────┐
│  RECHERCHE HYBRIDE                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Balance sémantique / lexicale ───────────────────────────┐ │
│  │                                                            │ │
│  │  Alpha :                                                   │ │
│  │  Lexical ◀ [========◆==========] ▶ Sémantique             │ │
│  │           0.0       0.5        1.0                         │ │
│  │                                                            │ │
│  │  Valeur : 0.50                                             │ │
│  │                                                            │ │
│  │  📊 Poids effectifs :                                      │ │
│  │     🔍 Sémantique : 50%  │  📝 Lexicale : 50%             │ │
│  │                                                            │ │
│  │  ℹ️ Alpha = 0.0 : 100% lexical (mots-clés exacts).         │ │
│  │  Alpha = 1.0 : 100% sémantique (concepts et sens).        │ │
│  │  Valeur recommandée selon votre profil : 0.50              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Méthode de fusion ───────────────────────────────────────┐ │
│  │                                                            │ │
│  │  (•) Reciprocal Rank Fusion (RRF)                         │ │
│  │      Fusionne les rangs plutôt que les scores. Robuste,   │ │
│  │      ne nécessite pas de calibration des échelles.         │ │
│  │                                                            │ │
│  │  ( ) Somme pondérée (Weighted Sum)                        │ │
│  │      Combine les scores normalisés avec les poids          │ │
│  │      semantic.weight et lexical.weight.                    │ │
│  │                                                            │ │
│  │  ℹ️ RRF est recommandé dans la majorité des cas.           │ │
│  │  La somme pondérée offre plus de contrôle si les scores   │ │
│  │  des deux recherches sont bien calibrés.                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Paramètres RRF (si RRF sélectionné) ────────────────────┐ │
│  │                                                            │ │
│  │  Constante k :   [========◆======] 60                     │ │
│  │                                                            │ │
│  │  ℹ️ k contrôle l'importance relative des rangs bas.         │ │
│  │  k élevé = les résultats mal classés dans une source      │ │
│  │  sont moins pénalisés. Défaut : 60.                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Paramètres Somme pondérée (si WS sélectionné) ──────────┐ │
│  │                                                            │ │
│  │  ☑ Normaliser les scores avant fusion                     │ │
│  │                                                            │ │
│  │  Méthode de normalisation : [▾ min-max              ]     │ │
│  │                                                            │ │
│  │  ℹ️ La normalisation met les scores sémantiques (0–1)      │ │
│  │  et BM25 (non bornés) sur une même échelle avant de       │ │
│  │  les combiner.                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ▸ Paramètres avancés                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Nombre de résultats finaux (top_k) : [===◆======] 10     │ │
│  │  Seuil de score minimum :             [◆=========] 0.0    │ │
│  │  ☐ Dédupliquer les résultats                              │ │
│  │  ☐ Mode debug activé par défaut                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [↻ Réinitialiser au profil]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Paramètres généraux — Type de recherche

C'est le **second paramètre** ajouté dans `PARAMÈTRES > Paramètres généraux` (après le mode d'ingestion) :

```
┌─────────────────────────────────────────────────────────────────┐
│  PARAMÈTRES GÉNÉRAUX                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Mode d'ingestion                                 ← Étape 4    │
│  (•) Manuel    ( ) Automatique                                  │
│                                                                 │
│  ─────────────────────────────────────────────────              │
│                                                                 │
│  Type de recherche                                ← NOUVEAU     │
│                                                                 │
│  ( ) Sémantique seule                                           │
│      Recherche par similarité de sens. Idéale pour les          │
│      questions conceptuelles.                                   │
│                                                                 │
│  ( ) Lexicale seule                                             │
│      Recherche par correspondance de mots-clés (BM25).          │
│      Idéale pour les termes exacts.                             │
│                                                                 │
│  (•) Hybride                                                    │
│      Combine les deux approches. Recommandé pour la             │
│      plupart des cas d'usage.                                   │
│                                                                 │
│  ℹ️ Le type de recherche détermine le mode par défaut du chat.   │
│  Vous pouvez toujours changer temporairement dans le chat.      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Comportements** :
- Le type de recherche par défaut est déterminé par le profil :
  - `faq_support` → "Sémantique seule" (car `lexical.enabled = false`, `architecture = semantic`)
  - Tous les autres → "Hybride" (car `architecture` contient `hybrid`)
- Si la recherche lexicale est désactivée (`lexical.enabled = false`), l'option "Lexicale seule" et "Hybride" sont grisées avec un tooltip : "Activez la recherche lexicale dans les paramètres avancés."
- Si la recherche sémantique est désactivée (`semantic.enabled = false`), l'option "Sémantique seule" et "Hybride" sont grisées.
- Le type sélectionné est persisté dans `settings.json` sous `general.search_type`.

### 2.3 Sélecteur de mode dans le CHAT — ajout "Hybride"

Le sélecteur de mode (introduit à l'Étape 6) est enrichi d'une troisième option :

```
┌─────────────────────────────────────────────────┐
│  [▾ 🔀 Hybride ▾]                               │
│                                                  │
│     🔍 Sémantique — Par sens et concepts         │
│     📝 Lexicale — Par mots-clés exacts           │
│  ✓  🔀 Hybride — Combine les deux approches      │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Comportements** :
- Le mode par défaut correspond au "Type de recherche" dans Paramètres généraux.
- Le mode sélectionné est mémorisé pour la session mais pas persisté (il revient au défaut au redémarrage).
- Si le mode hybride est sélectionné, un petit slider alpha apparaît dans les Options du chat pour ajuster la balance en temps réel.

### 2.4 Slider alpha interactif dans le chat

Quand le mode hybride est actif, le panneau Options du chat (⚙) est enrichi d'un slider alpha :

```
┌── ⚙ Options ──────────────────────────────────┐
│                                                │
│  Balance hybride (alpha) :                     │
│  Lexical ◀ [========◆==========] ▶ Sémantique │
│                     0.50                       │
│                                                │
│  Mode debug .................. [  ○  ]         │
│  Résultats par page .......... [▾ 5  ]         │
│  Afficher les scores ......... [  ● ─]         │
│  Afficher les métadonnées .... [  ● ─]         │
│  Afficher la provenance ...... [  ● ─]         │
│                                                │
└────────────────────────────────────────────────┘
```

**Comportements** :
- Le slider alpha dans le chat est un **override temporaire** qui ne modifie pas la config persistée.
- Sa valeur initiale est celle de `retrieval.hybrid.alpha` dans `settings.json`.
- Chaque modification du slider déclenche une nouvelle recherche si une requête est active (debounce 300 ms).
- Un bouton "↻" à côté du slider permet de revenir à la valeur par défaut du profil.

### 2.5 Affichage des résultats hybrides

Les résultats hybrides utilisent un affichage enrichi montrant la **provenance** de chaque résultat :

```
┌─────────────────────────────────────────────────────────────────┐
│  ── Résultats pour "article 12 résiliation" ──────────────────  │
│  ── Mode : Hybride (α=0.50, RRF) · 10 résultats · 287 ms ──  │
│                                                                 │
│  ┌── Résultat #1 ──────────────── Score : 0.0312 ────────────┐ │
│  │                                                            │ │
│  │  📄 contrat-service-2024.pdf · Page 8                     │ │
│  │                                                            │ │
│  │  "Les conditions de résiliation anticipée sont définies    │ │
│  │  à l'article 12 du présent contrat..."                     │ │
│  │                                                            │ │
│  │  📁 Juridique · 🏷 contrat, résiliation · 🌐 fr          │ │
│  │                                                            │ │
│  │  Provenance : 🔍 #1 (0.892) + 📝 #1 (18.42)             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Résultat #2 ──────────────── Score : 0.0289 ────────────┐ │
│  │                                                            │ │
│  │  📄 CGV-2024.pdf · Page 3                                 │ │
│  │                                                            │ │
│  │  "Article 7 — Résiliation..."                              │ │
│  │                                                            │ │
│  │  Provenance : 🔍 #2 (0.847) + 📝 #3 (12.15)             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Résultat #3 ──────────────── Score : 0.0245 ────────────┐ │
│  │                                                            │ │
│  │  📄 guide-juridique.md · Section 4                        │ │
│  │                                                            │ │
│  │  "Les motifs de résiliation amiable incluent..."           │ │
│  │                                                            │ │
│  │  Provenance : 🔍 #4 (0.756) · 📝 absent                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Mode debug (si activé) ─────────────────────────────────┐ │
│  │  Requête : "article 12 résiliation"                       │ │
│  │  Alpha : 0.50 · Méthode : RRF (k=60)                     │ │
│  │                                                            │ │
│  │  Recherche sémantique : 15 résultats · 198 ms            │ │
│  │  Recherche lexicale :   8 résultats · 32 ms              │ │
│  │  Fusion :               18 candidats uniques · 2 ms       │ │
│  │  Résultats finaux :     10 (top_k=10)                    │ │
│  │  Latence totale :       287 ms                            │ │
│  │                                                            │ │
│  │  Détail top 5 :                                            │ │
│  │  #1 contrat-service-2024 : sem=#1(0.892) lex=#1(18.42)   │ │
│  │     → RRF = 1/(60+1) + 1/(60+1) = 0.0328                │ │
│  │  #2 CGV-2024 : sem=#2(0.847) lex=#3(12.15)               │ │
│  │     → RRF = 1/(60+2) + 1/(60+3) = 0.0321                │ │
│  │  #3 guide-juridique : sem=#4(0.756) lex=absent            │ │
│  │     → RRF = 1/(60+4) + 0 = 0.0156                        │ │
│  │  ...                                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Ligne de provenance

Chaque résultat hybride affiche une ligne de **provenance** indiquant son rang et son score dans chaque source :

| Cas | Affichage | Signification |
|-----|-----------|---------------|
| Présent dans les deux | `🔍 #1 (0.892) + 📝 #3 (12.15)` | Rang #1 en sémantique (score 0.892), rang #3 en lexical (score 12.15) |
| Sémantique uniquement | `🔍 #4 (0.756) · 📝 absent` | Présent uniquement en sémantique |
| Lexical uniquement | `🔍 absent · 📝 #2 (15.67)` | Présent uniquement en lexical |

L'affichage de la provenance est contrôlable via le toggle "Afficher la provenance" dans les Options du chat.

---

## 3. Algorithmes de fusion

### 3.1 Reciprocal Rank Fusion (RRF)

RRF fusionne les résultats en se basant sur les **rangs** plutôt que sur les scores. Cela élimine le problème des échelles incompatibles entre les scores sémantiques (0–1) et BM25 (non bornés).

**Formule** :

```
RRF_score(d) = Σ  α_s / (k + rank_s(d))
               s ∈ {semantic, lexical}

où :
  d          = document (chunk)
  s          = source de recherche
  α_s        = poids de la source (dérivé de alpha)
               α_semantic = alpha
               α_lexical  = 1 - alpha
  k          = constante de lissage (défaut : 60)
  rank_s(d)  = rang du document d dans la source s (1-indexé)
               Si d absent de la source s : rank_s(d) = ∞ → contribution = 0
```

**Propriétés** :
- Les scores RRF sont toujours positifs mais petits (typiquement entre 0 et 0.05).
- Un document bien classé dans **les deux** sources a un score RRF élevé.
- Un document absent d'une source ne reçoit aucune contribution de cette source.
- Le paramètre `k` contrôle la "vitesse de décroissance" : `k` élevé → les rangs bas pénalisent moins.

### 3.2 Somme pondérée (Weighted Sum)

La somme pondérée combine directement les **scores** des deux sources après normalisation.

**Formule** :

```
WS_score(d) = α × norm(score_semantic(d)) + (1 - α) × norm(score_lexical(d))

où :
  α                    = paramètre alpha (0.0 – 1.0)
  score_semantic(d)    = score de similarité cosinus (0–1)
  score_lexical(d)     = score BM25 (non borné)
  norm()               = fonction de normalisation
```

**Normalisation** :
- Nécessaire car les scores sémantiques (0–1) et BM25 (0–∞) sont sur des échelles différentes.
- Si normalisation désactivée et méthode = weighted_sum, un avertissement s'affiche.

### 3.3 Méthodes de normalisation

| Méthode | Formule | Propriétés |
|---------|---------|------------|
| **min-max** | `(x - min) / (max - min)` | Normalise sur [0, 1]. Sensible aux outliers. Défaut recommandé. |
| **z-score** | `(x - μ) / σ` | Centre sur 0, écart-type 1. Valeurs non bornées. |

La normalisation est appliquée **séparément** sur les résultats sémantiques et lexicaux avant fusion.

### 3.4 Déduplication

Lorsqu'un chunk apparaît dans les deux sources (sémantique et lexicale), il ne doit apparaître qu'une seule fois dans les résultats fusionnés. La déduplication se fait par `chunk_id` : le chunk reçoit un score fusionné (RRF ou WS) et son rang final est déterminé par ce score.

Si la déduplication est activée dans les paramètres avancés, les chunks quasi-identiques (texte similaire à >95% mais `chunk_id` différent, cas rare de overlapping chunks) sont également fusionnés.

### 3.5 Flux complet de la recherche hybride

```
Requête utilisateur
    │
    ├────────────────────────────┐
    │                            │
    ▼                            ▼
┌──────────────┐        ┌──────────────┐
│  SÉMANTIQUE  │        │   LEXICALE   │
│  (Étape 5)   │        │   (Étape 6)  │
│              │        │              │
│  embed query │        │  tokenize    │
│  search(     │        │  BM25 search │
│    top_k ×   │        │  (top_k)     │
│    prefetch) │        │              │
│  threshold   │        │  threshold   │
│  MMR (opt.)  │        │              │
└──────┬───────┘        └──────┬───────┘
       │                       │
       │  results_semantic     │  results_lexical
       │                       │
       └───────────┬───────────┘
                   │
                   ▼
           ┌──────────────┐
           │    FUSION    │
           │              │
           │  RRF ou WS   │
           │  alpha       │
           │  dedup       │
           │  top_k final │
           └──────┬───────┘
                  │
                  ▼
           Résultats fusionnés
           (avec provenance)
```

---

## 4. Catalogue complet des paramètres RECHERCHE HYBRIDE

### 4.1 Paramètres principaux

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Alpha | `retrieval.hybrid.alpha` | float | 0.0 | 1.0 | Selon profil | Balance sémantique (1.0) ↔ lexical (0.0). **Paramètre le plus critique.** |
| Méthode de fusion | `retrieval.hybrid.fusion_method` | enum | — | — | Selon profil | `rrf` (Reciprocal Rank Fusion) ou `weighted_sum` |

### 4.2 Paramètres RRF

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Constante k | `retrieval.hybrid.rrf_k` | int | 1 | 200 | 60 | Constante de lissage. k élevé = rangs bas moins pénalisés. |

### 4.3 Paramètres Somme pondérée

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Normaliser les scores | `retrieval.hybrid.normalize_scores` | bool | `true` | Normaliser avant fusion |
| Méthode de normalisation | `retrieval.hybrid.normalization_method` | enum | `min_max` | `min_max` ou `z_score` |

### 4.4 Paramètres avancés

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Top K final | `retrieval.hybrid.top_k` | int | 1 | 100 | 10 | Nombre de résultats après fusion. Différent des `top_k` individuels qui contrôlent le nombre de candidats. |
| Seuil de score | `retrieval.hybrid.threshold` | float | 0.0 | — | 0.0 | Score fusionné minimum. 0.0 = pas de filtre. |
| Déduplication | `retrieval.hybrid.deduplicate` | bool | — | — | `true` | Fusionner les résultats identiques |
| Debug | `retrieval.hybrid.debug_default` | bool | — | — | `false` | Mode debug par défaut |

### 4.5 Paramètre général

| Paramètre | Clé config | Type | Options | Défaut | Description |
|-----------|------------|------|---------|--------|-------------|
| Type de recherche | `general.search_type` | enum | `semantic` \| `lexical` \| `hybrid` | Selon profil | Mode de recherche par défaut du chat |

### 4.6 Visibilité conditionnelle

| Paramètre | Condition de visibilité |
|-----------|------------------------|
| Paramètres RRF (`rrf_k`) | `fusion_method == "rrf"` |
| Paramètres Somme pondérée (`normalize_scores`, `normalization_method`) | `fusion_method == "weighted_sum"` |
| `normalization_method` | `normalize_scores == true` |

### 4.7 Résumé des impacts

| Paramètre | Impact principal | Impact secondaire |
|-----------|-----------------|-------------------|
| `alpha` | **CRITIQUE** — Détermine la balance sémantique/lexical. Impact majeur sur la pertinence des résultats. | Aucun impact sur la latence. |
| `fusion_method` | Méthode de combinaison. RRF est plus robuste, WS offre plus de contrôle. | RRF légèrement plus rapide (pas de normalisation). |
| `rrf_k` | Sensibilité aux rangs bas. | Impact marginal sauf cas extrêmes. |
| `normalize_scores` | Mise à l'échelle cohérente pour WS. | Ajout de ~1 ms de latence. |
| `top_k` | Nombre de résultats finaux présentés à l'utilisateur. | — |
| `deduplicate` | Évite les résultats en double. | Réduit potentiellement le nombre de résultats (<top_k). |

---

## 5. Valeurs par défaut par profil

### 5.1 Matrice profil → paramètres de recherche hybride

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|:---:|:---:|:---:|:---:|:---:|
| `alpha` | 0.3 | 0.8 | 0.4 | 0.6 | 0.5 |
| `fusion_method` | `rrf` | `weighted_sum` | `rrf` | `rrf` | `rrf` |
| `rrf_k` | 60 | 60 | 60 | 60 | 60 |
| `normalize_scores` | `true` | `true` | `true` | `true` | `true` |
| `normalization_method` | `min_max` | `min_max` | `min_max` | `min_max` | `min_max` |
| `top_k` | 10 | 5 | 15 | 10 | 10 |
| `threshold` | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| `deduplicate` | `true` | `true` | `true` | `true` | `true` |
| `debug_default` | `false` | `false` | `false` | `false` | `false` |

### 5.2 Matrice profil → type de recherche par défaut

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|:---:|:---:|:---:|:---:|:---:|
| `general.search_type` | `hybrid` | `semantic` | `hybrid` | `hybrid` | `hybrid` |

### 5.3 Justification des choix

- **`technical_documentation` → `alpha=0.3`** : la documentation technique contient beaucoup de termes exacts (noms de fonctions, codes produit, numéros de version). Un alpha bas favorise le lexical qui excelle pour ces cas, tout en gardant 30% de sémantique pour les questions conceptuelles.
- **`faq_support` → `alpha=0.8`, `weighted_sum`** : les FAQ sont interrogées avec des questions en langage naturel, rarement avec des termes exacts. Alpha élevé favorise le sémantique. La somme pondérée est utilisée car avec `weight=1.0` sémantique et `weight=0.0` lexical, RRF n'apporte rien (une seule source).
- **`legal_compliance` → `alpha=0.4`** : le juridique bénéficie d'un bon équilibre avec une légère préférence lexicale pour les références d'articles, numéros de loi, etc.
- **`reports_analysis` → `alpha=0.6`** : les rapports sont interrogés avec des questions conceptuelles ("évolution du CA", "risques identifiés") qui bénéficient du sémantique, mais les termes financiers précis nécessitent du lexical.
- **Tous `rrf_k=60`** : valeur standard de la littérature qui fonctionne bien dans la grande majorité des cas.
- **`faq_support` → `search_type=semantic`** : comme la recherche lexicale est désactivée pour ce profil, le type par défaut est sémantique seule.

---

## 6. Spécifications techniques

### 6.1 Schéma Pydantic (backend)

```python
# ragkit/config/hybrid_schema.py
"""Pydantic schemas for hybrid search configuration."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class FusionMethod(str, Enum):
    RRF = "rrf"
    WEIGHTED_SUM = "weighted_sum"


class NormalizationMethod(str, Enum):
    MIN_MAX = "min_max"
    Z_SCORE = "z_score"


class SearchType(str, Enum):
    SEMANTIC = "semantic"
    LEXICAL = "lexical"
    HYBRID = "hybrid"


class HybridSearchConfig(BaseModel):
    """Hybrid search (fusion) configuration."""

    alpha: float = Field(default=0.5, ge=0.0, le=1.0,
        description="Balance semantic (1.0) vs lexical (0.0)")
    fusion_method: FusionMethod = FusionMethod.RRF

    # RRF
    rrf_k: int = Field(default=60, ge=1, le=200)

    # Weighted sum
    normalize_scores: bool = True
    normalization_method: NormalizationMethod = NormalizationMethod.MIN_MAX

    # Advanced
    top_k: int = Field(default=10, ge=1, le=100)
    threshold: float = Field(default=0.0, ge=0.0)
    deduplicate: bool = True
    debug_default: bool = False
```

### 6.2 Moteur de fusion (backend)

```python
# ragkit/retrieval/hybrid_engine.py
"""Hybrid search engine — fuses semantic and lexical results."""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np

from ragkit.config.hybrid_schema import (
    HybridSearchConfig, FusionMethod, NormalizationMethod,
)
from ragkit.retrieval.semantic_engine import (
    SemanticSearchEngine, SearchResult as SemanticResult,
)
from ragkit.retrieval.lexical_engine import (
    LexicalSearchEngine, BM25SearchResult as LexicalResult,
)


@dataclass
class HybridSearchResult:
    """A single result from hybrid search with provenance."""
    chunk_id: str
    score: float                      # Fused score
    text: str
    metadata: dict

    # Provenance
    semantic_rank: int | None = None  # 1-indexed, None if absent
    semantic_score: float | None = None
    lexical_rank: int | None = None
    lexical_score: float | None = None
    matched_terms: dict[str, int] = field(default_factory=dict)

    # Standard fields
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
class HybridDebugInfo:
    """Debug information for a hybrid search."""
    query_text: str
    alpha: float
    fusion_method: str
    rrf_k: int | None
    semantic_results_count: int
    semantic_latency_ms: int
    lexical_results_count: int
    lexical_latency_ms: int
    unique_candidates: int
    fusion_latency_ms: int
    final_results_count: int
    total_latency_ms: int
    detail: list[dict] | None = None  # Per-result breakdown


@dataclass
class HybridSearchResponse:
    """Complete response from a hybrid search."""
    query: str
    results: list[HybridSearchResult]
    total_results: int
    debug: HybridDebugInfo | None = None


class HybridSearchEngine:
    """Fuses semantic and lexical search results."""

    def __init__(
        self,
        config: HybridSearchConfig,
        semantic_engine: SemanticSearchEngine,
        lexical_engine: LexicalSearchEngine,
    ):
        self.config = config
        self.semantic = semantic_engine
        self.lexical = lexical_engine

    async def search(
        self,
        query: str,
        alpha: float | None = None,
        top_k: int | None = None,
        threshold: float | None = None,
        filters: dict | None = None,
        include_debug: bool = False,
    ) -> HybridSearchResponse:
        """Execute a hybrid search: semantic + lexical → fusion."""

        _alpha = alpha if alpha is not None else self.config.alpha
        _top_k = top_k or self.config.top_k
        _threshold = threshold if threshold is not None else self.config.threshold

        t_start = time.perf_counter()

        # 1. Run both searches in parallel
        import asyncio
        t_sem_start = time.perf_counter()
        sem_task = asyncio.create_task(
            self.semantic.search(query, filters=filters)
        )
        t_lex_start = time.perf_counter()
        lex_task = asyncio.create_task(
            self.lexical.search(query, filters=filters)
        )

        sem_response = await sem_task
        t_sem = time.perf_counter() - t_sem_start
        lex_response = await lex_task
        t_lex = time.perf_counter() - t_lex_start

        # 2. Fuse results
        t_fusion_start = time.perf_counter()
        if self.config.fusion_method == FusionMethod.RRF:
            fused = self._fuse_rrf(
                sem_response.results,
                lex_response.results,
                _alpha,
            )
        else:
            fused = self._fuse_weighted_sum(
                sem_response.results,
                lex_response.results,
                _alpha,
            )
        t_fusion = time.perf_counter() - t_fusion_start

        # 3. Apply threshold
        fused = [r for r in fused if r.score >= _threshold]

        # 4. Truncate to top_k
        final = fused[:_top_k]
        t_total = time.perf_counter() - t_start

        debug = None
        if include_debug:
            debug = HybridDebugInfo(
                query_text=query,
                alpha=_alpha,
                fusion_method=self.config.fusion_method.value,
                rrf_k=self.config.rrf_k if self.config.fusion_method == FusionMethod.RRF else None,
                semantic_results_count=len(sem_response.results),
                semantic_latency_ms=int(t_sem * 1000),
                lexical_results_count=len(lex_response.results),
                lexical_latency_ms=int(t_lex * 1000),
                unique_candidates=len(fused),
                fusion_latency_ms=int(t_fusion * 1000),
                final_results_count=len(final),
                total_latency_ms=int(t_total * 1000),
                detail=self._build_debug_detail(final) if include_debug else None,
            )

        return HybridSearchResponse(
            query=query,
            results=final,
            total_results=len(final),
            debug=debug,
        )

    def _fuse_rrf(
        self,
        semantic_results: list,
        lexical_results: list,
        alpha: float,
    ) -> list[HybridSearchResult]:
        """Reciprocal Rank Fusion."""
        k = self.config.rrf_k
        alpha_sem = alpha
        alpha_lex = 1 - alpha

        # Build lookup: chunk_id → (rank, score, result)
        sem_lookup = {
            r.chunk_id: (i + 1, r.score, r)
            for i, r in enumerate(semantic_results)
        }
        lex_lookup = {
            r.chunk_id: (i + 1, r.score, r)
            for i, r in enumerate(lexical_results)
        }

        # Collect all unique chunk IDs
        all_ids = set(sem_lookup.keys()) | set(lex_lookup.keys())

        scored = []
        for chunk_id in all_ids:
            sem_rank, sem_score, sem_result = sem_lookup.get(chunk_id, (None, None, None))
            lex_rank, lex_score, lex_result = lex_lookup.get(chunk_id, (None, None, None))

            rrf_score = 0.0
            if sem_rank is not None:
                rrf_score += alpha_sem / (k + sem_rank)
            if lex_rank is not None:
                rrf_score += alpha_lex / (k + lex_rank)

            # Merge metadata from whichever source has the result
            source = sem_result or lex_result
            matched_terms = {}
            if lex_result and hasattr(lex_result, "matched_terms"):
                matched_terms = lex_result.matched_terms

            scored.append(HybridSearchResult(
                chunk_id=chunk_id,
                score=rrf_score,
                text=source.text,
                metadata=source.metadata,
                semantic_rank=sem_rank,
                semantic_score=sem_score,
                lexical_rank=lex_rank,
                lexical_score=lex_score,
                matched_terms=matched_terms,
                doc_title=source.doc_title,
                doc_path=source.doc_path,
                doc_type=source.doc_type,
                page_number=source.page_number,
                chunk_index=source.chunk_index,
                chunk_total=source.chunk_total,
                section_header=source.section_header,
                doc_language=source.doc_language,
                category=source.category,
                keywords=source.keywords,
            ))

        scored.sort(key=lambda x: x.score, reverse=True)
        return scored

    def _fuse_weighted_sum(
        self,
        semantic_results: list,
        lexical_results: list,
        alpha: float,
    ) -> list[HybridSearchResult]:
        """Weighted sum fusion with optional score normalization."""

        # Normalize scores
        sem_scores = [r.score for r in semantic_results]
        lex_scores = [r.score for r in lexical_results]

        if self.config.normalize_scores and sem_scores and lex_scores:
            sem_scores = self._normalize(sem_scores)
            lex_scores = self._normalize(lex_scores)

        sem_lookup = {
            r.chunk_id: (sem_scores[i], r)
            for i, r in enumerate(semantic_results)
        }
        lex_lookup = {
            r.chunk_id: (lex_scores[i], r)
            for i, r in enumerate(lexical_results)
        }

        all_ids = set(sem_lookup.keys()) | set(lex_lookup.keys())

        scored = []
        for chunk_id in all_ids:
            sem_norm, sem_result = sem_lookup.get(chunk_id, (0.0, None))
            lex_norm, lex_result = lex_lookup.get(chunk_id, (0.0, None))

            ws_score = alpha * sem_norm + (1 - alpha) * lex_norm

            source = sem_result or lex_result
            sem_raw = semantic_results[
                next(i for i, r in enumerate(semantic_results) if r.chunk_id == chunk_id)
            ].score if sem_result else None
            lex_raw = lexical_results[
                next(i for i, r in enumerate(lexical_results) if r.chunk_id == chunk_id)
            ].score if lex_result else None

            scored.append(HybridSearchResult(
                chunk_id=chunk_id,
                score=ws_score,
                text=source.text,
                metadata=source.metadata,
                semantic_rank=next(
                    (i + 1 for i, r in enumerate(semantic_results) if r.chunk_id == chunk_id), None
                ),
                semantic_score=sem_raw,
                lexical_rank=next(
                    (i + 1 for i, r in enumerate(lexical_results) if r.chunk_id == chunk_id), None
                ),
                lexical_score=lex_raw,
                matched_terms=getattr(lex_result, "matched_terms", {}) if lex_result else {},
                doc_title=source.doc_title,
                doc_path=source.doc_path,
                doc_type=source.doc_type,
                page_number=source.page_number,
                chunk_index=source.chunk_index,
                chunk_total=source.chunk_total,
                section_header=source.section_header,
                doc_language=source.doc_language,
                category=source.category,
                keywords=source.keywords,
            ))

        scored.sort(key=lambda x: x.score, reverse=True)
        return scored

    def _normalize(self, scores: list[float]) -> list[float]:
        """Normalize scores using configured method."""
        arr = np.array(scores)
        if self.config.normalization_method == NormalizationMethod.MIN_MAX:
            mn, mx = arr.min(), arr.max()
            if mx - mn < 1e-10:
                return [0.5] * len(scores)
            return ((arr - mn) / (mx - mn)).tolist()
        else:  # z_score
            mu, sigma = arr.mean(), arr.std()
            if sigma < 1e-10:
                return [0.0] * len(scores)
            return ((arr - mu) / sigma).tolist()
```

### 6.3 Routeur de recherche (backend)

Le routeur de recherche est le composant central qui dispatche vers le bon moteur selon le mode sélectionné :

```python
# ragkit/retrieval/search_router.py
"""Search router — dispatches to the correct engine based on search type."""

from __future__ import annotations

from ragkit.config.hybrid_schema import SearchType
from ragkit.retrieval.semantic_engine import SemanticSearchEngine
from ragkit.retrieval.lexical_engine import LexicalSearchEngine
from ragkit.retrieval.hybrid_engine import HybridSearchEngine


class SearchRouter:
    """Routes search queries to the appropriate engine."""

    def __init__(
        self,
        semantic: SemanticSearchEngine,
        lexical: LexicalSearchEngine,
        hybrid: HybridSearchEngine,
        default_type: SearchType = SearchType.HYBRID,
    ):
        self.semantic = semantic
        self.lexical = lexical
        self.hybrid = hybrid
        self.default_type = default_type

    async def search(
        self,
        query: str,
        search_type: SearchType | None = None,
        **kwargs,
    ):
        """Execute a search using the specified or default engine."""
        _type = search_type or self.default_type

        if _type == SearchType.SEMANTIC:
            return await self.semantic.search(query, **kwargs)
        elif _type == SearchType.LEXICAL:
            return await self.lexical.search(query, **kwargs)
        else:
            return await self.hybrid.search(query, **kwargs)
```

### 6.4 API REST (routes backend)

#### 6.4.1 Routes Config hybride

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/retrieval/hybrid/config` | GET | Config recherche hybride courante | — | `HybridSearchConfig` |
| `/api/retrieval/hybrid/config` | PUT | Met à jour la config | `HybridSearchConfig` (partiel) | `HybridSearchConfig` |
| `/api/retrieval/hybrid/config/reset` | POST | Réinitialise au profil actif | — | `HybridSearchConfig` |

#### 6.4.2 Route Recherche unifiée

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/search` | POST | Recherche unifiée (route vers le bon moteur) | `UnifiedSearchQuery` | `UnifiedSearchResponse` |

Cette route **remplace** l'utilisation directe de `/api/search/semantic` et `/api/search/lexical` depuis le chat. Les routes spécialisées restent disponibles pour un usage programmatique, mais le chat utilise désormais la route unifiée.

#### 6.4.3 Route Paramètres généraux (extension)

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/settings/general` | PUT | Met à jour (extension avec `search_type`) | `GeneralSettings` | `GeneralSettings` |

#### 6.4.4 Modèles de requête et réponse

```python
class UnifiedSearchQuery(BaseModel):
    """Unified search query — dispatched to the right engine."""
    query: str = Field(..., min_length=1, max_length=2000)
    search_type: SearchType | None = None  # Override general setting
    alpha: float | None = None             # Override hybrid alpha
    top_k: int | None = None
    threshold: float | None = None
    filters: SearchFilters | None = None
    include_debug: bool = False
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=5, ge=1, le=50)

class UnifiedSearchResponse(BaseModel):
    """Unified response — wraps semantic, lexical, or hybrid response."""
    query: str
    search_type: str                       # "semantic", "lexical", "hybrid"
    results: list[UnifiedSearchResultItem]
    total_results: int
    page: int
    page_size: int
    has_more: bool
    debug: dict | None = None              # Type-specific debug info

class UnifiedSearchResultItem(BaseModel):
    chunk_id: str
    score: float
    text: str
    text_preview: str

    # Provenance (hybrid only)
    semantic_rank: int | None = None
    semantic_score: float | None = None
    lexical_rank: int | None = None
    lexical_score: float | None = None
    matched_terms: dict[str, int] | None = None

    # Standard metadata
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

class GeneralSettings(BaseModel):
    """Extended general settings with search type."""
    ingestion_mode: str = "manual"
    auto_ingestion_delay: int = 30
    search_type: SearchType = SearchType.HYBRID   # ← NOUVEAU
```

### 6.5 Commandes Tauri (Rust) — ajouts

```rust
// desktop/src-tauri/src/commands.rs (ajouts Étape 7)

// Hybrid config
#[tauri::command]
pub async fn get_hybrid_search_config() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn update_hybrid_search_config(config: serde_json::Value) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn reset_hybrid_search_config() -> Result<serde_json::Value, String> { ... }

// Unified search (replaces direct semantic/lexical calls from chat)
#[tauri::command]
pub async fn unified_search(query: serde_json::Value) -> Result<serde_json::Value, String> { ... }
```

### 6.6 Composants React — arborescence

```
desktop/src/
├── components/
│   ├── settings/
│   │   ├── HybridSearchSettings.tsx           ← NOUVEAU : section complète
│   │   ├── AlphaSlider.tsx                    ← NOUVEAU : slider alpha avec visualisation
│   │   ├── FusionMethodSelector.tsx           ← NOUVEAU : sélecteur RRF / Weighted Sum
│   │   ├── RRFParamsPanel.tsx                 ← NOUVEAU : paramètres RRF (k)
│   │   ├── WeightedSumParamsPanel.tsx         ← NOUVEAU : normalisation
│   │   ├── GeneralSettings.tsx                ← MODIFIER : ajouter Type de recherche
│   │   └── ... (existants)
│   ├── chat/
│   │   ├── SearchModeSelector.tsx             ← MODIFIER : ajouter option "Hybride"
│   │   ├── ChatOptions.tsx                    ← MODIFIER : ajouter slider alpha
│   │   ├── HybridResultCard.tsx               ← NOUVEAU : carte résultat avec provenance
│   │   ├── ProvenanceBadge.tsx                ← NOUVEAU : badge provenance (sem + lex)
│   │   ├── HybridDebugPanel.tsx               ← NOUVEAU : debug enrichi (detail par source)
│   │   ├── ChatView.tsx                       ← MODIFIER : dispatch via SearchRouter
│   │   └── ... (existants)
│   └── ui/
│       ├── AlphaSliderCompact.tsx             ← NOUVEAU : slider compact pour le chat
│       └── ... (existants)
├── hooks/
│   ├── useHybridSearchConfig.ts               ← NOUVEAU : hook config hybride
│   ├── useUnifiedSearch.ts                    ← NOUVEAU : hook recherche unifiée
│   └── ... (existants)
├── lib/
│   └── ipc.ts                                 ← MODIFIER : ajouter routes hybrid + unified
└── locales/
    ├── fr.json                                ← MODIFIER : ajouter clés hybride
    └── en.json                                ← MODIFIER : ajouter clés hybride
```

### 6.7 Détail du composant `AlphaSlider.tsx`

```tsx
interface AlphaSliderProps {
  value: float;
  onChange: (value: float) => void;
  profileDefault: float;
  showReset?: boolean;
  compact?: boolean;           // Compact mode for chat Options
}

export function AlphaSlider({
  value, onChange, profileDefault, showReset = true, compact = false,
}: AlphaSliderProps) {
  const pctSemantic = Math.round(value * 100);
  const pctLexical = 100 - pctSemantic;

  return (
    <div className={compact ? "space-y-1" : "space-y-3"}>
      {!compact && <label className="font-medium">Alpha</label>}

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">📝 Lexical</span>
        <input
          type="range"
          min={0} max={1} step={0.05}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1"
        />
        <span className="text-xs text-gray-500">🔍 Sémantique</span>
      </div>

      <div className="flex justify-between text-xs text-gray-400">
        <span>📝 {pctLexical}%</span>
        <span className="font-mono">{value.toFixed(2)}</span>
        <span>🔍 {pctSemantic}%</span>
      </div>

      {/* Visual weight bars */}
      {!compact && (
        <div className="flex h-2 rounded overflow-hidden">
          <div
            className="bg-amber-400"
            style={{ width: `${pctLexical}%` }}
          />
          <div
            className="bg-blue-400"
            style={{ width: `${pctSemantic}%` }}
          />
        </div>
      )}

      {showReset && value !== profileDefault && (
        <button
          onClick={() => onChange(profileDefault)}
          className="text-xs text-blue-500 hover:underline"
        >
          ↻ Revenir au profil ({profileDefault})
        </button>
      )}
    </div>
  );
}
```

### 6.8 Persistance

La config de recherche hybride est stockée dans `settings.json` :

```json
{
  "general": {
    "ingestion_mode": "manual",
    "auto_ingestion_delay": 30,
    "search_type": "hybrid"
  },
  "retrieval": {
    "architecture": "hybrid_rerank",
    "semantic": { "...": "..." },
    "lexical": { "...": "..." },
    "hybrid": {
      "alpha": 0.5,
      "fusion_method": "rrf",
      "rrf_k": 60,
      "normalize_scores": true,
      "normalization_method": "min_max",
      "top_k": 10,
      "threshold": 0.0,
      "deduplicate": true,
      "debug_default": false
    }
  }
}
```

### 6.9 Dépendances Python ajoutées

```toml
# pyproject.toml — ajouts pour Étape 7
dependencies = [
    # ... (existants Étapes 0-6)
    # Aucune nouvelle dépendance requise.
    # numpy (Étape 3) est utilisé pour la normalisation.
    # Les moteurs sémantique (Étape 5) et lexical (Étape 6)
    # sont réutilisés directement.
]
```

---

## 7. Critères d'acceptation

### 7.1 Fonctionnels

| # | Critère |
|---|---------|
| F1 | La section `PARAMÈTRES > Paramètres avancés > RECHERCHE HYBRIDE` est accessible et affiche tous les paramètres |
| F2 | Le slider alpha est fonctionnel avec affichage des pourcentages sémantique/lexical |
| F3 | Le sélecteur de méthode de fusion propose RRF et Somme pondérée |
| F4 | Les paramètres RRF (`rrf_k`) ne sont visibles que lorsque RRF est sélectionné |
| F5 | Les paramètres Somme pondérée (`normalize_scores`, `normalization_method`) ne sont visibles que lorsque WS est sélectionné |
| F6 | `PARAMÈTRES > Paramètres généraux` affiche le sélecteur de type de recherche |
| F7 | Les options "Lexicale seule" et "Hybride" sont grisées si la recherche lexicale est désactivée |
| F8 | Le sélecteur de mode dans le CHAT propose désormais 3 options : Sémantique, Lexicale, Hybride |
| F9 | Le mode par défaut du sélecteur correspond au "Type de recherche" des Paramètres généraux |
| F10 | Le slider alpha interactif apparaît dans les Options du chat quand le mode hybride est actif |
| F11 | Modifier le slider alpha dans le chat relance la recherche (debounce 300 ms) |
| F12 | Les résultats hybrides affichent la ligne de provenance (rang + score par source) |
| F13 | Le toggle "Afficher la provenance" dans Options contrôle l'affichage de la provenance |
| F14 | Le mode debug affiche les détails par source et le calcul de fusion |
| F15 | La fusion RRF produit des résultats cohérents (un chunk bien classé dans les deux sources est en tête) |
| F16 | La fusion Weighted Sum produit des résultats cohérents |
| F17 | Un chunk présent uniquement dans une source apparaît quand même dans les résultats fusionnés |
| F18 | Le badge "Modifié" apparaît à côté de chaque paramètre modifié |
| F19 | Le bouton "Réinitialiser au profil" restaure les valeurs par défaut |
| F20 | Tous les textes sont traduits FR/EN via i18n |

### 7.2 Techniques

| # | Critère |
|---|---------|
| T1 | `GET /api/retrieval/hybrid/config` retourne la config courante |
| T2 | `PUT /api/retrieval/hybrid/config` valide et persiste les modifications |
| T3 | `POST /api/retrieval/hybrid/config/reset` restaure les valeurs du profil actif |
| T4 | `POST /api/search` dispatche vers le bon moteur selon `search_type` |
| T5 | La recherche hybride exécute les recherches sémantique et lexicale en **parallèle** (asyncio) |
| T6 | L'algorithme RRF est conforme à la formule documentée |
| T7 | L'algorithme Weighted Sum combine correctement les scores normalisés |
| T8 | La normalisation min-max produit des scores dans [0, 1] |
| T9 | La normalisation z-score centre les scores sur 0 |
| T10 | La déduplication fusionne les chunks identiques (même `chunk_id`) |
| T11 | Un chunk absent d'une source reçoit une contribution de 0 pour cette source |
| T12 | Le paramètre alpha modifie effectivement le poids relatif (alpha=0 → résultats identiques au lexical seul) |
| T13 | Le paramètre alpha modifie effectivement le poids relatif (alpha=1 → résultats identiques au sémantique seul) |
| T14 | Le `top_k` hybride tronque correctement les résultats après fusion |
| T15 | Le seuil de score filtre les résultats fusionnés |
| T16 | La config hybride est persistée dans `settings.json` sous `retrieval.hybrid` |
| T17 | Le `search_type` est persisté dans `settings.json` sous `general.search_type` |
| T18 | La latence de la fusion (hors recherches individuelles) est < 10 ms pour 100 candidats |
| T19 | `tsc --noEmit` ne produit aucune erreur TypeScript |
| T20 | Le CI passe sur les 4 targets (lint + build) |

---

## 8. Périmètre exclus (Étape 7)

- **Reranking** : sera ajouté à l'Étape 8. Les résultats fusionnés sont présentés directement.
- **Génération LLM** : sera ajoutée à l'Étape 9. Le chat affiche uniquement les résultats bruts.
- **Alpha dynamique** (ajustement automatique de alpha selon la requête) : amélioration future. Nécessite un classifieur de requêtes (Étape 10 — Agents).
- **Fusion par scores relatifs** (`relative_score`) : méthode de normalisation avancée, amélioration future.
- **Plus de 2 sources** (ex: recherche par graphe de connaissances) : non pertinent pour la V1.
- **Pondération par document** (alpha différent selon le type de document) : amélioration future.
- **A/B testing de alpha** (comparaison côte à côte de résultats avec différents alpha) : amélioration future, pourrait être intéressante pour le monitoring (Étape 11).

---

## 9. Estimation

| Tâche | Effort estimé |
|-------|---------------|
| Schéma Pydantic `HybridSearchConfig` + `SearchType` + validation | 0.5 jour |
| `HybridSearchEngine` (RRF + Weighted Sum + normalisation + dédup + provenance) | 2.5 jours |
| `SearchRouter` (dispatch sémantique / lexical / hybride) | 0.5 jour |
| Routes API config hybride (CRUD) | 0.5 jour |
| Route `/api/search` unifiée + dispatch | 0.5 jour |
| Extension `GeneralSettings` avec `search_type` | 0.5 jour |
| Commandes Tauri (Rust) | 0.5 jour |
| Composant `HybridSearchSettings.tsx` (section paramètres) | 1 jour |
| Composant `AlphaSlider.tsx` (slider avec visualisation barres de poids) | 0.5 jour |
| Composants `FusionMethodSelector.tsx`, `RRFParamsPanel.tsx`, `WeightedSumParamsPanel.tsx` | 1 jour |
| Modification `GeneralSettings.tsx` (ajout Type de recherche) | 0.5 jour |
| Modification `SearchModeSelector.tsx` (ajout Hybride) | 0.5 jour |
| Modification `ChatOptions.tsx` (ajout slider alpha compact) | 0.5 jour |
| Composant `HybridResultCard.tsx` + `ProvenanceBadge.tsx` | 1 jour |
| Composant `HybridDebugPanel.tsx` (debug enrichi multi-source) | 0.5 jour |
| Modification `ChatView.tsx` (dispatch via UnifiedSearch) | 0.5 jour |
| Composant `AlphaSliderCompact.tsx` (version chat) | 0.5 jour |
| Hooks (`useHybridSearchConfig`, `useUnifiedSearch`) | 0.5 jour |
| Traductions i18n (FR + EN) — hybride + type de recherche | 0.5 jour |
| Tests unitaires `HybridSearchEngine` (RRF, WS, normalisation, dédup, alpha extrêmes) | 1.5 jours |
| Tests unitaires `SearchRouter` (dispatch correct par type) | 0.5 jour |
| Tests unitaires normalisation (min-max, z-score, edge cases) | 0.5 jour |
| Tests d'intégration (requête → sémantique + lexical → fusion → résultats) | 1 jour |
| Tests manuels + corrections | 1 jour |
| **Total** | **~16 jours** |
