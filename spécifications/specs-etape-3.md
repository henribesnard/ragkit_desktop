# 🧰 RAGKIT Desktop — Spécifications Étape 3 : Embedding

> **Étape** : 3 — Embedding  
> **Tag cible** : `v0.4.0`  
> **Date** : 16 février 2026  
> **Dépôt** : https://github.com/henribesnard/ragkit_desktop.git  
> **Prérequis** : Étape 2 (Chunking) implémentée et validée

---

## 1. Objectif

Ajouter la **vectorisation des chunks** via des modèles d'embedding configurables, qu'ils soient hébergés dans le cloud (API) ou exécutés localement. L'embedding est la brique qui transforme les chunks textuels en vecteurs numériques exploitables par la recherche sémantique.

Cette étape livre :
- Une section `PARAMÈTRES > Paramètres avancés > EMBEDDING` complète et fonctionnelle.
- Le **support de 6 providers d'embedding** : OpenAI, Ollama, HuggingFace (local via ONNX ou sentence-transformers), Cohere, VoyageAI, Mistral.
- Un **gestionnaire de clés API** sécurisé (premier composant de gestion des secrets dans RAGKIT).
- La **détection automatique de l'environnement** (GPU, Ollama, modèles locaux disponibles).
- Un **bouton de test de connexion** pour valider la configuration du provider.
- Un **panneau de test d'embedding** pour visualiser la vectorisation d'un texte-échantillon et la similarité entre deux textes.
- Le **pipeline interne parsing → chunking → embedding** fonctionnel de bout en bout.
- Le remplacement du modèle léger de l'Étape 2 (chunking sémantique) par le modèle configuré par l'utilisateur.

**Le stockage vectoriel et l'indexation ne sont pas encore implémentés.** L'embedding s'exécute pour les tests et la validation, mais les vecteurs ne sont pas encore persistés dans une base vectorielle.

---

## 2. Spécifications fonctionnelles

### 2.1 Section PARAMÈTRES > Paramètres avancés > EMBEDDING

#### Structure de l'onglet PARAMÈTRES à cette étape

```
PARAMÈTRES
├── Paramètres généraux              ← (vide pour l'instant)
└── Paramètres avancés
    ├── INGESTION & PRÉPROCESSING    ← Étape 1
    ├── CHUNKING                     ← Étape 2
    └── EMBEDDING                    ← NOUVEAU
```

#### Layout de la section EMBEDDING

