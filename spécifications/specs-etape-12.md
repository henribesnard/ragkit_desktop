# 🧰 RAGKIT Desktop — Spécifications Étape 12 : Sécurité, UX & Finalisation

> **Étape** : 12 — Sécurité, UX & Finalisation  
> **Tag cible** : `v1.0.0`  
> **Date** : 18 février 2026  
> **Dépôt** : https://github.com/henribesnard/ragkit_desktop.git  
> **Prérequis** : Étape 11 (Monitoring & Évaluation) implémentée et validée

---

## 1. Objectif

Consolider l'application avec les fonctionnalités de **sécurité**, les **finitions UX**, et les outils d'**import/export** pour livrer une **release v1.0 prête pour la production**. Cette étape ne crée pas de nouveau composant RAG mais finalise, sécurise, et polit l'ensemble du produit.

Cette étape livre :
- **Sécurité renforcée** : audit et consolidation du stockage chiffré des clés API (keyring + AES-256 fallback), chiffrement optionnel des logs de requêtes, détection optionnelle de données personnelles (PII) dans les documents, politique de rétention configurable.
- **Export/Import de configuration** : sauvegarder et restaurer l'intégralité de la config en fichier `.ragkit-config`, pour dupliquer une installation ou migrer.
- **Export de conversations** : exporter une session de chat en Markdown ou PDF.
- **Niveaux d'expertise** : l'utilisateur choisit son niveau (Simple / Intermédiaire / Expert) qui contrôle la visibilité des paramètres dans l'interface.
- **Mode partiel** : le chat devient disponible dès que les premiers documents sont ingérés, même si l'ingestion continue en arrière-plan.
- **Question de test automatique** : après la première ingestion, RAGKIT propose une question-test générée à partir des documents.
- **Récapitulatif des paramètres généraux** : tous les paramètres accumulés au fil des étapes sont consolidés dans une vue unifiée.
- **Polish UX** : animations, transitions, états vides, messages d'erreur, cohérence visuelle, accessibilité clavier.
- **Build de production** : installeurs signés pour Windows (NSIS/MSI), macOS (DMG), Linux (AppImage/DEB).

---

## 2. Spécifications fonctionnelles

### 2.1 Sécurité & confidentialité

#### 2.1.1 Audit des clés API

