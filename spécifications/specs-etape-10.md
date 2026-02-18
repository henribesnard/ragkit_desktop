# 🧰 RAGKIT Desktop — Spécifications Étape 10 : Agents & Orchestration

> **Étape** : 10 — Agents & Orchestration  
> **Tag cible** : `v0.11.0`  
> **Date** : 18 février 2026  
> **Dépôt** : https://github.com/henribesnard/ragkit_desktop.git  
> **Prérequis** : Étape 9 (LLM / Génération) implémentée et validée

---

## 1. Objectif

Ajouter la **couche d'intelligence conversationnelle** qui analyse chaque requête avant de décider quoi en faire et orchestre le flux complet de manière optimale. Cette étape transforme le chat d'un système question-réponse indépendant en un **assistant conversationnel** avec historique, détection d'intention, et reformulation de requêtes.

Cette étape livre :
- Une section `PARAMÈTRES > Paramètres avancés > AGENTS` complète et fonctionnelle.
- Un **Query Analyzer** : agent LLM léger qui analyse chaque message pour détecter l'intention (`question`, `greeting`, `chitchat`, `clarification`, `out_of_scope`) et décide si le pipeline RAG est nécessaire.
- Le **Query Rewriting** : reformulation automatique de la requête pour améliorer la qualité de la recherche (résolution des pronoms, expansion, désambiguïsation).
- L'**historique de conversation** : mémoire contextuelle avec stratégie `sliding_window` (fenêtre glissante des N derniers messages) ou `summary` (résumé condensé de la conversation).
- Un **orchestrateur** central qui enchaîne : analyse de la requête → (retrieval si nécessaire) → génération de la réponse, avec gestion différenciée par type d'intention.
- Des **prompts dédiés** pour les cas non-RAG : salutations, bavardage, hors-périmètre.
- Un **mode debug enrichi** montrant l'intention détectée, la requête reformulée, et les décisions de l'orchestrateur.

**Pas de monitoring avancé** à cette étape. Le monitoring et l'évaluation seront ajoutés à l'Étape 11.

---

## 2. Spécifications fonctionnelles

### 2.1 Section PARAMÈTRES > Paramètres avancés > AGENTS

#### Structure de l'onglet PARAMÈTRES à cette étape

```
PARAMÈTRES
├── Paramètres généraux
│   ├── Mode d'ingestion (Manuel / Automatique)          ← Étape 4
│   ├── Type de recherche (Sémantique / Lexicale / Hybride)  ← Étape 7
│   ├── Modèle LLM                                       ← Étape 9
│   ├── Température                                       ← Étape 9
│   └── Langue de réponse                                 ← Étape 9
└── Paramètres avancés
    ├── INGESTION & PRÉPROCESSING                         ← Étape 1
    ├── CHUNKING                                          ← Étape 2
    ├── EMBEDDING                                         ← Étape 3
    ├── BASE DE DONNÉES VECTORIELLE                       ← Étape 4
    ├── RECHERCHE SÉMANTIQUE                              ← Étape 5
    ├── RECHERCHE LEXICALE                                ← Étape 6
    ├── RECHERCHE HYBRIDE                                 ← Étape 7
    ├── RERANKING                                         ← Étape 8
    ├── LLM / GÉNÉRATION                                  ← Étape 9
    └── AGENTS                                            ← NOUVEAU
```

#### Layout de la section AGENTS

```
┌─────────────────────────────────────────────────────────────────┐
│  AGENTS                                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Query Analyzer ─────────────────────────────────────────┐  │
│  │                                                            │ │
│  │  Détection d'intention                                    │ │
│  │  Intentions actives :                                     │ │
│  │  ☑ question — Requête nécessitant une recherche RAG      │ │
│  │  ☑ greeting — Salutation, bonjour, au revoir             │ │
│  │  ☑ chitchat — Conversation générale sans besoin RAG      │ │
│  │  ☑ out_of_scope — Question hors périmètre documentaire   │ │
│  │  ☐ clarification — Demande de précision sur la réponse   │ │
│  │                                                            │ │
│  │  ☐ Toujours lancer la recherche RAG                       │ │
│  │                                                            │ │
│  │  ℹ️ Si "Toujours lancer la recherche" est activé, le       │ │
│  │  Query Analyzer est court-circuité et chaque message      │ │
│  │  passe par le pipeline RAG complet.                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Query Rewriting ────────────────────────────────────────┐  │
│  │                                                            │ │
│  │  ☑ Reformulation automatique des requêtes                 │ │
│  │                                                            │ │
│  │  Nombre de reformulations : [◆=========] 1                 │ │
│  │                                                            │ │
│  │  ℹ️ La reformulation améliore la recherche en résolvant    │ │
│  │  les pronoms ("il", "ça"), en désambiguïsant les termes   │ │
│  │  et en utilisant l'historique de conversation.             │ │
│  │  Chaque reformulation coûte un appel LLM (~50-100 ms).    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Historique de conversation ─────────────────────────────┐  │
│  │                                                            │ │
│  │  Messages d'historique envoyés au LLM :                   │ │
│  │  [====◆=====] 10                                           │ │
│  │                                                            │ │
│  │  Stratégie de mémoire :                                   │ │
│  │  (•) Fenêtre glissante — Garde les N derniers messages    │ │
│  │  ( ) Résumé — Condense la conversation en résumé          │ │
│  │                                                            │ │
│  │  ℹ️ La fenêtre glissante est simple et efficace pour       │ │
│  │  les conversations courtes. Le résumé permet de           │ │
│  │  maintenir le contexte sur de longues conversations       │ │
│  │  sans exploser le budget tokens.                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Prompts dédiés ─────────────────────────────────────────┐  │
│  │                                                            │ │
│  │  ▸ Prompt Query Analyzer                                  │ │
│  │    [Zone de texte — prompt analyse d'intention]            │ │
│  │    [↻ Restaurer le prompt par défaut]                      │ │
│  │                                                            │ │
│  │  ▸ Prompt salutations (greeting)                          │ │
│  │    [Zone de texte — prompt réponse salutations]            │ │
│  │    [↻ Restaurer le prompt par défaut]                      │ │
│  │                                                            │ │
│  │  ▸ Prompt hors-périmètre (out_of_scope)                   │ │
│  │    [Zone de texte — prompt réponse hors-périmètre]        │ │
│  │    [↻ Restaurer le prompt par défaut]                      │ │
│  │                                                            │ │
│  │  ▸ Prompt Query Rewriting                                 │ │
│  │    [Zone de texte — prompt reformulation]                  │ │
│  │    [↻ Restaurer le prompt par défaut]                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ▸ Paramètres avancés                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Modèle pour le Query Analyzer : [▾ (même que principal)] │ │
│  │  Timeout Query Analyzer (sec) :  [==◆=======] 15           │ │
│  │  ☐ Mode debug activé par défaut                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [↻ Réinitialiser au profil]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Query Analyzer — détection d'intention

Le Query Analyzer est un appel LLM léger qui classe le message de l'utilisateur dans une catégorie d'intention :

| Intention | Description | RAG ? | Exemple |
|-----------|-------------|:-----:|---------|
| `question` | Question factuelle nécessitant les documents | ✅ Oui | "Quelles sont les conditions de résiliation ?" |
| `greeting` | Salutation, formule de politesse | ❌ Non | "Bonjour", "Merci, au revoir" |
| `chitchat` | Bavardage, conversation générale | ❌ Non | "Quel temps fait-il ?", "Comment vas-tu ?" |
| `out_of_scope` | Question sans rapport avec les documents | ❌ Non | "Quelle est la capitale du Brésil ?" |
| `clarification` | Demande de précision sur la réponse précédente | ⚠️ Optionnel | "Peux-tu détailler le point 3 ?", "Qu'est-ce que tu entends par..." |

**Flux de décision** :

```
Message utilisateur
    │
    ▼