```
┌─────────────────────────────────────────────────────────────────┐
│  EMBEDDING                                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Environnement détecté ───────────────────────────────────┐ │
│  │  🖥️ GPU : ⚪ Non détecté                                   │ │
│  │  🦙 Ollama : 🟢 Installé (v0.5.1) · 3 modèles disponibles│ │
│  │  📦 Modèles locaux : all-MiniLM-L6-v2 (cache)            │ │
│  │  [↻ Rafraîchir]                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Modèle de documents ─────────────────────────────────────┐ │
│  │                                                            │ │
│  │  Provider :            [▾ openai             ]            │ │
│  │  Modèle :              [▾ text-embedding-3-small ]        │ │
│  │  Clé API :             [•••••••••••••••••••] [👁] [✎]     │ │
│  │                                                            │ │
│  │  ℹ️ OpenAI text-embedding-3-small : 1536 dimensions,       │ │
│  │  max 8191 tokens, ~$0.02/1M tokens. Bon rapport            │ │
│  │  qualité/prix pour la plupart des cas d'usage.             │ │
│  │                                                            │ │
│  │  [🔌 Tester la connexion]     🟢 Connexion réussie        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Modèle de requêtes ──────────────────────────────────────┐ │
│  │  ☑ Identique au modèle de documents                       │ │
│  │                                                            │ │
│  │  (si décoché : mêmes champs que ci-dessus)                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Paramètres de vectorisation ─────────────────────────────┐ │
│  │  Dimensions :          [▾ 1536 (défaut)      ]  ℹ️        │ │
│  │  Batch size :          [===◆=========] 100                │ │
│  │  ☑ Normalisation L2                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Cache ───────────────────────────────────────────────────┐ │
│  │  ☑ Activer le cache d'embeddings                          │ │
│  │  Backend :             [▾ disk               ]            │ │
│  │  📊 Cache : 0 entrées · 0 Mo                              │ │
│  │  [🗑 Vider le cache]                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ▸ Paramètres avancés                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Timeout (secondes) :  [===◆=========] 30                 │ │
│  │  Max retries :         [=◆===========] 3                  │ │
│  │  Rate limit (req/min): [========◆====] 3000               │ │
│  │  Truncation :          [▾ end                ]            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Test d'embedding ────────────────────────────────────────┐ │
│  │  Texte A : [Le contrat de service définit les...     ]    │ │
│  │  Texte B : [Les obligations du prestataire sont...   ]    │ │
│  │                                                            │ │
│  │  [▶ Tester l'embedding]                                   │ │
│  │                                                            │ │
│  │  Résultat :                                               │ │
│  │  ┌────────────────────────────────────────────────────┐   │ │
│  │  │  Texte A : 1536 dimensions · 12 tokens · 23 ms    │   │ │
│  │  │  Texte B : 1536 dimensions · 10 tokens · 21 ms    │   │ │
│  │  │  Similarité cosinus : 0.847 ████████░░ (élevée)    │   │ │
│  │  └────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [↻ Réinitialiser au profil]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Panneau Environnement détecté

Au chargement de la section EMBEDDING, le backend exécute une détection de l'environnement local. Le panneau affiche :

| Élément | Détection | Affichage |
|---------|-----------|-----------|
| **GPU** | Vérification CUDA (via `torch.cuda.is_available()` ou `onnxruntime.get_available_providers()`) et MPS (macOS Apple Silicon) | 🟢 `NVIDIA RTX 3060 (CUDA 12.1)` / 🟢 `Apple MPS` / ⚪ `Non détecté` |
| **Ollama** | Vérification binaire dans le PATH + appel `ollama list` | 🟢 `Installé (vX.X) · N modèles` / 🔴 `Non installé` |
| **Modèles locaux** | Cache de modèles sentence-transformers / ONNX dans `~/.ragkit/models/` | Liste des modèles en cache |

**Comportements** :
- Le bouton "Rafraîchir" relance la détection.
- Si Ollama n'est pas installé, un lien vers les instructions d'installation est affiché.
- Si aucun GPU n'est détecté, un message informatif est affiché : "Les modèles locaux fonctionneront sur CPU (plus lent). Un GPU accélère considérablement l'embedding."
- La détection ne bloque pas le chargement de la page ; elle s'exécute en arrière-plan avec un spinner.

### 2.3 Sélection du provider et du modèle

#### Providers supportés et modèles associés

| Provider | ID config | Modèles proposés | Clé API requise | Local/Cloud |
|----------|-----------|-------------------|:---:|:---:|
| **OpenAI** | `openai` | `text-embedding-3-small` (1536d), `text-embedding-3-large` (3072d), `text-embedding-ada-002` (1536d) | ✅ | Cloud |
| **Ollama** | `ollama` | (dynamique : liste depuis `ollama list`, filtrée aux modèles d'embedding) | ❌ | Local |
| **HuggingFace / Local** | `huggingface` | `all-MiniLM-L6-v2` (384d), `multilingual-e5-large` (1024d), `bge-large-en-v1.5` (1024d), `nomic-embed-text-v1.5` (768d), champ libre pour modèle custom | ❌ | Local |
| **Cohere** | `cohere` | `embed-multilingual-v3.0` (1024d), `embed-english-v3.0` (1024d), `embed-multilingual-light-v3.0` (384d) | ✅ | Cloud |
| **VoyageAI** | `voyageai` | `voyage-3` (1024d), `voyage-3-lite` (512d), `voyage-multilingual-2` (1024d) | ✅ | Cloud |
| **Mistral** | `mistral` | `mistral-embed` (1024d) | ✅ | Cloud |

**Comportements** :
- Quand l'utilisateur change de provider, la liste des modèles se met à jour.
- Pour Ollama : la liste est dynamique (appel `ollama list`). Si Ollama n'est pas installé, le provider est grisé avec un message "Ollama non détecté".
- Pour HuggingFace : une liste pré-remplie des modèles les plus courants est proposée, avec un champ "Modèle personnalisé" permettant de saisir un identifiant HuggingFace libre (ex : `BAAI/bge-m3`).
- Chaque modèle affiche une fiche descriptive sous le sélecteur (dimensions, max tokens, coût estimé pour les providers cloud, langue supportée).

#### Fiches des modèles (exemples)

| Modèle | Dimensions | Max tokens | Coût estimé | Langues | Notes |
|--------|:---:|:---:|---|---|---|
| `text-embedding-3-small` | 1536 | 8191 | ~$0.02/1M tokens | Multilingue | Bon rapport qualité/prix |
| `text-embedding-3-large` | 3072 | 8191 | ~$0.13/1M tokens | Multilingue | Plus précis, plus cher |
| `embed-multilingual-v3.0` | 1024 | 512 | ~$0.10/1M tokens | 100+ langues | Excellent pour le multilingue |
| `all-MiniLM-L6-v2` | 384 | 256 | Gratuit (local) | Anglais (correct FR) | Léger, rapide, ~80 Mo |
| `multilingual-e5-large` | 1024 | 512 | Gratuit (local) | Multilingue | ~2.2 Go, nécessite GPU recommandé |
| `mistral-embed` | 1024 | 8192 | ~$0.10/1M tokens | Multilingue | Bon pour le français |

### 2.4 Gestion des clés API

L'Étape 3 introduit le **premier composant de gestion sécurisée des secrets** dans RAGKIT. Ce composant sera réutilisé aux étapes suivantes (reranking Cohere, LLM, etc.).

#### Architecture de sécurité des clés

```
┌─────────────────────────────────────────────────────┐
│                 Gestion des clés API                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. Saisie : champ masqué (•••) avec toggle 👁     │
│                                                     │
│  2. Stockage primaire : keyring système natif       │
│     └─ Windows : Windows Credential Manager         │
│     └─ macOS   : Keychain                           │
│     └─ Linux   : Secret Service (GNOME Keyring)     │
│                                                     │
│  3. Fallback : fichier ~/.ragkit/credentials.enc    │
│     └─ Chiffrement AES-256-GCM                      │
│     └─ Clé dérivée de la machine (PBKDF2)           │
│                                                     │
│  4. En mémoire : jamais persistée en clair          │
│     └─ Déchiffrée à la volée pour chaque appel API  │
│     └─ Jamais loggée, jamais dans settings.json     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Règles de sécurité strictes** :
- Les clés API ne sont **jamais** stockées dans `settings.json`.
- Les clés API ne sont **jamais** loggées (ni en clair, ni en hash).
- Le champ `api_key` dans `settings.json` contient uniquement un **indicateur** : `"api_key_set": true/false`.
- Les clés sont stockées dans le trousseau système natif (`keyring`) avec le service `ragkit` et un nom de clé structuré (ex : `ragkit.embedding.openai.api_key`).
- Si `keyring` n'est pas disponible (environnement headless), fallback sur un fichier chiffré `~/.ragkit/credentials.enc` (AES-256-GCM, clé dérivée via PBKDF2 à partir d'un identifiant machine).

**Interface utilisateur** :
- Le champ de clé API est masqué par défaut (caractères `•`).
- Bouton 👁 pour afficher/masquer temporairement la clé.
- Bouton ✎ pour modifier la clé (ouvre un champ de saisie).
- Indicateur visuel : 🟢 "Clé configurée" / 🔴 "Clé manquante".
- Bouton 🗑 pour supprimer la clé stockée (avec confirmation).

### 2.5 Modèle de requêtes (Query Model)

Par défaut, la case "Identique au modèle de documents" est cochée. Dans ce cas, le même modèle/provider est utilisé pour les embeddings de documents et de requêtes.

Si l'utilisateur décoche, un second bloc de configuration identique apparaît pour le modèle de requêtes. Cas d'usage : certains modèles asymétriques ont des modèles distincts pour documents et queries (ex : `intfloat/e5-*` avec préfixes `passage:` et `query:`).

**Note** : le provider du modèle de requêtes peut être différent de celui du modèle de documents (ex : OpenAI pour les documents, Ollama local pour les requêtes), mais les **dimensions doivent être identiques**. Si les dimensions diffèrent, un avertissement s'affiche : "⚠️ Les dimensions du modèle de requêtes (384) ne correspondent pas à celles du modèle de documents (1536). La recherche ne fonctionnera pas correctement."

### 2.6 Test de connexion

Le bouton "🔌 Tester la connexion" envoie un texte de test au provider configuré et vérifie :

1. **Accessibilité** : le provider est joignable (réseau, URL).
2. **Authentification** : la clé API est valide (pour les providers cloud).
3. **Modèle** : le modèle demandé est disponible.
4. **Résultat** : un vecteur est retourné avec les bonnes dimensions.

| Statut | Affichage |
|--------|-----------|
| Succès | 🟢 "Connexion réussie · 1536 dimensions · 145 ms" |
| Erreur auth | 🔴 "Clé API invalide ou expirée" |
| Erreur réseau | 🔴 "Provider injoignable — vérifiez votre connexion" |
| Modèle inconnu | 🔴 "Modèle 'xxx' non trouvé chez le provider" |
| Timeout | 🟡 "Timeout après 30s — essayez avec un modèle plus léger" |

### 2.7 Panneau de test d'embedding

