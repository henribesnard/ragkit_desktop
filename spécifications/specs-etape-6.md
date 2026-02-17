# 🧰 RAGKIT Desktop — Spécifications Étape 6 : Recherche lexicale (BM25)

> **Étape** : 6 — Recherche lexicale (BM25)  
> **Tag cible** : `v0.7.0`  
> **Date** : 17 février 2026  
> **Dépôt** : https://github.com/henribesnard/ragkit_desktop.git  
> **Prérequis** : Étape 5 (Recherche sémantique) implémentée et validée

---

## 1. Objectif

Ajouter un **second mode de recherche** basé sur la **correspondance lexicale (BM25)**, complémentaire à la recherche sémantique. La recherche lexicale excelle pour les cas où les **termes exacts** comptent : codes produit, références, noms propres, acronymes, identifiants techniques.

Cette étape livre :
- Une section `PARAMÈTRES > Paramètres avancés > RECHERCHE LEXICALE` complète et fonctionnelle.
- Un **moteur de recherche BM25** avec index inversé persistant, tokenization configurable, gestion des stopwords multilingues et stemming.
- La **construction automatique de l'index BM25** lors de l'ingestion (le pipeline d'ingestion est étendu pour alimenter l'index lexical en parallèle du stockage vectoriel).
- Un **sélecteur de mode de recherche** dans le CHAT permettant de basculer entre recherche sémantique et recherche lexicale.
- La **mise en évidence des termes matchés** dans les résultats de la recherche lexicale.
- Le support des algorithmes **BM25 classique** et **BM25+** (variante avec bonus pour les termes présents).

**Pas de fusion hybride** à cette étape. L'utilisateur choisit manuellement entre sémantique ou lexical. La fusion sera ajoutée à l'Étape 7.

---

## 2. Spécifications fonctionnelles

### 2.1 Section PARAMÈTRES > Paramètres avancés > RECHERCHE LEXICALE

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
    ├── RECHERCHE SÉMANTIQUE                         ← Étape 5
    └── RECHERCHE LEXICALE                           ← NOUVEAU