Le système de gestion des clés API (implémenté à l'Étape 3) fait l'objet d'un audit complet :

**Vérifications** :
- Les clés API ne sont **jamais** présentes dans `settings.json` (uniquement `"api_key_set": true/false`).
- Les clés API ne sont **jamais** loggées dans les journaux (ni `query_logs`, ni fichiers de log Python).
- Le keyring système natif est utilisé en priorité (Windows Credential Manager / macOS Keychain / Linux Secret Service).
- Le fallback AES-256-GCM (`~/.ragkit/credentials.enc`) fonctionne si le keyring n'est pas disponible.
- Les clés sont déchiffrées à la volée et jamais conservées en mémoire au-delà de l'appel API.

**Nouvelle fonctionnalité — Rotation des clés** :

```
┌── Gestion des clés API ──────────────────────────────────────┐
│                                                              │
│  OpenAI :       🟢 Configurée · Dernière modif. il y a 45j  │
│                 [✎ Modifier] [🗑 Supprimer]                  │
│                                                              │
│  Anthropic :    🟢 Configurée · Dernière modif. il y a 12j  │
│                 [✎ Modifier] [🗑 Supprimer]                  │
│                                                              │
│  Cohere :       🔴 Non configurée                            │
│                 [+ Ajouter]                                  │
│                                                              │
│  Mistral :      🔴 Non configurée                            │
│                 [+ Ajouter]                                  │
│                                                              │
│  ⚠️ Recommandation : la clé OpenAI n'a pas été renouvelée   │
│  depuis 45 jours. Pensez à la rotation régulière.           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

La vue consolidée des clés est accessible depuis `PARAMÈTRES > Paramètres généraux > Clés API`.

#### 2.1.2 Chiffrement optionnel des logs

Les journaux de requêtes (Étape 11) contiennent potentiellement des données sensibles (questions de l'utilisateur, extraits de documents). Un chiffrement optionnel est ajouté :

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Chiffrer les logs | `security.encrypt_logs` | bool | `false` | Chiffrer les entrées du journal de requêtes |

**Implémentation** : quand activé, les champs `query`, `answer`, et `sources` des `QueryLogEntry` sont chiffrés en AES-256-GCM avant écriture en SQLite. La clé de chiffrement est dérivée de la même clé machine que le fallback credentials.

#### 2.1.3 Détection de données personnelles (PII)

Détection optionnelle de données personnelles dans les documents **avant indexation** :

```
┌── Protection des données personnelles ───────────────────────┐
│                                                              │
│  ☐ Activer la détection de données personnelles (PII)       │
│                                                              │
│  Types détectés :                                            │
│  ☑ Emails                                                   │
│  ☑ Numéros de téléphone                                     │
│  ☑ Numéros de sécurité sociale                              │
│  ☑ Adresses                                                 │
│  ☑ Numéros de carte bancaire                                │
│  ☑ IBAN                                                     │
│                                                              │
│  Action en cas de détection :                                │
│  (•) Avertir uniquement (badge ⚠️ sur le document)          │
│  ( ) Anonymiser avant indexation (remplacer par [PII])       │
│  ( ) Exclure le document de l'indexation                     │
│                                                              │
│  ℹ️ La détection utilise des expressions régulières et une   │
│  analyse heuristique. Elle ne garantit pas une détection    │
│  exhaustive et ne remplace pas un audit RGPD.               │
└──────────────────────────────────────────────────────────────┘
```

**Implémentation** : détection par regex (patterns pour emails, téléphones, SSN, IBAN, CB) intégrée au pipeline de preprocessing (Étape 1). Les PII détectées sont marquées dans les métadonnées du document.

#### 2.1.4 Politique de rétention consolidée

La politique de rétention (logs, données, vecteurs) est centralisée :

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Rétention logs | `security.log_retention_days` | int | 30 | Jours avant suppression des logs de requêtes |
| Rotation auto | `security.auto_purge` | bool | `true` | Purge automatique des logs expirés au démarrage |

### 2.2 Export/Import de configuration

#### 2.2.1 Export de configuration

Le bouton **Exporter la configuration** dans `PARAMÈTRES > Paramètres généraux` génère un fichier `.ragkit-config` (JSON) contenant l'intégralité de la configuration **sans les clés API** :

```json
{
  "ragkit_version": "1.0.0",
  "export_date": "2026-02-18T14:30:00Z",
  "profile": "technical_documentation",
  "config": {
    "general": { "..." },
    "ingestion": { "..." },
    "chunking": { "..." },
    "embedding": {
      "provider": "openai",
      "model": "text-embedding-3-small",
      "api_key_set": false,
      "...": "..."
    },
    "retrieval": { "..." },
    "rerank": { "..." },
    "llm": { "..." },
    "agents": { "..." },
    "monitoring": { "..." },
    "security": { "..." }
  },
  "metadata": {
    "documents_count": 47,
    "chunks_count": 2847,
    "source_path": "/Users/henri/documents/legal"
  }
}
```

**Règles** :
- Les clés API ne sont **jamais** incluses dans l'export. Le champ `api_key_set` est mis à `false`.
- Les prompts personnalisés sont inclus.
- Le chemin source est inclus comme métadonnée (informatif, pas importé automatiquement).
- Le format est JSON avec extension `.ragkit-config`.

#### 2.2.2 Import de configuration

Le bouton **Importer une configuration** ouvre un sélecteur de fichier `.ragkit-config` :

```
┌── Import de configuration ───────────────────────────────────┐
│                                                              │
│  📁 Configuration importée : tech-docs-config.ragkit-config  │
│                                                              │
│  Profil : technical_documentation                            │
│  Version : 1.0.0 · Exportée le 15/02/2026                  │
│  Documents : 47 · Chunks : 2847                              │
│                                                              │
│  ⚠️ Les clés API ne sont pas incluses dans l'import.         │
│  Vous devrez reconfigurer vos clés API manuellement.        │
│                                                              │
│  ☑ Remplacer toute la configuration actuelle                │
│  ☐ Fusionner avec la configuration actuelle                  │
│                                                              │
│  [Annuler]                             [Importer]           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Comportement** :
- **Remplacer** : écrase `settings.json` avec la config importée. Les clés API existantes sont conservées.
- **Fusionner** : ne remplace que les sections non-nulles du fichier importé.
- La source de documents et l'index vectoriel ne sont **pas** affectés.
- Après import, l'utilisateur est redirigé vers les Paramètres généraux.

#### 2.2.3 Export de conversations

Chaque conversation du chat peut être exportée :

```
┌── Options du chat ───────────────┐
│                                  │
│  [📥 Exporter la conversation]   │
│    ▸ Markdown (.md)              │
│    ▸ PDF (.pdf)                  │
│                                  │
└──────────────────────────────────┘
```

**Format Markdown** :

```markdown
# Conversation RAGKIT — 18/02/2026 14:30

## Question 1
**Utilisateur** : Quelles sont les conditions de résiliation ?

**Assistant** : D'après les documents disponibles, les conditions...

*Sources : contrat-service-2024.pdf (p.8), CGV-2024.pdf (p.3)*

---

## Question 2
...
```

**Format PDF** : le même contenu, mis en page avec en-tête RAGKIT, date, profil actif.

### 2.3 Niveaux d'expertise

L'utilisateur peut choisir son niveau d'expertise, ce qui contrôle la visibilité des paramètres :

```
┌── Niveau d'expertise ────────────────────────────────────────┐
│                                                              │
│  (•) Simple — Seuls les paramètres essentiels sont visibles │
│  ( ) Intermédiaire — Paramètres courants + quelques avancés │
│  ( ) Expert — Tous les paramètres sont visibles              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Matrice de visibilité** :

| Section | Simple | Intermédiaire | Expert |
|---------|:---:|:---:|:---:|
| **Paramètres généraux** (tous) | ✅ | ✅ | ✅ |
| **Ingestion** — Source | ✅ | ✅ | ✅ |
| **Ingestion** — Parsing avancé | ❌ | ✅ | ✅ |
| **Ingestion** — Preprocessing | ❌ | ✅ | ✅ |
| **Chunking** — Stratégie + taille | ✅ | ✅ | ✅ |
| **Chunking** — Overlap, séparateurs | ❌ | ✅ | ✅ |
| **Embedding** — Provider + modèle | ✅ | ✅ | ✅ |
| **Embedding** — Batch, cache, truncation | ❌ | ❌ | ✅ |
| **Vector DB** — Provider | ❌ | ✅ | ✅ |
| **Vector DB** — Collection, HNSW | ❌ | ❌ | ✅ |
| **Recherche sémantique** | ❌ | ✅ | ✅ |
| **Recherche lexicale** | ❌ | ❌ | ✅ |
| **Recherche hybride** — Alpha | ❌ | ✅ | ✅ |
| **Recherche hybride** — Fusion, poids | ❌ | ❌ | ✅ |
| **Reranking** | ❌ | ✅ | ✅ |
| **LLM** — Provider + modèle | ✅ | ✅ | ✅ |
| **LLM** — Température, max_tokens | ✅ | ✅ | ✅ |
| **LLM** — Citations, incertitude | ❌ | ✅ | ✅ |
| **LLM** — Prompt système | ❌ | ✅ | ✅ |
| **LLM** — Context max, streaming | ❌ | ❌ | ✅ |
| **Agents** — Intentions | ❌ | ✅ | ✅ |
| **Agents** — Rewriting, mémoire | ❌ | ❌ | ✅ |
| **Agents** — Prompts dédiés | ❌ | ❌ | ✅ |
| **Monitoring** | ❌ | ✅ | ✅ |
| **Sécurité** | ❌ | ❌ | ✅ |

**Comportement** :
- Le niveau est stocké dans `settings.json` sous `general.expertise_level`.
- Le passage de Simple → Expert **ne modifie aucune valeur**, il rend seulement les paramètres visibles.
- Le passage de Expert → Simple masque les paramètres mais conserve les valeurs configurées.
- En mode Simple, les sections de paramètres avancés sont remplacées par un résumé en une ligne : "Configuré automatiquement par le profil".

### 2.4 Mode partiel (chat progressif)

Le chat devient disponible dès que les **10 premiers documents** (ou les premiers chunks, si < 10 docs) sont indexés :

```
┌─────────────────────────────────────────────────────────────────┐
│  💬 CHAT                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⚠️ Ingestion en cours : 23/47 documents indexés.               │
│  Les résultats peuvent être incomplets.                        │
│  [Voir la progression]                                         │
│                                                                 │
│  [Posez votre question...                              ] [→]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Comportement** :
- Le bandeau d'avertissement est affiché tant que l'ingestion est en cours.
- Le clic sur "Voir la progression" navigue vers le tableau de bord.
- Le bandeau disparaît quand l'ingestion est terminée.
- Si aucun document n'est indexé, le chat affiche toujours le placeholder "Le chat sera disponible après l'indexation d'au moins un document."

### 2.5 Question de test automatique

Après la **première ingestion complète**, RAGKIT propose une question-test :

```
┌─────────────────────────────────────────────────────────────────┐
│  💬 CHAT                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Ingestion terminée ! 47 documents · 2 847 chunks indexés.  │
│                                                                 │
│  🤖 Votre RAG est prêt ! Voici une question-test pour         │
│  vérifier que tout fonctionne :                                │
│                                                                 │
│  💡 "Quels sont les principaux thèmes abordés dans les        │
│     documents ?"                                               │
│                                                                 │
│  [Poser cette question]   [Non merci, je pose la mienne]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Implémentation** : le LLM génère une question pertinente à partir des titres et métadonnées des documents indexés. Si le LLM n'est pas disponible, une question par défaut est utilisée ("Quels sont les principaux thèmes abordés dans les documents ?").

### 2.6 Paramètres généraux — vue finale complète

```
┌─────────────────────────────────────────────────────────────────┐
│  PARAMÈTRES GÉNÉRAUX                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ── Général ──                                                  │
│  Thème .................. [▾ Système (clair/sombre auto)]      │
│  Niveau d'expertise ..... (•) Simple ( ) Inter. ( ) Expert     │
│  Langue interface ....... [▾ Français]                         │
│                                                                 │
│  ── Ingestion ──                                                │
│  Mode d'ingestion ....... (•) Manuel  ( ) Automatique          │
│  Mode watch ............. ☐ Surveiller le répertoire           │
│                                                                 │
│  ── Recherche & Génération ──                                   │
│  Type de recherche ...... [▾ Hybride]                          │
│  Modèle LLM ............. [▾ gpt-4o-mini (OpenAI)]            │
│  Température ............ Factuel [◆======] Créatif  0.1      │
│  Langue de réponse ...... [▾ Auto (même que la question)]      │
│                                                                 │
│  ── Configuration ──                                            │
│  Clés API ............... [🔑 Gérer les clés API]              │
│  Export config .......... [📥 Exporter] [📤 Importer]          │
│                                                                 │
│  ── Profil actif ──                                             │
│  📘 Documentation technique                                    │
│  [↻ Relancer le wizard de configuration]                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.7 Structure PARAMÈTRES finale

```
PARAMÈTRES
├── Paramètres généraux
│   ├── Thème (Clair / Sombre / Système)                 ← Étape 0
│   ├── Niveau d'expertise (Simple / Inter. / Expert)    ← NOUVEAU
│   ├── Langue interface (FR / EN)                       ← Étape 0
│   ├── Mode d'ingestion (Manuel / Automatique)          ← Étape 4
│   ├── Mode watch (Surveiller le répertoire)            ← Étape 4
│   ├── Type de recherche (Sém. / Lex. / Hybride)       ← Étape 7
│   ├── Modèle LLM                                       ← Étape 9
│   ├── Température                                       ← Étape 9
│   ├── Langue de réponse                                 ← Étape 9
│   ├── Clés API [Gérer]                                 ← NOUVEAU
│   ├── Export / Import configuration                     ← NOUVEAU
│   └── Profil actif + Relancer le wizard                ← NOUVEAU
└── Paramètres avancés (visibilité selon niveau d'expertise)
    ├── INGESTION & PRÉPROCESSING                         ← Étape 1
    ├── CHUNKING                                          ← Étape 2
    ├── EMBEDDING                                         ← Étape 3
    ├── BASE DE DONNÉES VECTORIELLE                       ← Étape 4
    ├── RECHERCHE SÉMANTIQUE                              ← Étape 5
    ├── RECHERCHE LEXICALE                                ← Étape 6
    ├── RECHERCHE HYBRIDE                                 ← Étape 7
    ├── RERANKING                                         ← Étape 8
    ├── LLM / GÉNÉRATION                                  ← Étape 9
    ├── AGENTS                                            ← Étape 10
    ├── MONITORING                                        ← Étape 11
    └── SÉCURITÉ                                          ← NOUVEAU
```

### 2.8 Section PARAMÈTRES > Paramètres avancés > SÉCURITÉ

```
┌─────────────────────────────────────────────────────────────────┐
│  SÉCURITÉ                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Clés API ───────────────────────────────────────────────┐  │
│  │  OpenAI :    🟢 Configurée · 45 jours                    │ │
│  │  Anthropic : 🟢 Configurée · 12 jours                    │ │
│  │  Cohere :    🔴 Non configurée                            │ │
│  │  Mistral :   🔴 Non configurée                            │ │
│  │                                                            │ │
│  │  ℹ️ Les clés sont stockées dans le trousseau système       │ │
│  │  natif. Elles ne sont jamais écrites dans les fichiers    │ │
│  │  de configuration.                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Chiffrement des logs ───────────────────────────────────┐  │
│  │                                                            │ │
│  │  ☐ Chiffrer les journaux de requêtes                      │ │
│  │                                                            │ │
│  │  ℹ️ Active le chiffrement AES-256 des données sensibles    │ │
│  │  dans les journaux (questions, réponses, sources).        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Données personnelles (PII) ─────────────────────────────┐  │
│  │                                                            │ │
│  │  ☐ Activer la détection PII                               │ │
│  │                                                            │ │
│  │  Types : ☑ Emails  ☑ Téléphones  ☑ SSN                   │ │
│  │          ☑ Adresses  ☑ Cartes bancaires  ☑ IBAN          │ │
│  │                                                            │ │
│  │  Action : (•) Avertir  ( ) Anonymiser  ( ) Exclure       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Rétention ──────────────────────────────────────────────┐  │
│  │                                                            │ │
│  │  Rétention des logs : [====◆=====] 30 jours               │ │
│  │  ☑ Purge automatique au démarrage                         │ │
│  │                                                            │ │
│  │  [🗑 Purger les logs expirés maintenant]                   │ │
│  │  [🗑 Supprimer TOUTES les données locales]                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Informations de confidentialité ────────────────────────┐  │
│  │                                                            │ │
│  │  ✅ Toutes les données sont stockées localement           │ │
│  │  ✅ Aucune télémétrie, aucun tracking                     │ │
│  │  ✅ Les API externes ne sont appelées que pour les        │ │
│  │     fonctionnalités choisies (embedding, LLM, reranking) │ │
│  │  ✅ Communication frontend↔backend en localhost           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.9 Polish UX

#### 2.9.1 États vides améliorés

Chaque section vide affiche un message contextuel et une action :

| Section | Message | Action |
|---------|---------|--------|
| Chat (pas d'index) | "Indexez vos premiers documents pour commencer à poser des questions." | [Configurer la source] |
| Chat (index vide) | "Aucun document n'a encore été indexé. Lancez l'ingestion pour commencer." | [Lancer l'ingestion] |
| Tableau de bord (pas de requêtes) | "Aucune requête enregistrée. Posez votre première question dans le chat !" | [Ouvrir le chat] |
| Journal (pas de logs) | "Le journal est vide. Les requêtes apparaîtront ici après utilisation du chat." | — |

#### 2.9.2 Transitions et animations

| Élément | Animation |
|---------|-----------|
| Navigation entre onglets | Fade 150ms |
| Ouverture/fermeture des panneaux accordéon | Slide 200ms + ease-out |
| Streaming du chat | Aucune animation (texte brut progressif) |
| Apparition des alertes | Slide-down 300ms |
| Feedback 👍/👎 | Scale bounce 200ms |
| Toast de succès/erreur | Slide-in 200ms, auto-dismiss 3s |

#### 2.9.3 Accessibilité clavier

| Action | Raccourci |
|--------|-----------|
| Envoyer un message dans le chat | `Enter` (ou `Ctrl+Enter` si multiligne) |
| Arrêter le streaming | `Escape` |
| Nouvelle conversation | `Ctrl+N` |
| Naviguer entre onglets | `Ctrl+1` (Chat), `Ctrl+2` (Paramètres), `Ctrl+3` (Dashboard) |
| Rechercher dans le journal | `Ctrl+F` |
| Ouvrir les paramètres rapides | `Ctrl+,` |

#### 2.9.4 Messages d'erreur contextuels

Chaque erreur affiche un message clair avec une suggestion d'action :

| Erreur | Message | Suggestion |
|--------|---------|------------|
| Clé API invalide | "La clé API OpenAI est invalide ou expirée." | "Vérifiez votre clé dans Paramètres > Clés API." |
| LLM timeout | "Le modèle n'a pas répondu dans le délai imparti (60s)." | "Essayez à nouveau ou augmentez le timeout." |
| Aucun résultat | "Aucun document pertinent trouvé pour cette question." | "Reformulez votre question ou vérifiez que les documents sont indexés." |
| Erreur réseau | "Impossible de contacter le service. Vérifiez votre connexion." | "Vérifiez votre connexion internet." |
| Ollama non disponible | "Ollama n'est pas détecté sur cette machine." | "Installez Ollama depuis ollama.ai et relancez RAGKIT." |

### 2.10 Build de production

| Plateforme | Target | Format | Signature |
|------------|--------|--------|-----------|
| Windows x64 | `x86_64-pc-windows-msvc` | NSIS `.exe` + MSI | Code signing certificate |
| macOS x64 | `x86_64-apple-darwin` | DMG | Apple Developer ID |
| macOS ARM | `aarch64-apple-darwin` | DMG | Apple Developer ID |
| Linux x64 | `x86_64-unknown-linux-gnu` | AppImage + DEB | — |

**Pipeline CI/CD** :
- Build automatique sur tag `v1.0.0`.
- Tests complets (lint, unit, integration) avant build.
- Signature des installeurs.
- Génération des release notes à partir des commits.
- Upload des artefacts sur la page releases GitHub.

---

## 3. Catalogue complet des paramètres — Section SÉCURITÉ

### 3.1 Tous les paramètres

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Chiffrer les logs | `security.encrypt_logs` | bool | `false` | Chiffrer les entrées sensibles du journal |
| Détection PII | `security.pii_detection` | bool | `false` | Détecter les données personnelles |
| Types PII | `security.pii_types` | list[str] | `["email","phone","ssn","address","credit_card","iban"]` | Types de PII à détecter |
| Action PII | `security.pii_action` | enum | `warn` | `warn` \| `anonymize` \| `exclude` |
| Rétention logs | `security.log_retention_days` | int | 30 | Jours de rétention |
| Purge auto | `security.auto_purge` | bool | `true` | Purge auto au démarrage |
| Niveau expertise | `general.expertise_level` | enum | `simple` | `simple` \| `intermediate` \| `expert` |

---

## 4. Spécifications techniques

### 4.1 Schéma Pydantic (backend)

```python
# ragkit/config/security_schema.py
"""Pydantic schemas for security configuration."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class PIIAction(str, Enum):
    WARN = "warn"
    ANONYMIZE = "anonymize"
    EXCLUDE = "exclude"


class PIIType(str, Enum):
    EMAIL = "email"
    PHONE = "phone"
    SSN = "ssn"
    ADDRESS = "address"
    CREDIT_CARD = "credit_card"
    IBAN = "iban"


class ExpertiseLevel(str, Enum):
    SIMPLE = "simple"
    INTERMEDIATE = "intermediate"
    EXPERT = "expert"


class SecurityConfig(BaseModel):
    """Security & privacy configuration."""

    # Log encryption
    encrypt_logs: bool = False

    # PII detection
    pii_detection: bool = False
    pii_types: list[PIIType] = [
        PIIType.EMAIL, PIIType.PHONE, PIIType.SSN,
        PIIType.ADDRESS, PIIType.CREDIT_CARD, PIIType.IBAN,
    ]
    pii_action: PIIAction = PIIAction.WARN

    # Retention
    log_retention_days: int = Field(default=30, ge=1, le=365)
    auto_purge: bool = True
```

### 4.2 PII Detector (backend)

```python
# ragkit/security/pii_detector.py
"""PII detection using regex patterns."""

from __future__ import annotations

import re
from dataclasses import dataclass

from ragkit.config.security_schema import SecurityConfig, PIIType


@dataclass
class PIIMatch:
    pii_type: PIIType
    value: str           # Masked: "jean.d***@email.com"
    start: int
    end: int


PII_PATTERNS = {
    PIIType.EMAIL: r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    PIIType.PHONE: r'\b(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}\b',
    PIIType.SSN: r'\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b',
    PIIType.CREDIT_CARD: r'\b(?:\d{4}[\s-]?){3}\d{4}\b',
    PIIType.IBAN: r'\b[A-Z]{2}\d{2}\s?(?:\d{4}\s?){4,7}\d{1,4}\b',
    PIIType.ADDRESS: r'\b\d{1,4}\s(?:rue|avenue|boulevard|place|chemin|impasse)\b',
}


class PIIDetector:
    """Detects personal data in text."""

    def __init__(self, config: SecurityConfig):
        self.config = config
        self.patterns = {
            t: re.compile(PII_PATTERNS[t], re.IGNORECASE)
            for t in config.pii_types
            if t in PII_PATTERNS
        }

    def detect(self, text: str) -> list[PIIMatch]:
        """Detect PII in text."""
        if not self.config.pii_detection:
            return []
        matches = []
        for pii_type, pattern in self.patterns.items():
            for m in pattern.finditer(text):
                matches.append(PIIMatch(
                    pii_type=pii_type,
                    value=self._mask(m.group()),
                    start=m.start(),
                    end=m.end(),
                ))
        return matches

    def anonymize(self, text: str) -> str:
        """Replace PII with [PII] tokens."""
        for _, pattern in self.patterns.items():
            text = pattern.sub("[PII]", text)
        return text

    def _mask(self, value: str) -> str:
        if len(value) <= 4:
            return "***"
        return value[:3] + "***" + value[-2:]
```

### 4.3 Config Exporter/Importer (backend)

```python
# ragkit/config/config_export.py
"""Export and import full RAGKIT configuration."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from ragkit.config.settings import Settings


class ConfigExporter:
    """Exports the full configuration to a .ragkit-config file."""

    def export(self, settings: Settings, output_path: str) -> str:
        config = settings.to_dict()

        # Strip API keys
        for section in ["embedding", "llm", "rerank"]:
            if section in config:
                config[section].pop("api_key", None)
                config[section]["api_key_set"] = False

        # Strip system prompts if they are defaults (optional)

        export_data = {
            "ragkit_version": "1.0.0",
            "export_date": datetime.utcnow().isoformat() + "Z",
            "profile": config.get("profile", "general"),
            "config": config,
            "metadata": {
                "documents_count": settings.get_ingestion_stats().get(
                    "total_documents", 0
                ),
                "chunks_count": settings.get_ingestion_stats().get(
                    "total_chunks", 0
                ),
                "source_path": config.get("ingestion", {}).get(
                    "source_path", None
                ),
            },
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)

        return output_path


class ConfigImporter:
    """Imports configuration from a .ragkit-config file."""

    def validate(self, path: str) -> dict:
        """Validate and return import preview."""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if "ragkit_version" not in data or "config" not in data:
            raise ValueError("Invalid .ragkit-config file")

        return {
            "version": data["ragkit_version"],
            "export_date": data.get("export_date"),
            "profile": data.get("profile"),
            "metadata": data.get("metadata", {}),
        }

    def import_replace(self, path: str, settings: Settings):
        """Replace current config with imported one."""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        settings.replace_all(data["config"])

    def import_merge(self, path: str, settings: Settings):
        """Merge imported config with current one."""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        settings.merge(data["config"])
```

### 4.4 Conversation Exporter (backend)

```python
# ragkit/export/conversation_export.py
"""Export conversations to Markdown or PDF."""

from __future__ import annotations

from datetime import datetime


class ConversationExporter:
    """Exports a conversation to Markdown or PDF."""

    def to_markdown(self, messages: list[dict], profile: str) -> str:
        lines = [
            f"# Conversation RAGKIT — {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            f"*Profil : {profile}*\n",
        ]
        q_num = 0
        for msg in messages:
            if msg["role"] == "user":
                q_num += 1
                lines.append(f"## Question {q_num}")
                lines.append(f"**Utilisateur** : {msg['content']}\n")
            else:
                lines.append(f"**Assistant** : {msg['content']}\n")
                if msg.get("sources"):
                    sources_str = ", ".join(
                        f"{s['title']} (p.{s.get('page', '?')})"
                        for s in msg["sources"]
                    )
                    lines.append(f"*Sources : {sources_str}*\n")
                lines.append("---\n")
        return "\n".join(lines)

    def to_pdf(self, messages: list[dict], profile: str, path: str):
        """Export to PDF using reportlab or weasyprint."""
        md_content = self.to_markdown(messages, profile)
        # Convert markdown → HTML → PDF
        ...
```

### 4.5 API REST (routes backend)

#### 4.5.1 Routes Sécurité

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/security/config` | GET | Config sécurité courante | — | `SecurityConfig` |
| `/api/security/config` | PUT | Met à jour la config | `SecurityConfig` (partiel) | `SecurityConfig` |
| `/api/security/keys` | GET | Liste des clés API et statuts | — | `APIKeyStatus[]` |
| `/api/security/purge-all` | POST | Supprimer toutes les données locales | — | `{ success, deleted }` |

#### 4.5.2 Routes Export/Import

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/config/export` | POST | Exporter la configuration | `{ path }` | `{ success, path }` |
| `/api/config/import/validate` | POST | Valider un fichier .ragkit-config | `{ path }` | `ImportPreview` |
| `/api/config/import` | POST | Importer une configuration | `{ path, mode: "replace"\|"merge" }` | `{ success }` |

#### 4.5.3 Routes Conversation Export

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/conversation/export` | POST | Exporter la conversation | `{ format: "md"\|"pdf", path }` | `{ success, path }` |

#### 4.5.4 Routes UX

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/test-question` | POST | Générer une question-test | — | `{ question }` |
| `/api/general/expertise` | PUT | Changer le niveau d'expertise | `{ level }` | `{ success }` |

### 4.6 Commandes Tauri (Rust) — ajouts

```rust
// Security
#[tauri::command]
pub async fn get_security_config() -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn update_security_config(config: serde_json::Value) -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn get_api_keys_status() -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn purge_all_data() -> Result<serde_json::Value, String> { ... }

// Export/Import
#[tauri::command]
pub async fn export_config(path: String) -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn validate_import(path: String) -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn import_config(path: String, mode: String) -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn export_conversation(format: String, path: String) -> Result<serde_json::Value, String> { ... }

// UX
#[tauri::command]
pub async fn generate_test_question() -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn set_expertise_level(level: String) -> Result<serde_json::Value, String> { ... }
```

### 4.7 Composants React — arborescence

```
desktop/src/
├── components/
│   ├── settings/
│   │   ├── SecuritySettings.tsx               ← NOUVEAU : section sécurité
│   │   ├── APIKeysPanel.tsx                   ← NOUVEAU : vue consolidée clés
│   │   ├── PIIDetectionPanel.tsx              ← NOUVEAU : config PII
│   │   ├── LogEncryptionToggle.tsx            ← NOUVEAU
│   │   ├── RetentionPanel.tsx                 ← NOUVEAU
│   │   ├── ExportImportPanel.tsx              ← NOUVEAU : export/import config
│   │   ├── ImportPreviewDialog.tsx            ← NOUVEAU : aperçu import
│   │   ├── ExpertiseLevelSelector.tsx         ← NOUVEAU
│   │   ├── GeneralSettings.tsx                ← MODIFIER : vue finale complète
│   │   └── AdvancedSettingsGate.tsx           ← NOUVEAU : contrôle visibilité
│   ├── chat/
│   │   ├── PartialIngestionBanner.tsx         ← NOUVEAU : bandeau ingestion
│   │   ├── TestQuestionPrompt.tsx             ← NOUVEAU : question-test
│   │   ├── ConversationExportMenu.tsx         ← NOUVEAU : menu export
│   │   └── ... (existants)
│   ├── dashboard/
│   │   └── ... (existants)
│   └── ui/
│       ├── EmptyState.tsx                     ← NOUVEAU : états vides contextuels
│       ├── ErrorMessage.tsx                   ← NOUVEAU : erreurs contextuelles
│       ├── KeyboardShortcuts.tsx              ← NOUVEAU : gestion raccourcis
│       └── ... (existants)
├── hooks/
│   ├── useSecurityConfig.ts                   ← NOUVEAU
│   ├── useConfigExport.ts                     ← NOUVEAU
│   ├── useExpertiseLevel.ts                   ← NOUVEAU
│   ├── useKeyboardShortcuts.ts                ← NOUVEAU
│   └── ... (existants)
├── lib/
│   ├── ipc.ts                                 ← MODIFIER
│   └── visibility.ts                          ← NOUVEAU : matrice visibilité
└── locales/
    ├── fr.json                                ← MODIFIER
    └── en.json                                ← MODIFIER
```

### 4.8 Persistance

```json
{
  "general": {
    "theme": "system",
    "expertise_level": "simple",
    "language": "fr",
    "ingestion_mode": "manual",
    "search_type": "hybrid",
    "llm_model": "openai/gpt-4o-mini",
    "llm_temperature": 0.1,
    "response_language": "auto"
  },
  "security": {
    "encrypt_logs": false,
    "pii_detection": false,
    "pii_types": ["email", "phone", "ssn", "address", "credit_card", "iban"],
    "pii_action": "warn",
    "log_retention_days": 30,
    "auto_purge": true
  },
  "ingestion": { "..." },
  "chunking": { "..." },
  "embedding": { "..." },
  "retrieval": { "..." },
  "rerank": { "..." },
  "llm": { "..." },
  "agents": { "..." },
  "monitoring": { "..." }
}
```

### 4.9 Dépendances Python ajoutées

```toml
# pyproject.toml — ajouts pour Étape 12
dependencies = [
    # ... (existants Étapes 0-11)
    "cryptography>=41.0",     # AES-256-GCM pour chiffrement logs
    "weasyprint>=60.0",       # Export conversation PDF (optionnel)
]
```

---

## 5. Critères d'acceptation

### 5.1 Fonctionnels

| # | Critère |
|---|---------|
| F1 | La section `PARAMÈTRES > Paramètres avancés > SÉCURITÉ` est accessible et fonctionnelle |
| F2 | La vue consolidée des clés API affiche le statut de chaque clé avec l'âge |
| F3 | Le chiffrement des logs peut être activé/désactivé |
| F4 | La détection PII détecte les emails, téléphones, SSN, IBAN dans un texte de test |
| F5 | L'action PII "Avertir" ajoute un badge ⚠️ aux documents contenant des PII |
| F6 | L'action PII "Anonymiser" remplace les PII par `[PII]` avant indexation |
| F7 | L'action PII "Exclure" empêche l'indexation du document |
| F8 | Le bouton **Exporter la configuration** génère un fichier `.ragkit-config` valide sans clés API |
| F9 | Le bouton **Importer une configuration** affiche un aperçu avant import |
| F10 | L'import en mode "Remplacer" écrase la config, l'import en mode "Fusionner" ne modifie que les sections importées |
| F11 | L'export de conversation en **Markdown** produit un fichier `.md` formaté |
| F12 | L'export de conversation en **PDF** produit un fichier `.pdf` lisible |
| F13 | Le sélecteur de **niveau d'expertise** masque/affiche les sections de paramètres appropriées |
| F14 | En mode Simple, les sections avancées affichent "Configuré automatiquement par le profil" |
| F15 | Le **mode partiel** rend le chat disponible dès que des documents sont indexés, avec bandeau d'avertissement |
| F16 | La **question de test** est proposée après la première ingestion complète |
| F17 | Les **états vides** affichent un message contextuel et une action dans chaque section |
| F18 | Les **raccourcis clavier** fonctionnent (Enter, Escape, Ctrl+N, Ctrl+1/2/3) |
| F19 | Les **messages d'erreur** sont contextuels avec suggestion d'action |
| F20 | Le bouton "Supprimer toutes les données locales" efface les données avec double confirmation |
| F21 | Le bouton "Relancer le wizard" ramène au wizard de l'Étape 1 |
| F22 | Tous les textes sont traduits FR/EN via i18n |

### 5.2 Techniques

| # | Critère |
|---|---------|
| T1 | `GET /api/security/config` retourne la config sécurité |
| T2 | `PUT /api/security/config` valide et persiste les modifications |
| T3 | `GET /api/security/keys` retourne le statut de toutes les clés API |
| T4 | Les clés API ne sont **jamais** présentes dans `settings.json` (audit complet) |
| T5 | Les clés API ne sont **jamais** loggées dans `query_logs` ni les fichiers de log |
| T6 | Le chiffrement AES-256-GCM des logs fonctionne et les données sont déchiffrables |
| T7 | Le `PIIDetector` détecte correctement les patterns configurés |
| T8 | L'anonymisation remplace les PII par `[PII]` sans altérer le reste du texte |
| T9 | `POST /api/config/export` génère un fichier `.ragkit-config` valide |
| T10 | `POST /api/config/import` importe correctement en mode replace et merge |
| T11 | `POST /api/conversation/export` génère un Markdown et un PDF valides |
| T12 | La matrice de visibilité des paramètres est correctement appliquée pour les 3 niveaux |
| T13 | Le mode partiel détecte correctement les vecteurs dans la base |
| T14 | La question de test est générée par le LLM à partir des métadonnées des documents |
| T15 | La purge complète des données supprime : logs, vecteurs, settings, credentials |
| T16 | Le build NSIS produit un installeur Windows fonctionnel |
| T17 | Le build DMG produit un installeur macOS fonctionnel (x64 + ARM) |
| T18 | Le build AppImage/DEB produit un installeur Linux fonctionnel |
| T19 | `tsc --noEmit` ne produit aucune erreur TypeScript |
| T20 | Le CI passe sur les 4 targets (lint + build + tests) |

---

## 6. Périmètre exclus (Étape 12 / v1.0)

Les éléments suivants sont identifiés comme améliorations futures, post-v1.0 :

- **Authentification utilisateur** (login/password, rôles) : non pertinent pour une app desktop mono-utilisateur.
- **Permissions par document** (accès granulaire) : amélioration future pour usage multi-utilisateur.
- **Détection PII par NER** (modèle NLP au lieu de regex) : amélioration future. Les regex couvrent les cas courants.
- **Filtre de toxicité** sur les réponses LLM : amélioration future.
- **Détection de biais** dans les réponses : amélioration future.
- **Auto-update** (mise à jour automatique de l'application) : amélioration post-v1.0. L'utilisateur télécharge manuellement les nouvelles versions.
- **Plugin system** (extensions tierces) : amélioration future.
- **Multi-bases** (gérer plusieurs bases documentaires en parallèle) : amélioration future.
- **Persistance des conversations** entre sessions : amélioration post-v1.0.
- **Signature de code** macOS notarization : dépend de l'obtention d'un Apple Developer ID.

---

## 7. Estimation

| Tâche | Effort estimé |
|-------|---------------|
| Schéma Pydantic `SecurityConfig` + validation | 0.5 jour |
| Audit complet sécurité des clés API (vérification code, tests, correctifs) | 2 jours |
| Chiffrement optionnel des logs (AES-256-GCM, intégration QueryLogger) | 1.5 jours |
| `PIIDetector` (patterns regex, détection, anonymisation) | 1.5 jours |
| Intégration PII dans le pipeline de preprocessing (Étape 1) | 0.5 jour |
| `ConfigExporter` + `ConfigImporter` (export/import .ragkit-config) | 1.5 jours |
| `ConversationExporter` (Markdown + PDF) | 1.5 jours |
| Routes API sécurité (config, keys, purge) | 0.5 jour |
| Routes API export/import + conversation export | 1 jour |
| Routes API UX (test-question, expertise) | 0.5 jour |
| Commandes Tauri (sécurité + export/import + UX) | 1 jour |
| Composant `SecuritySettings.tsx` (section complète) | 1 jour |
| Composants `APIKeysPanel.tsx`, `PIIDetectionPanel.tsx`, `LogEncryptionToggle.tsx` | 1 jour |
| Composant `ExportImportPanel.tsx` + `ImportPreviewDialog.tsx` | 1 jour |
| Composant `ExpertiseLevelSelector.tsx` + `AdvancedSettingsGate.tsx` | 1 jour |
| Modification `GeneralSettings.tsx` (vue finale consolidée) | 1 jour |
| Composants chat (`PartialIngestionBanner.tsx`, `TestQuestionPrompt.tsx`, `ConversationExportMenu.tsx`) | 1 jour |
| Composants UX (`EmptyState.tsx`, `ErrorMessage.tsx`, `KeyboardShortcuts.tsx`) | 1 jour |
| Hooks (`useSecurityConfig`, `useConfigExport`, `useExpertiseLevel`, `useKeyboardShortcuts`) | 0.5 jour |
| Matrice de visibilité (`visibility.ts`) + intégration dans toutes les sections | 1.5 jours |
| Traductions i18n complètes (FR + EN) — audit de toutes les clés | 1 jour |
| Polish UX (animations, transitions, états vides, erreurs contextuelles) | 2 jours |
| Accessibilité clavier (raccourcis, focus management, tab navigation) | 1 jour |
| Tests unitaires sécurité (audit clés, chiffrement, PII, rotation) | 1.5 jours |
| Tests unitaires export/import (config, conversation, formats) | 1 jour |
| Tests unitaires UX (expertise levels, visibility, mode partiel) | 0.5 jour |
| Tests d'intégration (pipeline complet v1.0, scénarios end-to-end) | 2 jours |
| Build de production (NSIS, DMG, AppImage, signature) | 2 jours |
| Tests manuels finaux + corrections + polish | 3 jours |
| Documentation utilisateur (README, guide de démarrage rapide) | 1 jour |
| **Total** | **~34 jours** |

---

## 8. Récapitulatif complet du projet

### 8.1 Estimation totale par étape

| Étape | Description | Estimation |
|-------|-------------|:---:|
| 0 | Ossature & Release 0 | ~8 jours |
| 1 | Ingestion & Préprocessing | ~20 jours |
| 2 | Chunking | ~16 jours |
| 3 | Embedding | ~20 jours |
| 4 | Base de données vectorielle | ~18 jours |
| 5 | Recherche sémantique | ~19 jours |
| 6 | Recherche lexicale (BM25) | ~15 jours |
| 7 | Recherche hybride | ~18 jours |
| 8 | Reranking | ~18 jours |
| 9 | LLM / Génération | ~29 jours |
| 10 | Agents & Orchestration | ~29 jours |
| 11 | Monitoring & Évaluation | ~23 jours |
| 12 | Sécurité, UX & Finalisation | ~34 jours |
| **Total** | | **~267 jours** |

### 8.2 Pipeline RAG complet (v1.0)

```
Documents (PDF, DOCX, TXT, HTML, MD, CSV, XLSX, PPTX, images)
    │
    ▼
INGESTION & PRÉPROCESSING (Étape 1)
    │ Parsing, nettoyage, extraction texte
    ▼
CHUNKING (Étape 2)
    │ Découpage sémantique/récursif, overlap
    ▼
EMBEDDING (Étape 3)
    │ Vectorisation (OpenAI, Ollama, HuggingFace, Cohere, Mistral, VoyageAI)
    ▼
STOCKAGE VECTORIEL (Étape 4)
    │ Qdrant / ChromaDB, métadonnées
    ▼
QUERY ANALYZER (Étape 10)
    │ Intent detection, routing
    ├── greeting/chitchat/oos → Réponse directe (prompt dédié)
    └── question/clarification →
            │
            ▼
        QUERY REWRITING (Étape 10)
            │ Reformulation, résolution pronoms
            ▼
        RECHERCHE HYBRIDE (Étape 7)
            │ Sémantique (Étape 5) + Lexicale BM25 (Étape 6)
            │ Fusion RRF, alpha configurable
            ▼
        RERANKING (Étape 8)
            │ Cohere / HuggingFace cross-encoder
            ▼
        CONTEXT ASSEMBLY (Étape 9)
            │ Sélection top chunks, budget tokens
            ▼
        LLM GENERATION (Étape 9)
            │ OpenAI / Anthropic / Ollama / Mistral
            │ Streaming token par token
            ▼
        RÉPONSE avec citations + sources
            │
            ▼
HISTORIQUE CONVERSATION (Étape 10)
    │ Sliding window / Summary
    ▼
MONITORING (Étape 11)
    │ Logs, métriques, feedback 👍/👎
    ▼
SÉCURITÉ (Étape 12)
    │ Clés chiffrées, PII, export/import
    ▼
v1.0 — RAGKIT Desktop 🎉
```