Ce panneau permet à l'utilisateur de tester interactivement l'embedding et de comprendre la similarité sémantique.

**Fonctionnement** :
1. Deux champs de texte libre (Texte A, Texte B) pré-remplis avec des exemples pertinents au profil actif.
2. Bouton "Tester l'embedding" : envoie les deux textes au provider, récupère les vecteurs, calcule la similarité cosinus.
3. **Affichage des résultats** :
   - Dimensions du vecteur retourné
   - Nombre de tokens de chaque texte
   - Latence de chaque appel (ms)
   - **Similarité cosinus** entre les deux vecteurs, avec barre visuelle et qualificatif :
     - 0.0 — 0.3 : "Faible" (rouge)
     - 0.3 — 0.6 : "Modérée" (orange)
     - 0.6 — 0.8 : "Élevée" (vert clair)
     - 0.8 — 1.0 : "Très élevée" (vert)

**Valeurs pré-remplies selon le profil** :

| Profil | Texte A (exemple) | Texte B (exemple) |
|--------|-------------------|-------------------|
| `technical_documentation` | "Comment configurer l'authentification OAuth2 dans l'API REST ?" | "Configuration de l'authentification et des tokens d'accès" |
| `faq_support` | "Je n'arrive pas à me connecter à mon compte" | "Problème de connexion et réinitialisation du mot de passe" |
| `legal_compliance` | "Les obligations du prestataire sont définies à l'article 5" | "Article 5 — Engagements et responsabilités du fournisseur" |
| `reports_analysis` | "Le chiffre d'affaires a progressé de 12% au T3 2024" | "Croissance des revenus au troisième trimestre" |
| `general` | "Les effets du changement climatique sur l'agriculture" | "Impact du réchauffement global sur les cultures" |

### 2.8 Dimensions configurables

Certains modèles permettent de choisir les dimensions du vecteur (ex : OpenAI `text-embedding-3-small` peut produire 256, 512, 1024 ou 1536 dimensions via le paramètre `dimensions`).

**Comportements** :
- Si le modèle supporte des dimensions variables, un sélecteur dropdown apparaît avec les options du modèle et la valeur par défaut sélectionnée.
- Si le modèle a des dimensions fixes, le champ affiche la valeur en lecture seule avec un tooltip "Ce modèle ne supporte qu'une seule dimension."
- Une note informative est affichée : "Moins de dimensions = plus rapide et moins de stockage, mais potentiellement moins précis."

### 2.9 Cache d'embeddings

Le cache évite de recalculer des embeddings pour des textes déjà vectorisés. Il est particulièrement utile pendant la phase d'itération (modification de paramètres de chunking → re-embedding).

| Backend | Stockage | Persistance | Performance |
|---------|----------|:-----------:|-------------|
| `memory` | Dictionnaire en mémoire | Non (perdu au redémarrage) | Très rapide |
| `disk` | Fichier SQLite dans `~/.ragkit/cache/embeddings.db` | Oui | Rapide |

**Comportements** :
- Le cache utilise un hash SHA-256 du texte + identifiant modèle comme clé.
- Le compteur affiche le nombre d'entrées et la taille du cache.
- Le bouton "Vider le cache" supprime toutes les entrées (avec confirmation).
- Si l'utilisateur change de modèle d'embedding, le cache est automatiquement invalidé (car les vecteurs ne sont plus compatibles). Un avertissement s'affiche : "⚠️ Le changement de modèle invalidera le cache d'embeddings existant (N entrées)."

### 2.10 Intégration avec le chunking sémantique (Étape 2)

À l'Étape 2, le chunking sémantique utilisait un modèle léger embarqué (`all-MiniLM-L6-v2`). À partir de l'Étape 3, si l'utilisateur a configuré un modèle d'embedding :
- Le chunking sémantique utilise **le modèle d'embedding configuré** au lieu du modèle embarqué.
- Si le modèle configuré est un provider cloud (OpenAI, Cohere…), un avertissement est affiché dans les paramètres de chunking : "⚠️ Le chunking sémantique avec un provider cloud génère des coûts API. Pour la prévisualisation, le modèle léger embarqué reste utilisé."
- La **prévisualisation** du chunking continue d'utiliser le modèle léger (pour ne pas consommer de crédits API à chaque clic sur "Prévisualiser").

---

## 3. Catalogue complet des paramètres EMBEDDING

### 3.1 Paramètres du modèle de documents

| Paramètre | Clé config | Type | Options | Défaut | Description |
|-----------|------------|------|---------|--------|-------------|
| Provider | `embedding.provider` | enum | `openai` \| `ollama` \| `huggingface` \| `cohere` \| `voyageai` \| `mistral` | Selon profil | Fournisseur du modèle d'embedding |
| Modèle | `embedding.model` | string | Dépend du provider | Selon profil | Identifiant du modèle |
| Clé API configurée | `embedding.api_key_set` | bool | — | `false` | Indicateur uniquement (la clé est dans keyring) |

### 3.2 Paramètres du modèle de requêtes

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Identique au document | `embedding.query_model.same_as_document` | bool | `true` | Utiliser le même modèle pour les documents et les requêtes |
| Provider (requêtes) | `embedding.query_model.provider` | enum | — | Provider spécifique pour les requêtes (si différent) |
| Modèle (requêtes) | `embedding.query_model.model` | string | — | Modèle spécifique pour les requêtes (si différent) |

### 3.3 Paramètres de vectorisation

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Dimensions | `embedding.dimensions` | int \| null | 64 | 4096 | `null` (auto) | Nombre de dimensions du vecteur. `null` = utiliser la dimension par défaut du modèle. |
| Batch size | `embedding.batch_size` | int | 1 | 2048 | Selon profil | Nombre de textes envoyés par requête d'embedding. Plus haut = plus rapide mais plus de mémoire. |
| Normalisation L2 | `embedding.normalize` | bool | — | — | `true` | Normaliser les vecteurs (norme L2 = 1). Nécessaire pour la similarité cosinus. |

### 3.4 Paramètres de cache

| Paramètre | Clé config | Type | Options | Défaut | Description |
|-----------|------------|------|---------|--------|-------------|
| Cache activé | `embedding.cache_enabled` | bool | — | `true` | Mettre en cache les embeddings pour éviter les recalculs |
| Backend de cache | `embedding.cache_backend` | enum | `memory` \| `disk` | `disk` | `memory` = en mémoire (perdu au redémarrage). `disk` = SQLite persistant. |

### 3.5 Paramètres avancés

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Timeout | `embedding.timeout` | int (s) | 5 | 120 | 30 | Timeout par requête d'embedding |
| Max retries | `embedding.max_retries` | int | 0 | 10 | 3 | Nombre de tentatives en cas d'échec réseau/API |
| Rate limit | `embedding.rate_limit_rpm` | int | 0 | 10000 | 3000 | Limite de requêtes par minute (0 = illimité). Respect des quotas API du provider. |
| Truncation | `embedding.truncation` | enum | `start` \| `end` \| `middle` | `end` | Stratégie si le texte dépasse la limite de tokens du modèle. `end` = tronque la fin. |