┌──────────────────────────────────┐
│  always_retrieve == true ?        │
│  → OUI : skip Query Analyzer     │
│  → NON : appeler Query Analyzer  │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  QUERY ANALYZER (appel LLM)      │
│                                  │
│  Input :                         │
│  - Message courant               │
│  - Historique (N derniers msgs)  │
│  - Liste des intents actifs      │
│                                  │
│  Output (JSON) :                 │
│  {                               │
│    "intent": "question",         │
│    "needs_rag": true,            │
│    "confidence": 0.95,           │
│    "reasoning": "L'utilisateur   │
│     pose une question sur les    │
│     conditions de résiliation."  │
│  }                               │
└──────────────┬───────────────────┘
               │
       ┌───────┴───────────┐
       │                   │
  needs_rag=true      needs_rag=false
       │                   │
       ▼                   ▼
  Query Rewriting     Réponse directe
  (si activé)         (prompt dédié)
       │
       ▼
  Pipeline RAG
  (recherche → reranking → génération)
```

### 2.3 Query Rewriting — reformulation

Quand le Query Analyzer détecte une `question` nécessitant le RAG, le Query Rewriter reformule la requête pour améliorer la qualité de la recherche.

**Cas d'usage** :

| Cas | Message original | Contexte conversation | Requête reformulée |
|-----|------------------|----------------------|-------------------|
| **Résolution pronoms** | "Quels sont ses avantages ?" | Discussion précédente sur l'article 12 | "Quels sont les avantages de l'article 12 ?" |
| **Désambiguïsation** | "Parle-moi du contrat" | Plusieurs contrats mentionnés | "Parle-moi du contrat de service 2024" |
| **Expansion** | "conditions résil" | — | "Quelles sont les conditions de résiliation ?" |
| **Référence contextuelle** | "Et pour celui de 2023 ?" | Discussion sur le contrat 2024 | "Quelles sont les conditions du contrat 2023 ?" |

**Fonctionnement** :
1. Le rewriter reçoit le message courant + l'historique de conversation (N derniers messages).
2. Il produit `num_rewrites` requêtes reformulées (défaut : 1).
3. Si `num_rewrites > 1`, les requêtes reformulées sont utilisées en parallèle pour la recherche (multi-query), et les résultats sont fusionnés avant déduplication.
4. La requête reformulée est celle utilisée pour la recherche RAG. La requête originale reste affichée dans le chat.

### 2.4 Historique de conversation

L'historique de conversation apporte le **contexte multi-tour** au LLM.

#### Stratégie Fenêtre glissante (`sliding_window`)

```
Historique complet : [msg1, msg2, msg3, msg4, msg5, msg6, msg7, msg8]
max_history_messages = 4

Envoyé au LLM :
  system_prompt
  + [msg5, msg6, msg7, msg8]   ← 4 derniers messages
  + query courante
```

#### Stratégie Résumé (`summary`)

```
Historique complet : [msg1, msg2, msg3, msg4, msg5, msg6, msg7, msg8]
max_history_messages = 4

Envoyé au LLM :
  system_prompt
  + résumé_condensé(msg1 à msg4)   ← Résumé LLM des anciens messages
  + [msg5, msg6, msg7, msg8]        ← 4 derniers messages verbatim
  + query courante
```

Le résumé est généré automatiquement quand l'historique dépasse `max_history_messages`. Il est regénéré à chaque dépassement pour intégrer les nouveaux messages sortis de la fenêtre.

### 2.5 Orchestrateur

L'orchestrateur est le composant central qui enchaîne les étapes du pipeline selon l'intention détectée :

```
Message utilisateur
    │
    ├── [Historique conversation en mémoire]
    │
    ▼
┌─────────────────────────────┐
│  ORCHESTRATEUR               │
│                              │
│  1. Query Analyzer           │
│     → Intent + needs_rag     │
│                              │
│  2. Routing par intent :     │
│                              │
│     question / clarification:│
│       a. Query Rewriting     │
│       b. Retrieval pipeline  │
│       c. Context Assembly    │
│       d. LLM Generation      │
│                              │
│     greeting :               │
│       → LLM + prompt greeting│
│                              │
│     chitchat :               │
│       → LLM + prompt chitchat│
│                              │
│     out_of_scope :           │
│       → LLM + prompt OOS     │
│                              │
│  3. Mise à jour historique   │
│  4. Émission réponse (stream)│
└─────────────────────────────┘
```

### 2.6 Affichage dans le CHAT

Le chat est enrichi avec des indicateurs d'intention et de reformulation :

```
┌─────────────────────────────────────────────────────────────────┐
│  💬 CHAT                                           [⚙ Options] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  👤 Bonjour !                                                   │
│                                                                 │
│  🤖 Bonjour ! Je suis votre assistant documentaire. Posez-moi  │
│  une question sur vos documents et je ferai de mon mieux pour   │
│  vous répondre.                                                 │
│  ── Intent : greeting · Pas de recherche RAG ──                │
│                                                                 │
│  👤 Quelles sont les conditions de résiliation ?                │
│                                                                 │
│  🤖 D'après les documents disponibles, les conditions de       │
│  résiliation sont définies à l'article 12...                    │
│  [Source: contrat-service-2024.pdf, p.8]                       │
│  ── Intent : question · Recherche RAG ──                       │
│                                                                 │
│  👤 Et pour le contrat de 2023 ?                                │
│                                                                 │
│  🤖 Pour le contrat 2023, les conditions diffèrent sur...      │
│  [Source: contrat-2023.pdf, p.5]                               │
│  ── Intent : question · Reformulé : "conditions de             │
│     résiliation du contrat 2023" ──                            │
│                                                                 │
│  👤 Quelle est la capitale du Brésil ?                          │
│                                                                 │
│  🤖 Cette question ne semble pas concerner vos documents.       │
│  Je suis spécialisé dans l'analyse de votre base documentaire.  │
│  Posez-moi une question sur vos documents !                     │
│  ── Intent : out_of_scope · Pas de recherche RAG ──           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Indicateurs affichés** (optionnel, contrôlé par un toggle dans Options) :
- L'intention détectée (icône + label)
- Si une reformulation a eu lieu : la requête reformulée
- Si le pipeline RAG a été activé ou non

