# 🧰 RAGKIT Desktop — Spécifications Étape 1 : Ingestion & Préprocessing

> **Étape** : 1 — Ingestion & Préprocessing  
> **Tag cible** : `v1.0.0`  
> **Date** : 13 février 2026  
> **Dépôt** : https://github.com/henribesnard/ragkit_desktop.git  
> **Prérequis** : Étape 0 (Ossature & Release 0) implémentée et validée

---

## 1. Objectif

Permettre à l'utilisateur de configurer sa base de connaissances via un assistant guidé (wizard) et d'analyser ses documents pour en extraire les métadonnées. C'est le **point d'entrée de toute l'expérience utilisateur**.

Cette étape livre :
- Un **wizard de configuration initiale** en 4 écrans (bienvenue, profilage, sélection dossier, sélection types de documents).
- Un moteur de **profilage de base de connaissances** (5 profils + 6 questions de calibrage) qui détermine les valeurs par défaut de **tout le pipeline RAG** pour les étapes suivantes.
- L'**analyse automatique des documents** avec extraction de métadonnées techniques et fonctionnelles.
- Une section `PARAMÈTRES > Paramètres avancés > INGESTION & PRÉPROCESSING` complète et fonctionnelle.
- Le **pipeline de parsing** fonctionnel (extraction de texte brut à partir des documents).

**Le chunking, l'embedding et le stockage vectoriel ne sont pas encore implémentés.** Le parsing s'exécute pour l'analyse et la validation, mais les documents ne sont pas encore indexés.

---

## 2. Spécifications fonctionnelles

### 2.1 Wizard de configuration initiale

Au premier lancement (aucune configuration détectée dans `~/.ragkit/config/settings.json`), le wizard se déclenche automatiquement en plein écran (la navigation sidebar est masquée).