### 3.6 Résumé des impacts

| Paramètre | Impact principal | Impact secondaire |
|-----------|-----------------|-------------------|
| `provider` + `model` | **FONDAMENTAL** — Qualité de la compréhension sémantique | Coût, latence, nécessité d'une clé API |
| `dimensions` | Compromis précision / stockage / performance | Affecte la taille de la BDD vectorielle |
| `batch_size` | Vitesse d'ingestion | Utilisation mémoire, risque de timeout |
| `normalize` | Cohérence des scores de similarité | Quasi obligatoire pour cosine similarity |
| `cache_enabled` | Économies de coût et de temps lors des ré-embeddings | Espace disque |
| `timeout` | Tolérance aux latences réseau | Risque de faux négatifs si trop court |
| `rate_limit_rpm` | Respect des quotas API | Peut ralentir l'ingestion |
| `truncation` | Gestion des chunks dépassant la limite du modèle | Perte d'information en fin/début de chunk |

---

## 4. Valeurs par défaut par profil

Les valeurs par défaut sont déjà calculées et stockées dans `settings.json` par le wizard de l'Étape 1 (section `embedding`). Cette étape **active et utilise** ces valeurs.

### 4.1 Matrice profil → paramètres d'embedding

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|:---:|:---:|:---:|:---:|:---:|
| `provider` | `openai` | `openai` | `openai` | `openai` | `openai` |
| `model` | `text-embedding-3-small` | `text-embedding-3-small` | `text-embedding-3-small` | `text-embedding-3-small` | `text-embedding-3-small` |
| `batch_size` | 100 | 100 | 50 | 100 | 100 |
| `cache_enabled` | `true` | `true` | `true` | `true` | `true` |
| `normalize` | `true` | `true` | `true` | `true` | `true` |
| `dimensions` | `null` (1536) | `null` (1536) | `null` (1536) | `null` (1536) | `null` (1536) |
| `cache_backend` | `disk` | `disk` | `disk` | `disk` | `disk` |
| `timeout` | 30 | 30 | 30 | 30 | 30 |
| `max_retries` | 3 | 3 | 3 | 3 | 3 |
| `rate_limit_rpm` | 3000 | 3000 | 3000 | 3000 | 3000 |
| `truncation` | `end` | `end` | `end` | `end` | `end` |
| `query_model.same_as_document` | `true` | `true` | `true` | `true` | `true` |

### 4.2 Justification des choix

Tous les profils utilisent OpenAI `text-embedding-3-small` par défaut, car c'est le modèle qui offre le meilleur compromis qualité/coût/simplicité de configuration pour un premier usage. Les modèles locaux (Ollama, HuggingFace) sont proposés en alternative mais nécessitent une installation supplémentaire.

Le profil `legal_compliance` utilise un `batch_size` de 50 (au lieu de 100) pour être plus conservateur avec les gros chunks juridiques (1024+ tokens) qui approchent de la limite du modèle.

### 4.3 Impact des modificateurs de calibrage sur l'embedding

Aucune question de calibrage de l'Étape 1 n'impacte directement les paramètres d'embedding. Les valeurs sont uniformes entre profils (seul `batch_size` varie).

---

## 5. Spécifications techniques

### 5.1 Schéma Pydantic (backend)

```python
# ragkit/config/embedding_schema.py
"""Pydantic schemas for embedding configuration."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class EmbeddingProvider(str, Enum):
    OPENAI = "openai"
    OLLAMA = "ollama"
    HUGGINGFACE = "huggingface"
    COHERE = "cohere"
    VOYAGEAI = "voyageai"
    MISTRAL = "mistral"


class TruncationStrategy(str, Enum):
    START = "start"
    END = "end"
    MIDDLE = "middle"


class CacheBackend(str, Enum):
    MEMORY = "memory"
    DISK = "disk"


class QueryModelConfig(BaseModel):
    """Configuration for the query embedding model."""
    same_as_document: bool = True
    provider: EmbeddingProvider | None = None
    model: str | None = None
    api_key_set: bool = False

    @model_validator(mode="after")
    def validate_query_model(self) -> "QueryModelConfig":
        if not self.same_as_document:
            if self.provider is None or self.model is None:
                raise ValueError(
                    "provider and model are required when "
                    "same_as_document is False")
        return self


class EmbeddingConfig(BaseModel):
    """Complete embedding configuration."""

    # Document model
    provider: EmbeddingProvider = EmbeddingProvider.OPENAI
    model: str = "text-embedding-3-small"
    api_key_set: bool = Field(default=False,
        description="Indicator only — actual key is in keyring")

    # Query model
    query_model: QueryModelConfig = Field(
        default_factory=QueryModelConfig)

    # Vectorization parameters
    dimensions: int | None = Field(default=None,
        description="Vector dimensions (null = model default)")
    batch_size: int = Field(default=100, ge=1, le=2048)
    normalize: bool = Field(default=True,
        description="L2-normalize vectors")

    # Cache
    cache_enabled: bool = True
    cache_backend: CacheBackend = CacheBackend.DISK

    # Advanced
    timeout: int = Field(default=30, ge=5, le=120)
    max_retries: int = Field(default=3, ge=0, le=10)
    rate_limit_rpm: int = Field(default=3000, ge=0, le=10000)
    truncation: TruncationStrategy = TruncationStrategy.END
```

### 5.2 Gestionnaire de secrets (backend)

