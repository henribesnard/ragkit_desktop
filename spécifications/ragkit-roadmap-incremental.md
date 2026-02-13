# 🧰 RAGKIT — Plan de Développement Incrémental

> **Version** : 2.0  
> **Date** : 13 février 2026  
> **Objectif** : Décrire le plan de refonte complète de RAGKIT, étape par étape, avec des releases intermédiaires fonctionnelles.

---

## Principes directeurs

- **Chaque étape produit un livrable utilisable** : l'application est testable et distribuable à la fin de chaque étape.
- **Les paramètres sont toujours pilotés par le profilage initial** : le wizard de l'Étape 1 détermine les valeurs par défaut de toutes les étapes suivantes.
- **L'utilisateur peut tout modifier** : chaque paramètre par défaut est éditable dans `PARAMÈTRES > Paramètres avancés > [section]`.
- **La complexité est progressive** : l'utilisateur débutant ne voit que le wizard et les paramètres généraux ; l'expert peut tout régler dans les paramètres avancés.

---

## Vue d'ensemble des étapes

```
Étape 0 ─ Ossature & Release 0             → .exe avec coquille vide
Étape 1 ─ Ingestion & Préprocessing        → Wizard + analyse des documents
Étape 2 ─ Chunking                          → Découpage paramétrable
Étape 3 ─ Embedding                         → Vectorisation des chunks
Étape 4 ─ Base de données vectorielle       → Stockage + pipeline d'ingestion complet
Étape 5 ─ Recherche sémantique             → Premier agent de recherche
Étape 6 ─ Recherche lexicale (BM25)        → Deuxième mode de recherche
Étape 7 ─ Recherche hybride                → Fusion des deux recherches
Étape 8 ─ Reranking                         → Réordonnancement des résultats
Étape 9 ─ LLM / Génération                 → Réponse finale en langage naturel
Étape 10 ─ Agents & Orchestration           → Query Analyzer + Orchestrateur complet
Étape 11 ─ Monitoring & Évaluation          → Tableau de bord avancé + métriques
Étape 12 ─ Sécurité, UX & Finalisation     → Polish, sécurité, export
```

---

## Étape 0 — Ossature & Release 0

### 🎯 Objectif

Mettre en place le socle technique de l'application et livrer un premier `.exe` installable qui prouve que la chaîne de build fonctionne de bout en bout.

### Fonctionnalités

1. **Structure projet** : initialiser le monorepo avec le backend Python (FastAPI), le frontend desktop (Electron/Tauri + React) et le système de build.
2. **Application desktop** : fenêtre principale avec navigation entre trois onglets vides :
   - **CHAT** — placeholder "Le chat sera disponible après configuration."
   - **PARAMÈTRES** — placeholder "Configurez votre RAG ici."
   - **TABLEAU DE BORD** — placeholder "Le monitoring apparaîtra ici."
3. **Build & distribution** : pipeline de build produisant un installeur `.exe` Windows signé.
4. **Internationalisation** : infrastructure i18n en place (FR par défaut, EN prêt).
5. **Thème clair/sombre** : toggle fonctionnel dès cette étape.

### Sortie attendue

> L'utilisateur télécharge et installe le `.exe`. L'application s'ouvre et affiche le nom "RAGKIT" avec les trois onglets vides navigables. Aucune fonctionnalité métier.

---

## Étape 1 — Ingestion & Préprocessing

### 🎯 Objectif

Permettre à l'utilisateur de configurer sa base de connaissances via un assistant guidé (wizard) et d'analyser ses documents pour en extraire les métadonnées. C'est le **point d'entrée de toute l'expérience utilisateur**.

### Fonctionnalités

#### 1.1 — Wizard de configuration initiale

Au premier lancement (aucune configuration détectée), le wizard se déclenche automatiquement et guide l'utilisateur en séquence :

**Écran 1 — Bienvenue**
- Présentation de RAGKIT, de ses capacités, et du processus de configuration.
- Bouton "Commencer la configuration →".