```

#### Layout de la section RECHERCHE LEXICALE

```
┌─────────────────────────────────────────────────────────────────┐
│  RECHERCHE LEXICALE                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Paramètres principaux ───────────────────────────────────┐ │
│  │                                                            │ │
│  │  ☑ Recherche lexicale activée                             │ │
│  │                                                            │ │
│  │  Algorithme :               (•) BM25       ○ BM25+        │ │
│  │                                                            │ │
│  │  Nombre de résultats (top_k) :  [===◆======] 15           │ │
│  │  Poids (recherche hybride) :    [====◆=====] 0.5          │ │
│  │                                                            │ │
│  │  ℹ️ BM25 est l'algorithme standard de recherche lexicale.  │ │
│  │  BM25+ ajoute un bonus pour les termes présents, ce qui   │ │
│  │  améliore le classement pour les documents courts.         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Paramètres BM25 ────────────────────────────────────────┐  │
│  │                                                            │ │
│  │  k1 (saturation du terme) : [====◆=====] 1.5              │ │
│  │  b  (normalisation de longueur) : [=====◆====] 0.75       │ │
│  │  delta (BM25+ uniquement) : [====◆=====] 0.5              │ │
│  │                                                            │ │
│  │  ℹ️ k1 élevé = la répétition d'un terme compte davantage.  │ │
│  │  b élevé = les documents courts sont favorisés.            │ │
│  │  Valeurs recommandées : k1 = 1.2–2.0, b = 0.5–0.8.       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Preprocessing lexical ──────────────────────────────────┐  │
│  │                                                            │ │
│  │  ☑ Conversion en minuscules (lowercase)                   │ │
│  │  ☑ Suppression des stopwords                              │ │
│  │                                                            │ │
│  │  Langue des stopwords :  [▾ auto (détection)       ]      │ │
│  │                                                            │ │
│  │  ☑ Stemming (racinisation)                                │ │
│  │                                                            │ │
│  │  Langue du stemmer :     [▾ auto (détection)       ]      │ │
│  │                                                            │ │
│  │  ℹ️ Le stemming réduit les mots à leur racine :            │ │
│  │  "courant", "courir", "coureur" → "cour".                 │ │
│  │  Améliore le rappel mais peut créer de faux positifs.     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── État de l'index BM25 ───────────────────────────────────┐  │
│  │                                                            │ │
│  │  📊 Index : 1 247 documents · 42 318 termes uniques       │ │
│  │  💾 Taille : 8.2 Mo · Dernière mise à jour : v3 (15 fév) │ │
│  │                                                            │ │
│  │  [🔄 Reconstruire l'index]                                 │ │
│  │                                                            │ │
│  │  ℹ️ L'index BM25 est construit automatiquement lors de     │ │
│  │  l'ingestion. Le reconstruire manuellement est utile       │ │
│  │  après un changement de paramètres de preprocessing.       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ▸ Paramètres avancés                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Seuil de score minimum :    [◆=========] 0.0             │ │
│  │  N-grams :                   [▾ Unigrams (1,1)     ]      │ │
│  │  ☐ Mode debug activé par défaut                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [↻ Réinitialiser au profil]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Sélecteur de mode de recherche dans le CHAT

L'Étape 6 ajoute un **sélecteur de mode de recherche** dans la barre de recherche du CHAT :

```
┌─────────────────────────────────────────────────────────────────┐
│  💬 CHAT                                           [⚙ Options] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Barre de recherche ──────────────────────────────────────┐ │
│  │                                                            │ │
│  │  [▾ 🔍 Sémantique ▾]                                      │ │
│  │                                                            │ │
│  │     🔍 Sémantique — Recherche par sens et concepts         │ │
│  │     📝 Lexicale — Recherche par mots-clés exacts           │ │
│  │                                                            │ │
│  │  [Posez votre question...                           ] [→]  │ │
│  │                                                            │ │
│  │  Filtres rapides :                                        │ │
│  │  [▾ Tous les documents] [▾ Toutes les langues]           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ── Résultats pour "article 12 résiliation" ──────────────────  │
│  ── Mode : Lexicale (BM25) · 8 résultats · 32 ms ───────────  │
│                                                                 │
│  ┌── Résultat #1 ──────────────── Score BM25 : 18.42 ────────┐ │
│  │                                                            │ │
│  │  📄 contrat-service-2024.pdf · Page 8                     │ │
│  │                                                            │ │
│  │  "Les conditions de 【résiliation】 anticipée sont          │ │
│  │  définies à l'【article】【12】 du présent contrat. Le       │ │
│  │  prestataire peut résilier le contrat avec un préavis..."  │ │
│  │                                                            │ │
│  │  📁 Juridique · 🏷 contrat, résiliation · 🌐 fr          │ │
│  │  Termes matchés : article (×2), 12 (×1), résiliation (×3) │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Résultat #2 ──────────────── Score BM25 : 14.87 ────────┐ │
│  │  ...                                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Comportements du sélecteur** :
- Le sélecteur est un dropdown au-dessus de la barre de recherche.
- Deux options disponibles à cette étape : **Sémantique** (🔍) et **Lexicale** (📝).
- Le mode par défaut est Sémantique (le mode hybride sera ajouté à l'Étape 7).
- Le mode sélectionné est mémorisé pour la session mais pas persisté (il revient à "Sémantique" au redémarrage).
- Un tooltip décrit chaque mode au survol.

### 2.3 Différences d'affichage : lexical vs sémantique

| Élément | Recherche sémantique (Ét. 5) | Recherche lexicale (Ét. 6) |
|---------|------------------------------|---------------------------|
| **Label du score** | "Score : 0.892" (similarité 0–1) | "Score BM25 : 18.42" (non borné) |
| **Code couleur du score** | Vert→Rouge basé sur 0–1 | Relatif au score max de la requête (le meilleur résultat est toujours vert) |
| **Surlignage** | Requête surlignée (fond jaune) | Termes matchés surlignés avec 【crochets gras】 |
| **Info supplémentaire** | — | "Termes matchés : article (×2), résiliation (×3)" |
| **En-tête de résultats** | "Mode : Sémantique" | "Mode : Lexicale (BM25)" |
| **Latence debug** | Embedding + recherche + MMR | Tokenization + recherche BM25 |

### 2.4 Mise en évidence des termes matchés

Pour la recherche lexicale, les termes de la requête qui apparaissent dans le texte du chunk sont mis en évidence.

**Règles de surlignage** :
1. Les termes sont identifiés après tokenization (même pipeline que la requête : lowercase, stemming).
2. Un terme matché dans le texte original est encadré par une balise de surlignage (`<mark>`).
3. Si le stemming est activé, les variantes morphologiques sont aussi surlignées : recherche de "résiliation" surligne aussi "résilier", "résiliée", "résilié".
4. Les stopwords ne sont jamais surlignés même s'ils apparaissent dans la requête.
5. Le compteur "Termes matchés" affiche chaque terme de la requête (après stopwords removal) avec le nombre d'occurrences dans le chunk.

### 2.5 Construction de l'index BM25 lors de l'ingestion

L'index BM25 est construit **automatiquement** lors de chaque ingestion (Étape 4). Le pipeline d'ingestion est étendu :

```
                                                    ┌─────────────┐
                                                ┌──→│  STOCKAGE   │
┌──────────┐  ┌──────────┐  ┌──────────┐      │   │ VECTORIEL   │
│ PARSING  │→ │ CHUNKING │→ │EMBEDDING │──────┤   └─────────────┘
│ (Ét. 1)  │  │ (Ét. 2)  │  │ (Ét. 3)  │      │
└──────────┘  └──────────┘  └──────────┘      │   ┌─────────────┐
                    │                          └──→│ INDEX BM25  │
                    │                              │ (Ét. 6)     │
                    └─ texte des chunks ──────────→└─────────────┘
```

**Points clés** :
- L'index BM25 est alimenté par les **textes des chunks** (pas les vecteurs).
- Il est construit en parallèle du stockage vectoriel (non séquentiel).
- Il partage les mêmes `chunk_id` que le stockage vectoriel pour pouvoir récupérer les payloads.
- L'index est **persisté sur disque** dans `~/.ragkit/data/bm25_index/`.
- L'index est reconstruit lors d'une ingestion complète et mis à jour de manière incrémentale (ajout/suppression de documents).

### 2.6 Panneau "État de l'index BM25"

Ce panneau affiche des statistiques sur l'index lexical :

| Métrique | Source | Description |
|----------|--------|-------------|
| Documents | Nombre de chunks indexés | Cohérent avec le nombre de vecteurs |
| Termes uniques | Taille du vocabulaire | Après tokenization + stopwords + stemming |
| Taille | Taille du fichier d'index sur disque | En Mo |
| Dernière mise à jour | Version d'ingestion associée | Référence `ingestion_history` |

**Action "Reconstruire l'index"** : recalcule l'index BM25 à partir des textes des chunks déjà stockés (sans relancer le pipeline complet). Utile après un changement de paramètres de preprocessing lexical (lowercase, stopwords, stemming) qui ne nécessite pas de réingestion complète.

---

## 3. Algorithme BM25

### 3.1 Formule BM25 classique

```
BM25(D, Q) = Σ IDF(qi) × ( f(qi, D) × (k1 + 1) )
              i            ────────────────────────────────
                           f(qi, D) + k1 × (1 - b + b × |D| / avgdl)

où :
  Q         = requête (ensemble de termes q1, q2, ..., qn)
  D         = document (chunk)
  f(qi, D)  = fréquence du terme qi dans le document D
  |D|       = longueur du document D (en tokens)
  avgdl     = longueur moyenne des documents dans le corpus
  k1        = paramètre de saturation du terme (défaut : 1.5)
  b         = paramètre de normalisation de longueur (défaut : 0.75)

  IDF(qi)   = ln( (N - n(qi) + 0.5) / (n(qi) + 0.5) + 1 )
  N         = nombre total de documents dans le corpus
  n(qi)     = nombre de documents contenant le terme qi
```

### 3.2 Variante BM25+

BM25+ ajoute un bonus `delta` pour les termes présents, ce qui corrige un biais de BM25 classique qui peut attribuer un score négatif aux termes rares dans les documents longs.

```
BM25+(D, Q) = Σ IDF(qi) × ( f(qi, D) × (k1 + 1)
               i            ──────────────────────────── + delta )
                             f(qi, D) + k1 × (1 - b + b × |D| / avgdl)

  delta     = bonus pour les termes présents (défaut : 0.5)
```

### 3.3 Pipeline de tokenization

La même pipeline de tokenization est appliquée aux chunks (lors de l'indexation) et à la requête (lors de la recherche) :

```
Texte brut
    │
    ▼
1. Lowercase (si activé)
    │  "Les CONDITIONS de Résiliation" → "les conditions de résiliation"
    ▼
2. Tokenization (split sur espaces + ponctuation)
    │  → ["les", "conditions", "de", "résiliation"]
    ▼
3. Suppression des stopwords (si activé)
    │  → ["conditions", "résiliation"]
    ▼
4. Stemming (si activé, Snowball)
    │  → ["condit", "résili"]
    ▼
5. N-grams (si > unigrams)
    │  (1,2) → ["condit", "résili", "condit résili"]
    ▼
Tokens finaux
```

### 3.4 Stopwords multilingues

RAGKIT embarque des listes de stopwords pour les langues prises en charge :

| Langue | Clé | Nombre de mots | Source |
|--------|-----|:-:|-------|
| Français | `french` | ~160 | NLTK / Snowball |
| Anglais | `english` | ~180 | NLTK / Snowball |
| Auto | `auto` | Variable | Détection de la langue du chunk via `doc_language` et application de la liste correspondante |

**Mode `auto`** :
- Si le chunk a une métadonnée `doc_language`, la liste correspondante est utilisée.
- Si la langue n'est pas détectée ou non supportée, aucun stopword n'est supprimé (comportement conservateur).
- Les documents multilingues utilisent l'union des listes de stopwords des langues détectées.

### 3.5 Stemming multilingue

Le stemming utilise l'algorithme **Snowball** (amélioré par rapport à Porter) :

| Langue | Stemmer | Exemple |
|--------|---------|---------|
| Français | `SnowballStemmer("french")` | "résiliation" → "résili", "conditions" → "condit" |
| Anglais | `SnowballStemmer("english")` | "running" → "run", "conditions" → "condit" |
| Auto | Détection par `doc_language` | Applique le stemmer de la langue détectée |

---

## 4. Catalogue complet des paramètres RECHERCHE LEXICALE

### 4.1 Paramètres principaux

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Activée | `retrieval.lexical.enabled` | bool | — | — | Selon profil | Activer/désactiver la recherche lexicale |
| Algorithme | `retrieval.lexical.algorithm` | enum | — | — | `bm25` | `bm25` ou `bm25+` |
| Top K | `retrieval.lexical.top_k` | int | 1 | 100 | Selon profil | Nombre maximum de chunks retournés |
| Poids | `retrieval.lexical.weight` | float | 0.0 | 1.0 | Selon profil | Poids dans le score hybride (Étape 7) |

### 4.2 Paramètres BM25

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| k1 | `retrieval.lexical.bm25_k1` | float | 0.5 | 3.0 | Selon profil | Saturation de la fréquence des termes. k1 élevé = la répétition compte davantage. |
| b | `retrieval.lexical.bm25_b` | float | 0.0 | 1.0 | Selon profil | Normalisation par longueur. b=1 = forte pénalité pour les documents longs. |
| delta | `retrieval.lexical.bm25_delta` | float | 0.0 | 2.0 | 0.5 | Bonus pour les termes présents (BM25+ uniquement). |

### 4.3 Paramètres de preprocessing

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Lowercase | `retrieval.lexical.lowercase` | bool | `true` | Convertir en minuscules avant tokenization |
| Stopwords | `retrieval.lexical.remove_stopwords` | bool | `true` | Supprimer les mots vides |
| Langue stopwords | `retrieval.lexical.stopwords_lang` | enum | `auto` | `french` \| `english` \| `auto` |
| Stemming | `retrieval.lexical.stemming` | bool | `true` | Activer la racinisation (Snowball) |
| Langue stemmer | `retrieval.lexical.stemmer_lang` | enum | `auto` | `french` \| `english` \| `auto` |

### 4.4 Paramètres avancés

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Seuil de score | `retrieval.lexical.threshold` | float | 0.0 | — | 0.0 | Score BM25 minimum. 0.0 = pas de filtre. Les scores BM25 ne sont pas bornés à 1. |
| N-grams | `retrieval.lexical.ngram_range` | tuple | (1,1) | (1,3) | `(1,1)` | `(1,1)` = unigrams, `(1,2)` = uni+bigrams, `(1,3)` = uni+bi+trigrams |
| Debug | `retrieval.lexical.debug_default` | bool | — | — | `false` | Activer le mode debug par défaut |

### 4.5 Visibilité conditionnelle

| Paramètre | Condition de visibilité |
|-----------|------------------------|
| `bm25_delta` | `algorithm == "bm25+"` |
| `stopwords_lang` | `remove_stopwords == true` |
| `stemmer_lang` | `stemming == true` |

### 4.6 Résumé des impacts

| Paramètre | Impact principal | Impact secondaire |
|-----------|-----------------|-------------------|
| `algorithm` | BM25+ donne de meilleurs scores pour les documents courts | Marginal sur les performances |
| `k1` | **IMPORTANT** — Poids de la répétition des termes | k1 élevé favorise les chunks répétant le même terme |
| `b` | **IMPORTANT** — Pénalisation des documents longs | b=0 désactive la normalisation de longueur |
| `lowercase` | Matching case-insensitive | Perte de la distinction entre acronymes et mots communs (ex: US vs us) |
| `remove_stopwords` | Réduction du bruit (les mots courants ne polluent plus les scores) | Requêtes contenant uniquement des stopwords retournent 0 résultat |
| `stemming` | Meilleur rappel (variantes morphologiques matchent) | Risque de faux positifs (ex: "université" et "univers" → même racine) |
| `ngram_range` | Capture des expressions multi-mots ("machine learning" matché comme bigram) | Augmente la taille de l'index et la latence |

---

## 5. Valeurs par défaut par profil

### 5.1 Matrice profil → paramètres de recherche lexicale

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|:---:|:---:|:---:|:---:|:---:|
| `enabled` | `true` | `false` | `true` | `true` | `true` |
| `algorithm` | `bm25` | `bm25` | `bm25` | `bm25` | `bm25` |
| `top_k` | 15 | 5 | 20 | 15 | 10 |
| `weight` | 0.5 | 0.0 | 0.5 | 0.4 | 0.5 |
| `bm25_k1` | 1.5 | 1.2 | 1.2 | 1.5 | 1.5 |
| `bm25_b` | 0.75 | 0.75 | 0.5 | 0.75 | 0.75 |
| `bm25_delta` | 0.5 | 0.5 | 0.5 | 0.5 | 0.5 |
| `lowercase` | `true` | `true` | `true` | `true` | `true` |
| `remove_stopwords` | `true` | `true` | `true` | `true` | `true` |
| `stopwords_lang` | `auto` | `auto` | `auto` | `auto` | `auto` |
| `stemming` | `true` | `true` | `true` | `true` | `true` |
| `stemmer_lang` | `auto` | `auto` | `auto` | `auto` | `auto` |
| `threshold` | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| `ngram_range` | `(1,1)` | `(1,1)` | `(1,1)` | `(1,1)` | `(1,1)` |
| `debug_default` | `false` | `false` | `false` | `false` | `false` |

### 5.2 Justification des choix

- **`faq_support` → `enabled=false`, `weight=0.0`** : le profil FAQ est orienté sémantique pur (les questions des utilisateurs sont rarement formulées avec les mots exacts de la réponse). La recherche lexicale est désactivée par défaut mais peut être activée manuellement.
- **`technical_documentation` → `bm25_k1=1.5`** : les documents techniques contiennent souvent des termes répétés (noms de fonction, codes produit). Un k1 modérément élevé valorise cette répétition.
- **`legal_compliance` → `bm25_b=0.5`** : les textes juridiques sont naturellement longs. Une normalisation de longueur réduite (`b=0.5`) évite de trop pénaliser les chunks longs qui sont pertinents en contexte juridique.
- **`legal_compliance` → `bm25_k1=1.2`** : les textes juridiques utilisent un vocabulaire précis mais sans répétition excessive. Un k1 plus faible est approprié.
- **Tous `stemming=true`** : le stemming améliore significativement le rappel en français (conjugaisons, accords, dérivations) avec un risque de faux positifs acceptable.
- **Tous `ngram_range=(1,1)`** : les unigrams suffisent pour la majorité des cas d'usage. Les bigrams/trigrams augmentent la taille de l'index et ne sont nécessaires que pour des cas spécialisés (expressions figées, terminologie composite).

---

## 6. Spécifications techniques

### 6.1 Schéma Pydantic (backend)

```python
# ragkit/config/lexical_schema.py
"""Pydantic schemas for lexical (BM25) search configuration."""

from __future__ import annotations

from enum import Enum
from typing import Tuple

from pydantic import BaseModel, Field


class BM25Algorithm(str, Enum):
    BM25 = "bm25"
    BM25_PLUS = "bm25+"


class StopwordsLang(str, Enum):
    FRENCH = "french"
    ENGLISH = "english"
    AUTO = "auto"


class LexicalSearchConfig(BaseModel):
    """Lexical (BM25) search configuration."""

    enabled: bool = True
    algorithm: BM25Algorithm = BM25Algorithm.BM25
    top_k: int = Field(default=10, ge=1, le=100)
    weight: float = Field(default=0.5, ge=0.0, le=1.0,
        description="Weight in hybrid search (Étape 7)")

    # BM25 parameters
    bm25_k1: float = Field(default=1.5, ge=0.5, le=3.0)
    bm25_b: float = Field(default=0.75, ge=0.0, le=1.0)
    bm25_delta: float = Field(default=0.5, ge=0.0, le=2.0,
        description="BM25+ delta (only used when algorithm=bm25+)")

    # Preprocessing
    lowercase: bool = True
    remove_stopwords: bool = True
    stopwords_lang: StopwordsLang = StopwordsLang.AUTO
    stemming: bool = True
    stemmer_lang: StopwordsLang = StopwordsLang.AUTO

    # Advanced
    threshold: float = Field(default=0.0, ge=0.0)
    ngram_range: tuple[int, int] = Field(default=(1, 1))
    debug_default: bool = False
```

### 6.2 Moteur de recherche BM25 (backend)

```python
# ragkit/retrieval/lexical_engine.py
"""Lexical search engine — BM25/BM25+ with configurable preprocessing."""

from __future__ import annotations

import math
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from ragkit.config.lexical_schema import LexicalSearchConfig, BM25Algorithm


@dataclass
class BM25SearchResult:
    """A single BM25 search result."""
    chunk_id: str
    score: float
    text: str
    metadata: dict
    matched_terms: dict[str, int]     # term → occurrence count in chunk
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
class LexicalDebugInfo:
    """Debug information for a lexical search query."""
    query_text: str
    query_tokens: list[str]
    tokenization_latency_ms: int
    search_latency_ms: int
    total_latency_ms: int
    results_from_index: int
    results_after_threshold: int
    index_stats: dict          # documents, unique_terms, size_bytes


@dataclass
class LexicalSearchResponse:
    """Complete response from a lexical search."""
    query: str
    results: list[BM25SearchResult]
    total_results: int
    debug: LexicalDebugInfo | None = None


class TextPreprocessor:
    """Text preprocessing pipeline for BM25 tokenization."""

    def __init__(self, config: LexicalSearchConfig):
        self.config = config
        self._stopwords: dict[str, set[str]] = {}
        self._stemmers: dict[str, object] = {}
        self._load_resources()

    def _load_resources(self) -> None:
        """Load stopwords lists and stemmers."""
        from nltk.corpus import stopwords as nltk_stopwords
        from nltk.stem.snowball import SnowballStemmer

        for lang in ("french", "english"):
            try:
                self._stopwords[lang] = set(nltk_stopwords.words(lang))
            except LookupError:
                import nltk
                nltk.download("stopwords", quiet=True)
                self._stopwords[lang] = set(nltk_stopwords.words(lang))
            self._stemmers[lang] = SnowballStemmer(lang)

    def tokenize(
        self, text: str, language: str | None = None
    ) -> list[str]:
        """Full preprocessing pipeline: lowercase → tokenize → stopwords → stemming → ngrams."""
        import re

        # 1. Lowercase
        if self.config.lowercase:
            text = text.lower()

        # 2. Tokenize (split on non-alphanumeric, keep numbers)
        tokens = re.findall(r"\b\w+\b", text)

        # 3. Remove stopwords
        if self.config.remove_stopwords:
            lang = self._resolve_lang(
                self.config.stopwords_lang.value, language)
            if lang and lang in self._stopwords:
                sw = self._stopwords[lang]
                tokens = [t for t in tokens if t not in sw]

        # 4. Stemming
        if self.config.stemming:
            lang = self._resolve_lang(
                self.config.stemmer_lang.value, language)
            if lang and lang in self._stemmers:
                stemmer = self._stemmers[lang]
                tokens = [stemmer.stem(t) for t in tokens]

        # 5. N-grams
        min_n, max_n = self.config.ngram_range
        if max_n > 1:
            ngrams = []
            for n in range(min_n, max_n + 1):
                for i in range(len(tokens) - n + 1):
                    ngrams.append(" ".join(tokens[i:i + n]))
            return ngrams

        return tokens

    def _resolve_lang(
        self, config_lang: str, doc_lang: str | None
    ) -> str | None:
        if config_lang != "auto":
            return config_lang
        if doc_lang:
            mapping = {"fr": "french", "en": "english"}
            return mapping.get(doc_lang[:2])
        return None


class BM25Index:
    """In-memory BM25 index with persistence."""

    def __init__(self, preprocessor: TextPreprocessor):
        self.preprocessor = preprocessor
        self._doc_ids: list[str] = []
        self._doc_lengths: list[int] = []
        self._avg_dl: float = 0.0
        self._doc_freqs: dict[str, int] = defaultdict(int)  # term → df
        self._term_freqs: dict[str, dict[str, int]] = {}    # doc_id → {term: tf}
        self._doc_texts: dict[str, str] = {}
        self._doc_metadata: dict[str, dict] = {}
        self._doc_languages: dict[str, str | None] = {}

    @property
    def num_documents(self) -> int:
        return len(self._doc_ids)

    @property
    def num_unique_terms(self) -> int:
        return len(self._doc_freqs)

    def add_document(
        self,
        doc_id: str,
        text: str,
        metadata: dict,
        language: str | None = None,
    ) -> None:
        """Add a document (chunk) to the index."""
        tokens = self.preprocessor.tokenize(text, language)
        tf = Counter(tokens)

        self._doc_ids.append(doc_id)
        self._doc_lengths.append(len(tokens))
        self._term_freqs[doc_id] = dict(tf)
        self._doc_texts[doc_id] = text
        self._doc_metadata[doc_id] = metadata
        self._doc_languages[doc_id] = language

        for term in tf:
            self._doc_freqs[term] += 1

        # Recompute average document length
        self._avg_dl = (
            sum(self._doc_lengths) / len(self._doc_lengths)
            if self._doc_lengths else 0.0
        )

    def remove_document(self, doc_id: str) -> None:
        """Remove a document from the index."""
        if doc_id not in self._term_freqs:
            return

        tf = self._term_freqs.pop(doc_id)
        for term in tf:
            self._doc_freqs[term] -= 1
            if self._doc_freqs[term] <= 0:
                del self._doc_freqs[term]

        idx = self._doc_ids.index(doc_id)
        self._doc_ids.pop(idx)
        self._doc_lengths.pop(idx)
        self._doc_texts.pop(doc_id, None)
        self._doc_metadata.pop(doc_id, None)
        self._doc_languages.pop(doc_id, None)

        self._avg_dl = (
            sum(self._doc_lengths) / len(self._doc_lengths)
            if self._doc_lengths else 0.0
        )

    def search(
        self,
        query: str,
        config: LexicalSearchConfig,
        language: str | None = None,
        filter_conditions: dict | None = None,
    ) -> list[tuple[str, float, dict[str, int]]]:
        """Search the index. Returns list of (doc_id, score, matched_terms)."""
        query_tokens = self.preprocessor.tokenize(query, language)
        if not query_tokens:
            return []

        N = self.num_documents
        scores: dict[str, float] = {}
        matched: dict[str, dict[str, int]] = defaultdict(dict)

        for token in query_tokens:
            df = self._doc_freqs.get(token, 0)
            if df == 0:
                continue

            idf = math.log((N - df + 0.5) / (df + 0.5) + 1)

            for doc_id in self._doc_ids:
                tf = self._term_freqs.get(doc_id, {}).get(token, 0)
                if tf == 0:
                    continue

                # Apply metadata filters
                if filter_conditions and not self._matches_filters(
                    doc_id, filter_conditions
                ):
                    continue

                doc_len = self._doc_lengths[self._doc_ids.index(doc_id)]
                k1 = config.bm25_k1
                b = config.bm25_b

                numerator = tf * (k1 + 1)
                denominator = tf + k1 * (1 - b + b * doc_len / self._avg_dl)

                if config.algorithm == BM25Algorithm.BM25_PLUS:
                    term_score = idf * (numerator / denominator + config.bm25_delta)
                else:
                    term_score = idf * (numerator / denominator)

                scores[doc_id] = scores.get(doc_id, 0.0) + term_score
                matched[doc_id][token] = tf

        # Sort by score descending
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [
            (doc_id, score, matched.get(doc_id, {}))
            for doc_id, score in ranked
        ]

    def _matches_filters(
        self, doc_id: str, filter_conditions: dict
    ) -> bool:
        """Check if a document matches the filter conditions."""
        meta = self._doc_metadata.get(doc_id, {})
        for field, condition in filter_conditions.items():
            if "$in" in condition:
                if meta.get(field) not in condition["$in"]:
                    return False
        return True

    def save(self, path: Path) -> None:
        """Persist the index to disk."""
        import json
        path.mkdir(parents=True, exist_ok=True)
        data = {
            "doc_ids": self._doc_ids,
            "doc_lengths": self._doc_lengths,
            "avg_dl": self._avg_dl,
            "doc_freqs": dict(self._doc_freqs),
            "term_freqs": self._term_freqs,
            "doc_texts": self._doc_texts,
            "doc_metadata": self._doc_metadata,
            "doc_languages": self._doc_languages,
        }
        (path / "bm25_index.json").write_text(
            json.dumps(data, ensure_ascii=False), encoding="utf-8"
        )

    def load(self, path: Path) -> bool:
        """Load the index from disk. Returns True if loaded."""
        import json
        index_file = path / "bm25_index.json"
        if not index_file.exists():
            return False
        data = json.loads(index_file.read_text(encoding="utf-8"))
        self._doc_ids = data["doc_ids"]
        self._doc_lengths = data["doc_lengths"]
        self._avg_dl = data["avg_dl"]
        self._doc_freqs = defaultdict(int, data["doc_freqs"])
        self._term_freqs = data["term_freqs"]
        self._doc_texts = data["doc_texts"]
        self._doc_metadata = data["doc_metadata"]
        self._doc_languages = data.get("doc_languages", {})
        return True


class LexicalSearchEngine:
    """Orchestrates lexical search with preprocessing and scoring."""

    def __init__(
        self,
        config: LexicalSearchConfig,
        index: BM25Index,
    ):
        self.config = config
        self.index = index

    async def search(
        self,
        query: str,
        top_k: int | None = None,
        threshold: float | None = None,
        filters: dict | None = None,
        include_debug: bool = False,
    ) -> LexicalSearchResponse:
        """Execute a lexical search query."""
        _top_k = top_k or self.config.top_k
        _threshold = threshold if threshold is not None else self.config.threshold

        t_start = time.perf_counter()

        # 1. Tokenize query
        t_tok_start = time.perf_counter()
        query_tokens = self.index.preprocessor.tokenize(query)
        t_tok = time.perf_counter() - t_tok_start

        # 2. BM25 search
        t_search_start = time.perf_counter()
        raw_results = self.index.search(
            query, self.config, filter_conditions=filters
        )
        t_search = time.perf_counter() - t_search_start

        # 3. Apply threshold
        filtered = [
            (doc_id, score, terms)
            for doc_id, score, terms in raw_results
            if score >= _threshold
        ]

        # 4. Truncate to top_k
        final = filtered[:_top_k]

        t_total = time.perf_counter() - t_start

        # 5. Build response
        results = [
            self._to_result(doc_id, score, terms)
            for doc_id, score, terms in final
        ]

        debug = None
        if include_debug:
            debug = LexicalDebugInfo(
                query_text=query,
                query_tokens=query_tokens,
                tokenization_latency_ms=int(t_tok * 1000),
                search_latency_ms=int(t_search * 1000),
                total_latency_ms=int(t_total * 1000),
                results_from_index=len(raw_results),
                results_after_threshold=len(filtered),
                index_stats={
                    "documents": self.index.num_documents,
                    "unique_terms": self.index.num_unique_terms,
                },
            )

        return LexicalSearchResponse(
            query=query,
            results=results,
            total_results=len(final),
            debug=debug,
        )

    def _to_result(
        self, doc_id: str, score: float, matched_terms: dict[str, int]
    ) -> BM25SearchResult:
        """Convert index result to search result."""
        text = self.index._doc_texts.get(doc_id, "")
        meta = self.index._doc_metadata.get(doc_id, {})
        return BM25SearchResult(
            chunk_id=doc_id,
            score=score,
            text=text,
            metadata=meta,
            matched_terms=matched_terms,
            doc_title=meta.get("doc_title"),
            doc_path=meta.get("doc_path"),
            doc_type=meta.get("doc_type"),
            page_number=meta.get("page_number"),
            chunk_index=meta.get("chunk_index"),
            chunk_total=meta.get("chunk_total"),
            section_header=meta.get("section_header"),
            doc_language=meta.get("doc_language"),
            category=meta.get("category"),
            keywords=meta.get("keywords", []),
        )
```

### 6.3 Extension du pipeline d'ingestion

Le `IngestionOrchestrator` (Étape 4) est étendu pour alimenter l'index BM25 :

```python
# ragkit/ingestion/orchestrator.py — modifications Étape 6

class IngestionOrchestrator:
    def __init__(
        self,
        parser, chunker, embedder, store,
        registry,
        bm25_index: BM25Index,  # ← NOUVEAU
    ):
        ...
        self.bm25_index = bm25_index

    async def _process_document(self, file_path: Path) -> DocumentResult:
        # 1. Parse
        doc_content = await self.parser.parse(file_path)
        # 2. Chunk
        chunks = self.chunker.chunk(doc_content.text, doc_content.metadata)
        # 3. Embed
        texts = [c.text for c in chunks]
        vectors = await self.embedder.embed_texts(texts)
        # 4. Store vectors
        points = [...]
        await self.store.upsert(points)

        # 5. Index in BM25 ← NOUVEAU
        for i, chunk in enumerate(chunks):
            chunk_id = self._make_point_id(file_path, i)
            self.bm25_index.add_document(
                doc_id=chunk_id,
                text=chunk.text,
                metadata=self._make_payload(doc_content, chunk, i, len(chunks)),
                language=doc_content.metadata.get("language"),
            )

        return DocumentResult(...)

    async def _remove_document(self, doc_id: str) -> None:
        """Remove a document from both vector store and BM25 index."""
        await self.store.delete_by_doc_id(doc_id)
        # Remove all chunks for this doc from BM25 index
        chunks_to_remove = [
            cid for cid in self.bm25_index._doc_ids
            if self.bm25_index._doc_metadata.get(cid, {}).get("doc_id") == doc_id
        ]
        for chunk_id in chunks_to_remove:
            self.bm25_index.remove_document(chunk_id)

    async def _finalize(self) -> None:
        """Save BM25 index after ingestion."""
        index_path = Path("~/.ragkit/data/bm25_index/").expanduser()
        self.bm25_index.save(index_path)
```

### 6.4 API REST (routes backend)

#### 6.4.1 Routes Config

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/retrieval/lexical/config` | GET | Config recherche lexicale courante | — | `LexicalSearchConfig` |
| `/api/retrieval/lexical/config` | PUT | Met à jour la config | `LexicalSearchConfig` (partiel) | `LexicalSearchConfig` |
| `/api/retrieval/lexical/config/reset` | POST | Réinitialise au profil actif | — | `LexicalSearchConfig` |

#### 6.4.2 Routes Recherche

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/search/lexical` | POST | Exécute une recherche BM25 | `LexicalSearchQuery` | `LexicalSearchResponse` |

#### 6.4.3 Routes Index BM25

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/retrieval/lexical/index/stats` | GET | Statistiques de l'index BM25 | — | `BM25IndexStats` |
| `/api/retrieval/lexical/index/rebuild` | POST | Reconstruit l'index à partir des chunks existants | — | `{ status: string, duration_s: float }` |

#### 6.4.4 Modèles de requête et réponse

```python
class LexicalSearchQuery(BaseModel):
    """Lexical search query from the chat interface."""
    query: str = Field(..., min_length=1, max_length=2000)
    top_k: int | None = None
    threshold: float | None = None
    filters: SearchFilters | None = None   # Shared with semantic (Étape 5)
    include_debug: bool = False
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=5, ge=1, le=50)

class LexicalSearchResponseAPI(BaseModel):
    query: str
    results: list[LexicalSearchResultItem]
    total_results: int
    page: int
    page_size: int
    has_more: bool
    debug: LexicalDebugInfo | None = None

class LexicalSearchResultItem(BaseModel):
    chunk_id: str
    score: float                   # BM25 score (non borné)
    text: str
    text_preview: str              # Tronqué à 300 caractères
    matched_terms: dict[str, int]  # terme → nombre d'occurrences
    highlight_positions: list[dict] # [{start, end, term}] pour le surlignage
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

class BM25IndexStats(BaseModel):
    num_documents: int
    num_unique_terms: int
    size_bytes: int
    last_updated_version: str | None
    last_updated_at: str | None
```

### 6.5 Commandes Tauri (Rust) — ajouts

```rust
// desktop/src-tauri/src/commands.rs (ajouts Étape 6)

// Lexical config
#[tauri::command]
pub async fn get_lexical_search_config() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn update_lexical_search_config(config: serde_json::Value) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn reset_lexical_search_config() -> Result<serde_json::Value, String> { ... }

// Lexical search
#[tauri::command]
pub async fn lexical_search(query: serde_json::Value) -> Result<serde_json::Value, String> { ... }

// BM25 index
#[tauri::command]
pub async fn get_bm25_index_stats() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn rebuild_bm25_index() -> Result<serde_json::Value, String> { ... }
```

### 6.6 Composants React — arborescence

```
desktop/src/
├── components/
│   ├── settings/
│   │   ├── LexicalSearchSettings.tsx          ← NOUVEAU : section complète
│   │   ├── BM25ParamsPanel.tsx                ← NOUVEAU : k1, b, delta
│   │   ├── LexicalPreprocessingPanel.tsx      ← NOUVEAU : lowercase, stopwords, stemming
│   │   ├── BM25IndexStatusPanel.tsx           ← NOUVEAU : état de l'index
│   │   └── ... (existants)
│   ├── chat/
│   │   ├── SearchModeSelector.tsx             ← NOUVEAU : sélecteur sémantique/lexicale
│   │   ├── LexicalResultCard.tsx              ← NOUVEAU : carte résultat avec termes matchés
│   │   ├── TermHighlighter.tsx                ← NOUVEAU : surlignage des termes matchés
│   │   ├── MatchedTermsBadge.tsx              ← NOUVEAU : compteur de termes matchés
│   │   └── ... (existants Étape 5)
│   └── ui/
│       └── ... (existants)
├── hooks/
│   ├── useLexicalSearchConfig.ts              ← NOUVEAU : hook config
│   ├── useLexicalSearch.ts                    ← NOUVEAU : hook exécution recherche
│   ├── useBM25IndexStats.ts                   ← NOUVEAU : hook stats index
│   └── ... (existants)
├── lib/
│   └── ipc.ts                                 ← MODIFIER : ajouter routes lexical
└── locales/
    ├── fr.json                                ← MODIFIER : ajouter clés lexical
    └── en.json                                ← MODIFIER : ajouter clés lexical
```

### 6.7 Détail du composant `SearchModeSelector.tsx`

```tsx
interface SearchMode {
  id: "semantic" | "lexical";
  icon: string;
  label: string;
  description: string;
}

const SEARCH_MODES: SearchMode[] = [
  {
    id: "semantic",
    icon: "🔍",
    label: "Sémantique",
    description: "Recherche par sens et concepts",
  },
  {
    id: "lexical",
    icon: "📝",
    label: "Lexicale",
    description: "Recherche par mots-clés exacts (BM25)",
  },
  // L'option "Hybride" sera ajoutée à l'Étape 7
];

export function SearchModeSelector({
  mode,
  onModeChange,
  lexicalEnabled,   // from config
  semanticEnabled,  // from config
}: SearchModeSelectorProps) {
  const availableModes = SEARCH_MODES.filter((m) => {
    if (m.id === "lexical") return lexicalEnabled;
    if (m.id === "semantic") return semanticEnabled;
    return true;
  });

  return (
    <select
      value={mode}
      onChange={(e) => onModeChange(e.target.value as SearchMode["id"])}
      className="..."
    >
      {availableModes.map((m) => (
        <option key={m.id} value={m.id} title={m.description}>
          {m.icon} {m.label}
        </option>
      ))}
    </select>
  );
}
```

### 6.8 Détail du composant `TermHighlighter.tsx`

```tsx
interface TermHighlighterProps {
  text: string;
  matchedTerms: Record<string, number>;
  stemming: boolean;
}

export function TermHighlighter({
  text, matchedTerms, stemming
}: TermHighlighterProps) {
  // Build regex pattern from matched terms
  // If stemming is active, also find morphological variants
  const terms = Object.keys(matchedTerms);
  if (terms.length === 0) return <span>{text}</span>;

  const pattern = new RegExp(
    `\\b(${terms.map(escapeRegex).join("|")})\\w*\\b`,
    "gi"
  );

  const parts = text.split(pattern);

  return (
    <span>
      {parts.map((part, i) =>
        pattern.test(part) ? (
          <mark key={i} className="bg-yellow-200 font-semibold px-0.5 rounded">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}
```

### 6.9 Persistance

La config de recherche lexicale est stockée dans `settings.json` :

```json
{
  "retrieval": {
    "architecture": "hybrid_rerank",
    "semantic": { "...": "..." },
    "lexical": {
      "enabled": true,
      "algorithm": "bm25",
      "top_k": 15,
      "weight": 0.5,
      "bm25_k1": 1.5,
      "bm25_b": 0.75,
      "bm25_delta": 0.5,
      "lowercase": true,
      "remove_stopwords": true,
      "stopwords_lang": "auto",
      "stemming": true,
      "stemmer_lang": "auto",
      "threshold": 0.0,
      "ngram_range": [1, 1],
      "debug_default": false
    },
    "hybrid": { "...": "..." }
  }
}
```

L'index BM25 est stocké séparément dans `~/.ragkit/data/bm25_index/bm25_index.json`.

### 6.10 Dépendances Python ajoutées

```toml
# pyproject.toml — ajouts aux dependencies pour Étape 6
dependencies = [
    # ... (existants Étapes 0-5)
    "nltk>=3.8",                    # Stopwords lists + Snowball stemmer
]
```

**Post-installation** : un script de setup télécharge les ressources NLTK nécessaires :

```python
# ragkit/setup_nltk.py
import nltk
nltk.download("stopwords", quiet=True)
nltk.download("punkt", quiet=True)
```

Ce script est appelé au premier démarrage de l'application ou lors de l'activation de la recherche lexicale.

---

## 7. Critères d'acceptation

### 7.1 Fonctionnels

| # | Critère |
|---|---------|
| F1 | La section `PARAMÈTRES > Paramètres avancés > RECHERCHE LEXICALE` est accessible et affiche tous les paramètres |
| F2 | Le toggle `enabled` active/désactive la recherche lexicale |
| F3 | Le sélecteur d'algorithme propose BM25 et BM25+ |
| F4 | Le paramètre `delta` n'est visible que lorsque l'algorithme est BM25+ |
| F5 | Les sliders k1 et b modifient les paramètres BM25 avec validation des bornes |
| F6 | Les toggles de preprocessing (lowercase, stopwords, stemming) sont fonctionnels |
| F7 | Les dropdowns de langue (stopwords, stemmer) apparaissent conditionnellement |
| F8 | Le panneau "État de l'index BM25" affiche les statistiques de l'index |
| F9 | Le bouton "Reconstruire l'index" reconstruit l'index sans relancer l'ingestion complète |
| F10 | Le sélecteur de mode de recherche est visible dans le CHAT |
| F11 | Le mode "Lexicale" effectue une recherche BM25 et affiche les résultats |
| F12 | Les termes matchés sont surlignés dans les résultats lexicaux |
| F13 | Le compteur "Termes matchés" affiche chaque terme avec son nombre d'occurrences |
| F14 | Les résultats lexicaux affichent le score BM25 (non borné) avec coloration relative |
| F15 | Les filtres rapides (documents, langues, types, catégories) fonctionnent en mode lexical |
| F16 | Le mode debug affiche les tokens de la requête, les latences et les stats de l'index |
| F17 | Le sélecteur de mode ne propose que les modes activés (si lexical `enabled=false`, l'option est grisée) |
| F18 | L'index BM25 est construit automatiquement lors de l'ingestion (Étape 4) |
| F19 | Le badge "Modifié" apparaît à côté de chaque paramètre modifié |
| F20 | Le bouton "Réinitialiser au profil" restaure les valeurs par défaut |
| F21 | Tous les textes sont traduits FR/EN via i18n |

### 7.2 Techniques

| # | Critère |
|---|---------|
| T1 | `GET /api/retrieval/lexical/config` retourne la config courante |
| T2 | `PUT /api/retrieval/lexical/config` valide et persiste les modifications |
| T3 | `POST /api/retrieval/lexical/config/reset` restaure les valeurs du profil actif |
| T4 | `POST /api/search/lexical` retourne les résultats de la recherche BM25 |
| T5 | L'algorithme BM25 classique produit des scores conformes à la formule documentée |
| T6 | L'algorithme BM25+ produit des scores avec le bonus delta |
| T7 | Le preprocessing lowercase fonctionne correctement |
| T8 | Le retrait des stopwords français fonctionne (vérifié avec "le", "la", "de", "et") |
| T9 | Le retrait des stopwords anglais fonctionne (vérifié avec "the", "a", "is", "and") |
| T10 | Le stemming français fonctionne ("résiliation" → "résili", "courant" → "cour") |
| T11 | Le stemming anglais fonctionne ("running" → "run", "conditions" → "condit") |
| T12 | Le mode `auto` pour les langues utilise la métadonnée `doc_language` du chunk |
| T13 | L'index BM25 est alimenté automatiquement pendant l'ingestion |
| T14 | L'index BM25 est persisté dans `~/.ragkit/data/bm25_index/` |
| T15 | L'index supporte l'ajout et la suppression incrémentale de documents |
| T16 | Le filtrage par métadonnées fonctionne dans la recherche BM25 |
| T17 | Le seuil de score filtre correctement les résultats |
| T18 | `GET /api/retrieval/lexical/index/stats` retourne les statistiques de l'index |
| T19 | `POST /api/retrieval/lexical/index/rebuild` reconstruit l'index à partir des textes des chunks existants |
| T20 | La latence d'une recherche BM25 est < 100 ms pour un index de 10K chunks |
| T21 | La config recherche lexicale est persistée dans `settings.json` sous `retrieval.lexical` |
| T22 | `tsc --noEmit` ne produit aucune erreur TypeScript |
| T23 | Le CI passe sur les 4 targets (lint + build) |

---

## 8. Périmètre exclus (Étape 6)

- **Recherche hybride** (fusion sémantique + lexicale) : sera ajoutée à l'Étape 7.
- **Reranking** : sera ajouté à l'Étape 8.
- **Génération LLM** : sera ajoutée à l'Étape 9. Le chat affiche uniquement les résultats bruts.
- **Lemmatisation** (alternative au stemming plus précise mais plus lente) : amélioration future. Le stemming Snowball est suffisant pour la V1.
- **Index BM25 distribué** (Elasticsearch, Solr) : non pertinent pour une application desktop locale. L'index en mémoire avec persistance JSON est suffisant pour les volumes visés (<100K chunks).
- **Quantification TF-IDF** (alternative à BM25) : BM25 est strictement supérieur à TF-IDF pour le RAG.
- **Custom stopwords** (liste personnalisée par l'utilisateur) : amélioration future.
- **N-grams > 3** : pas de cas d'usage identifié.
- **Sparse embeddings** (SPLADE, ColBERT) : amélioration future, au-delà du scope de la V1.

---

## 9. Estimation

| Tâche | Effort estimé |
|-------|---------------|
| Schéma Pydantic `LexicalSearchConfig` + validation | 0.5 jour |
| `TextPreprocessor` (tokenization, stopwords, stemming, n-grams) | 1.5 jours |
| `BM25Index` (add/remove/search, BM25 + BM25+, persistence JSON) | 2.5 jours |
| `LexicalSearchEngine` (orchestration, filtres, debug) | 1 jour |
| Extension `IngestionOrchestrator` (alimentation BM25 en parallèle) | 1 jour |
| Reconstruction d'index (`rebuild`) à partir des chunks existants | 0.5 jour |
| Routes API config (CRUD) | 0.5 jour |
| Routes API recherche (`/api/search/lexical`) + pagination | 0.5 jour |
| Routes API index (`stats`, `rebuild`) | 0.5 jour |
| Commandes Tauri (Rust) | 0.5 jour |
| Composant `LexicalSearchSettings.tsx` (section paramètres) | 1 jour |
| Composants `BM25ParamsPanel.tsx`, `LexicalPreprocessingPanel.tsx`, `BM25IndexStatusPanel.tsx` | 1 jour |
| Composant `SearchModeSelector.tsx` (sélecteur dans le chat) | 0.5 jour |
| Composant `LexicalResultCard.tsx` + `TermHighlighter.tsx` + `MatchedTermsBadge.tsx` | 1.5 jours |
| Modification `ChatView.tsx` (dispatch sémantique vs lexical) | 0.5 jour |
| Hooks (`useLexicalSearchConfig`, `useLexicalSearch`, `useBM25IndexStats`) | 0.5 jour |
| Traductions i18n (FR + EN) — lexical settings + chat labels | 0.5 jour |
| Setup NLTK (download automatique stopwords + punkt au premier lancement) | 0.5 jour |
| Tests unitaires `TextPreprocessor` (tokenization, stopwords FR/EN, stemming FR/EN, n-grams) | 1 jour |
| Tests unitaires `BM25Index` (add, remove, search, BM25 vs BM25+, persistence) | 1.5 jours |
| Tests unitaires `LexicalSearchEngine` (filtres, seuil, debug) | 0.5 jour |
| Tests d'intégration (ingestion → index BM25 → recherche → résultats) | 1 jour |
| Tests manuels + corrections | 1 jour |
| **Total** | **~19 jours** |