```python
# ragkit/security/secrets.py
"""Secure API key management using system keyring with encrypted fallback."""

from __future__ import annotations

import hashlib
import json
import os
import platform
from pathlib import Path

import keyring
from keyring.errors import NoKeyringError

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

SERVICE_NAME = "ragkit"
CREDENTIALS_FILE = Path.home() / ".ragkit" / "credentials.enc"


class SecretsManager:
    """Manages API keys securely via keyring or encrypted file fallback."""

    def __init__(self):
        self._keyring_available = self._check_keyring()
        if not self._keyring_available:
            self._fernet = self._init_fernet()

    def _check_keyring(self) -> bool:
        """Check if system keyring is available."""
        try:
            keyring.get_password(SERVICE_NAME, "__test__")
            return True
        except NoKeyringError:
            return False

    def _get_machine_id(self) -> bytes:
        """Derive a machine-specific identifier."""
        info = f"{platform.node()}-{platform.machine()}-{os.getlogin()}"
        return hashlib.sha256(info.encode()).digest()

    def _init_fernet(self) -> Fernet:
        """Initialize Fernet cipher with machine-derived key."""
        salt = b"ragkit-credential-salt-v1"
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,
        )
        key = base64.urlsafe_b64encode(
            kdf.derive(self._get_machine_id()))
        return Fernet(key)

    def store(self, key_name: str, value: str) -> None:
        """Store a secret securely."""
        if self._keyring_available:
            keyring.set_password(SERVICE_NAME, key_name, value)
        else:
            self._store_in_file(key_name, value)

    def retrieve(self, key_name: str) -> str | None:
        """Retrieve a secret."""
        if self._keyring_available:
            return keyring.get_password(SERVICE_NAME, key_name)
        return self._retrieve_from_file(key_name)

    def delete(self, key_name: str) -> None:
        """Delete a secret."""
        if self._keyring_available:
            try:
                keyring.delete_password(SERVICE_NAME, key_name)
            except keyring.errors.PasswordDeleteError:
                pass
        else:
            self._delete_from_file(key_name)

    def exists(self, key_name: str) -> bool:
        """Check if a secret exists."""
        return self.retrieve(key_name) is not None

    # --- Encrypted file fallback ---

    def _load_credentials_file(self) -> dict:
        if not CREDENTIALS_FILE.exists():
            return {}
        encrypted = CREDENTIALS_FILE.read_bytes()
        decrypted = self._fernet.decrypt(encrypted)
        return json.loads(decrypted)

    def _save_credentials_file(self, data: dict) -> None:
        CREDENTIALS_FILE.parent.mkdir(parents=True, exist_ok=True)
        encrypted = self._fernet.encrypt(
            json.dumps(data).encode())
        CREDENTIALS_FILE.write_bytes(encrypted)

    def _store_in_file(self, key_name: str, value: str) -> None:
        data = self._load_credentials_file()
        data[key_name] = value
        self._save_credentials_file(data)

    def _retrieve_from_file(self, key_name: str) -> str | None:
        data = self._load_credentials_file()
        return data.get(key_name)

    def _delete_from_file(self, key_name: str) -> None:
        data = self._load_credentials_file()
        data.pop(key_name, None)
        self._save_credentials_file(data)
```

**Convention de nommage des clés** :

| Composant | Clé dans keyring | Exemple |
|-----------|-----------------|---------|
| Embedding document | `ragkit.embedding.{provider}.api_key` | `ragkit.embedding.openai.api_key` |
| Embedding requête | `ragkit.embedding.query.{provider}.api_key` | `ragkit.embedding.query.cohere.api_key` |
| Reranking (futur) | `ragkit.rerank.{provider}.api_key` | `ragkit.rerank.cohere.api_key` |
| LLM (futur) | `ragkit.llm.{provider}.api_key` | `ragkit.llm.openai.api_key` |

### 5.3 Moteur d'embedding (backend)

```python
# ragkit/embedding/engine.py
"""Embedding engine — dispatches to provider implementations."""

from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np

from ragkit.config.embedding_schema import EmbeddingConfig, EmbeddingProvider


class BaseEmbeddingProvider(ABC):
    """Abstract base class for all embedding providers."""

    def __init__(self, config: EmbeddingConfig, api_key: str | None = None):
        self.config = config
        self.api_key = api_key

    @abstractmethod
    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts and return vectors."""
        ...

    @abstractmethod
    async def embed_query(self, query: str) -> list[float]:
        """Embed a single query text."""
        ...

    @abstractmethod
    async def test_connection(self) -> ConnectionTestResult:
        """Test that the provider is reachable and functional."""
        ...

    @abstractmethod
    def get_model_info(self) -> ModelInfo:
        """Return metadata about the configured model."""
        ...


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    """OpenAI embedding API provider."""
    ...


class OllamaEmbeddingProvider(BaseEmbeddingProvider):
    """Ollama local embedding provider."""
    ...


class HuggingFaceEmbeddingProvider(BaseEmbeddingProvider):
    """Local embedding via sentence-transformers or ONNX runtime."""
    ...


class CohereEmbeddingProvider(BaseEmbeddingProvider):
    """Cohere embedding API provider."""
    ...


class VoyageAIEmbeddingProvider(BaseEmbeddingProvider):
    """VoyageAI embedding API provider."""
    ...


class MistralEmbeddingProvider(BaseEmbeddingProvider):
    """Mistral embedding API provider."""
    ...


# Provider registry
PROVIDER_REGISTRY: dict[EmbeddingProvider, type[BaseEmbeddingProvider]] = {
    EmbeddingProvider.OPENAI: OpenAIEmbeddingProvider,
    EmbeddingProvider.OLLAMA: OllamaEmbeddingProvider,
    EmbeddingProvider.HUGGINGFACE: HuggingFaceEmbeddingProvider,
    EmbeddingProvider.COHERE: CohereEmbeddingProvider,
    EmbeddingProvider.VOYAGEAI: VoyageAIEmbeddingProvider,
    EmbeddingProvider.MISTRAL: MistralEmbeddingProvider,
}


def create_embedding_provider(
    config: EmbeddingConfig,
    api_key: str | None = None,
) -> BaseEmbeddingProvider:
    """Factory function to create the appropriate embedding provider."""
    provider_cls = PROVIDER_REGISTRY[config.provider]
    return provider_cls(config, api_key)
```

### 5.4 Cache d'embeddings (backend)

```python
# ragkit/embedding/cache.py
"""Embedding cache with memory and disk backends."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from abc import ABC, abstractmethod
from pathlib import Path

from ragkit.config.embedding_schema import CacheBackend


class BaseEmbeddingCache(ABC):
    """Abstract base class for embedding caches."""

    @abstractmethod
    def get(self, text: str, model_id: str) -> list[float] | None:
        ...

    @abstractmethod
    def put(self, text: str, model_id: str, vector: list[float]) -> None:
        ...

    @abstractmethod
    def clear(self) -> None:
        ...

    @abstractmethod
    def stats(self) -> CacheStats:
        ...

    @staticmethod
    def cache_key(text: str, model_id: str) -> str:
        """Generate a deterministic cache key."""
        content = f"{model_id}::{text}"
        return hashlib.sha256(content.encode()).hexdigest()


class MemoryEmbeddingCache(BaseEmbeddingCache):
    """In-memory embedding cache (dict-based)."""

    def __init__(self):
        self._store: dict[str, list[float]] = {}

    def get(self, text: str, model_id: str) -> list[float] | None:
        return self._store.get(self.cache_key(text, model_id))

    def put(self, text: str, model_id: str, vector: list[float]) -> None:
        self._store[self.cache_key(text, model_id)] = vector

    def clear(self) -> None:
        self._store.clear()

    def stats(self) -> "CacheStats":
        return CacheStats(
            entries=len(self._store),
            size_bytes=0,  # Approximate
        )


class DiskEmbeddingCache(BaseEmbeddingCache):
    """SQLite-backed persistent embedding cache."""

    DB_PATH = Path.home() / ".ragkit" / "cache" / "embeddings.db"

    def __init__(self):
        self.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.DB_PATH))
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS embeddings (
                key TEXT PRIMARY KEY,
                model_id TEXT NOT NULL,
                vector BLOB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

    # ... implementation ...


class CacheStats:
    entries: int
    size_bytes: int
```