**Écran 2 — Profilage de la base de connaissances**
- **Question principale** : "Quel type de contenu décrit le mieux votre base ?" avec les profils :
  - 📘 Documentation technique
  - ❓ FAQ / Support
  - 📜 Juridique / Réglementaire
  - 📊 Rapports & Analyses
  - 📚 Base généraliste
- **6 questions de calibrage** (Oui/Non) pour affiner le profil :

| # | Question | Impact si OUI |
|---|----------|---------------|
| 1 | Documents avec tableaux ou schémas ? | Parsing avancé (tables, OCR) |
| 2 | Réponses croisant plusieurs documents ? | Multi-doc retrieval, `top_k` augmenté |
| 3 | Documents de plus de 50 pages en moyenne ? | Chunks plus grands, chunking hiérarchique |
| 4 | Besoin de réponses très précises (chiffres, dates) ? | Reranking activé, température LLM basse |
| 5 | Base mise à jour fréquemment ? | Mode watch / ingestion incrémentale |
| 6 | Citations avec sources et numéros de page ? | Métadonnées de source activées |

- **Résultat** : affichage du profil détecté avec un récapitulatif des paramètres par défaut qui en découlent. L'utilisateur peut accepter ou modifier manuellement.

**Écran 3 — Sélection du répertoire de documents**
- Bouton "Parcourir…" ou glisser-déposer d'un dossier.
- **Inclusion des sous-dossiers** : choix Oui/Non.
  - Si OUI : affichage de l'arborescence complète avec tous les sous-dossiers cochés par défaut. L'utilisateur peut décocher ceux qu'il souhaite exclure.
- **Patterns d'exclusion avancés** (optionnel, section dépliable) : ex. `*_draft.*`, `*_old.*`, fichiers > X Mo.

**Écran 4 — Sélection des types de documents**
- L'application scanne le répertoire sélectionné (et les sous-dossiers retenus).
- Affichage de tous les types de fichiers trouvés (PDF, DOCX, MD, TXT, HTML, CSV, etc.) avec le nombre de fichiers par type.
- Les types supportés par RAGKIT sont cochés par défaut. Les types non supportés sont grisés avec une info-bulle explicative.
- L'utilisateur peut décocher des types s'il souhaite en exclure certains.

#### 1.2 — Analyse des documents et métadonnées

- L'outil parcourt les documents retenus et extrait les **métadonnées techniques** (taille, nombre de pages, langue détectée, format, date de modification) et les **métadonnées fonctionnelles** (titre détecté, auteur si disponible, résumé/description, mots-clés).
- Les métadonnées fonctionnelles sont affichées à l'utilisateur dans un tableau éditable pour validation ou correction.
- Une fois validées, l'utilisateur est dirigé vers `PARAMÈTRES > Paramètres avancés > INGESTION & PRÉPROCESSING`.

#### 1.3 — Onglet PARAMÈTRES > Paramètres avancés > INGESTION & PRÉPROCESSING

Tous les paramètres issus du wizard et de l'analyse sont visibles et modifiables :

- **Document Parsing** : `document_loader_type`, `ocr_enabled`, `ocr_language`, `ocr_engine`, `table_extraction_strategy`, `image_captioning_enabled`, `header_detection`.
- **Text Preprocessing** : `lowercase`, `remove_punctuation`, `normalize_unicode`, `remove_urls`, `language_detection`, `deduplication_strategy`, `deduplication_threshold`.
- **Source** : chemin du répertoire, récursivité, sous-dossiers exclus, patterns de fichiers, patterns d'exclusion.
- **Métadonnées** : tableau des métadonnées fonctionnelles validées.

#### 1.4 — Structure de l'onglet PARAMÈTRES à cette étape

```
PARAMÈTRES
├── Paramètres généraux          ← (vide pour l'instant)
└── Paramètres avancés
    └── INGESTION & PRÉPROCESSING
```

### Sortie attendue

> L'utilisateur lance l'application, passe par le wizard, sélectionne son dossier de documents, voit l'analyse des fichiers avec métadonnées, valide, et retrouve tous les paramètres d'ingestion dans l'onglet dédié. Le pipeline de parsing est fonctionnel mais n'indexe pas encore (pas de chunking ni embedding).

---

## Étape 2 — Chunking

### 🎯 Objectif