#### 2.1.1 Écran 1 — Bienvenue

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                          RAGKIT                             │
│                                                             │
│           Votre assistant documentaire intelligent           │
│                                                             │
│  RAGKIT transforme vos documents en une base de             │
│  connaissances interrogeable par intelligence artificielle.  │
│                                                             │
│  En quelques étapes, nous allons :                          │
│  ✓ Analyser votre type de contenu                           │
│  ✓ Sélectionner vos documents                               │
│  ✓ Configurer le système automatiquement                    │
│                                                             │
│              [Commencer la configuration →]                  │
│                                                             │
│  ● ○ ○ ○                                        Étape 1/4   │
└─────────────────────────────────────────────────────────────┘
```

**Comportements** :
- Bouton unique "Commencer la configuration →".
- Indicateur de progression en bas (4 pastilles + numéro d'étape).
- Pas de bouton "Retour" sur cet écran.

#### 2.1.2 Écran 2 — Profilage de la base de connaissances

```
┌─────────────────────────────────────────────────────────────┐
│  ← Retour                                   Étape 2/4      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Quel type de contenu décrit le mieux votre base ?          │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ 📘           │ │ ❓           │ │ 📜           │        │
│  │ Documentation│ │ FAQ /        │ │ Juridique /  │        │
│  │ technique    │ │ Support      │ │ Réglementaire│        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│  ┌──────────────┐ ┌──────────────┐                          │
│  │ 📊           │ │ 📚           │                          │
│  │ Rapports &   │ │ Base         │                          │
│  │ Analyses     │ │ généraliste  │                          │
│  └──────────────┘ └──────────────┘                          │
│                                                             │
│  ── Affiner le profil (optionnel) ──                        │
│                                                             │
│  1. Documents avec tableaux ou schémas ?        [Oui] [Non] │
│  2. Réponses croisant plusieurs documents ?     [Oui] [Non] │
│  3. Documents de plus de 50 pages en moyenne ?  [Oui] [Non] │
│  4. Besoin de réponses très précises ?          [Oui] [Non] │
│  5. Base mise à jour fréquemment ?              [Oui] [Non] │
│  6. Citations avec sources et pages ?           [Oui] [Non] │
│                                                             │
│              [Suivant →]                                     │
│                                                             │
│  ● ● ○ ○                                        Étape 2/4   │
└─────────────────────────────────────────────────────────────┘
```

**Comportements** :
- Les 5 profils sont des **cartes cliquables** avec icône + nom. Un seul profil sélectionnable à la fois (radio). La carte sélectionnée a un contour coloré + coche.
- Par défaut, aucun profil n'est sélectionné. Le bouton "Suivant" est grisé tant qu'un profil n'est pas choisi.
- Les 6 questions de calibrage sont affichées sous les profils dans une section dépliable "Affiner le profil" (dépliée par défaut). Chaque question a un toggle Oui/Non (défaut : Non).
- Chaque question a un tooltip ℹ️ expliquant son impact.
- Bouton "Retour" ramène à l'Écran 1.

#### 2.1.3 Écran 3 — Sélection du répertoire de documents

```
┌─────────────────────────────────────────────────────────────┐
│  ← Retour                                   Étape 3/4      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Sélectionnez le répertoire de vos documents                │
│                                                             │
│  ┌────────────────────────────────────────────────┐         │
│  │  📁  C:\Users\henri\Documents\base_ragkit      │ [📂]   │
│  └────────────────────────────────────────────────┘         │
│                                                             │
│  ☑ Inclure les sous-dossiers                                │
│                                                             │
│  ┌── Arborescence ────────────────────────────────────────┐ │
│  │  ☑ 📁 contracts/          (12 fichiers)                │ │
│  │  ☑ 📁 reports/            (8 fichiers)                 │ │
│  │  ☑ 📁 reports/2024/       (5 fichiers)                 │ │
│  │  ☑ 📁 reports/2023/       (3 fichiers)                 │ │
│  │  ☐ 📁 archive/            (34 fichiers)                │ │
│  │  ☑ 📁 procedures/         (6 fichiers)                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ▸ Patterns d'exclusion avancés                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Exclure les fichiers contenant : [*_draft.*, *_old.*] │ │
│  │  Taille maximale par fichier :    [50] Mo              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  📊 60 fichiers trouvés · 245 Mo                            │
│                                                             │
│              [Suivant →]                                     │
│                                                             │
│  ● ● ● ○                                        Étape 3/4   │
└─────────────────────────────────────────────────────────────┘
```

**Comportements** :
- **Bouton "Parcourir"** (📂) : ouvre le dialogue natif Tauri pour sélectionner un dossier.
- **Validation du dossier** : appel à `POST /api/wizard/validate-folder` qui vérifie l'accès, scanne récursivement et retourne les stats (nombre de fichiers, taille, extensions).
- **Arborescence** : affichée uniquement si "Inclure les sous-dossiers" est coché. Chaque sous-dossier a une checkbox (coché par défaut). L'utilisateur peut décocher des sous-dossiers pour les exclure.
- **Patterns d'exclusion** : section dépliable (repliée par défaut). Champ de texte pour les patterns glob (séparés par virgule). Champ numérique pour la taille max.
- **Compteur** : nombre de fichiers et taille totale mis à jour dynamiquement selon les filtres.
- **Validation** : le bouton "Suivant" est grisé si aucun dossier n'est sélectionné ou si le dossier est vide/invalide.

#### 2.1.4 Écran 4 — Sélection des types de documents

```
┌─────────────────────────────────────────────────────────────┐
│  ← Retour                                   Étape 4/4      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Types de documents trouvés                                 │
│                                                             │
│  ┌── Supportés ───────────────────────────────────────────┐ │
│  │  ☑ PDF   (.pdf)         28 fichiers   120 Mo           │ │
│  │  ☑ Word  (.docx)        15 fichiers   45 Mo            │ │
│  │  ☑ Markdown (.md)       10 fichiers   2 Mo             │ │
│  │  ☑ Texte (.txt)          5 fichiers   1 Mo             │ │
│  │  ☐ HTML  (.html)         2 fichiers   0.5 Mo           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌── Non supportés ───────────────────────────────────────┐ │
│  │  ⊘ Images (.png, .jpg)   8 fichiers                    │ │
│  │     ℹ️ Les images ne sont pas encore supportées.        │ │
│  │  ⊘ Excel (.xlsx)         2 fichiers                    │ │
│  │     ℹ️ Support Excel prévu dans une prochaine version.  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  📊 58 fichiers sélectionnés · 168 Mo                       │
│                                                             │
│  ┌── Récapitulatif du profil ─────────────────────────────┐ │
│  │  Profil détecté : 📜 Juridique / Réglementaire         │ │
│  │  Calibrage : Q1=Non Q2=Oui Q3=Oui Q4=Oui Q5=Non Q6=Oui│ │
│  │                                                        │ │
│  │  Paramètres appliqués :                                │ │
│  │  · Chunking : récursif, 1536 tokens                    │ │
│  │  · Recherche : hybride + reranking                     │ │
│  │  · Température LLM : 0.1                               │ │
│  │  · Citations : oui, format footnote                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│              [✓ Terminer la configuration]                   │
│                                                             │
│  ● ● ● ●                                        Étape 4/4   │
└─────────────────────────────────────────────────────────────┘
```

**Comportements** :
- **Scan automatique** : au chargement, appel backend qui scanne le dossier sélectionné et liste tous les types trouvés avec compteurs.
- **Types supportés** : PDF, DOCX, DOC, MD, TXT, HTML, CSV, RST, XML, JSON, YAML. Cochés par défaut. L'utilisateur peut décocher.
- **Types non supportés** : grisés avec icône ⊘ et info-bulle explicative. Non cochables.
- **Récapitulatif du profil** : encadré en bas montrant le profil sélectionné, les réponses de calibrage, et un résumé des paramètres clés qui en découlent (en langage humain, pas de noms techniques). Cet encadré aide l'utilisateur à comprendre ce que le système va faire.
- **Bouton "Terminer"** : finalise le wizard, sauvegarde la config, lance l'analyse des métadonnées, et redirige vers `PARAMÈTRES > Paramètres avancés > INGESTION & PRÉPROCESSING`.

### 2.2 Analyse des documents et métadonnées

Après la fin du wizard, le backend :

1. **Parcourt tous les documents** retenus (types cochés, sous-dossiers non exclus, patterns respectés).
2. **Extrait les métadonnées techniques** automatiquement :

| Métadonnée | Source | Exemple |
|------------|--------|---------|
| `filename` | Nom du fichier | `contrat_2024.pdf` |
| `file_path` | Chemin relatif | `contracts/contrat_2024.pdf` |
| `file_size_bytes` | Taille | `2456789` |
| `file_type` | Extension | `pdf` |
| `page_count` | Extraction PDF/DOCX | `24` |
| `language` | Détection langdetect | `fr` |
| `last_modified` | Filesystem | `2024-11-15T14:32:00` |
| `encoding` | Détection | `utf-8` |
| `word_count` | Comptage après parsing | `12450` |

3. **Extrait les métadonnées fonctionnelles** (best-effort) :

| Métadonnée | Source | Modifiable |
|------------|--------|-----------|
| `title` | Métadonnées PDF/DOCX ou première ligne | ✅ Oui |
| `author` | Métadonnées PDF/DOCX | ✅ Oui |
| `description` | Premiers paragraphes | ✅ Oui |
| `keywords` | Extraction automatique | ✅ Oui |
| `creation_date` | Métadonnées PDF/DOCX | ✅ Oui |

4. **Affiche un tableau éditable** dans l'onglet INGESTION & PRÉPROCESSING avec toutes les métadonnées fonctionnelles pour validation/correction par l'utilisateur.

### 2.3 Section PARAMÈTRES > Paramètres avancés > INGESTION & PRÉPROCESSING

#### Structure de l'onglet PARAMÈTRES à cette étape

```
PARAMÈTRES
├── Paramètres généraux              ← (vide pour l'instant)
└── Paramètres avancés
    └── INGESTION & PRÉPROCESSING    ← NOUVEAU
```

#### Layout de la section

```
┌─────────────────────────────────────────────────────────────┐
│  INGESTION & PRÉPROCESSING                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌── Source ──────────────────────────────────────────────┐ │
│  │  Répertoire : C:\Users\henri\Documents\base_ragkit [📂]│ │
│  │  ☑ Récursif                                           │ │
│  │  Sous-dossiers exclus : archive/                      │ │
│  │  Types de fichiers : pdf, docx, md, txt               │ │
│  │  Patterns d'exclusion : *_draft.*, *_old.*            │ │
│  │  Taille max fichier : 50 Mo                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌── Document Parsing ────────────────────────────────────┐ │
│  │  Moteur de parsing :    [▾ auto              ]        │ │
│  │                                                        │ │
│  │  ☐ Activer l'OCR                                      │ │
│  │  Langue OCR :           [▾ fra, eng          ]        │ │
│  │  Moteur OCR :           [▾ tesseract         ]        │ │
│  │                                                        │ │
│  │  Extraction tableaux :  [▾ preserve          ]        │ │
│  │  ☐ Captioning d'images                                │ │
│  │  ☑ Détection de titres                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌── Prétraitement du texte ──────────────────────────────┐ │
│  │  ☐ Conversion en minuscules                           │ │
│  │  ☐ Suppression ponctuation                            │ │
│  │  ☑ Normalisation Unicode                              │ │
│  │  ☐ Suppression URLs                                   │ │
│  │  ☑ Détection de langue                                │ │
│  │                                                        │ │
│  │  Déduplication :        [▾ exact             ]        │ │
│  │  Seuil déduplication :  [=====●====] 0.95             │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌── Métadonnées des documents ───────────────────────────┐ │
│  │  ┌──────────┬─────────────────────┬────────┬─────────┐│ │
│  │  │ Fichier  │ Titre               │ Auteur │ Langue  ││ │
│  │  ├──────────┼─────────────────────┼────────┼─────────┤│ │
│  │  │ cont...  │ [Contrat de service]│ [J.D.] │ fr      ││ │
│  │  │ rapp...  │ [Rapport annuel '24]│ [—]    │ fr      ││ │
│  │  │ proc...  │ [Procédure qualité] │ [—]    │ fr      ││ │
│  │  └──────────┴─────────────────────┴────────┴─────────┘│ │
│  │  (tableau scrollable, champs titre/auteur éditables)   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  [↻ Réanalyser les documents]  [↻ Réinitialiser le profil] │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Catalogue complet des paramètres INGESTION & PRÉPROCESSING

### 3.1 Paramètres de source

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Répertoire source | `source.path` | string | — (obligatoire) | Chemin absolu vers le dossier de documents |
| Récursif | `source.recursive` | bool | `true` | Inclure les sous-dossiers |
| Sous-dossiers exclus | `source.excluded_dirs` | string[] | `[]` | Liste des sous-dossiers à exclure |
| Types de fichiers | `source.file_types` | string[] | `["pdf", "docx", "md", "txt"]` | Extensions acceptées |
| Patterns d'exclusion | `source.exclusion_patterns` | string[] | `[]` | Patterns glob pour exclure des fichiers |
| Taille max fichier | `source.max_file_size_mb` | int | `50` | Fichiers plus gros sont ignorés (Mo) |

### 3.2 Paramètres de Document Parsing

| Paramètre | Clé config | Type | Options | Défaut | Description |
|-----------|------------|------|---------|--------|-------------|
| Moteur de parsing | `parsing.engine` | enum | `auto` \| `unstructured` \| `pypdf` \| `docling` | `auto` | `auto` choisit le meilleur moteur selon le type de fichier |
| OCR activé | `parsing.ocr_enabled` | bool | — | `false` | Active l'OCR pour les PDFs scannés / images dans les documents |
| Langue OCR | `parsing.ocr_language` | string[] | ISO 639-3 codes | `["fra", "eng"]` | Langues pour la reconnaissance de caractères |
| Moteur OCR | `parsing.ocr_engine` | enum | `tesseract` \| `easyocr` | `tesseract` | Moteur OCR utilisé |
| Extraction tableaux | `parsing.table_extraction_strategy` | enum | `preserve` \| `markdown` \| `separate` \| `ignore` | `preserve` | `preserve` : garde le formatage original. `markdown` : convertit en tableau Markdown. `separate` : extrait comme chunks dédiés. `ignore` : ignore les tableaux. |
| Captioning images | `parsing.image_captioning_enabled` | bool | — | `false` | Génère des descriptions textuelles pour les images détectées |
| Détection titres | `parsing.header_detection` | bool | — | `true` | Détecte automatiquement les titres et sous-titres pour structurer le document |

### 3.3 Paramètres de prétraitement du texte

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Minuscules | `preprocessing.lowercase` | bool | `false` | Convertit tout le texte en minuscules. Améliore le matching lexical mais perd la casse (acronymes, noms propres). |
| Suppression ponctuation | `preprocessing.remove_punctuation` | bool | `false` | Supprime la ponctuation. Utile pour le matching mais peut perdre du sens (ex: "M." vs "M"). |
| Normalisation Unicode | `preprocessing.normalize_unicode` | bool | `true` | Normalise les caractères Unicode (NFC). Gère les accents composés vs précomposés. |
| Suppression URLs | `preprocessing.remove_urls` | bool | `false` | Supprime les URLs du texte. Réduit le bruit pour du contenu web. |
| Détection langue | `preprocessing.language_detection` | bool | `true` | Détecte automatiquement la langue de chaque document via `langdetect`. |
| Stratégie déduplication | `preprocessing.deduplication_strategy` | enum | `exact` \| `fuzzy` \| `semantic` \| `none` | `exact` | `exact` : hash SHA-256. `fuzzy` : similarité de Jaccard sur les n-grams. `semantic` : similarité d'embedding (plus lent). `none` : pas de déduplication. |
| Seuil déduplication | `preprocessing.deduplication_threshold` | float | 0.0 – 1.0 | `0.95` | Seuil au-dessus duquel deux documents sont considérés comme doublons. |

### 3.4 Résumé des impacts

| Paramètre | Impact principal | Impact secondaire |
|-----------|-----------------|-------------------|
| `ocr_enabled` | Permet d'extraire du texte des PDFs scannés | Augmente le temps de parsing (~10x) |
| `table_extraction_strategy` | Qualité de la recherche dans les tableaux | `markdown` produit des chunks plus gros |
| `image_captioning_enabled` | Rend le contenu visuel cherchable | Nécessite un modèle de vision (lent) |
| `header_detection` | Améliore le chunking par structure | Peut mal interpréter les headers |
| `normalize_unicode` | Évite les doublons de caractères accentués | Aucun impact négatif notable |
| `deduplication_strategy` | Évite d'indexer des doublons | `semantic` est lent, `exact` peut rater des quasi-doublons |

---

## 4. Profils de base de connaissances — Référentiel complet

Le wizard détermine un profil qui fixe les valeurs par défaut de **tout le pipeline RAG**, pas seulement l'étape courante. Ce référentiel est le **contrat de données** entre le wizard et toutes les étapes futures.

### 4.1 Les 5 profils

| ID | Nom affiché (FR) | Nom affiché (EN) | Icône | Description |
|----|-------------------|-------------------|-------|-------------|
| `technical_documentation` | Documentation technique | Technical documentation | 📘 | Manuels, API docs, guides, références, code |
| `faq_support` | FAQ / Support | FAQ / Support | ❓ | Questions-réponses, bases de connaissances, aide en ligne |
| `legal_compliance` | Juridique / Réglementaire | Legal / Compliance | 📜 | Contrats, lois, réglementations, conformité |
| `reports_analysis` | Rapports & Analyses | Reports & Analysis | 📊 | Rapports financiers, études, analyses, comptes-rendus |
| `general` | Base généraliste | General purpose | 📚 | Contenu varié, mixte, sans dominante claire |

### 4.2 Matrice complète des paramètres par profil

> **Convention** : chaque tableau couvre une section du pipeline. Les paramètres de la section **courante** (Ingestion) sont implémentés immédiatement. Les paramètres des sections **futures** sont stockés dans la config mais pas encore utilisés — ils seront débloqués progressivement.

#### 4.2.1 INGESTION & PRÉPROCESSING (Étape 1 — cette étape)

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|--------------------------|---------------|--------------------|--------------------|-----------|
| `parsing.engine` | `auto` | `auto` | `auto` | `auto` | `auto` |
| `parsing.ocr_enabled` | `false` | `false` | `false` | `false` | `false` |
| `parsing.ocr_language` | `["fra", "eng"]` | `["fra", "eng"]` | `["fra"]` | `["fra", "eng"]` | `["fra", "eng"]` |
| `parsing.ocr_engine` | `tesseract` | `tesseract` | `tesseract` | `tesseract` | `tesseract` |
| `parsing.table_extraction_strategy` | `markdown` | `preserve` | `preserve` | `markdown` | `preserve` |
| `parsing.image_captioning_enabled` | `false` | `false` | `false` | `false` | `false` |
| `parsing.header_detection` | `true` | `true` | `true` | `true` | `true` |
| `preprocessing.lowercase` | `false` | `false` | `false` | `false` | `false` |
| `preprocessing.remove_punctuation` | `false` | `false` | `false` | `false` | `false` |
| `preprocessing.normalize_unicode` | `true` | `true` | `true` | `true` | `true` |
| `preprocessing.remove_urls` | `false` | `true` | `false` | `false` | `false` |
| `preprocessing.language_detection` | `true` | `true` | `true` | `true` | `true` |
| `preprocessing.deduplication_strategy` | `exact` | `fuzzy` | `exact` | `exact` | `exact` |
| `preprocessing.deduplication_threshold` | `0.95` | `0.85` | `0.98` | `0.95` | `0.90` |

#### 4.2.2 CHUNKING (Étape 2 — futur, valeurs stockées)

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|--------------------------|---------------|--------------------|--------------------|-----------|
| `chunking.strategy` | `recursive` | `paragraph_based` | `recursive` | `paragraph_based` | `fixed_size` |
| `chunking.chunk_size` | 512 | 256 | 1024 | 768 | 512 |
| `chunking.chunk_overlap` | 100 | 50 | 200 | 100 | 50 |
| `chunking.min_chunk_size` | 50 | 30 | 100 | 50 | 30 |
| `chunking.max_chunk_size` | 2000 | 1000 | 4000 | 3000 | 2000 |
| `chunking.preserve_sentences` | `true` | `true` | `true` | `true` | `true` |
| `chunking.metadata_propagation` | `true` | `true` | `true` | `true` | `true` |
| `chunking.add_chunk_index` | `true` | `false` | `true` | `true` | `true` |
| `chunking.add_document_title` | `true` | `true` | `true` | `true` | `true` |
| `chunking.keep_separator` | `false` | `false` | `true` | `false` | `false` |
| `chunking.separators` | `["\n\n", "\n", ". ", " "]` | `["\n\n", "\n"]` | `["\n\n", "\n", ". "]` | `["\n\n", "\n", ". ", " "]` | `["\n\n", "\n", ". ", " "]` |
| `chunking.similarity_threshold` | 0.75 | 0.80 | 0.70 | 0.75 | 0.75 |
| `chunking.header_levels` | `[1, 2, 3]` | `[1, 2]` | `[1, 2, 3, 4]` | `[1, 2, 3]` | `[1, 2, 3]` |

#### 4.2.3 EMBEDDING (Étape 3 — futur)

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|--------------------------|---------------|--------------------|--------------------|-----------|
| `embedding.provider` | `openai` | `openai` | `openai` | `openai` | `openai` |
| `embedding.model` | `text-embedding-3-small` | `text-embedding-3-small` | `text-embedding-3-small` | `text-embedding-3-small` | `text-embedding-3-small` |
| `embedding.batch_size` | 100 | 100 | 50 | 100 | 100 |
| `embedding.cache_enabled` | `true` | `true` | `true` | `true` | `true` |
| `embedding.normalize` | `true` | `true` | `true` | `true` | `true` |

#### 4.2.4 BASE VECTORIELLE (Étape 4 — futur)

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|--------------------------|---------------|--------------------|--------------------|-----------|
| `vector_store.provider` | `qdrant` | `chroma` | `qdrant` | `qdrant` | `qdrant` |
| `vector_store.mode` | `persistent` | `persistent` | `persistent` | `persistent` | `persistent` |

#### 4.2.5 RECHERCHE (Étapes 5-7 — futur)

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|--------------------------|---------------|--------------------|--------------------|-----------|
| `retrieval.architecture` | `hybrid_rerank` | `semantic` | `hybrid_rerank` | `hybrid` | `hybrid` |
| `retrieval.semantic.top_k` | 15 | 5 | 20 | 15 | 10 |
| `retrieval.semantic.weight` | 0.5 | 1.0 | 0.5 | 0.6 | 0.5 |
| `retrieval.semantic.threshold` | 0.0 | 0.3 | 0.0 | 0.0 | 0.0 |
| `retrieval.lexical.enabled` | `true` | `false` | `true` | `true` | `true` |
| `retrieval.lexical.top_k` | 15 | 5 | 20 | 15 | 10 |
| `retrieval.lexical.weight` | 0.5 | 0.0 | 0.5 | 0.4 | 0.5 |
| `retrieval.lexical.bm25_k1` | 1.5 | 1.2 | 1.2 | 1.5 | 1.5 |
| `retrieval.lexical.bm25_b` | 0.75 | 0.75 | 0.5 | 0.75 | 0.75 |
| `retrieval.hybrid.alpha` | 0.3 | 0.8 | 0.4 | 0.6 | 0.5 |
| `retrieval.hybrid.fusion_method` | `rrf` | `weighted_sum` | `rrf` | `rrf` | `rrf` |

#### 4.2.6 RERANKING (Étape 8 — futur)

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|--------------------------|---------------|--------------------|--------------------|-----------|
| `rerank.enabled` | `true` | `false` | `true` | `false` | `false` |
| `rerank.provider` | `cohere` | `none` | `cohere` | `none` | `none` |
| `rerank.model` | `rerank-v3.5` | — | `rerank-v3.5` | — | — |
| `rerank.top_n` | 5 | — | 5 | — | — |
| `rerank.candidates` | 40 | — | 40 | — | — |
| `rerank.relevance_threshold` | 0.0 | — | 0.1 | — | — |

#### 4.2.7 LLM / GÉNÉRATION (Étape 9 — futur)

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|--------------------------|---------------|--------------------|--------------------|-----------|
| `llm.provider` | `openai` | `openai` | `openai` | `openai` | `openai` |
| `llm.model` | `gpt-4o-mini` | `gpt-4o-mini` | `gpt-4o-mini` | `gpt-4o-mini` | `gpt-4o-mini` |
| `llm.temperature` | 0.1 | 0.3 | 0.0 | 0.2 | 0.7 |
| `llm.max_tokens` | 2000 | 1000 | 3000 | 2000 | 2000 |
| `llm.top_p` | 0.9 | 0.95 | 0.85 | 0.9 | 0.95 |
| `llm.cite_sources` | `true` | `true` | `true` | `true` | `true` |
| `llm.citation_format` | `inline` | `inline` | `footnote` | `inline` | `inline` |
| `llm.admit_uncertainty` | `true` | `true` | `true` | `true` | `true` |
| `llm.response_language` | `auto` | `auto` | `auto` | `auto` | `auto` |
| `llm.context_max_chunks` | 5 | 3 | 8 | 5 | 5 |
| `llm.context_max_tokens` | 4000 | 2000 | 8000 | 4000 | 4000 |

#### 4.2.8 AGENTS (Étape 10 — futur)

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|--------------------------|---------------|--------------------|--------------------|-----------|
| `agents.always_retrieve` | `false` | `false` | `true` | `false` | `false` |
| `agents.query_rewriting.enabled` | `true` | `false` | `true` | `true` | `true` |
| `agents.query_rewriting.num_rewrites` | 1 | 0 | 2 | 1 | 1 |
| `agents.detect_intents` | `["question","greeting","chitchat","out_of_scope"]` | `["question","greeting","chitchat"]` | `["question","clarification","out_of_scope"]` | `["question","greeting","out_of_scope"]` | `["question","greeting","chitchat","out_of_scope"]` |
| `agents.max_history_messages` | 10 | 15 | 10 | 10 | 10 |
| `agents.memory_strategy` | `sliding_window` | `sliding_window` | `sliding_window` | `sliding_window` | `sliding_window` |

### 4.3 Justification des choix par profil

#### 📘 `technical_documentation`

La documentation technique est structurée (titres, sous-titres, code), contient des références précises (noms de fonctions, codes, SKU). Le parsing utilise `table_extraction_strategy: markdown` pour convertir les tableaux techniques en Markdown exploitable. Les URL sont conservées car elles font souvent référence à des ressources. La déduplication `exact` suffit car les docs techniques sont rarement dupliqués avec des variations mineures. L'alpha bas (0.3) favorise le lexical car les termes techniques exacts comptent. Le reranking est activé pour affiner les résultats précis.

#### ❓ `faq_support`

Les FAQ sont naturellement structurées en paragraphes question-réponse courts. Les URL sont supprimées (`remove_urls: true`) car fréquentes dans le support mais rarement pertinentes pour la recherche. La déduplication `fuzzy` avec seuil bas (0.85) élimine les variantes de la même question/réponse. Le chunking par paragraphes courts (256 tokens) isole chaque paire Q/R. L'alpha haut (0.8) favorise le sémantique car l'utilisateur formule souvent différemment de la FAQ. Le reranking est inutile sur des résultats courts et ciblés.

#### 📜 `legal_compliance`

Chaque mot compte dans les documents juridiques. L'OCR est désactivé par défaut mais la langue est restreinte au français seul par défaut. La déduplication `exact` avec seuil très haut (0.98) est très conservatrice — en juridique, des documents très similaires peuvent avoir des différences cruciales. Les chunks sont grands (1024 tokens) pour préserver le contexte juridique. Le reranking est activé avec seuil de pertinence. Température 0.0 pour une fidélité maximale. Citations footnote pour la traçabilité juridique. `always_retrieve: true` car en contexte juridique, il vaut mieux toujours chercher.

#### 📊 `reports_analysis`

Les rapports sont narratifs avec des sections longues et des données chiffrées. Le `table_extraction_strategy: markdown` préserve les tableaux de données. La déduplication `exact` standard. Les chunks de 768 tokens capturent des passages d'analyse complets. L'alpha 0.6 penche vers le sémantique car les utilisateurs cherchent des concepts. Température modérée (0.2) pour des synthèses fidèles.

#### 📚 `general`

Profil universel. Tous les paramètres sont équilibrés : déduplication `exact` à 0.90, chunking `fixed_size` à 512, alpha 0.5, température 0.7 pour des réponses naturelles. Configuration de départ recommandée quand l'utilisateur ne sait pas quel profil choisir.

### 4.4 Modificateurs des questions de calibrage

Les 6 questions de calibrage appliquent des **modificateurs** au profil de base. Un modificateur peut être une valeur absolue (remplacement) ou relative (addition/multiplication).

| # | Question | Si OUI → Modifications |
|---|----------|------------------------|
| **Q1** | Documents avec tableaux ou schémas ? | `parsing.table_extraction_strategy` → `markdown`, `parsing.ocr_enabled` → `true`, `parsing.image_captioning_enabled` → `true` |
| **Q2** | Réponses croisant plusieurs documents ? | `retrieval.semantic.top_k` += 10, `retrieval.lexical.top_k` += 10, `llm.context_max_chunks` += 3, `llm.context_max_tokens` += 2000, `agents.query_rewriting.enabled` → `true` |
| **Q3** | Documents > 50 pages en moyenne ? | `chunking.chunk_size` ×= 1.5 (arrondi), `chunking.chunk_overlap` ×= 1.5, `chunking.max_chunk_size` ×= 1.5, `chunking.min_chunk_size` ×= 2 |
| **Q4** | Réponses très précises (chiffres, dates) ? | `rerank.enabled` → `true`, `llm.temperature` → min(profil, 0.1), `retrieval.hybrid.alpha` -= 0.15 (min 0.1), `retrieval.lexical.bm25_k1` += 0.3 |
| **Q5** | Base mise à jour fréquemment ? | Impact futur : `ingestion.mode` → `auto`, `ingestion.auto_refresh_interval` → `24h`, `ingestion.watch_enabled` → `true` |
| **Q6** | Citations avec sources et pages ? | `chunking.add_chunk_index` → `true`, `chunking.metadata_propagation` → `true`, `chunking.add_document_title` → `true`, `llm.cite_sources` → `true`, `llm.citation_format` → `footnote` |

**Exemple de calcul combiné** : profil `legal_compliance` + Q3=OUI + Q4=OUI :
- `chunking.chunk_size` : 1024 × 1.5 = **1536**
- `chunking.chunk_overlap` : 200 × 1.5 = **300**
- `chunking.max_chunk_size` : 4000 × 1.5 = **6000**
- `chunking.min_chunk_size` : 100 × 2 = **200**
- `rerank.enabled` : déjà `true` → reste **true** (Q4)
- `llm.temperature` : min(0.0, 0.1) = **0.0** (Q4, déjà au min)
- `retrieval.hybrid.alpha` : 0.4 - 0.15 = **0.25** (Q4)
- `retrieval.lexical.bm25_k1` : 1.2 + 0.3 = **1.5** (Q4)

---

## 5. Spécifications techniques

### 5.1 Schéma Pydantic (backend)

```python
# ragkit/config/ingestion_schema.py
"""Pydantic schemas for ingestion & preprocessing configuration."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ParsingEngine(str, Enum):
    AUTO = "auto"
    UNSTRUCTURED = "unstructured"
    PYPDF = "pypdf"
    DOCLING = "docling"


class TableExtractionStrategy(str, Enum):
    PRESERVE = "preserve"
    MARKDOWN = "markdown"
    SEPARATE = "separate"
    IGNORE = "ignore"


class OcrEngine(str, Enum):
    TESSERACT = "tesseract"
    EASYOCR = "easyocr"


class DeduplicationStrategy(str, Enum):
    EXACT = "exact"
    FUZZY = "fuzzy"
    SEMANTIC = "semantic"
    NONE = "none"


class SourceConfig(BaseModel):
    path: str = Field(description="Absolute path to documents folder")
    recursive: bool = True
    excluded_dirs: list[str] = Field(default_factory=list)
    file_types: list[str] = Field(
        default=["pdf", "docx", "md", "txt"])
    exclusion_patterns: list[str] = Field(default_factory=list)
    max_file_size_mb: int = Field(default=50, ge=1, le=500)


class ParsingConfig(BaseModel):
    engine: ParsingEngine = ParsingEngine.AUTO
    ocr_enabled: bool = False
    ocr_language: list[str] = Field(default=["fra", "eng"])
    ocr_engine: OcrEngine = OcrEngine.TESSERACT
    table_extraction_strategy: TableExtractionStrategy = (
        TableExtractionStrategy.PRESERVE)
    image_captioning_enabled: bool = False
    header_detection: bool = True


class PreprocessingConfig(BaseModel):
    lowercase: bool = False
    remove_punctuation: bool = False
    normalize_unicode: bool = True
    remove_urls: bool = False
    language_detection: bool = True
    deduplication_strategy: DeduplicationStrategy = (
        DeduplicationStrategy.EXACT)
    deduplication_threshold: float = Field(
        default=0.95, ge=0.0, le=1.0)


class IngestionConfig(BaseModel):
    """Complete ingestion & preprocessing configuration."""
    source: SourceConfig
    parsing: ParsingConfig = Field(default_factory=ParsingConfig)
    preprocessing: PreprocessingConfig = Field(
        default_factory=PreprocessingConfig)
```

### 5.2 API REST (routes backend)

#### 5.2.1 Routes Wizard

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/wizard/validate-folder` | POST | Valide un dossier et retourne les stats | `{ folder_path: string }` | `FolderValidationResult` |
| `/api/wizard/scan-folder` | POST | Scanne les types de fichiers dans un dossier | `{ folder_path, recursive, excluded_dirs, exclusion_patterns }` | `FolderScanResult` |
| `/api/wizard/analyze-profile` | POST | Analyse les réponses wizard et retourne le profil + config complète | `WizardAnswers` | `WizardProfileResponse` |
| `/api/wizard/complete` | POST | Finalise le wizard, sauvegarde la config, lance l'analyse | `WizardCompletionRequest` | `{ success: bool }` |
| `/api/wizard/environment-detection` | GET | Détecte GPU, Ollama, modèles locaux | — | `EnvironmentInfo` |

#### 5.2.2 Routes Ingestion Config

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/ingestion/config` | GET | Config ingestion courante | — | `IngestionConfig` |
| `/api/ingestion/config` | PUT | Met à jour la config | `IngestionConfig` (partiel) | `IngestionConfig` |
| `/api/ingestion/config/reset` | POST | Réinitialise au profil actif | — | `IngestionConfig` |
| `/api/ingestion/documents` | GET | Liste les documents détectés avec métadonnées | — | `DocumentInfo[]` |
| `/api/ingestion/documents/{id}/metadata` | PUT | Met à jour les métadonnées fonctionnelles | `{ title?, author?, description?, keywords? }` | `DocumentInfo` |
| `/api/ingestion/analyze` | POST | Relance l'analyse des documents | — | `AnalysisResult` |

#### 5.2.3 Modèles de réponse

```python
class FolderValidationResult(BaseModel):
    valid: bool
    error: str | None = None
    error_code: str | None = None
    stats: FolderStats

class FolderStats(BaseModel):
    files: int
    size_mb: float
    extensions: list[str]
    extension_counts: dict[str, int]

class FolderScanResult(BaseModel):
    supported_types: list[FileTypeInfo]
    unsupported_types: list[FileTypeInfo]
    total_files: int
    total_size_mb: float

class FileTypeInfo(BaseModel):
    extension: str
    display_name: str        # "PDF", "Word", "Markdown"...
    count: int
    size_mb: float
    supported: bool

class WizardAnswers(BaseModel):
    profile: str             # "technical_documentation", etc.
    calibration: dict[str, bool]  # {"q1": false, "q2": true, ...}

class WizardProfileResponse(BaseModel):
    profile_name: str
    profile_display_name: str
    icon: str
    description: str
    config_summary: dict[str, str]    # Résumé humain
    full_config: dict                 # Config complète calculée

class DocumentInfo(BaseModel):
    id: str
    filename: str
    file_path: str
    file_type: str
    file_size_bytes: int
    page_count: int | None
    language: str | None
    last_modified: str
    word_count: int | None
    # Métadonnées fonctionnelles (éditables)
    title: str | None
    author: str | None
    description: str | None
    keywords: list[str]
    creation_date: str | None
```

### 5.3 Commandes Tauri (Rust) — ajouts

```rust
// desktop/src-tauri/src/commands.rs (ajouts Étape 1)

// Wizard
#[tauri::command]
pub async fn validate_folder(path: String) -> Result<FolderValidationResult, String> { ... }

#[tauri::command]
pub async fn scan_folder(params: ScanFolderParams) -> Result<FolderScanResult, String> { ... }

#[tauri::command]
pub async fn analyze_wizard_profile(params: WizardAnswers) -> Result<WizardProfileResponse, String> { ... }

#[tauri::command]
pub async fn complete_wizard(params: WizardCompletionRequest) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn detect_environment() -> Result<serde_json::Value, String> { ... }

// Ingestion config
#[tauri::command]
pub async fn get_ingestion_config() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn update_ingestion_config(config: serde_json::Value) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn reset_ingestion_config() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn get_documents() -> Result<Vec<serde_json::Value>, String> { ... }

#[tauri::command]
pub async fn update_document_metadata(id: String, metadata: serde_json::Value) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn analyze_documents() -> Result<serde_json::Value, String> { ... }
```

### 5.4 Composants React — arborescence

```
desktop/src/
├── pages/
│   ├── Onboarding.tsx                     ← NOUVEAU : container wizard plein écran
│   └── Settings.tsx                       ← MODIFIER : ajouter section Ingestion
├── components/
│   ├── wizard/
│   │   ├── WizardContainer.tsx            ← NOUVEAU : orchestrateur wizard
│   │   ├── WizardProgress.tsx             ← NOUVEAU : barre de progression
│   │   ├── WelcomeStep.tsx                ← NOUVEAU : écran 1
│   │   ├── ProfileStep.tsx                ← NOUVEAU : écran 2 (profils + calibrage)
│   │   ├── FolderStep.tsx                 ← NOUVEAU : écran 3 (sélection dossier)
│   │   ├── FileTypesStep.tsx              ← NOUVEAU : écran 4 (types + récap)
│   │   ├── ProfileCard.tsx                ← NOUVEAU : carte profil cliquable
│   │   ├── CalibrationQuestion.tsx        ← NOUVEAU : question Oui/Non avec tooltip
│   │   ├── FolderTree.tsx                 ← NOUVEAU : arborescence de sous-dossiers
│   │   └── ProfileSummary.tsx             ← NOUVEAU : récapitulatif profil + paramètres
│   ├── settings/
│   │   ├── IngestionSettings.tsx          ← NOUVEAU : section complète
│   │   ├── SourceSettings.tsx             ← NOUVEAU : config source
│   │   ├── ParsingSettings.tsx            ← NOUVEAU : config parsing
│   │   ├── PreprocessingSettings.tsx      ← NOUVEAU : config preprocessing
│   │   └── MetadataTable.tsx              ← NOUVEAU : tableau métadonnées éditable
│   └── ui/
│       ├── Toggle.tsx                     ← NOUVEAU : toggle Oui/Non
│       ├── Select.tsx                     ← NOUVEAU : select dropdown
│       ├── Slider.tsx                     ← NOUVEAU : slider + input numérique
│       ├── Tooltip.tsx                    ← NOUVEAU : tooltip d'aide ℹ️
│       └── Badge.tsx                      ← NOUVEAU : badge "Modifié"
├── hooks/
│   ├── useWizard.ts                       ← NOUVEAU : état wizard multi-step
│   ├── useIngestionConfig.ts              ← NOUVEAU : hook config ingestion
│   └── useDocuments.ts                    ← NOUVEAU : hook liste documents
├── lib/
│   └── ipc.ts                             ← MODIFIER : ajouter toutes les routes
└── locales/
    ├── fr.json                            ← MODIFIER : ajouter clés wizard + ingestion
    └── en.json                            ← MODIFIER : ajouter clés wizard + ingestion
```

### 5.5 Routing & navigation

```tsx
// App.tsx — modification
import { Onboarding } from "./pages/Onboarding";

// Si pas de config détectée → afficher le wizard plein écran
// Sinon → afficher le layout normal avec sidebar
export default function App() {
  const { hasCompletedSetup, isLoading } = useSetupStatus();

  if (isLoading) return <SplashScreen />;
  if (!hasCompletedSetup) return <Onboarding />;

  return (
    <BrowserRouter>
      <div className="flex h-screen ...">
        <Sidebar />
        <div className="flex flex-col flex-1">
          <Header />
          <main>
            <Routes>
              <Route path="/chat" element={<Chat />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="*" element={<Navigate to="/chat" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
```

### 5.6 Persistance

Le wizard sauvegarde toute la config calculée dans :

```
~/.ragkit/config/settings.json
```

```json
{
  "version": "1.0.0",
  "setup_completed": true,
  "profile": "legal_compliance",
  "calibration_answers": {
    "q1_tables_schemas": false,
    "q2_multi_document": true,
    "q3_long_documents": true,
    "q4_precision_needed": true,
    "q5_frequent_updates": false,
    "q6_citations_needed": true
  },
  "ingestion": {
    "source": {
      "path": "C:\\Users\\henri\\Documents\\base_ragkit",
      "recursive": true,
      "excluded_dirs": ["archive"],
      "file_types": ["pdf", "docx", "md", "txt"],
      "exclusion_patterns": ["*_draft.*"],
      "max_file_size_mb": 50
    },
    "parsing": {
      "engine": "auto",
      "ocr_enabled": false,
      "ocr_language": ["fra"],
      "ocr_engine": "tesseract",
      "table_extraction_strategy": "preserve",
      "image_captioning_enabled": false,
      "header_detection": true
    },
    "preprocessing": {
      "lowercase": false,
      "remove_punctuation": false,
      "normalize_unicode": true,
      "remove_urls": false,
      "language_detection": true,
      "deduplication_strategy": "exact",
      "deduplication_threshold": 0.98
    }
  },
  "chunking": { "...": "valeurs calculées, utilisées à l'Étape 2" },
  "embedding": { "...": "valeurs calculées, utilisées à l'Étape 3" },
  "retrieval": { "...": "valeurs calculées, utilisées aux Étapes 5-7" },
  "rerank": { "...": "valeurs calculées, utilisées à l'Étape 8" },
  "llm": { "...": "valeurs calculées, utilisées à l'Étape 9" },
  "agents": { "...": "valeurs calculées, utilisées à l'Étape 10" }
}
```

### 5.7 Dépendances Python ajoutées

```toml
# pyproject.toml — ajouts aux dependencies pour Étape 1
dependencies = [
    "fastapi>=0.100",
    "uvicorn>=0.20",
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
    "pyyaml>=6.0",
    "python-dotenv>=1.0",
    "langdetect>=1.0",           # Détection de langue
    "unstructured>=0.10",         # Parsing PDF, DOCX, HTML, Markdown
]
```

---

## 6. Critères d'acceptation

### 6.1 Fonctionnels

| # | Critère |
|---|---------|
| F1 | Au premier lancement (pas de `settings.json`), le wizard plein écran se lance automatiquement |
| F2 | Le wizard propose 4 écrans avec navigation Suivant/Retour et indicateur de progression |
| F3 | L'écran 2 propose les 5 profils sous forme de cartes cliquables avec icônes |
| F4 | Les 6 questions de calibrage sont affichables et ont un tooltip explicatif |
| F5 | L'écran 3 ouvre le dialogue natif pour sélectionner un dossier |
| F6 | L'arborescence des sous-dossiers s'affiche avec des checkboxes pour exclure |
| F7 | L'écran 4 affiche les types de fichiers trouvés avec compteurs et taille |
| F8 | Les types non supportés sont grisés avec une info-bulle explicative |
| F9 | Le récapitulatif du profil en bas de l'écran 4 montre les paramètres clés en langage humain |
| F10 | Après "Terminer", la sidebar réapparaît et l'onglet Paramètres > Ingestion est affiché |
| F11 | La section Ingestion affiche les 3 sous-sections : Source, Parsing, Préprocessing |
| F12 | Le tableau de métadonnées permet d'éditer titre et auteur pour chaque document |
| F13 | Le bouton "Réanalyser" relance l'analyse des documents |
| F14 | Au redémarrage, le wizard ne se relance pas (config détectée) |
| F15 | Tous les textes sont traduits FR/EN via i18n |

### 6.2 Techniques

| # | Critère |
|---|---------|
| T1 | `POST /api/wizard/validate-folder` retourne `valid: true` pour un dossier accessible avec des fichiers |
| T2 | `POST /api/wizard/analyze-profile` retourne la config complète calculée (profil + modificateurs) |
| T3 | Les 5 profils × 6 questions × toutes combinaisons produisent des configs valides (test paramétrisé) |
| T4 | Le scan de dossier récursif respecte `excluded_dirs` et `exclusion_patterns` |
| T5 | L'extraction de métadonnées fonctionne sur PDF, DOCX, MD et TXT |
| T6 | La détection de langue (`langdetect`) fonctionne sur le contenu extrait |
| T7 | La config complète est persistée dans `~/.ragkit/config/settings.json` |
| T8 | `GET /api/ingestion/config` retourne la config sauvegardée |
| T9 | `PUT /api/ingestion/config` valide et persiste les modifications |
| T10 | `tsc --noEmit` ne produit aucune erreur TypeScript |
| T11 | Le CI passe sur les 4 targets (lint + build) |

---

## 7. Périmètre exclus (Étape 1)

- **Chunking** : sera ajouté à l'Étape 2.
- **Embedding** : sera ajouté à l'Étape 3.
- **Stockage vectoriel** : sera ajouté à l'Étape 4.
- **Lancement d'ingestion** : le parsing s'exécute pour l'analyse mais les documents ne sont pas encore indexés.
- **Paramètres généraux** : restent vides à cette étape.
- **Gestion des clés API** : sera ajoutée à l'Étape 3 (embedding providers).
- **Chat fonctionnel** : reste un placeholder.
- **Tableau de bord fonctionnel** : reste un placeholder.

---

## 8. Estimation

| Tâche | Effort estimé |
|-------|---------------|
| Schéma Pydantic + profils backend (5 profils × config complète) | 2 jours |
| Logique wizard backend (calcul profil + modificateurs) | 1.5 jours |
| Routes API wizard (validate-folder, scan, analyze-profile, complete) | 1.5 jours |
| Routes API ingestion (config CRUD, documents, metadata) | 1 jour |
| Pipeline de parsing (PDF, DOCX, MD, TXT) + extraction métadonnées | 2 jours |
| Commandes Tauri (Rust) | 0.5 jour |
| Composants React wizard (4 écrans + composants) | 3 jours |
| Composants React settings (Ingestion + MetadataTable) | 1.5 jours |
| Composants UI réutilisables (Toggle, Select, Slider, Tooltip, Badge) | 1 jour |
| Traductions i18n (FR + EN) — wizard + ingestion | 1 jour |
| Routing conditionnel (wizard vs app principale) | 0.5 jour |
| Tests unitaires et d'intégration | 2 jours |
| Tests manuels + corrections | 1 jour |
| **Total** | **~19 jours** |