### 5.5 API REST (routes backend)

#### 5.5.1 Routes Embedding Config

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/embedding/config` | GET | Config embedding courante | — | `EmbeddingConfig` |
| `/api/embedding/config` | PUT | Met à jour la config | `EmbeddingConfig` (partiel) | `EmbeddingConfig` |
| `/api/embedding/config/reset` | POST | Réinitialise au profil actif | — | `EmbeddingConfig` |

#### 5.5.2 Routes Secrets (clés API)

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/secrets/store` | POST | Stocke une clé API | `{ key_name: string, value: string }` | `{ success: bool }` |
| `/api/secrets/exists` | POST | Vérifie si une clé existe | `{ key_name: string }` | `{ exists: bool }` |
| `/api/secrets/delete` | POST | Supprime une clé API | `{ key_name: string }` | `{ success: bool }` |

> **Important** : il n'y a **pas** de route `GET` pour récupérer une clé API. La clé n'est jamais transmise au frontend. Le frontend ne connaît que l'indicateur `api_key_set: true/false`.

#### 5.5.3 Routes Test & Environnement

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/embedding/test-connection` | POST | Teste la connexion au provider | `{ provider?, model? }` (optionnel, sinon config courante) | `ConnectionTestResult` |
| `/api/embedding/test-embedding` | POST | Teste l'embedding de deux textes | `{ text_a: string, text_b: string }` | `EmbeddingTestResult` |
| `/api/embedding/environment` | GET | Détection de l'environnement local | — | `EnvironmentInfo` |
| `/api/embedding/models` | GET | Liste les modèles disponibles pour un provider | `?provider=openai` | `AvailableModelsResponse` |
| `/api/embedding/cache/stats` | GET | Statistiques du cache | — | `CacheStats` |
| `/api/embedding/cache/clear` | POST | Vide le cache | — | `{ success: bool, entries_cleared: int }` |

#### 5.5.4 Modèles de réponse

```python
class ConnectionTestResult(BaseModel):
    success: bool
    provider: str
    model: str
    dimensions: int | None = None
    latency_ms: int | None = None
    error: str | None = None
    error_code: str | None = None   # "auth_error", "network_error",
                                     # "model_not_found", "timeout"

class EmbeddingTestResult(BaseModel):
    success: bool
    text_a: TextEmbeddingInfo
    text_b: TextEmbeddingInfo
    cosine_similarity: float | None = None
    error: str | None = None

class TextEmbeddingInfo(BaseModel):
    text_preview: str               # Tronqué à 100 caractères
    token_count: int
    dimensions: int
    latency_ms: int

class AvailableModelsResponse(BaseModel):
    provider: str
    models: list[ModelInfo]

class ModelInfo(BaseModel):
    id: str                          # Ex: "text-embedding-3-small"
    display_name: str                # Ex: "Text Embedding 3 Small"
    dimensions: int | list[int]      # Fixe ou variable
    max_tokens: int
    cost_per_million: float | None   # En USD, null pour local
    languages: str                   # "multilingue", "anglais", etc.
    description: str
    local: bool                      # true si exécuté localement

class EnvironmentInfo(BaseModel):
    gpu_available: bool
    gpu_name: str | None = None
    gpu_backend: str | None = None   # "cuda", "mps", null
    ollama_available: bool
    ollama_version: str | None = None
    ollama_models: list[str] = Field(default_factory=list)
    local_cached_models: list[str] = Field(default_factory=list)
    keyring_available: bool

class CacheStats(BaseModel):
    entries: int
    size_mb: float
    backend: str                     # "memory" or "disk"
    model_id: str | None = None      # Modèle associé au cache actuel
```

### 5.6 Commandes Tauri (Rust) — ajouts

```rust
// desktop/src-tauri/src/commands.rs (ajouts Étape 3)

// Embedding config
#[tauri::command]
pub async fn get_embedding_config() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn update_embedding_config(config: serde_json::Value) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn reset_embedding_config() -> Result<serde_json::Value, String> { ... }

// Secrets management
#[tauri::command]
pub async fn store_secret(key_name: String, value: String) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn secret_exists(key_name: String) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn delete_secret(key_name: String) -> Result<serde_json::Value, String> { ... }

// Test & environment
#[tauri::command]
pub async fn test_embedding_connection(
    provider: Option<String>,
    model: Option<String>
) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn test_embedding(text_a: String, text_b: String) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn get_embedding_environment() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn get_available_models(provider: String) -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn get_embedding_cache_stats() -> Result<serde_json::Value, String> { ... }

#[tauri::command]
pub async fn clear_embedding_cache() -> Result<serde_json::Value, String> { ... }
```

### 5.7 Composants React — arborescence

```
desktop/src/
├── components/
│   ├── settings/
│   │   ├── IngestionSettings.tsx              ← existant (Étape 1)
│   │   ├── ChunkingSettings.tsx               ← existant (Étape 2)
│   │   ├── EmbeddingSettings.tsx              ← NOUVEAU : section complète
│   │   ├── EnvironmentPanel.tsx               ← NOUVEAU : détection GPU/Ollama
│   │   ├── ProviderSelector.tsx               ← NOUVEAU : sélecteur provider + modèle
│   │   ├── ModelInfoCard.tsx                  ← NOUVEAU : fiche descriptive du modèle
│   │   ├── ApiKeyInput.tsx                    ← NOUVEAU : champ clé API sécurisé
│   │   ├── QueryModelPanel.tsx                ← NOUVEAU : config modèle requêtes
│   │   ├── VectorizationParams.tsx            ← NOUVEAU : dimensions, batch, normalisation
│   │   ├── EmbeddingCachePanel.tsx            ← NOUVEAU : config et stats du cache
│   │   ├── ConnectionTestButton.tsx           ← NOUVEAU : bouton test connexion
│   │   └── EmbeddingTestPanel.tsx             ← NOUVEAU : panneau test similarité
│   └── ui/
│       ├── SecretInput.tsx                    ← NOUVEAU : input masqué générique
│       ├── StatusIndicator.tsx                ← NOUVEAU : indicateur 🟢🟡🔴⚪
│       ├── SimilarityBar.tsx                  ← NOUVEAU : barre de similarité visuelle
│       └── ... (existants Étape 1-2)
├── hooks/
│   ├── useEmbeddingConfig.ts                  ← NOUVEAU : hook config embedding
│   ├── useEnvironment.ts                      ← NOUVEAU : hook détection environnement
│   ├── useSecrets.ts                          ← NOUVEAU : hook gestion clés API
│   ├── useConnectionTest.ts                   ← NOUVEAU : hook test connexion
│   └── useEmbeddingTest.ts                    ← NOUVEAU : hook test embedding
├── lib/
│   └── ipc.ts                                 ← MODIFIER : ajouter routes embedding + secrets
└── locales/
    ├── fr.json                                ← MODIFIER : ajouter clés embedding
    └── en.json                                ← MODIFIER : ajouter clés embedding