Ajouter le découpage intelligent des documents en chunks, paramétrable selon la stratégie choisie lors du profilage.

### Fonctionnalités

1. **Nouvel onglet** : `PARAMÈTRES > Paramètres avancés > CHUNKING`.
2. **Paramètres exposés** (valeurs par défaut issues du profilage) :
   - `chunking_strategy` : `fixed_size` | `sentence_based` | `paragraph_based` | `semantic` | `recursive` | `markdown_header`
   - `chunk_size` : taille en tokens (ex : 256, 512, 1024)
   - `chunk_overlap` : chevauchement en tokens (ex : 50, 100, 200)
   - `min_chunk_size` : taille minimale d'un chunk (éviter les micro-chunks)
   - `max_chunk_size` : taille maximale
   - Pour la stratégie `semantic` : `similarity_threshold`, modèle utilisé
   - `separators` : liste des séparateurs utilisés (pour stratégie récursive)
   - `preserve_sentences` : ne pas couper au milieu d'une phrase (booléen)
   - `metadata_propagation` : propager les métadonnées du document parent aux chunks
3. **Prévisualisation** : possibilité de voir un aperçu du découpage sur un document-échantillon directement depuis l'interface des paramètres (bouton "Prévisualiser le chunking").
4. Modification des paramètres → prise en compte immédiate (mais ingestion non encore possible, car pas d'embedding).

### Structure PARAMÈTRES à cette étape

```
PARAMÈTRES
├── Paramètres généraux          ← (vide)
└── Paramètres avancés
    ├── INGESTION & PRÉPROCESSING
    └── CHUNKING
```

### Sortie attendue

> L'utilisateur peut configurer la stratégie de chunking et prévisualiser le résultat sur un document-échantillon. Le pipeline parsing → chunking est fonctionnel en interne.

---

## Étape 3 — Embedding

### 🎯 Objectif

Ajouter la vectorisation des chunks via des modèles d'embedding configurables (local ou API cloud).

### Fonctionnalités

1. **Nouvel onglet** : `PARAMÈTRES > Paramètres avancés > EMBEDDING`.
2. **Paramètres exposés** :
   - **Modèle document** : `provider` (openai | ollama | huggingface | cohere | voyageai | mistral), `model`, `api_key`
   - **Modèle requête** : possibilité d'utiliser un modèle différent pour l'embedding des requêtes (ou cocher "Identique au modèle document")
   - `batch_size` : nombre de textes par requête d'embedding
   - `dimensions` : dimensions du vecteur (si configurable par le modèle)
   - `cache_enabled` : mise en cache des embeddings (booléen)
   - `cache_backend` : `memory` | `disk`
   - `normalize_embeddings` : normalisation L2 des vecteurs
3. **Détection environnement** (si pas déjà fait au wizard) : détection GPU, Ollama installé, modèles locaux disponibles.
4. **Test de connexion** : bouton pour valider que le provider est joignable et le modèle fonctionnel.

### Structure PARAMÈTRES à cette étape

```
PARAMÈTRES
├── Paramètres généraux          ← (vide)
└── Paramètres avancés
    ├── INGESTION & PRÉPROCESSING
    ├── CHUNKING
    └── EMBEDDING
```

### Sortie attendue

> L'utilisateur peut configurer et tester son modèle d'embedding. Le pipeline parsing → chunking → embedding est fonctionnel en interne, mais les vecteurs ne sont pas encore stockés.

---

## Étape 4 — Base de données vectorielle

### 🎯 Objectif

Ajouter le stockage vectoriel, compléter le pipeline d'ingestion de bout en bout, et permettre à l'utilisateur de lancer et monitorer l'ingestion depuis le tableau de bord.

### Fonctionnalités

#### 4.1 — Paramètres de la base vectorielle

- **Nouvel onglet** : `PARAMÈTRES > Paramètres avancés > BASE DE DONNÉES VECTORIELLE`.
- **Paramètres** :
  - `provider` : `qdrant` | `chroma`
  - `mode` : `memory` | `persistent`
  - `path` : chemin de stockage (mode persistent)
  - `collection_name` : nom de la collection
  - `distance_metric` : `cosine` | `euclidean` | `dot`
  - `index_type` : type d'index (HNSW, etc.)
  - Paramètres HNSW : `ef_construction`, `m`

#### 4.2 — Pipeline d'ingestion complet

Le pipeline complet est maintenant opérationnel : **Parsing → Chunking → Embedding → Stockage vectoriel**.

#### 4.3 — Gestion de l'ingestion

- **Lancement** : bouton "Lancer l'ingestion" dans le `TABLEAU DE BORD`.
- **Monitoring temps réel** dans le `TABLEAU DE BORD` :
  - Barre de progression (X/Y documents, pourcentage)
  - Temps écoulé et estimation du temps restant
  - Document en cours de traitement
  - Compteurs : réussis / avertissements / échecs
  - Boutons Pause et Annuler
- **Détection de changements** : l'application surveille le répertoire source et signale dans le tableau de bord si des documents ont été ajoutés, modifiés ou supprimés depuis la dernière ingestion.

#### 4.4 — Mode d'ingestion (Paramètres généraux)

Ajout dans `PARAMÈTRES > Paramètres généraux` :

| Paramètre | Description | Options |
|-----------|-------------|---------|
| Mode d'ingestion | Comment les changements sont pris en compte | **Manuel** : l'utilisateur lance l'ingestion lui-même / **Automatique** : l'ingestion se relance automatiquement à chaque mouvement dans la base de connaissances |

#### 4.5 — Persistance et versioning de l'ingestion

- **Persistance** : l'ingestion précédente reste active et utilisable tant que la nouvelle n'est pas terminée. L'application ne bloque jamais l'utilisateur pendant une ingestion.
- **Ingestion incrémentale** : seuls les documents ajoutés/modifiés sont réingérés (stratégie `upsert`). Les documents supprimés sont retirés de l'index.
- **Versioning** : chaque ingestion crée une version horodatée. L'utilisateur peut :
  - Voir l'historique des ingestions (date, nombre de docs/chunks, durée, statut)
  - Revenir à une version précédente (rollback)

#### 4.6 — Notification de réingestion

Si l'utilisateur modifie des paramètres d'ingestion (parsing, chunking, embedding, BDD vectorielle), l'application affiche un avertissement :

> ⚠️ Modifier ce paramètre nécessite une réingestion complète. Souhaitez-vous continuer ?

### Structure PARAMÈTRES à cette étape

```
PARAMÈTRES
├── Paramètres généraux
│   └── Mode d'ingestion (Manuel / Automatique)
└── Paramètres avancés
    ├── INGESTION & PRÉPROCESSING
    ├── CHUNKING
    ├── EMBEDDING
    └── BASE DE DONNÉES VECTORIELLE
```

### Sortie attendue

> L'utilisateur peut lancer l'ingestion complète de ses documents. Le tableau de bord affiche la progression en temps réel et l'historique. L'ingestion est persistante et versionnable. L'application signale les changements dans la base de connaissances.

---

## Étape 5 — Recherche sémantique

### 🎯 Objectif

Ajouter le premier mode de recherche fonctionnel : la recherche sémantique (par similarité vectorielle). L'utilisateur peut soumettre une requête et voir les chunks les plus pertinents.

### Fonctionnalités

1. **Nouvel onglet** : `PARAMÈTRES > Paramètres avancés > RECHERCHE SÉMANTIQUE`.
2. **Paramètres** :
   - `enabled` : activée par défaut (booléen)
   - `top_k` : nombre de résultats retournés (ex : 10, 20)
   - `similarity_threshold` : score minimum de similarité (0.0 à 1.0, 0 = pas de filtre)
   - `weight` : poids de cette recherche dans le score final (utilisé plus tard pour la recherche hybride)
3. **Agent de recherche sémantique** :
   - Interface dans l'onglet **CHAT** : un champ de requête simple.
   - L'utilisateur saisit une question → l'application effectue une recherche sémantique → affichage des résultats.
   - **Affichage des résultats** dans le chat : liste des chunks pertinents avec pour chacun :
     - Score de similarité
     - Contenu du chunk (extrait)
     - Source (nom du document, page si disponible)
     - Métadonnées associées
   - Pas de génération LLM à cette étape : uniquement les résultats bruts de la recherche.

### Sortie attendue

> L'utilisateur peut taper une requête dans le chat et voir les chunks les plus proches sémantiquement, avec scores et sources. C'est un premier outil de validation de la qualité de l'ingestion.

---

## Étape 6 — Recherche lexicale (BM25)

### 🎯 Objectif

Ajouter un second mode de recherche basé sur la correspondance lexicale (BM25), complémentaire à la recherche sémantique.

### Fonctionnalités

1. **Nouvel onglet** : `PARAMÈTRES > Paramètres avancés > RECHERCHE LEXICALE`.
2. **Paramètres** :
   - `enabled` : activée par défaut (booléen)
   - `algorithm` : `bm25` | `bm25+`
   - `k1` : saturation du terme (1.2–2.0, défaut 1.5)
   - `b` : normalisation de longueur (0.5–0.8, défaut 0.75)
   - `top_k` : nombre de résultats
   - `weight` : poids dans le score final
   - **Preprocessing lexical** : `lowercase`, `remove_stopwords`, `stopwords_lang` (french | english | auto), `stemming`
3. **Agent de recherche lexicale** :
   - Même interface dans le **CHAT**, mais l'utilisateur peut choisir le mode de recherche (sémantique ou lexicale) via un sélecteur.
   - Affichage des résultats identique à l'Étape 5 (chunks, scores BM25, sources).

### Sortie attendue

> L'utilisateur peut basculer entre recherche sémantique et lexicale dans le chat et comparer les résultats sur une même requête. Utile pour les cas où les termes exacts comptent (codes, références, noms propres).

---

## Étape 7 — Recherche hybride

### 🎯 Objectif

Fusionner les recherches sémantique et lexicale en une recherche hybride paramétrable, offrant le meilleur des deux approches.

### Fonctionnalités

1. **Nouvel onglet** : `PARAMÈTRES > Paramètres avancés > RECHERCHE HYBRIDE`.
2. **Paramètres** :
   - `fusion_method` : `weighted_sum` | `reciprocal_rank_fusion` (RRF)
   - `alpha` : balance sémantique/lexical (0 = 100% lexical, 1 = 100% sémantique). Valeur par défaut issue du profilage.
   - `normalize_scores` : normalisation des scores avant fusion (booléen)
   - `rrf_k` : constante RRF (défaut 60)
3. **Ajout dans Paramètres généraux** :

| Paramètre | Description | Options |
|-----------|-------------|---------|
| Type de recherche | Mode de recherche actif | **Sémantique seule** / **Lexicale seule** / **Hybride** (défaut selon profilage) |

4. **CHAT** : le mode sélectionné dans les paramètres généraux est celui utilisé par défaut. L'utilisateur peut toujours switcher temporairement via le sélecteur dans le chat.
5. **Chaque type de recherche reste paramétrable** dans son onglet avancé dédié (Étapes 5, 6, 7).

### Structure PARAMÈTRES à cette étape

```
PARAMÈTRES
├── Paramètres généraux
│   ├── Mode d'ingestion (Manuel / Automatique)
│   └── Type de recherche (Sémantique / Lexicale / Hybride)
└── Paramètres avancés
    ├── INGESTION & PRÉPROCESSING
    ├── CHUNKING
    ├── EMBEDDING
    ├── BASE DE DONNÉES VECTORIELLE
    ├── RECHERCHE SÉMANTIQUE
    ├── RECHERCHE LEXICALE
    └── RECHERCHE HYBRIDE
```

### Sortie attendue

> L'utilisateur choisit son mode de recherche préféré. La recherche hybride combine les forces des deux approches avec un paramètre `alpha` ajustable. Les résultats fusionnés sont affichés dans le chat.

---

## Étape 8 — Reranking

### 🎯 Objectif

Ajouter une couche de réordonnancement intelligent des résultats de recherche pour améliorer la pertinence finale des chunks sélectionnés.

### Fonctionnalités

1. **Nouvel onglet** : `PARAMÈTRES > Paramètres avancés > RERANKING`.
2. **Paramètres** :
   - `enabled` : activé/désactivé (défaut selon profilage)
   - `provider` : `cohere` | `local` (HuggingFace) | `none`
   - `model` : modèle de reranking (ex : `rerank-v3.5`, `BAAI/bge-reranker-v2-m3`)
   - `api_key` : clé API si provider cloud
   - `top_n` : nombre final de résultats après reranking (ex : 5)
   - `candidates` : nombre de candidats envoyés au reranker (ex : 40)
   - `relevance_threshold` : score minimum après reranking
3. **Agent orchestrateur de recherche + reranking** :
   - L'agent combine automatiquement : recherche sémantique + recherche lexicale → fusion → reranking → résultats finaux.
   - Dans le **CHAT**, l'utilisateur soumet une requête et voit les résultats après reranking, avec les scores reclassés.
   - Possibilité d'afficher un mode debug montrant les scores avant/après reranking pour chaque chunk.

### Sortie attendue

> Les résultats de recherche sont maintenant réordonnancés par un modèle de reranking. L'utilisateur voit les chunks les plus pertinents en premier. Le pipeline complet de retrieval est opérationnel : recherche hybride → reranking → résultats.

---

## Étape 9 — LLM / Génération

### 🎯 Objectif

Ajouter la génération de réponses en langage naturel par un LLM, en prenant comme contexte les chunks récupérés aux étapes précédentes. C'est la brique qui transforme le moteur de recherche en véritable assistant conversationnel.

### Fonctionnalités

1. **Nouvel onglet** : `PARAMÈTRES > Paramètres avancés > LLM / GÉNÉRATION`.
2. **Paramètres** :
   - **Modèle principal** : `provider` (openai | anthropic | ollama | mistral), `model`, `api_key`
   - **Modèle secondaire / fallback** : configuration optionnelle d'un modèle de secours
   - **Paramètres de génération** : `temperature`, `max_tokens`, `top_p`, `frequency_penalty`, `presence_penalty`
   - **Timeouts** : `timeout`, `max_retries`
   - **Comportement** :
     - `cite_sources` : citer les sources dans la réponse (booléen)
     - `citation_format` : format des citations (ex : `[Source: {nom}]`)
     - `admit_uncertainty` : admettre quand l'info n'est pas trouvée
     - `uncertainty_phrase` : phrase personnalisable pour l'incertitude
     - `response_language` : langue de réponse (`auto` | `fr` | `en` | etc.)
   - **Prompt système** : zone de texte éditable pour le prompt système de génération
   - **Prompt hors-RAG** : prompt utilisé pour les messages qui ne nécessitent pas de recherche (salutations, etc.)
3. **Ajout dans Paramètres généraux** :

| Paramètre | Description | Défaut |
|-----------|-------------|--------|
| Modèle LLM | Modèle de génération actif | Selon profilage |
| Température | Créativité des réponses (0.0 → 1.0) | Selon profilage |
| Langue de réponse | Langue préférée | Français |
| Nombre de sources affichées | Sources citées par réponse | 3 |
| Prompt système | Instructions personnalisables | Prompt par défaut |

4. **Contexte final** (section dans les paramètres avancés) :
   - `max_chunks` : nombre max de chunks dans le contexte envoyé au LLM
   - `max_tokens` : taille max du contexte en tokens
   - `deduplication` : dédupliquer les chunks trop similaires (`enabled`, `similarity_threshold`)

5. **CHAT** : l'utilisateur pose une question → recherche hybride + reranking → les chunks pertinents sont injectés dans le prompt → le LLM génère une réponse en langage naturel avec citations. La réponse affiche :
   - Le texte de la réponse
   - Les sources utilisées (cliquables, avec extrait du chunk)
   - Optionnel : panneau debug (latence, intent, chunks, langue)

### Sortie attendue

> L'utilisateur a un chat RAG fonctionnel de bout en bout. Il pose une question, obtient une réponse sourcée en langage naturel. Le pipeline complet fonctionne : parsing → chunking → embedding → stockage → recherche → reranking → génération.

---

## Étape 10 — Agents & Orchestration

### 🎯 Objectif

Ajouter la couche d'intelligence qui analyse la requête avant de décider quoi en faire (RAG nécessaire ? reformulation ? hors-périmètre ?) et orchestrer le flux complet de manière intelligente.

### Fonctionnalités

1. **Nouvel onglet** : `PARAMÈTRES > Paramètres avancés > AGENTS`.
2. **Agent 1 — Query Analyzer** :
   - Analyse l'intention de l'utilisateur : `question` | `greeting` | `chitchat` | `out_of_scope` | `clarification`
   - Décide si une recherche RAG est nécessaire
   - Reformule la requête pour optimiser la recherche (`query_rewriting`)
   - **Paramètres** : `always_retrieve` (booléen), `detect_intents` (liste), `query_rewriting.enabled`, `query_rewriting.num_rewrites`, prompt système personnalisable, LLM utilisé (référence au modèle "fast")
3. **Agent 2 — Response Generator** :
   - Génère la réponse finale avec le contexte (déjà configuré à l'Étape 9, mais maintenant piloté par l'orchestrateur)
   - Gère les cas sans RAG (salutations, hors-périmètre) avec des prompts dédiés
4. **Orchestrateur** :
   - Enchaîne automatiquement : Query Analyzer → (Retrieval si nécessaire) → Response Generator
   - Gère le streaming des réponses token par token
   - Collecte les métriques de chaque composant (latence, succès/échec)
5. **Conversation** :
   - `max_history_messages` : nombre de messages d'historique envoyés au LLM
   - `memory_strategy` : `sliding_window` | `summary`
   - `system_message_position` : `first` | `last`

### Sortie attendue

> Le chat est désormais intelligent : il distingue les salutations des vraies questions, reformule les requêtes ambiguës, et orchestre le pipeline de façon optimale. Les réponses hors-périmètre sont gérées élégamment.

---

## Étape 11 — Monitoring & Évaluation

### 🎯 Objectif

Enrichir le tableau de bord avec des métriques de performance, des journaux de requêtes, et des outils de diagnostic pour que l'utilisateur puisse suivre et améliorer la qualité de son RAG.

### Fonctionnalités

1. **Tableau de bord enrichi** :
   - **État des services** : indicateurs temps réel (🟢 OK / 🟡 Chargement / 🔴 Erreur / ⚪ Désactivé) pour chaque composant (Embedding, LLM, Reranker, Vector DB)
   - **Statistiques d'ingestion** : total docs, total chunks, dernière mise à jour, couverture vectorielle
   - **Métriques de requêtes (24h)** : nombre de requêtes, taux de réussite, latence moyenne/p95, coût estimé
   - **Graphique** : volume de requêtes dans le temps
   - **Requêtes récentes** : liste des dernières questions avec latence et intent détecté
2. **Journaux de requêtes** (onglet dédié ou sous-section) :
   - Historique complet des requêtes avec filtres (date, intent, statut)
   - Pour chaque requête : question, intent, chunks récupérés, réponse, latence, feedback utilisateur
3. **Feedback utilisateur** :
   - Boutons 👍/👎 sur chaque réponse du chat
   - Collecte pour amélioration continue
4. **Nouvel onglet** : `PARAMÈTRES > Paramètres avancés > MONITORING`.
5. **Paramètres** :
   - `log_queries` : journaliser les requêtes (booléen)
   - `log_retrieval_results` : journaliser les résultats de recherche
   - `log_llm_outputs` : journaliser les réponses LLM
   - `feedback_collection` : activer la collecte de feedback
   - `latency_p50`, `latency_p95`, `latency_p99` : seuils d'alerte de latence

### Sortie attendue

> Le tableau de bord offre une vue complète de la santé du système : services, ingestion, requêtes, performances. L'utilisateur peut diagnostiquer les problèmes et suivre l'évolution de la qualité.

---

## Étape 12 — Sécurité, UX & Finalisation

### 🎯 Objectif

Consolider l'application avec les fonctionnalités de sécurité, les finitions UX, et les outils d'import/export pour une utilisation en production.

### Fonctionnalités

#### 12.1 — Sécurité & confidentialité

- Stockage chiffré des clés API (AES-256)
- Détection optionnelle de données personnelles (PII) dans les documents
- Anonymisation optionnelle des PII avant indexation
- Politique de rétention des logs configurable

#### 12.2 — Export & import

- **Export de configuration** : exporter l'intégralité de la configuration en fichier `.yaml` ou `.ragkit-config`
- **Import de configuration** : réimporter une configuration exportée
- **Export de conversations** : exporter les sessions de chat en Markdown ou PDF

#### 12.3 — UX & finitions

- **Mode partiel** : le chat devient disponible dès que les N premiers documents sont ingérés, même si l'ingestion continue en arrière-plan
- **Question de test automatique** : après la première ingestion, RAGKIT propose une question-test générée à partir des documents pour valider le bon fonctionnement
- **Panneau de debug dans le chat** (activable) : affichage de l'intent, des chunks, de la latence, du streaming, de la langue détectée
- **Niveaux d'expertise** : l'utilisateur peut choisir son niveau (Simple / Intermédiaire / Expert) pour voir plus ou moins de paramètres dans l'interface

#### 12.4 — Paramètres généraux complets

Récapitulatif de tous les paramètres généraux accumulés au fil des étapes :

| Paramètre | Description | Défaut |
|-----------|-------------|--------|
| Mode d'ingestion | Manuel / Automatique | Manuel |
| Type de recherche | Sémantique / Lexicale / Hybride | Selon profil |
| Modèle LLM | Modèle de génération | Selon profil |
| Température | Créativité (0.0–1.0) | Selon profil |
| Langue de réponse | Langue préférée | Français |
| Nb sources affichées | Citations par réponse | 3 |
| Prompt système | Instructions LLM | Défaut |
| Mode watch | Surveiller le répertoire | Selon profil |
| Thème | Clair / Sombre / Système | Système |
| Niveau d'expertise | Simple / Intermédiaire / Expert | Simple |
| Export config | Exporter / Importer | — |

### Structure PARAMÈTRES finale

```
PARAMÈTRES
├── Paramètres généraux
│   ├── Mode d'ingestion
│   ├── Type de recherche
│   ├── Modèle LLM
│   ├── Température
│   ├── Langue de réponse
│   ├── Nombre de sources
│   ├── Prompt système
│   ├── Mode watch
│   ├── Thème
│   ├── Niveau d'expertise
│   └── Export / Import config
└── Paramètres avancés
    ├── INGESTION & PRÉPROCESSING
    ├── CHUNKING
    ├── EMBEDDING
    ├── BASE DE DONNÉES VECTORIELLE
    ├── RECHERCHE SÉMANTIQUE
    ├── RECHERCHE LEXICALE
    ├── RECHERCHE HYBRIDE
    ├── RERANKING
    ├── LLM / GÉNÉRATION
    ├── AGENTS
    └── MONITORING
```

### Sortie attendue

> L'application est complète, sécurisée, et prête pour une utilisation en production. L'utilisateur dispose d'un RAG local complet avec wizard de configuration, chat intelligent avec sources, tableau de bord de monitoring, et paramétrage fin de chaque composant du pipeline.

---

## Récapitulatif des releases

| Étape | Release | Ce qui fonctionne |
|-------|---------|-------------------|
| 0 | v0.1 | `.exe` installable, coquille vide avec navigation |
| 1 | v0.2 | Wizard complet, analyse de documents, métadonnées |
| 2 | v0.3 | Chunking paramétrable avec prévisualisation |
| 3 | v0.4 | Embedding configurable avec test de connexion |
| 4 | v0.5 | **Ingestion de bout en bout**, monitoring, versioning |
| 5 | v0.6 | Recherche sémantique dans le chat |
| 6 | v0.7 | Recherche lexicale (BM25) dans le chat |
| 7 | v0.8 | Recherche hybride configurable |
| 8 | v0.9 | Reranking, résultats optimisés |
| 9 | v0.10 | **Chat RAG complet** avec réponses LLM sourcées |
| 10 | v0.11 | Agents intelligents, orchestration, reformulation |
| 11 | v0.12 | Tableau de bord enrichi, métriques, logs |
| 12 | v1.0 | **Release finale** : sécurité, export, polish UX |