### 2.7 Bouton "Nouvelle conversation"

Un bouton est ajouté dans l'en-tête du chat pour démarrer une nouvelle conversation :

```
┌─────────────────────────────────────────────────────────────────┐
│  💬 CHAT                        [🗑 Nouvelle conv.] [⚙ Options] │
```

**Comportement** :
- Efface l'historique de conversation affiché.
- Réinitialise la mémoire de l'orchestrateur (historique, résumé).
- Ne supprime pas les conversations précédentes (pas de persistance de l'historique en V1).
- Confirmation demandée si la conversation a plus de 2 messages.

### 2.8 Mode debug enrichi

Le mode debug de l'Étape 10 ajoute la couche agents :

```
┌── Mode debug ───────────────────────────────────────────────────┐
│                                                                 │
│  ── Query Analyzer ──                                           │
│  Intent : question (confiance 0.95)                            │
│  Raisonnement : "L'utilisateur pose une question factuelle     │
│  sur les conditions de résiliation du contrat."                │
│  Latence : 142 ms                                              │
│                                                                 │
│  ── Query Rewriting ──                                          │
│  Requête originale : "Et pour celui de 2023 ?"                 │
│  Requête reformulée : "conditions de résiliation du contrat    │
│  2023"                                                          │
│  Latence : 118 ms                                              │
│                                                                 │
│  ── Historique ──                                               │
│  Messages en mémoire : 6 / 10                                  │
│  Stratégie : sliding_window                                    │
│  Tokens historique : 1 240                                      │
│                                                                 │
│  ── Retrieval ──                                                │
│  Recherche : 287 ms · Reranking : 255 ms · 5 chunks           │
│                                                                 │
│  ── Génération ──                                               │
│  Modèle : gpt-4o-mini · Prompt : 3 142 tokens                 │
│  Time to first token : 623 ms · Total : 2 847 ms              │
│                                                                 │
│  ── Total pipeline ──                                           │
│  Latence totale : 3 389 ms                                     │
│  (analyzer: 142 + rewriting: 118 + retrieval: 542 +            │
│   generation: 2 587)                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Prompts par défaut

### 3.1 Prompt Query Analyzer

```
Tu es un analyseur de requêtes. Ta tâche est de classifier le message de l'utilisateur
et de décider si une recherche dans la base documentaire est nécessaire.

Contexte de la conversation (derniers messages) :
{conversation_history}

Message de l'utilisateur : "{user_message}"

Intentions possibles : {intents_list}

Réponds UNIQUEMENT en JSON avec ce format :
{
  "intent": "question|greeting|chitchat|out_of_scope|clarification",
  "needs_rag": true|false,
  "confidence": 0.0-1.0,
  "reasoning": "Explication courte de ta décision"
}

Règles :
- "question" : le message pose une question factuelle qui pourrait être répondue par les documents.
- "greeting" : salutation, formule de politesse, remerciement.
- "chitchat" : conversation générale sans rapport avec les documents.
- "out_of_scope" : question factuelle mais clairement hors du périmètre documentaire.
- "clarification" : demande de précision sur une réponse précédente.
- En cas de doute, préfère "question" avec needs_rag=true.
```

### 3.2 Prompt Query Rewriting

```
Tu es un reformulateur de requêtes pour un système de recherche documentaire.
Ta tâche est de reformuler la requête de l'utilisateur pour améliorer la recherche.

Contexte de la conversation :
{conversation_history}

Requête originale : "{user_query}"

Reformule cette requête en :
1. Résolvant les pronoms et références contextuelles ("il", "ça", "celui-ci")
2. Ajoutant le contexte implicite de la conversation
3. Rendant la requête autonome et compréhensible sans l'historique
4. Gardant la même intention et le même périmètre

Réponds UNIQUEMENT avec la requête reformulée, sans explication.
```

### 3.3 Prompt Greeting

```
Tu es un assistant documentaire amical. L'utilisateur te salue ou fait une formule
de politesse. Réponds de manière chaleureuse et concise, en rappelant brièvement
que tu es là pour répondre aux questions sur ses documents.
Langue de réponse : {response_language}.
```

### 3.4 Prompt Out of Scope

```
Tu es un assistant documentaire. L'utilisateur pose une question qui ne concerne
pas les documents de sa base. Informe-le poliment que cette question est hors de
ton périmètre et invite-le à poser une question sur ses documents.
Ne tente PAS de répondre à la question.
Langue de réponse : {response_language}.
```

---

## 4. Catalogue complet des paramètres AGENTS

### 4.1 Query Analyzer

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Toujours rechercher | `agents.always_retrieve` | bool | Selon profil | Court-circuiter le Query Analyzer et toujours lancer le RAG |
| Intentions actives | `agents.detect_intents` | list[str] | Selon profil | Liste des intentions détectées. `question` est toujours inclus. |

### 4.2 Query Rewriting

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Activé | `agents.query_rewriting.enabled` | bool | — | — | Selon profil | Activer la reformulation |
| Nombre de reformulations | `agents.query_rewriting.num_rewrites` | int | 0 | 5 | Selon profil | Nombre de requêtes alternatives. 0 = désactivé. |

### 4.3 Historique de conversation

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Max messages historique | `agents.max_history_messages` | int | 0 | 50 | Selon profil | Messages envoyés au LLM (0 = pas d'historique) |
| Stratégie mémoire | `agents.memory_strategy` | enum | — | — | `sliding_window` | `sliding_window` ou `summary` |

### 4.4 Prompts

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Prompt Query Analyzer | `agents.prompt_analyzer` | string | (voir §3.1) | Prompt pour la détection d'intention |
| Prompt Query Rewriting | `agents.prompt_rewriting` | string | (voir §3.2) | Prompt pour la reformulation |
| Prompt Greeting | `agents.prompt_greeting` | string | (voir §3.3) | Prompt pour les salutations |
| Prompt Out of Scope | `agents.prompt_out_of_scope` | string | (voir §3.4) | Prompt pour le hors-périmètre |

### 4.5 Paramètres avancés

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Modèle Analyzer | `agents.analyzer_model` | string | `null` | Modèle LLM pour le Query Analyzer. `null` = même modèle que le principal. |
| Timeout Analyzer | `agents.analyzer_timeout` | int | 15 | Timeout en secondes pour l'appel au Query Analyzer |
| Debug | `agents.debug_default` | bool | `false` | Mode debug par défaut |

### 4.6 Résumé des impacts

| Paramètre | Impact principal | Impact secondaire |
|-----------|-----------------|-------------------|
| `always_retrieve` | Court-circuite l'analyse d'intention. Latence réduite (~100 ms) mais chaque message passe par le RAG. | Coût supérieur si beaucoup de messages non-question. |
| `detect_intents` | Précision du routage. Plus d'intents = meilleur routage mais plus de cas à gérer. | — |
| `query_rewriting.enabled` | **IMPORTANT** — Améliore la qualité de la recherche pour les conversations multi-tours. | Latence : +50-200 ms par reformulation. |
| `query_rewriting.num_rewrites` | Plus de reformulations = meilleure couverture de recherche (multi-query). | Latence × nombre de reformulations. |
| `max_history_messages` | **IMPORTANT** — Contexte conversationnel. Trop bas = perte de contexte. Trop haut = coût et dilution. | Tokens consommés proportionnels. |
| `memory_strategy` | Sliding window = simple et fiable. Summary = maintient le contexte sur de longues conversations. | Summary nécessite un appel LLM supplémentaire pour résumer. |

---

## 5. Valeurs par défaut par profil

### 5.1 Matrice profil → paramètres agents

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|:---:|:---:|:---:|:---:|:---:|
| `always_retrieve` | `false` | `false` | `true` | `false` | `false` |
| `query_rewriting.enabled` | `true` | `false` | `true` | `true` | `true` |
| `query_rewriting.num_rewrites` | 1 | 0 | 2 | 1 | 1 |
| `detect_intents` | `["question","greeting","chitchat","out_of_scope"]` | `["question","greeting","chitchat"]` | `["question","clarification","out_of_scope"]` | `["question","greeting","out_of_scope"]` | `["question","greeting","chitchat","out_of_scope"]` |
| `max_history_messages` | 10 | 15 | 10 | 10 | 10 |
| `memory_strategy` | `sliding_window` | `sliding_window` | `sliding_window` | `sliding_window` | `sliding_window` |
| `analyzer_model` | `null` | `null` | `null` | `null` | `null` |
| `analyzer_timeout` | 15 | 15 | 15 | 15 | 15 |
| `debug_default` | `false` | `false` | `false` | `false` | `false` |

### 5.2 Justification des choix

- **`legal_compliance` → `always_retrieve=true`** : en contexte juridique, chaque message doit être traité comme une question potentiellement importante. On ne prend pas le risque de rater une question classée à tort en `chitchat`. Le coût supplémentaire est acceptable.
- **`legal_compliance` → `num_rewrites=2`, `clarification`** : les questions juridiques sont souvent ambiguës ou référentielles ("qu'en est-il de l'article mentionné précédemment ?"). Deux reformulations et la détection de clarification améliorent significativement le rappel.
- **`faq_support` → `query_rewriting.enabled=false`, `num_rewrites=0`** : les questions FAQ sont généralement autonomes et courtes. La reformulation n'apporte pas de valeur et ajoute de la latence.
- **`faq_support` → `max_history_messages=15`** : les conversations FAQ sont souvent multi-tours ("et si je veux annuler ?", "et pour un changement d'adresse ?"). Un historique plus long aide à maintenir le contexte.
- **`faq_support` → pas de `out_of_scope`** : dans un contexte FAQ, les questions "hors périmètre" sont rares et il vaut mieux tenter une réponse que de refuser.
- **`reports_analysis` → pas de `chitchat`** : les analystes sont généralement directs et ne font pas de bavardage avec l'outil.
- **Tous `sliding_window`** : la stratégie résumé est plus complexe et n'apporte de la valeur que pour de très longues conversations. Elle peut être activée manuellement si nécessaire.

---

## 6. Spécifications techniques

### 6.1 Schéma Pydantic (backend)

```python
# ragkit/config/agents_schema.py
"""Pydantic schemas for agents configuration."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class MemoryStrategy(str, Enum):
    SLIDING_WINDOW = "sliding_window"
    SUMMARY = "summary"


class Intent(str, Enum):
    QUESTION = "question"
    GREETING = "greeting"
    CHITCHAT = "chitchat"
    OUT_OF_SCOPE = "out_of_scope"
    CLARIFICATION = "clarification"


class QueryRewritingConfig(BaseModel):
    enabled: bool = True
    num_rewrites: int = Field(default=1, ge=0, le=5)


class AgentsConfig(BaseModel):
    """Agents & orchestration configuration."""

    # Query Analyzer
    always_retrieve: bool = False
    detect_intents: list[Intent] = [
        Intent.QUESTION, Intent.GREETING,
        Intent.CHITCHAT, Intent.OUT_OF_SCOPE,
    ]

    # Query Rewriting
    query_rewriting: QueryRewritingConfig = QueryRewritingConfig()

    # Conversation history
    max_history_messages: int = Field(default=10, ge=0, le=50)
    memory_strategy: MemoryStrategy = MemoryStrategy.SLIDING_WINDOW

    # Prompts
    prompt_analyzer: str = DEFAULT_ANALYZER_PROMPT
    prompt_rewriting: str = DEFAULT_REWRITING_PROMPT
    prompt_greeting: str = DEFAULT_GREETING_PROMPT
    prompt_out_of_scope: str = DEFAULT_OOS_PROMPT

    # Advanced
    analyzer_model: str | None = None  # None = use main LLM
    analyzer_timeout: int = Field(default=15, ge=5, le=60)
    debug_default: bool = False
```

### 6.2 Query Analyzer (backend)

```python
# ragkit/agents/query_analyzer.py
"""Query Analyzer — intent detection and RAG routing."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass

from ragkit.config.agents_schema import AgentsConfig, Intent
from ragkit.llm.base import BaseLLMProvider, LLMMessage


@dataclass
class AnalysisResult:
    """Result of query analysis."""
    intent: Intent
    needs_rag: bool
    confidence: float
    reasoning: str
    latency_ms: int


class QueryAnalyzer:
    """Analyzes user queries to determine intent and RAG necessity."""

    def __init__(self, config: AgentsConfig, llm: BaseLLMProvider):
        self.config = config
        self.llm = llm

    async def analyze(
        self,
        message: str,
        history: list[dict] | None = None,
    ) -> AnalysisResult:
        """Analyze a user message and return intent + needs_rag."""

        if self.config.always_retrieve:
            return AnalysisResult(
                intent=Intent.QUESTION,
                needs_rag=True,
                confidence=1.0,
                reasoning="always_retrieve is enabled",
                latency_ms=0,
            )

        t_start = time.perf_counter()

        # Build conversation history string
        history_str = self._format_history(history or [])
        intents_str = ", ".join(i.value for i in self.config.detect_intents)

        prompt = self.config.prompt_analyzer.replace(
            "{conversation_history}", history_str
        ).replace(
            "{user_message}", message
        ).replace(
            "{intents_list}", intents_str
        )

        messages = [
            LLMMessage(role="system", content=prompt),
            LLMMessage(role="user", content=message),
        ]

        response = await self.llm.generate(
            messages=messages,
            temperature=0.0,
            max_tokens=200,
        )

        latency = int((time.perf_counter() - t_start) * 1000)

        # Parse JSON response
        try:
            data = json.loads(
                response.content.strip().removeprefix("```json").removesuffix("```").strip()
            )
            return AnalysisResult(
                intent=Intent(data.get("intent", "question")),
                needs_rag=data.get("needs_rag", True),
                confidence=data.get("confidence", 0.5),
                reasoning=data.get("reasoning", ""),
                latency_ms=latency,
            )
        except (json.JSONDecodeError, ValueError):
            # Fallback: assume question
            return AnalysisResult(
                intent=Intent.QUESTION,
                needs_rag=True,
                confidence=0.5,
                reasoning="Failed to parse analyzer response, defaulting to question",
                latency_ms=latency,
            )

    def _format_history(self, history: list[dict]) -> str:
        if not history:
            return "(pas d'historique)"
        lines = []
        for msg in history[-5:]:  # Last 5 messages for context
            role = "Utilisateur" if msg["role"] == "user" else "Assistant"
            content = msg["content"][:200]
            lines.append(f"{role}: {content}")
        return "\n".join(lines)
```

### 6.3 Query Rewriter (backend)

```python
# ragkit/agents/query_rewriter.py
"""Query Rewriter — reformulates queries for better retrieval."""

from __future__ import annotations

import time
from dataclasses import dataclass

from ragkit.config.agents_schema import AgentsConfig
from ragkit.llm.base import BaseLLMProvider, LLMMessage


@dataclass
class RewriteResult:
    """Result of query rewriting."""
    original_query: str
    rewritten_queries: list[str]
    latency_ms: int


class QueryRewriter:
    """Rewrites user queries for improved retrieval."""

    def __init__(self, config: AgentsConfig, llm: BaseLLMProvider):
        self.config = config
        self.llm = llm

    async def rewrite(
        self,
        query: str,
        history: list[dict] | None = None,
    ) -> RewriteResult:
        """Rewrite a query using conversation context."""

        if not self.config.query_rewriting.enabled:
            return RewriteResult(
                original_query=query,
                rewritten_queries=[query],
                latency_ms=0,
            )

        t_start = time.perf_counter()
        history_str = self._format_history(history or [])

        rewritten = []
        for _ in range(self.config.query_rewriting.num_rewrites):
            prompt = self.config.prompt_rewriting.replace(
                "{conversation_history}", history_str
            ).replace(
                "{user_query}", query
            )

            response = await self.llm.generate(
                messages=[LLMMessage(role="user", content=prompt)],
                temperature=0.0,
                max_tokens=200,
            )

            rewritten_query = response.content.strip().strip('"')
            if rewritten_query and rewritten_query != query:
                rewritten.append(rewritten_query)

        latency = int((time.perf_counter() - t_start) * 1000)

        if not rewritten:
            rewritten = [query]

        return RewriteResult(
            original_query=query,
            rewritten_queries=rewritten,
            latency_ms=latency,
        )

    def _format_history(self, history: list[dict]) -> str:
        if not history:
            return "(pas d'historique)"
        lines = []
        for msg in history[-6:]:
            role = "Utilisateur" if msg["role"] == "user" else "Assistant"
            content = msg["content"][:200]
            lines.append(f"{role}: {content}")
        return "\n".join(lines)
```

### 6.4 Conversation Memory (backend)

```python
# ragkit/agents/memory.py
"""Conversation memory management."""

from __future__ import annotations

from dataclasses import dataclass, field

from ragkit.config.agents_schema import AgentsConfig, MemoryStrategy
from ragkit.llm.base import BaseLLMProvider, LLMMessage


@dataclass
class ConversationMessage:
    role: str           # "user" or "assistant"
    content: str
    intent: str | None = None
    sources: list | None = None


@dataclass
class ConversationState:
    """Current state of a conversation."""
    messages: list[ConversationMessage] = field(default_factory=list)
    summary: str | None = None
    total_messages: int = 0


class ConversationMemory:
    """Manages conversation history with sliding window or summary."""

    def __init__(self, config: AgentsConfig, llm: BaseLLMProvider | None = None):
        self.config = config
        self.llm = llm  # Needed for summary strategy
        self.state = ConversationState()

    def add_message(self, role: str, content: str, **kwargs):
        self.state.messages.append(
            ConversationMessage(role=role, content=content, **kwargs)
        )
        self.state.total_messages += 1

    def get_history_for_llm(self) -> list[dict]:
        """Get formatted history to send to LLM."""
        if self.config.memory_strategy == MemoryStrategy.SLIDING_WINDOW:
            return self._sliding_window()
        else:
            return self._with_summary()

    def _sliding_window(self) -> list[dict]:
        recent = self.state.messages[-self.config.max_history_messages:]
        return [{"role": m.role, "content": m.content} for m in recent]

    def _with_summary(self) -> list[dict]:
        result = []
        if self.state.summary:
            result.append({
                "role": "system",
                "content": f"Résumé de la conversation précédente :\n{self.state.summary}",
            })
        recent = self.state.messages[-self.config.max_history_messages:]
        result.extend({"role": m.role, "content": m.content} for m in recent)
        return result

    async def update_summary_if_needed(self):
        """Generate/update summary when messages exceed window."""
        if (
            self.config.memory_strategy != MemoryStrategy.SUMMARY
            or not self.llm
            or len(self.state.messages) <= self.config.max_history_messages
        ):
            return

        # Messages that are about to exit the window
        overflow = self.state.messages[:-self.config.max_history_messages]
        if not overflow:
            return

        old_context = ""
        if self.state.summary:
            old_context = f"Résumé précédent :\n{self.state.summary}\n\n"

        messages_text = "\n".join(
            f"{'Utilisateur' if m.role == 'user' else 'Assistant'}: {m.content[:300]}"
            for m in overflow
        )

        prompt = (
            f"{old_context}"
            f"Nouveaux messages à intégrer au résumé :\n{messages_text}\n\n"
            "Génère un résumé concis de l'ensemble de la conversation. "
            "Inclus les points clés, questions posées, et réponses importantes."
        )

        response = await self.llm.generate(
            messages=[LLMMessage(role="user", content=prompt)],
            temperature=0.0,
            max_tokens=500,
        )

        self.state.summary = response.content.strip()
        # Remove summarized messages from active list
        self.state.messages = self.state.messages[-self.config.max_history_messages:]

    def clear(self):
        """Reset conversation state."""
        self.state = ConversationState()
```

### 6.5 Orchestrateur (backend)

```python
# ragkit/agents/orchestrator.py
"""Main orchestrator — coordinates all agents and pipeline stages."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import AsyncIterator

from ragkit.config.agents_schema import AgentsConfig, Intent
from ragkit.agents.query_analyzer import QueryAnalyzer, AnalysisResult
from ragkit.agents.query_rewriter import QueryRewriter, RewriteResult
from ragkit.agents.memory import ConversationMemory
from ragkit.retrieval.search_router import SearchRouter
from ragkit.llm.response_generator import ResponseGenerator
from ragkit.llm.base import BaseLLMProvider, LLMMessage, LLMStreamChunk


@dataclass
class OrchestratorDebugInfo:
    """Debug info from the full orchestrated pipeline."""
    # Analysis
    intent: str
    intent_confidence: float
    intent_reasoning: str
    analyzer_latency_ms: int
    # Rewriting
    original_query: str
    rewritten_queries: list[str]
    rewriting_latency_ms: int
    # History
    history_messages: int
    history_strategy: str
    history_tokens: int | None
    # Retrieval (from search router)
    retrieval_debug: dict | None
    # Generation (from response generator)
    generation_debug: dict | None
    # Total
    total_latency_ms: int


class Orchestrator:
    """Coordinates query analysis, retrieval, and generation."""

    def __init__(
        self,
        config: AgentsConfig,
        analyzer: QueryAnalyzer,
        rewriter: QueryRewriter,
        memory: ConversationMemory,
        search_router: SearchRouter,
        response_generator: ResponseGenerator,
        llm: BaseLLMProvider,
    ):
        self.config = config
        self.analyzer = analyzer
        self.rewriter = rewriter
        self.memory = memory
        self.search_router = search_router
        self.response_generator = response_generator
        self.llm = llm

    async def process(
        self,
        message: str,
        include_debug: bool = False,
        **search_kwargs,
    ):
        """Process a user message through the full pipeline."""
        t_start = time.perf_counter()

        history = self.memory.get_history_for_llm()

        # 1. Query Analysis
        analysis = await self.analyzer.analyze(message, history)

        # 2. Route by intent
        if analysis.needs_rag:
            response = await self._handle_rag_query(
                message, history, analysis, include_debug, **search_kwargs
            )
        else:
            response = await self._handle_non_rag(
                message, history, analysis
            )

        # 3. Update memory
        self.memory.add_message("user", message, intent=analysis.intent.value)
        self.memory.add_message("assistant", response.content)
        await self.memory.update_summary_if_needed()

        t_total = int((time.perf_counter() - t_start) * 1000)

        if include_debug:
            response.debug = self._build_debug(
                analysis, response, t_total, history
            )

        return response

    async def _handle_rag_query(
        self, message, history, analysis, include_debug, **search_kwargs
    ):
        """Handle a query that needs RAG retrieval."""
        # Query Rewriting
        rewrite = await self.rewriter.rewrite(message, history)
        search_query = rewrite.rewritten_queries[0]

        # Multi-query: if multiple rewrites, search with all and merge
        all_results = []
        for q in rewrite.rewritten_queries:
            result = await self.search_router.search(q, **search_kwargs)
            all_results.extend(result.results)

        # Deduplicate by chunk_id
        seen = set()
        unique = []
        for r in all_results:
            if r.chunk_id not in seen:
                seen.add(r.chunk_id)
                unique.append(r)

        # Generate response with context
        return await self.response_generator.generate(
            query=message,  # Original query for the LLM
            retrieval_results=unique,
            include_debug=include_debug,
        )

    async def _handle_non_rag(self, message, history, analysis):
        """Handle greeting, chitchat, or out_of_scope."""
        prompt_map = {
            Intent.GREETING: self.config.prompt_greeting,
            Intent.CHITCHAT: self.config.prompt_greeting,  # Same friendly prompt
            Intent.OUT_OF_SCOPE: self.config.prompt_out_of_scope,
        }
        system_prompt = prompt_map.get(
            analysis.intent, self.config.prompt_greeting
        )

        messages = [LLMMessage(role="system", content=system_prompt)]
        # Add recent history for context
        for h in history[-4:]:
            messages.append(LLMMessage(role=h["role"], content=h["content"]))
        messages.append(LLMMessage(role="user", content=message))

        response = await self.llm.generate(
            messages=messages,
            temperature=0.5,
            max_tokens=500,
        )

        from ragkit.llm.response_generator import RAGResponse
        return RAGResponse(content=response.content, sources=[])

    def new_conversation(self):
        """Start a fresh conversation."""
        self.memory.clear()
```

### 6.6 API REST (routes backend)

#### 6.6.1 Routes Config agents

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/agents/config` | GET | Config agents courante | — | `AgentsConfig` |
| `/api/agents/config` | PUT | Met à jour la config | `AgentsConfig` (partiel) | `AgentsConfig` |
| `/api/agents/config/reset` | POST | Réinitialise au profil actif | — | `AgentsConfig` |

#### 6.6.2 Routes Chat (pipeline orchestré — remplace Étape 9)

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/chat` | POST | Pipeline orchestré complet | `ChatQuery` | `OrchestratedChatResponse` |
| `/api/chat/stream` | POST | Pipeline orchestré en streaming | `ChatQuery` | `text/event-stream` |
| `/api/chat/new` | POST | Démarre une nouvelle conversation | — | `{ success: true }` |
| `/api/chat/history` | GET | Retourne l'historique de la conversation | — | `ConversationHistory` |

#### 6.6.3 Modèles de requête et réponse

```python
# Extension du ChatQuery (Étape 9 → 10)
class ChatQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=5000)
    search_type: SearchType | None = None
    alpha: float | None = None
    filters: SearchFilters | None = None
    include_debug: bool = False
    # Note: conversation_id n'est pas nécessaire en V1
    # (une seule conversation active par session)

class OrchestratedChatResponse(BaseModel):
    """Chat response from the orchestrated pipeline."""
    query: str
    answer: str
    sources: list[ChatSource]
    intent: str                        # ← NOUVEAU
    needs_rag: bool                    # ← NOUVEAU
    rewritten_query: str | None        # ← NOUVEAU
    debug: OrchestratorDebugInfo | None = None

class ConversationHistory(BaseModel):
    messages: list[ConversationMessageDTO]
    total_messages: int
    has_summary: bool

class ConversationMessageDTO(BaseModel):
    role: str
    content: str
    intent: str | None
    sources: list[ChatSource] | None
    timestamp: str
```

### 6.7 Commandes Tauri (Rust) — ajouts

```rust
// Agents config
#[tauri::command]
pub async fn get_agents_config() -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn update_agents_config(config: serde_json::Value) -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn reset_agents_config() -> Result<serde_json::Value, String> { ... }

// Chat (orchestrated — replaces Étape 9 commands)
#[tauri::command]
pub async fn chat_orchestrated(window: tauri::Window, query: serde_json::Value) -> Result<String, String> { ... }
#[tauri::command]
pub async fn new_conversation() -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn get_conversation_history() -> Result<serde_json::Value, String> { ... }
```

### 6.8 Composants React — arborescence

```
desktop/src/
├── components/
│   ├── settings/
│   │   ├── AgentsSettings.tsx                 ← NOUVEAU : section complète
│   │   ├── IntentSelector.tsx                 ← NOUVEAU : checkboxes intentions
│   │   ├── QueryRewritingPanel.tsx            ← NOUVEAU : toggle + num_rewrites
│   │   ├── ConversationMemoryPanel.tsx        ← NOUVEAU : max_history + strategy
│   │   ├── AgentPromptsPanel.tsx              ← NOUVEAU : éditeurs de prompts
│   │   └── ... (existants)
│   ├── chat/
│   │   ├── ChatView.tsx                       ← MODIFIER : intégrer orchestrateur
│   │   ├── ChatHeader.tsx                     ← NOUVEAU : "Nouvelle conversation"
│   │   ├── ConversationThread.tsx             ← NOUVEAU : fil de conversation
│   │   ├── IntentBadge.tsx                    ← NOUVEAU : badge intention
│   │   ├── RewriteIndicator.tsx               ← NOUVEAU : indicateur reformulation
│   │   ├── OrchestratorDebugPanel.tsx         ← NOUVEAU : debug pipeline complet
│   │   └── ... (existants)
│   └── ui/
│       └── ... (existants)
├── hooks/
│   ├── useAgentsConfig.ts                     ← NOUVEAU
│   ├── useConversation.ts                     ← NOUVEAU : état conversation
│   ├── useOrchestratedChat.ts                 ← NOUVEAU : remplace useChat
│   └── ... (existants)
├── lib/
│   └── ipc.ts                                 ← MODIFIER
└── locales/
    ├── fr.json                                ← MODIFIER
    └── en.json                                ← MODIFIER
```

### 6.9 Persistance

```json
{
  "agents": {
    "always_retrieve": false,
    "detect_intents": ["question", "greeting", "chitchat", "out_of_scope"],
    "query_rewriting": {
      "enabled": true,
      "num_rewrites": 1
    },
    "max_history_messages": 10,
    "memory_strategy": "sliding_window",
    "prompt_analyzer": "...",
    "prompt_rewriting": "...",
    "prompt_greeting": "...",
    "prompt_out_of_scope": "...",
    "analyzer_model": null,
    "analyzer_timeout": 15,
    "debug_default": false
  }
}
```

L'historique de conversation est stocké **en mémoire uniquement** (pas persisté entre les sessions). La persistance des conversations est hors périmètre V1.

### 6.10 Dépendances Python ajoutées

```toml
# pyproject.toml — ajouts pour Étape 10
# Aucune nouvelle dépendance requise.
# Tous les outils nécessaires sont déjà disponibles
# (LLM providers Étape 9, search router Étape 7, etc.)
```

---

## 7. Critères d'acceptation

### 7.1 Fonctionnels

| # | Critère |
|---|---------|
| F1 | La section `PARAMÈTRES > Paramètres avancés > AGENTS` est accessible et affiche tous les paramètres |
| F2 | Les checkboxes des intentions actives fonctionnent (`question` est toujours coché et non décochable) |
| F3 | Le toggle "Toujours lancer la recherche RAG" court-circuite le Query Analyzer |
| F4 | Le toggle "Reformulation automatique" active/désactive le Query Rewriter |
| F5 | Le slider `num_rewrites` est fonctionnel (0-5) |
| F6 | Le slider `max_history_messages` est fonctionnel (0-50) |
| F7 | Le sélecteur de stratégie mémoire propose `sliding_window` et `summary` |
| F8 | Les éditeurs de prompts (Analyzer, Rewriting, Greeting, Out of Scope) sont fonctionnels |
| F9 | Les boutons "Restaurer le prompt par défaut" fonctionnent pour chaque prompt |
| F10 | Le chat maintient un historique de conversation multi-tours |
| F11 | Une salutation ("Bonjour") ne déclenche **pas** de recherche RAG |
| F12 | Une question factuelle déclenche la recherche RAG |
| F13 | Une question hors périmètre ("Quelle est la capitale du Brésil ?") est détectée comme `out_of_scope` |
| F14 | La reformulation résout les pronoms ("Et pour celui-là ?") en utilisant l'historique |
| F15 | L'indicateur d'intention est affiché sous chaque réponse (si activé dans Options) |
| F16 | L'indicateur de reformulation montre la requête reformulée (si applicable) |
| F17 | Le bouton "Nouvelle conversation" efface l'historique avec confirmation |
| F18 | Le mode debug affiche l'intention, la reformulation, l'historique et le pipeline complet |
| F19 | Le badge "Modifié" apparaît à côté de chaque paramètre modifié |
| F20 | Le bouton "Réinitialiser au profil" restaure les valeurs par défaut |
| F21 | Tous les textes sont traduits FR/EN via i18n |

### 7.2 Techniques

| # | Critère |
|---|---------|
| T1 | `GET /api/agents/config` retourne la config courante |
| T2 | `PUT /api/agents/config` valide et persiste les modifications |
| T3 | `POST /api/agents/config/reset` restaure les valeurs du profil actif |
| T4 | Le Query Analyzer retourne un JSON valide avec intent, needs_rag, confidence |
| T5 | Le Query Analyzer fait fallback sur `question` + `needs_rag=true` si le parsing échoue |
| T6 | `always_retrieve=true` court-circuite le Query Analyzer (latence 0 ms) |
| T7 | Le Query Rewriter produit une requête reformulée autonome |
| T8 | `num_rewrites > 1` génère plusieurs requêtes et fusionne les résultats (multi-query) |
| T9 | La fenêtre glissante envoie exactement les N derniers messages au LLM |
| T10 | La stratégie summary génère un résumé quand les messages dépassent la fenêtre |
| T11 | `POST /api/chat/new` réinitialise l'historique et la mémoire |
| T12 | `GET /api/chat/history` retourne l'historique complet avec intents et sources |
| T13 | L'orchestrateur enchaîne correctement : analyzer → rewriter → retrieval → generation |
| T14 | Les messages non-RAG (greeting, out_of_scope) utilisent les prompts dédiés |
| T15 | Le streaming fonctionne pour les réponses RAG et non-RAG |
| T16 | La config agents est persistée dans `settings.json` sous `agents` |
| T17 | L'historique de conversation est en mémoire (pas persisté entre sessions) |
| T18 | La latence du Query Analyzer est < 500 ms |
| T19 | `tsc --noEmit` ne produit aucune erreur TypeScript |
| T20 | Le CI passe sur les 4 targets (lint + build) |

---

## 8. Périmètre exclus (Étape 10)

- **Monitoring et métriques** : sera ajouté à l'Étape 11. Les métriques par composant ne sont pas encore agrégées.
- **Persistance des conversations** (historique entre sessions) : amélioration future. Les conversations sont perdues au redémarrage.
- **Conversations multiples** (onglets ou liste de conversations) : amélioration future. Une seule conversation active en V1.
- **Agents spécialisés** (agent de résumé, agent de comparaison, agent de synthèse) : amélioration future.
- **Query expansion** avancée (synonymes via thésaurus, hyperonymes/hyponymes) : amélioration future.
- **HyDE** (Hypothetical Document Embeddings) : amélioration future.
- **Routage dynamique** (adapter automatiquement alpha, search_type selon l'intention) : amélioration future.
- **Feedback loop** (l'utilisateur valide/invalide la détection d'intention pour améliorer le système) : amélioration future.
- **Modèle Analyzer dédié** (modèle rapide et léger différent du modèle principal) : supporté techniquement via `analyzer_model` mais non configuré par défaut. Le modèle principal est utilisé.

---

## 9. Estimation

| Tâche | Effort estimé |
|-------|---------------|
| Schéma Pydantic `AgentsConfig` + `QueryRewritingConfig` + validation | 0.5 jour |
| `QueryAnalyzer` (détection d'intention, parsing JSON, fallback, prompt) | 2 jours |
| `QueryRewriter` (reformulation, résolution pronoms, multi-query) | 1.5 jours |
| `ConversationMemory` (sliding_window, summary, état) | 2 jours |
| `Orchestrator` (coordination, routage par intent, pipeline RAG vs non-RAG) | 2.5 jours |
| Prompts par défaut (Analyzer, Rewriting, Greeting, OOS) + tuning | 1 jour |
| Routes API config agents (CRUD) | 0.5 jour |
| Routes API chat orchestré (remplacement pipeline Étape 9) | 1 jour |
| Routes API conversation (new, history) | 0.5 jour |
| Commandes Tauri (config + chat orchestré + conversation) | 0.5 jour |
| Composant `AgentsSettings.tsx` (section paramètres complète) | 1 jour |
| Composants `IntentSelector.tsx`, `QueryRewritingPanel.tsx`, `ConversationMemoryPanel.tsx` | 1 jour |
| Composant `AgentPromptsPanel.tsx` (4 éditeurs de prompts avec reset) | 1 jour |
| Composant `ChatHeader.tsx` (bouton nouvelle conversation) | 0.5 jour |
| Composant `ConversationThread.tsx` (fil multi-tours avec historique) | 1.5 jours |
| Composants `IntentBadge.tsx`, `RewriteIndicator.tsx` | 0.5 jour |
| Composant `OrchestratorDebugPanel.tsx` (debug pipeline complet) | 1 jour |
| Modification `ChatView.tsx` (intégration orchestrateur) | 1 jour |
| Hooks (`useAgentsConfig`, `useConversation`, `useOrchestratedChat`) | 1 jour |
| Traductions i18n (FR + EN) | 0.5 jour |
| Tests unitaires `QueryAnalyzer` (chaque intention, fallback, always_retrieve) | 1.5 jours |
| Tests unitaires `QueryRewriter` (reformulation, résolution pronoms, multi-query) | 1 jour |
| Tests unitaires `ConversationMemory` (sliding_window, summary, clear) | 1 jour |
| Tests unitaires `Orchestrator` (routage par intent, pipeline RAG vs non-RAG) | 1.5 jours |
| Tests d'intégration (conversation multi-tours complète) | 1.5 jours |
| Tests manuels + corrections + tuning des prompts | 2 jours |
| **Total** | **~29 jours** |