```

### 5.8 Détail des composants clés

#### `ApiKeyInput.tsx`

Composant réutilisable pour la saisie sécurisée de clés API. Sera réutilisé pour Reranking (Étape 8) et LLM (Étape 9).

```tsx
interface ApiKeyInputProps {
  keyName: string;           // ex: "ragkit.embedding.openai.api_key"
  provider: string;          // ex: "openai"
  isSet: boolean;            // true si la clé est déjà stockée
  onKeyStored: () => void;   // callback après sauvegarde
  onKeyDeleted: () => void;  // callback après suppression
}

export function ApiKeyInput({ keyName, provider, isSet, ...props }: ApiKeyInputProps) {
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  // La clé n'est JAMAIS récupérée du backend pour l'afficher
  // Le frontend connaît uniquement isSet: true/false

  return (
    <div>
      {isSet && !editing ? (
        <div className="flex items-center gap-2">
          <span className="text-green-600">🟢 Clé configurée</span>
          <button onClick={() => setEditing(true)}>✎ Modifier</button>
          <button onClick={handleDelete}>🗑</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type={visible ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sk-..."
          />
          <button onClick={() => setVisible(!visible)}>👁</button>
          <button onClick={handleSave} disabled={!value}>Sauvegarder</button>
        </div>
      )}
    </div>
  );
}
```

#### `ProviderSelector.tsx`

Sélecteur de provider avec affichage conditionnel de la liste de modèles et de la fiche descriptive.

```tsx
export function ProviderSelector({
  provider, model, onProviderChange, onModelChange
}: ProviderSelectorProps) {
  const { environment } = useEnvironment();
  const { data: models } = useAvailableModels(provider);

  const providers = [
    { id: "openai", name: "OpenAI", icon: "🌐", needsKey: true },
    { id: "ollama", name: "Ollama (local)", icon: "🦙", needsKey: false,
      disabled: !environment?.ollama_available },
    { id: "huggingface", name: "HuggingFace (local)", icon: "🤗", needsKey: false },
    { id: "cohere", name: "Cohere", icon: "🌐", needsKey: true },
    { id: "voyageai", name: "VoyageAI", icon: "🌐", needsKey: true },
    { id: "mistral", name: "Mistral", icon: "🌐", needsKey: true },
  ];

  return (
    <>
      <Select label="Provider" options={providers} value={provider}
              onChange={onProviderChange} />
      <Select label="Modèle" options={models} value={model}
              onChange={onModelChange} />
      {selectedModel && <ModelInfoCard model={selectedModel} />}
    </>
  );
}
```

### 5.9 Persistance

La config embedding est stockée dans `settings.json` :

```json
{
  "version": "1.0.0",
  "setup_completed": true,
  "profile": "legal_compliance",
  "calibration_answers": { "...": "..." },
  "ingestion": { "...": "..." },
  "chunking": { "...": "..." },
  "embedding": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "api_key_set": true,
    "query_model": {
      "same_as_document": true
    },
    "dimensions": null,
    "batch_size": 50,
    "normalize": true,
    "cache_enabled": true,
    "cache_backend": "disk",
    "timeout": 30,
    "max_retries": 3,
    "rate_limit_rpm": 3000,
    "truncation": "end"
  },
  "retrieval": { "...": "valeurs calculées, utilisées aux Étapes 5-7" },
  "rerank": { "...": "valeurs calculées, utilisées à l'Étape 8" },
  "llm": { "...": "valeurs calculées, utilisées à l'Étape 9" },
  "agents": { "...": "valeurs calculées, utilisées à l'Étape 10" }
}
```

> **Rappel** : `api_key_set: true` est un indicateur. La clé réelle est dans le keyring système sous `ragkit.embedding.openai.api_key`.

### 5.10 Dépendances Python ajoutées

```toml
# pyproject.toml — ajouts aux dependencies pour Étape 3
dependencies = [
    # ... (existants Étapes 0-2)
    "openai>=1.0",                  # Client API OpenAI (embedding)
    "cohere>=5.0",                  # Client API Cohere (embedding)
    "voyageai>=0.2",                # Client API VoyageAI (embedding)
    "mistralai>=0.1",               # Client API Mistral (embedding)
    "httpx>=0.25",                  # Client HTTP async (Ollama)
    "onnxruntime>=1.16",            # Inférence locale rapide
    "huggingface_hub>=0.20",        # Téléchargement de modèles
    "keyring>=24.0",                # Trousseau système natif
    "cryptography>=41.0",           # AES-256 pour credentials (fallback)
    "numpy>=1.24",                  # Opérations vectorielles (similarité cosinus)
]
```

> **Note** : `sentence-transformers` (ajouté à l'Étape 2 pour le chunking sémantique) est toujours présent. À l'Étape 3, il est également utilisé comme backend pour le provider `huggingface` si ONNX Runtime n'est pas disponible.

### 5.11 Flux d'exécution des providers

#### Provider OpenAI

```
1. Récupérer la clé API depuis keyring (ragkit.embedding.openai.api_key)
2. Initialiser le client openai.AsyncOpenAI(api_key=...)
3. Découper les textes en batches de batch_size
4. Pour chaque batch :
   a. Appel openai.embeddings.create(model=..., input=batch, dimensions=...)
   b. Retry avec backoff exponentiel si erreur (max_retries)
   c. Respect du rate_limit_rpm (sleep si nécessaire)
5. Normaliser les vecteurs si normalize=true
6. Mettre en cache si cache_enabled=true
7. Retourner les vecteurs
```

#### Provider Ollama

```
1. Vérifier qu'Ollama est accessible (http://localhost:11434)
2. Pour chaque texte (Ollama n'a pas de batch natif) :
   a. POST http://localhost:11434/api/embeddings { model: ..., prompt: text }
   b. Extraire le vecteur de la réponse
3. Normaliser si nécessaire
4. Mettre en cache
5. Retourner les vecteurs
```

#### Provider HuggingFace (local)

```
1. Vérifier si le modèle est en cache (~/.ragkit/models/)
2. Si non : télécharger via huggingface_hub.snapshot_download()
3. Charger le modèle :
   a. Priorité ONNX Runtime si le modèle a un fichier .onnx
   b. Sinon sentence-transformers (PyTorch)
4. Encoder les textes en batches
5. Normaliser si nécessaire
6. Mettre en cache
7. Retourner les vecteurs
```

---

## 6. Critères d'acceptation

### 6.1 Fonctionnels

| # | Critère |
|---|---------|
| F1 | La section `PARAMÈTRES > Paramètres avancés > EMBEDDING` est accessible et affiche tous les paramètres |
| F2 | Le panneau "Environnement détecté" affiche le statut GPU, Ollama et modèles locaux |
| F3 | Le sélecteur de provider propose les 6 providers avec les modèles associés |
| F4 | Les providers cloud nécessitant une clé API affichent le champ de saisie sécurisé |
| F5 | Le champ de clé API est masqué par défaut et ne révèle jamais la clé stockée |
| F6 | Le bouton "Tester la connexion" vérifie l'accessibilité, l'authentification et le modèle |
| F7 | Le résultat du test affiche le statut (succès/erreur), les dimensions et la latence |
| F8 | Le provider Ollama est grisé si Ollama n'est pas détecté |
| F9 | La fiche descriptive du modèle (dimensions, max tokens, coût, langues) s'affiche sous le sélecteur |
| F10 | Le panneau "Modèle de requêtes" permet de configurer un modèle distinct ou d'utiliser le même |
| F11 | Un avertissement s'affiche si les dimensions du modèle de requêtes diffèrent du modèle de documents |
| F12 | Le panneau de test d'embedding calcule et affiche la similarité cosinus entre deux textes |
| F13 | La barre de similarité s'affiche avec un code couleur et un qualificatif |
| F14 | Les champs de test sont pré-remplis avec des exemples adaptés au profil actif |
| F15 | Le cache affiche ses statistiques (entrées, taille) et peut être vidé |
| F16 | Un avertissement s'affiche quand un changement de modèle invalide le cache |
| F17 | Les paramètres avancés (timeout, retries, rate limit, truncation) sont configurables |
| F18 | Le badge "Modifié" apparaît à côté de chaque paramètre modifié |
| F19 | Le bouton "Réinitialiser au profil" restaure les valeurs par défaut avec confirmation |
| F20 | Tous les textes sont traduits FR/EN via i18n |

### 6.2 Techniques

| # | Critère |
|---|---------|
| T1 | `GET /api/embedding/config` retourne la config embedding courante |
| T2 | `PUT /api/embedding/config` valide et persiste les modifications |
| T3 | `POST /api/embedding/config/reset` restaure les valeurs du profil actif |
| T4 | `POST /api/secrets/store` stocke une clé dans le keyring (ou fichier chiffré fallback) |
| T5 | `POST /api/secrets/exists` vérifie l'existence sans retourner la valeur |
| T6 | Aucune route ne retourne la clé API en clair |
| T7 | `POST /api/embedding/test-connection` valide la connexion avec le provider configuré |
| T8 | `POST /api/embedding/test-embedding` retourne les vecteurs et la similarité cosinus |
| T9 | Le provider OpenAI fonctionne avec `text-embedding-3-small` et une clé valide |
| T10 | Le provider Ollama fonctionne avec un modèle d'embedding installé localement |
| T11 | Le provider HuggingFace fonctionne avec `all-MiniLM-L6-v2` en local |
| T12 | Le cache disk persiste les embeddings entre redémarrages |
| T13 | Le cache est invalidé automatiquement quand le modèle change |
| T14 | Le pipeline parsing → chunking → embedding fonctionne de bout en bout |
| T15 | La détection de GPU (CUDA/MPS) fonctionne correctement |
| T16 | La détection d'Ollama fonctionne (installé et non installé) |
| T17 | La config embedding est persistée dans `settings.json` sous la clé `embedding` |
| T18 | `tsc --noEmit` ne produit aucune erreur TypeScript |
| T19 | Le CI passe sur les 4 targets (lint + build) |

---

## 7. Périmètre exclus (Étape 3)

- **Stockage vectoriel** : sera ajouté à l'Étape 4.
- **Ingestion complète** : le pipeline fonctionne pour les tests mais les vecteurs ne sont pas persistés dans une BDD vectorielle.
- **Paramètres généraux** : restent vides à cette étape.
- **Chat fonctionnel** : reste un placeholder.
- **Tableau de bord fonctionnel** : reste un placeholder.
- **Réduction de dimensionnalité** (PCA, UMAP) : prévue en amélioration future.
- **Quantification des embeddings** (float16, int8) : prévue en amélioration future.
- **Pooling strategy** (mean, max, cls_token) : prévue en amélioration future.
- **Gestion complète de la sécurité** (rotation des clés, audit trail) : sera finalisée à l'Étape 12.

---

## 8. Estimation

| Tâche | Effort estimé |
|-------|---------------|
| Schéma Pydantic embedding + validation | 0.5 jour |
| `SecretsManager` (keyring + fallback chiffré) | 1.5 jours |
| Implémentation `OpenAIEmbeddingProvider` | 1 jour |
| Implémentation `OllamaEmbeddingProvider` | 1 jour |
| Implémentation `HuggingFaceEmbeddingProvider` (ONNX + sentence-transformers) | 1.5 jours |
| Implémentation `CohereEmbeddingProvider` | 0.5 jour |
| Implémentation `VoyageAIEmbeddingProvider` | 0.5 jour |
| Implémentation `MistralEmbeddingProvider` | 0.5 jour |
| Cache d'embeddings (memory + disk/SQLite) | 1 jour |
| Détection d'environnement (GPU, Ollama, modèles locaux) | 0.5 jour |
| Routes API embedding (config CRUD + test + secrets + cache) | 1.5 jours |
| Commandes Tauri (Rust) | 0.5 jour |
| Composant `EmbeddingSettings.tsx` (orchestrateur) | 1 jour |
| Composant `ProviderSelector.tsx` + `ModelInfoCard.tsx` | 1 jour |
| Composant `ApiKeyInput.tsx` (champ sécurisé réutilisable) | 0.5 jour |
| Composant `EnvironmentPanel.tsx` | 0.5 jour |
| Composant `ConnectionTestButton.tsx` | 0.5 jour |
| Composant `EmbeddingTestPanel.tsx` + `SimilarityBar.tsx` | 1 jour |
| Composant `EmbeddingCachePanel.tsx` | 0.5 jour |
| Composants UI réutilisables (`SecretInput`, `StatusIndicator`) | 0.5 jour |
| Hooks (`useEmbeddingConfig`, `useSecrets`, `useConnectionTest`, etc.) | 1 jour |
| Traductions i18n (FR + EN) — embedding + fiches modèles | 0.5 jour |
| Tests unitaires providers (6 providers × mock API) | 2 jours |
| Tests SecretsManager (keyring + fallback) | 0.5 jour |
| Tests d'intégration (pipeline parsing → chunking → embedding) | 1 jour |
| Tests manuels + corrections | 1 jour |
| **Total** | **~21 jours** |
