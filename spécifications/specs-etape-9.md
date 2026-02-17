# 🧰 RAGKIT Desktop — Spécifications Étape 9 : LLM / Génération

> **Étape** : 9 — LLM / Génération  
> **Tag cible** : `v0.10.0`  
> **Date** : 17 février 2026  
> **Dépôt** : https://github.com/henribesnard/ragkit_desktop.git  
> **Prérequis** : Étape 8 (Reranking) implémentée et validée

---

## 1. Objectif

Ajouter la **génération de réponses en langage naturel** par un LLM, en utilisant comme contexte les chunks récupérés par le pipeline de retrieval (Étapes 5–8). C'est l'étape qui transforme RAGKIT d'un moteur de recherche en un **assistant conversationnel RAG complet**.

Cette étape livre :
- Une section `PARAMÈTRES > Paramètres avancés > LLM / GÉNÉRATION` complète et fonctionnelle.
- Quatre **providers LLM** : **OpenAI** (GPT-4o, GPT-4o-mini), **Anthropic** (Claude 3.5 Sonnet, Claude 3 Haiku), **Ollama** (modèles locaux : Llama 3, Mistral, Phi-3), **Mistral AI** (Mistral Large, Mistral Small).
- Le **streaming** des réponses token par token dans le chat.
- L'**assemblage du contexte** : sélection et formatage des chunks en contexte pour le prompt LLM, avec respect du budget token.
- Les **citations de sources** : chaque affirmation de la réponse peut être liée au chunk source, avec format configurable (inline ou footnote).
- Un **prompt système par défaut** adapté au RAG, entièrement personnalisable.
- Le **comportement d'incertitude** : quand le LLM ne trouve pas la réponse dans le contexte, il le dit honnêtement.
- L'ajout de paramètres LLM dans les **Paramètres généraux** (modèle, température, langue, sources).
- Un **mode debug** montrant le prompt complet envoyé au LLM, les chunks injectés, et les latences.

**Pas d'historique de conversation** à cette étape. Chaque requête est indépendante (pas de mémoire entre les messages). L'historique conversationnel sera ajouté à l'Étape 10 (Agents & Orchestration).

---

## 2. Spécifications fonctionnelles

### 2.1 Section PARAMÈTRES > Paramètres avancés > LLM / GÉNÉRATION

#### Structure de l'onglet PARAMÈTRES à cette étape

```
PARAMÈTRES
├── Paramètres généraux
│   ├── Mode d'ingestion (Manuel / Automatique)          ← Étape 4
│   ├── Type de recherche (Sémantique / Lexicale / Hybride)  ← Étape 7
│   ├── Modèle LLM                                       ← NOUVEAU
│   ├── Température                                       ← NOUVEAU
│   └── Langue de réponse                                 ← NOUVEAU
└── Paramètres avancés
    ├── INGESTION & PRÉPROCESSING                         ← Étape 1
    ├── CHUNKING                                          ← Étape 2
    ├── EMBEDDING                                         ← Étape 3
    ├── BASE DE DONNÉES VECTORIELLE                       ← Étape 4
    ├── RECHERCHE SÉMANTIQUE                              ← Étape 5
    ├── RECHERCHE LEXICALE                                ← Étape 6
    ├── RECHERCHE HYBRIDE                                 ← Étape 7
    ├── RERANKING                                         ← Étape 8
    └── LLM / GÉNÉRATION                                  ← NOUVEAU
```

#### Layout de la section LLM / GÉNÉRATION

```
┌─────────────────────────────────────────────────────────────────┐
│  LLM / GÉNÉRATION                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Provider et modèle ─────────────────────────────────────┐  │
│  │                                                            │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │ │
│  │  │ ☁️ OpenAI     │ │ ☁️ Anthropic  │ │ 🦙 Ollama    │       │ │
│  │  │              │ │              │ │ (local)      │       │ │
│  │  │ ✓ SÉLECT.   │ │              │ │              │       │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘       │ │
│  │  ┌──────────────┐                                          │ │
│  │  │ ☁️ Mistral AI │                                          │ │
│  │  │              │                                          │ │
│  │  └──────────────┘                                          │ │
│  │                                                            │ │
│  │  Modèle : [▾ gpt-4o-mini                            ]     │ │
│  │                                                            │ │
│  │  ┌── Fiche modèle ──────────────────────────────────────┐ │ │
│  │  │  📏 Contexte : 128K tokens                           │ │ │
│  │  │  🌐 Langues : Multilingue                            │ │ │
│  │  │  💰 Coût : ~$0.15 / 1M input · $0.60 / 1M output   │ │ │
│  │  │  ⚡ Latence : ~500-1500 ms (premier token)           │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │  Clé API OpenAI : [••••••••••••••••] [👁] [✓ Valide]     │ │
│  │                                                            │ │
│  │  [🔌 Tester la connexion]                                  │ │
│  │  ✅ Connexion réussie — gpt-4o-mini · 842 ms              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Paramètres de génération ───────────────────────────────┐  │
│  │                                                            │ │
│  │  Température :      [◆=========] 0.1                       │ │
│  │  Max tokens :       [====◆=====] 2000                      │ │
│  │  Top P :            [========◆=] 0.9                       │ │
│  │                                                            │ │
│  │  ℹ️ Température basse (0.0–0.3) = réponses factuelles.     │ │
│  │  Température élevée (0.7+) = plus de créativité mais       │ │
│  │  risque accru d'hallucinations.                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Comportement et citations ──────────────────────────────┐  │
│  │                                                            │ │
│  │  ☑ Citer les sources dans la réponse                      │ │
│  │  Format des citations : (•) Inline [Source: nom]          │ │
│  │                          ( ) Footnote ¹²³                 │ │
│  │                                                            │ │
│  │  ☑ Admettre l'incertitude                                 │ │
│  │  Phrase d'incertitude :                                    │ │
│  │  [Je n'ai pas trouvé cette information dans les documents │ │
│  │   disponibles.                                        ]   │ │
│  │                                                            │ │
│  │  Langue de réponse : [▾ auto (même langue que la requête)]│ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Contexte (chunks envoyés au LLM) ──────────────────────┐  │
│  │                                                            │ │
│  │  Nombre max de chunks :  [==◆=======] 5                    │ │
│  │  Tokens max de contexte : [====◆=====] 4000                │ │
│  │                                                            │ │
│  │  ℹ️ Les chunks les plus pertinents (après recherche et      │ │
│  │  reranking) sont injectés dans le prompt. Un contexte      │ │
│  │  plus large donne plus d'information au LLM mais coûte    │ │
│  │  plus cher et peut diluer la pertinence.                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌── Prompt système ─────────────────────────────────────────┐  │
│  │                                                            │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ Tu es un assistant spécialisé qui répond aux         │  │ │
│  │  │ questions en se basant UNIQUEMENT sur le contexte    │  │ │
│  │  │ fourni. Cite tes sources. Si tu ne trouves pas       │  │ │
│  │  │ l'information, dis-le honnêtement.                   │  │ │
│  │  │                                                      │  │ │
│  │  │ Lignes: 6 · Tokens: ~85                              │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │  [↻ Restaurer le prompt par défaut]                        │ │
│  │                                                            │ │
│  │  ℹ️ Le prompt système définit le comportement du LLM.      │ │
│  │  Modifiez-le pour adapter le ton, le format de réponse    │ │
│  │  ou les consignes spécifiques à votre domaine.            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ▸ Paramètres avancés                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Timeout (secondes) : [====◆=====] 60                      │ │
│  │  Max retries :        [◆=========] 2                       │ │
│  │  ☑ Streaming activé                                        │ │
│  │  ☐ Mode debug activé par défaut                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [↻ Réinitialiser au profil]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Paramètres généraux — extension LLM

Trois nouveaux paramètres sont ajoutés dans `PARAMÈTRES > Paramètres généraux` :

```
┌─────────────────────────────────────────────────────────────────┐
│  PARAMÈTRES GÉNÉRAUX                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Mode d'ingestion ........ (•) Manuel  ( ) Automatique  ← Ét.4 │
│  Type de recherche ....... (•) Hybride              ← Ét.7     │
│                                                                 │
│  ─────────────────────────────────────────────────              │
│                                                                 │
│  Modèle LLM                                         ← NOUVEAU  │
│  [▾ gpt-4o-mini (OpenAI)                                   ]   │
│                                                                 │
│  Température                                         ← NOUVEAU  │
│  Factuel ◀ [◆=========] ▶ Créatif                              │
│                0.1                                              │
│                                                                 │
│  Langue de réponse                                   ← NOUVEAU  │
│  [▾ Auto (même langue que la question)                     ]   │
│                                                                 │
│  ℹ️ Ces paramètres contrôlent le comportement général du         │
│  chat. Pour un réglage fin, utilisez Paramètres avancés >      │
│  LLM / GÉNÉRATION.                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Le CHAT — interface conversationnelle complète

L'Étape 9 transforme le CHAT d'un afficheur de résultats bruts en un **chat conversationnel complet** :

```
┌─────────────────────────────────────────────────────────────────┐
│  💬 CHAT                                           [⚙ Options] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── Zone de conversation ───────────────────────────────────┐  │
│  │                                                            │ │
│  │  👤 Quelles sont les conditions de résiliation du contrat? │ │
│  │                                                            │ │
│  │  🤖 D'après les documents disponibles, les conditions de   │ │
│  │  résiliation sont définies à l'article 12 du contrat de   │ │
│  │  service. Le contrat peut être résilié dans les cas        │ │
│  │  suivants :                                                │ │
│  │                                                            │ │
│  │  • **Résiliation pour faute** : en cas de manquement      │ │
│  │    grave aux obligations contractuelles, avec un délai     │ │
│  │    de mise en demeure de 30 jours.                         │ │
│  │    [Source: contrat-service-2024.pdf, p.8]                │ │
│  │                                                            │ │
│  │  • **Résiliation pour convenance** : avec un préavis de   │ │
│  │    3 mois et le paiement des prestations en cours.        │ │
│  │    [Source: contrat-service-2024.pdf, p.9]                │ │
│  │                                                            │ │
│  │  • **Résiliation de plein droit** : en cas de liquidation │ │
│  │    judiciaire ou de cessation d'activité.                 │ │
│  │    [Source: CGV-2024.pdf, p.3]                            │ │
│  │                                                            │ │
│  │  ── Sources ──────────────────────────────────────────────│ │
│  │  📄 contrat-service-2024.pdf · Pages 8-9 · Score 0.987   │ │
│  │  📄 CGV-2024.pdf · Page 3 · Score 0.934                  │ │
│  │  📄 avenant-2023.pdf · Page 2 · Score 0.891              │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [▾ 🔀 Hybride ▾]                                              │
│  [Posez votre question...                              ] [→]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Éléments de la réponse

| Élément | Description |
|---------|-------------|
| **Texte de la réponse** | Texte généré par le LLM en markdown, avec mise en forme (gras, listes, etc.) |
| **Citations inline** | `[Source: nom_doc, p.N]` insérées dans le texte aux endroits appropriés |
| **Panneau Sources** | Liste des chunks utilisés comme contexte, triés par score, cliquables pour voir le chunk complet |
| **Indicateur de confiance** | Si le LLM exprime une incertitude, le message est annoté avec un badge ⚠️ |

### 2.4 Streaming des réponses

La réponse du LLM est affichée **token par token** en streaming :

**Comportement** :
1. L'utilisateur soumet une requête → apparition d'un indicateur de chargement "Recherche en cours..."
2. Le pipeline de retrieval s'exécute (recherche + reranking) → l'indicateur passe à "Génération en cours..."
3. Les tokens commencent à arriver du LLM → affichage incrémental dans la bulle de réponse.
4. Le streaming se termine → le panneau Sources apparaît sous la réponse.

**État de l'interface pendant le streaming** :
- Le bouton d'envoi est remplacé par un bouton "⏹ Arrêter" qui interrompt la génération.
- Le texte s'affiche progressivement, le markdown est rendu en temps réel.
- Les citations ne sont rendues cliquables qu'une fois le streaming terminé.

### 2.5 Assemblage du contexte

Le composant **Context Assembler** sélectionne et formate les chunks en contexte pour le prompt LLM :

```
Résultats du retrieval (après reranking)
    │
    ▼
┌──────────────────────────────────────┐
│  CONTEXT ASSEMBLER                   │
│                                      │
│  1. Sélection : top context_max_chunks│
│  2. Budget tokens : ≤ context_max_tokens│
│  3. Formatage : chaque chunk avec    │
│     source, page, score              │
│  4. Injection dans le prompt système │
└──────────────────────────────────────┘
    │
    ▼
Prompt complet = system_prompt + context + user_query
```

**Format du contexte injecté** :

```
<context>
<source id="1" title="contrat-service-2024.pdf" page="8" score="0.987">
Les conditions de résiliation anticipée sont définies à l'article 12
du présent contrat. Le prestataire peut résilier le contrat avec un
préavis de 30 jours en cas de manquement grave...
</source>
<source id="2" title="CGV-2024.pdf" page="3" score="0.934">
Article 7 — Résiliation. Le contrat peut être résilié de plein droit
en cas de liquidation judiciaire ou de cessation d'activité...
</source>
<source id="3" title="avenant-2023.pdf" page="2" score="0.891">
L'avenant modifie les conditions de résiliation pour convenance
en ajoutant un préavis de 3 mois...
</source>
</context>
```

**Règles de sélection** :
1. Les chunks sont triés par score (post-reranking ou post-recherche).
2. On ajoute les chunks un par un jusqu'à atteindre `context_max_chunks` ou `context_max_tokens`.
3. Si un chunk dépasse le budget token restant, il est tronqué.
4. Les chunks sont formatés en XML avec métadonnées (titre, page, score) pour permettre au LLM de les citer.

### 2.6 Prompt système par défaut

```
Tu es un assistant spécialisé dans l'analyse de documents. Tu réponds aux questions
en te basant UNIQUEMENT sur le contexte fourni entre les balises <context> et </context>.

Règles :
1. Base ta réponse exclusivement sur le contexte fourni. Ne génère jamais d'information
   qui ne s'y trouve pas.
2. Cite tes sources en utilisant le format [Source: titre, p.N] après chaque affirmation
   importante.
3. Si l'information demandée n'est pas dans le contexte, dis-le honnêtement en utilisant
   la phrase : "{uncertainty_phrase}".
4. Réponds dans la langue de la question, sauf indication contraire.
5. Structure ta réponse de manière claire avec des paragraphes, listes ou titres si
   nécessaire.
6. Si plusieurs sources se contredisent, signale-le explicitement.
```

Les variables `{uncertainty_phrase}` et `{citation_format}` sont remplacées dynamiquement.

### 2.7 Panneau Sources (sous la réponse)

Chaque réponse est accompagnée d'un panneau **Sources** montrant les chunks utilisés comme contexte :

```
┌── Sources (3 documents) ─────────────────────────────────────┐
│                                                              │
│  📄 contrat-service-2024.pdf · Pages 8-9 · Score 0.987      │
│  ▸ Cliquer pour voir l'extrait                              │
│                                                              │
│  📄 CGV-2024.pdf · Page 3 · Score 0.934                     │
│  ▸ Cliquer pour voir l'extrait                              │
│                                                              │
│  📄 avenant-2023.pdf · Page 2 · Score 0.891                 │
│  ▸ Cliquer pour voir l'extrait                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Au clic** sur une source, l'extrait du chunk s'affiche en accordéon avec les métadonnées complètes.

### 2.8 Mode debug enrichi

Le mode debug de l'Étape 9 est le plus complet. Il montre l'ensemble du pipeline :

```
┌── Mode debug ───────────────────────────────────────────────────┐
│                                                                 │
│  Pipeline : Hybride (α=0.50, RRF) → Reranking → LLM (GPT-4o-mini)│
│                                                                 │
│  ── Retrieval ──                                                │
│  Recherche : 287 ms · Reranking : 255 ms · 5 chunks retenus    │
│                                                                 │
│  ── Contexte ──                                                 │
│  Chunks injectés : 5 · Tokens contexte : 2 847 / 4 000        │
│  Sources : contrat-service (p.8, p.9), CGV (p.3), avenant (p.2)│
│                                                                 │
│  ── Génération ──                                               │
│  Modèle : gpt-4o-mini · Température : 0.1                     │
│  Tokens prompt : 3 142 · Tokens réponse : 487                  │
│  Time to first token : 623 ms · Temps total : 2 847 ms        │
│  Coût estimé : ~$0.0005 input + $0.0003 output                │
│                                                                 │
│  ▸ Voir le prompt complet (system + context + query)           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Providers LLM

### 3.1 Catalogue des providers

| Provider | Clé | Authentification | Modèles | Streaming | Latence |
|----------|-----|:---:|---------|:---:|:---:|
| OpenAI | `openai` | API Key | GPT-4o, GPT-4o-mini, GPT-4-turbo | ✅ | 500-1500 ms |
| Anthropic | `anthropic` | API Key | Claude 3.5 Sonnet, Claude 3 Haiku | ✅ | 500-2000 ms |
| Ollama | `ollama` | Aucune | Llama 3, Mistral, Phi-3, Gemma 2 | ✅ | 1000-5000 ms |
| Mistral AI | `mistral` | API Key | Mistral Large, Mistral Small, Codestral | ✅ | 500-1500 ms |

### 3.2 Catalogue des modèles

#### OpenAI

| Modèle | Clé | Contexte | Coût (input/output) | Qualité |
|--------|-----|:---:|:---:|:---:|
| GPT-4o | `gpt-4o` | 128K | $2.50 / $10.00 par 1M | ⭐⭐⭐⭐⭐ |
| GPT-4o mini | `gpt-4o-mini` | 128K | $0.15 / $0.60 par 1M | ⭐⭐⭐⭐ |
| GPT-4 Turbo | `gpt-4-turbo` | 128K | $10 / $30 par 1M | ⭐⭐⭐⭐⭐ |

#### Anthropic

| Modèle | Clé | Contexte | Coût (input/output) | Qualité |
|--------|-----|:---:|:---:|:---:|
| Claude 3.5 Sonnet | `claude-3-5-sonnet-20241022` | 200K | $3.00 / $15.00 par 1M | ⭐⭐⭐⭐⭐ |
| Claude 3 Haiku | `claude-3-haiku-20240307` | 200K | $0.25 / $1.25 par 1M | ⭐⭐⭐⭐ |

#### Ollama (local)

| Modèle | Clé | Contexte | Coût | Qualité |
|--------|-----|:---:|:---:|:---:|
| Llama 3.1 8B | `llama3.1:8b` | 128K | 🆓 Gratuit | ⭐⭐⭐ |
| Mistral 7B | `mistral:7b` | 32K | 🆓 Gratuit | ⭐⭐⭐ |
| Phi-3 Mini | `phi3:mini` | 128K | 🆓 Gratuit | ⭐⭐⭐ |
| Gemma 2 9B | `gemma2:9b` | 8K | 🆓 Gratuit | ⭐⭐⭐ |

#### Mistral AI

| Modèle | Clé | Contexte | Coût (input/output) | Qualité |
|--------|-----|:---:|:---:|:---:|
| Mistral Large | `mistral-large-latest` | 128K | $2.00 / $6.00 par 1M | ⭐⭐⭐⭐⭐ |
| Mistral Small | `mistral-small-latest` | 128K | $0.20 / $0.60 par 1M | ⭐⭐⭐⭐ |

### 3.3 Interface unifiée des providers

Tous les providers implémentent la même interface unifiée, avec les différences d'API encapsulées :

| Aspect | OpenAI | Anthropic | Ollama | Mistral |
|--------|--------|-----------|--------|---------|
| **Endpoint** | `api.openai.com/v1/chat/completions` | `api.anthropic.com/v1/messages` | `localhost:11434/api/chat` | `api.mistral.ai/v1/chat/completions` |
| **Format messages** | `messages: [{role, content}]` | `messages: [{role, content}]` | `messages: [{role, content}]` | `messages: [{role, content}]` |
| **System prompt** | `messages[0].role = "system"` | `system: "..."` | `system: "..."` | `messages[0].role = "system"` |
| **Streaming** | SSE `data: {choices: [{delta}]}` | SSE `event: content_block_delta` | NDJSON `{message: {content}}` | SSE `data: {choices: [{delta}]}` |
| **Stop** | `n/a` (arrêt côté client) | `n/a` (arrêt côté client) | `n/a` (arrêt côté client) | `n/a` (arrêt côté client) |

---

## 4. Catalogue complet des paramètres LLM / GÉNÉRATION

### 4.1 Provider et modèle

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Provider | `llm.provider` | enum | Selon profil | `openai` \| `anthropic` \| `ollama` \| `mistral` |
| Modèle | `llm.model` | string | Selon profil | Identifiant du modèle |

### 4.2 Paramètres de génération

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Température | `llm.temperature` | float | 0.0 | 2.0 | Selon profil | Créativité. 0 = factuel. RAG recommandé : 0.0–0.3. |
| Max tokens | `llm.max_tokens` | int | 100 | 16384 | Selon profil | Longueur max de la réponse en tokens |
| Top P | `llm.top_p` | float | 0.0 | 1.0 | Selon profil | Nucleus sampling. 0.9 = valeur standard RAG. |

### 4.3 Comportement et citations

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Citer les sources | `llm.cite_sources` | bool | `true` | Inclure des citations dans la réponse |
| Format des citations | `llm.citation_format` | enum | Selon profil | `inline` = `[Source: nom, p.N]`, `footnote` = exposants ¹²³ avec notes en bas |
| Admettre l'incertitude | `llm.admit_uncertainty` | bool | `true` | Dire honnêtement quand l'info n'est pas trouvée |
| Phrase d'incertitude | `llm.uncertainty_phrase` | string | "Je n'ai pas trouvé cette information dans les documents disponibles." | Message affiché quand le LLM ne peut pas répondre |
| Langue de réponse | `llm.response_language` | enum | `auto` | `auto` \| `fr` \| `en`. `auto` = même langue que la requête. |

### 4.4 Contexte

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Max chunks | `llm.context_max_chunks` | int | 1 | 30 | Selon profil | Nombre max de chunks dans le contexte |
| Max tokens contexte | `llm.context_max_tokens` | int | 500 | 32000 | Selon profil | Budget token max pour le contexte |

### 4.5 Prompt système

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Prompt système | `llm.system_prompt` | string | (voir §2.6) | Instructions pour le LLM. Variables : `{uncertainty_phrase}`, `{citation_format}` |

### 4.6 Paramètres avancés

| Paramètre | Clé config | Type | Min | Max | Défaut | Description |
|-----------|------------|------|-----|-----|--------|-------------|
| Timeout | `llm.timeout` | int | 10 | 300 | 60 | Timeout en secondes |
| Max retries | `llm.max_retries` | int | 0 | 5 | 2 | Nombre de tentatives en cas d'erreur |
| Streaming | `llm.streaming` | bool | — | — | `true` | Afficher les tokens progressivement |
| Debug | `llm.debug_default` | bool | — | — | `false` | Mode debug par défaut |

### 4.7 Paramètres généraux (extensions)

| Paramètre | Clé config | Type | Défaut | Description |
|-----------|------------|------|--------|-------------|
| Modèle LLM | `general.llm_model` | string | Selon profil | Raccourci vers `llm.provider` + `llm.model` |
| Température | `general.llm_temperature` | float | Selon profil | Raccourci vers `llm.temperature` |
| Langue de réponse | `general.response_language` | enum | `auto` | Raccourci vers `llm.response_language` |

**Synchronisation** : modifier ces paramètres dans Paramètres généraux modifie aussi les paramètres correspondants dans LLM / GÉNÉRATION, et inversement.

### 4.8 Résumé des impacts

| Paramètre | Impact principal | Impact secondaire |
|-----------|-----------------|-------------------|
| `provider` + `model` | **CRITIQUE** — Qualité et coût de la génération | Latence, confidentialité (local vs cloud) |
| `temperature` | **IMPORTANT** — Factualité vs créativité. 0 = déterministe, >0.5 = risque hallucinations | Légère variation de latence |
| `max_tokens` | Longueur maximale des réponses | Coût proportionnel aux tokens de sortie |
| `cite_sources` | Traçabilité et vérifiabilité des réponses | Léger overhead dans le prompt |
| `context_max_chunks` | Quantité d'information disponible pour le LLM | Plus de chunks = meilleure couverture mais "lost in the middle" |
| `context_max_tokens` | Budget token pour le contexte | Impact direct sur le coût |
| `system_prompt` | **FONDAMENTAL** — Définit le comportement et la personnalité | — |
| `streaming` | UX : réponse progressive vs attente complète | — |

---

## 5. Valeurs par défaut par profil

### 5.1 Matrice profil → paramètres LLM

| Paramètre | `technical_documentation` | `faq_support` | `legal_compliance` | `reports_analysis` | `general` |
|-----------|:---:|:---:|:---:|:---:|:---:|
| `provider` | `openai` | `openai` | `openai` | `openai` | `openai` |
| `model` | `gpt-4o-mini` | `gpt-4o-mini` | `gpt-4o-mini` | `gpt-4o-mini` | `gpt-4o-mini` |
| `temperature` | 0.1 | 0.3 | 0.0 | 0.2 | 0.7 |
| `max_tokens` | 2000 | 1000 | 3000 | 2000 | 2000 |
| `top_p` | 0.9 | 0.95 | 0.85 | 0.9 | 0.95 |
| `cite_sources` | `true` | `true` | `true` | `true` | `true` |
| `citation_format` | `inline` | `inline` | `footnote` | `inline` | `inline` |
| `admit_uncertainty` | `true` | `true` | `true` | `true` | `true` |
| `response_language` | `auto` | `auto` | `auto` | `auto` | `auto` |
| `context_max_chunks` | 5 | 3 | 8 | 5 | 5 |
| `context_max_tokens` | 4000 | 2000 | 8000 | 4000 | 4000 |
| `timeout` | 60 | 30 | 60 | 60 | 60 |
| `streaming` | `true` | `true` | `true` | `true` | `true` |

### 5.2 Justification des choix

- **`technical_documentation` → `temperature=0.1`** : les réponses techniques doivent être factuelles et précises. Une température très basse minimise les hallucinations tout en gardant un minimum de variabilité naturelle.
- **`faq_support` → `temperature=0.3`, `max_tokens=1000`, `context_max_chunks=3`** : les FAQ attendent des réponses courtes et ciblées. Température légèrement plus haute pour un ton plus naturel. Peu de contexte nécessaire (les réponses FAQ sont courtes).
- **`legal_compliance` → `temperature=0.0`, `context_max_chunks=8`, `context_max_tokens=8000`, `footnote`** : température à zéro pour un déterminisme total (aucune place pour l'interprétation). Contexte maximal pour ne rien manquer. Citations en footnotes pour un format juridique.
- **`reports_analysis` → `temperature=0.2`** : les rapports d'analyse nécessitent de la précision mais aussi une capacité de synthèse, d'où une température légèrement plus haute que la doc technique.
- **`general` → `temperature=0.7`** : profil conversationnel, ton plus naturel et engageant.
- **Tous `gpt-4o-mini`** : meilleur rapport qualité/prix pour la majorité des cas d'usage RAG. L'utilisateur peut changer pour un modèle plus puissant si nécessaire.

---

## 6. Spécifications techniques

### 6.1 Schéma Pydantic (backend)

```python
# ragkit/config/llm_schema.py
"""Pydantic schemas for LLM generation configuration."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class LLMProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    OLLAMA = "ollama"
    MISTRAL = "mistral"


class CitationFormat(str, Enum):
    INLINE = "inline"
    FOOTNOTE = "footnote"


class ResponseLanguage(str, Enum):
    AUTO = "auto"
    FR = "fr"
    EN = "en"


DEFAULT_SYSTEM_PROMPT = """Tu es un assistant spécialisé dans l'analyse de documents. Tu réponds aux questions en te basant UNIQUEMENT sur le contexte fourni entre les balises <context> et </context>.

Règles :
1. Base ta réponse exclusivement sur le contexte fourni. Ne génère jamais d'information qui ne s'y trouve pas.
2. Cite tes sources en utilisant le format {citation_format_instruction} après chaque affirmation importante.
3. Si l'information demandée n'est pas dans le contexte, dis-le honnêtement en utilisant la phrase : "{uncertainty_phrase}".
4. Réponds dans la langue de la question, sauf indication contraire.
5. Structure ta réponse de manière claire avec des paragraphes, listes ou titres si nécessaire.
6. Si plusieurs sources se contredisent, signale-le explicitement."""


class LLMConfig(BaseModel):
    """LLM generation configuration."""

    # Provider & model
    provider: LLMProvider = LLMProvider.OPENAI
    model: str = "gpt-4o-mini"

    # Generation
    temperature: float = Field(default=0.1, ge=0.0, le=2.0)
    max_tokens: int = Field(default=2000, ge=100, le=16384)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)

    # Behavior
    cite_sources: bool = True
    citation_format: CitationFormat = CitationFormat.INLINE
    admit_uncertainty: bool = True
    uncertainty_phrase: str = "Je n'ai pas trouvé cette information dans les documents disponibles."
    response_language: ResponseLanguage = ResponseLanguage.AUTO

    # Context
    context_max_chunks: int = Field(default=5, ge=1, le=30)
    context_max_tokens: int = Field(default=4000, ge=500, le=32000)

    # Prompt
    system_prompt: str = DEFAULT_SYSTEM_PROMPT

    # Advanced
    timeout: int = Field(default=60, ge=10, le=300)
    max_retries: int = Field(default=2, ge=0, le=5)
    streaming: bool = True
    debug_default: bool = False
```

### 6.2 Abstraction LLM Provider (backend)

```python
# ragkit/llm/base.py
"""Abstract base class for LLM providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator


@dataclass
class LLMMessage:
    """A single message in the conversation."""
    role: str        # "system", "user", "assistant"
    content: str


@dataclass
class LLMUsage:
    """Token usage for a generation."""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass
class LLMResponse:
    """Complete (non-streaming) response from the LLM."""
    content: str
    usage: LLMUsage
    model: str
    latency_ms: int


@dataclass
class LLMStreamChunk:
    """A single chunk from the streaming response."""
    content: str           # Partial text
    is_final: bool = False
    usage: LLMUsage | None = None  # Only on final chunk


@dataclass
class LLMTestResult:
    """Result from testing the LLM connection."""
    success: bool
    model: str
    response_text: str
    latency_ms: int
    error: str | None = None


class BaseLLMProvider(ABC):
    """Abstract base for LLM providers."""

    @abstractmethod
    async def generate(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.1,
        max_tokens: int = 2000,
        top_p: float = 0.9,
    ) -> LLMResponse:
        """Generate a complete response."""
        ...

    @abstractmethod
    async def stream(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.1,
        max_tokens: int = 2000,
        top_p: float = 0.9,
    ) -> AsyncIterator[LLMStreamChunk]:
        """Stream a response token by token."""
        ...

    @abstractmethod
    async def test_connection(self) -> LLMTestResult:
        """Test the LLM connection."""
        ...
```

### 6.3 Context Assembler (backend)

```python
# ragkit/llm/context_assembler.py
"""Assembles retrieved chunks into LLM context."""

from __future__ import annotations

from dataclasses import dataclass

import tiktoken

from ragkit.config.llm_schema import LLMConfig, CitationFormat


@dataclass
class ContextChunk:
    """A chunk prepared for LLM context injection."""
    source_id: int         # 1-indexed
    chunk_id: str
    text: str
    doc_title: str
    doc_path: str | None
    page_number: int | None
    score: float
    tokens: int


@dataclass
class AssembledContext:
    """The assembled context ready for prompt injection."""
    formatted_text: str
    chunks_used: list[ContextChunk]
    total_tokens: int
    chunks_available: int
    chunks_included: int
    truncated: bool


class ContextAssembler:
    """Selects and formats chunks for LLM context."""

    def __init__(self, config: LLMConfig):
        self.config = config
        try:
            self._encoder = tiktoken.encoding_for_model(config.model)
        except KeyError:
            self._encoder = tiktoken.get_encoding("cl100k_base")

    def assemble(
        self,
        results: list,          # SearchResult or RerankResult
    ) -> AssembledContext:
        """Assemble chunks into formatted context."""
        chunks: list[ContextChunk] = []
        total_tokens = 0
        truncated = False

        for i, result in enumerate(results):
            if len(chunks) >= self.config.context_max_chunks:
                break

            text = result.text
            tokens = len(self._encoder.encode(text))

            # Check token budget
            if total_tokens + tokens > self.config.context_max_tokens:
                # Truncate last chunk to fit budget
                remaining = self.config.context_max_tokens - total_tokens
                if remaining > 50:  # Minimum useful chunk
                    encoded = self._encoder.encode(text)[:remaining]
                    text = self._encoder.decode(encoded)
                    tokens = remaining
                    truncated = True
                else:
                    break

            chunks.append(ContextChunk(
                source_id=i + 1,
                chunk_id=result.chunk_id,
                text=text,
                doc_title=getattr(result, "doc_title", None) or "Document",
                doc_path=getattr(result, "doc_path", None),
                page_number=getattr(result, "page_number", None),
                score=result.score if hasattr(result, "score") else
                      result.rerank_score,
                tokens=tokens,
            ))
            total_tokens += tokens

        # Format as XML context
        formatted = self._format_context(chunks)

        return AssembledContext(
            formatted_text=formatted,
            chunks_used=chunks,
            total_tokens=total_tokens,
            chunks_available=len(results),
            chunks_included=len(chunks),
            truncated=truncated,
        )

    def _format_context(self, chunks: list[ContextChunk]) -> str:
        parts = ["<context>"]
        for chunk in chunks:
            page_attr = f' page="{chunk.page_number}"' if chunk.page_number else ""
            parts.append(
                f'<source id="{chunk.source_id}" '
                f'title="{chunk.doc_title}"{page_attr} '
                f'score="{chunk.score:.3f}">'
            )
            parts.append(chunk.text)
            parts.append("</source>")
        parts.append("</context>")
        return "\n".join(parts)
```

### 6.4 Response Generator (backend)

```python
# ragkit/llm/response_generator.py
"""Orchestrates context assembly + LLM generation."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import AsyncIterator

from ragkit.config.llm_schema import LLMConfig, CitationFormat
from ragkit.llm.base import BaseLLMProvider, LLMMessage, LLMStreamChunk
from ragkit.llm.context_assembler import ContextAssembler, AssembledContext


@dataclass
class GenerationDebugInfo:
    """Debug info for the full generation pipeline."""
    model: str
    temperature: float
    retrieval_latency_ms: int
    context_chunks: int
    context_tokens: int
    context_truncated: bool
    prompt_tokens: int
    completion_tokens: int
    time_to_first_token_ms: int
    total_latency_ms: int
    estimated_cost_usd: float | None
    sources_used: list[dict]


@dataclass
class RAGResponse:
    """Complete RAG response with sources and debug."""
    content: str
    sources: list[dict]           # [{id, title, page, score, text_preview}]
    debug: GenerationDebugInfo | None = None


class ResponseGenerator:
    """Generates RAG responses using LLM + context."""

    def __init__(
        self,
        config: LLMConfig,
        llm_provider: BaseLLMProvider,
    ):
        self.config = config
        self.llm = llm_provider
        self.assembler = ContextAssembler(config)

    def _build_system_prompt(self) -> str:
        """Build the system prompt with variable substitution."""
        if self.config.citation_format == CitationFormat.INLINE:
            citation_instruction = "[Source: titre_document, p.N]"
        else:
            citation_instruction = "des notes de bas de page numérotées ¹²³"

        return self.config.system_prompt.replace(
            "{citation_format_instruction}", citation_instruction
        ).replace(
            "{uncertainty_phrase}", self.config.uncertainty_phrase
        )

    async def generate(
        self,
        query: str,
        retrieval_results: list,
        retrieval_latency_ms: int = 0,
        include_debug: bool = False,
    ) -> RAGResponse:
        """Generate a complete (non-streaming) RAG response."""
        t_start = time.perf_counter()

        # 1. Assemble context
        context = self.assembler.assemble(retrieval_results)

        # 2. Build messages
        messages = [
            LLMMessage(role="system", content=self._build_system_prompt()),
            LLMMessage(
                role="user",
                content=f"{context.formatted_text}\n\nQuestion : {query}",
            ),
        ]

        # 3. Generate
        response = await self.llm.generate(
            messages=messages,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            top_p=self.config.top_p,
        )

        t_total = time.perf_counter() - t_start

        # 4. Build sources list
        sources = self._build_sources(context)

        debug = None
        if include_debug:
            debug = GenerationDebugInfo(
                model=self.config.model,
                temperature=self.config.temperature,
                retrieval_latency_ms=retrieval_latency_ms,
                context_chunks=context.chunks_included,
                context_tokens=context.total_tokens,
                context_truncated=context.truncated,
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                time_to_first_token_ms=response.latency_ms,
                total_latency_ms=int(t_total * 1000),
                estimated_cost_usd=self._estimate_cost(response.usage),
                sources_used=[
                    {"id": c.source_id, "title": c.doc_title,
                     "page": c.page_number, "score": c.score}
                    for c in context.chunks_used
                ],
            )

        return RAGResponse(
            content=response.content,
            sources=sources,
            debug=debug,
        )

    async def stream(
        self,
        query: str,
        retrieval_results: list,
        include_debug: bool = False,
    ) -> AsyncIterator[LLMStreamChunk]:
        """Stream a RAG response token by token."""
        context = self.assembler.assemble(retrieval_results)

        messages = [
            LLMMessage(role="system", content=self._build_system_prompt()),
            LLMMessage(
                role="user",
                content=f"{context.formatted_text}\n\nQuestion : {query}",
            ),
        ]

        async for chunk in self.llm.stream(
            messages=messages,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            top_p=self.config.top_p,
        ):
            yield chunk

    def _build_sources(self, context: AssembledContext) -> list[dict]:
        return [
            {
                "id": c.source_id,
                "chunk_id": c.chunk_id,
                "title": c.doc_title,
                "path": c.doc_path,
                "page": c.page_number,
                "score": c.score,
                "text_preview": c.text[:200] + "..." if len(c.text) > 200 else c.text,
            }
            for c in context.chunks_used
        ]

    def _estimate_cost(self, usage) -> float | None:
        # Simplified cost estimation for known models
        costs = {
            "gpt-4o-mini": (0.15, 0.60),
            "gpt-4o": (2.50, 10.00),
            "gpt-4-turbo": (10.0, 30.0),
            "claude-3-5-sonnet-20241022": (3.0, 15.0),
            "claude-3-haiku-20240307": (0.25, 1.25),
            "mistral-large-latest": (2.0, 6.0),
            "mistral-small-latest": (0.2, 0.6),
        }
        rate = costs.get(self.config.model)
        if not rate:
            return None
        input_cost = usage.prompt_tokens / 1_000_000 * rate[0]
        output_cost = usage.completion_tokens / 1_000_000 * rate[1]
        return round(input_cost + output_cost, 6)
```

### 6.5 API REST (routes backend)

#### 6.5.1 Routes Config LLM

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/llm/config` | GET | Config LLM courante | — | `LLMConfig` |
| `/api/llm/config` | PUT | Met à jour la config | `LLMConfig` (partiel) | `LLMConfig` |
| `/api/llm/config/reset` | POST | Réinitialise au profil actif | — | `LLMConfig` |

#### 6.5.2 Routes Actions LLM

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/llm/test-connection` | POST | Test de connexion au LLM | — | `LLMTestResult` |
| `/api/llm/models` | GET | Liste des modèles par provider | `?provider=openai` | `LLMModelInfo[]` |

#### 6.5.3 Route Chat (pipeline complet)

| Endpoint | Méthode | Description | Corps | Réponse |
|----------|---------|-------------|-------|---------|
| `/api/chat` | POST | Pipeline complet : recherche → reranking → génération | `ChatQuery` | `ChatResponse` (ou SSE stream) |
| `/api/chat/stream` | POST | Même pipeline mais en streaming (SSE) | `ChatQuery` | `text/event-stream` |

#### 6.5.4 Modèles de requête et réponse

```python
class ChatQuery(BaseModel):
    """Complete chat query — triggers the full RAG pipeline."""
    query: str = Field(..., min_length=1, max_length=5000)
    search_type: SearchType | None = None
    alpha: float | None = None
    filters: SearchFilters | None = None
    include_debug: bool = False

class ChatResponse(BaseModel):
    """Complete chat response with generated answer and sources."""
    query: str
    answer: str                         # Markdown text generated by LLM
    sources: list[ChatSource]
    search_type: str
    debug: ChatDebugInfo | None = None

class ChatSource(BaseModel):
    id: int
    chunk_id: str
    title: str
    path: str | None
    page: int | None
    score: float
    text_preview: str

class ChatDebugInfo(BaseModel):
    # Retrieval
    retrieval_latency_ms: int
    search_type: str
    chunks_retrieved: int
    reranking_applied: bool
    # Context
    context_chunks: int
    context_tokens: int
    context_truncated: bool
    # Generation
    model: str
    temperature: float
    prompt_tokens: int
    completion_tokens: int
    time_to_first_token_ms: int
    total_latency_ms: int
    estimated_cost_usd: float | None
    # Sources detail
    sources_detail: list[dict]

class LLMModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    context_window: int
    cost_input: str | None
    cost_output: str | None
    languages: str
    quality_rating: int
```

### 6.6 Streaming via Tauri

Le streaming nécessite un mécanisme spécifique dans Tauri. L'approche retenue est l'**Event Emitter** :

```rust
// desktop/src-tauri/src/commands.rs (ajouts Étape 9)

#[tauri::command]
pub async fn chat_stream(
    window: tauri::Window,
    query: serde_json::Value,
) -> Result<String, String> {
    // 1. Start retrieval pipeline
    // 2. For each LLM token received:
    window.emit("chat-stream-chunk", payload)?;
    // 3. On completion:
    window.emit("chat-stream-done", final_payload)?;
    Ok("stream_started".to_string())
}

#[tauri::command]
pub async fn chat_stream_stop() -> Result<(), String> {
    // Cancel the ongoing generation
    Ok(())
}
```

Côté React :

```typescript
// hooks/useChatStream.ts
export function useChatStream() {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = async (query: ChatQuery) => {
    setIsStreaming(true);
    setContent("");

    const unlisten = await listen<string>("chat-stream-chunk", (event) => {
      setContent((prev) => prev + event.payload);
    });

    await listen("chat-stream-done", (event) => {
      setIsStreaming(false);
      unlisten();
      // event.payload contains sources and debug info
    });

    await invoke("chat_stream", { query });
  };

  const stopStream = () => invoke("chat_stream_stop");

  return { content, isStreaming, startStream, stopStream };
}
```

### 6.7 Commandes Tauri (Rust) — ajouts

```rust
// LLM config
#[tauri::command]
pub async fn get_llm_config() -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn update_llm_config(config: serde_json::Value) -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn reset_llm_config() -> Result<serde_json::Value, String> { ... }

// LLM actions
#[tauri::command]
pub async fn test_llm_connection() -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn get_llm_models(provider: String) -> Result<serde_json::Value, String> { ... }

// Chat (full pipeline)
#[tauri::command]
pub async fn chat(query: serde_json::Value) -> Result<serde_json::Value, String> { ... }
#[tauri::command]
pub async fn chat_stream(window: tauri::Window, query: serde_json::Value) -> Result<String, String> { ... }
#[tauri::command]
pub async fn chat_stream_stop() -> Result<(), String> { ... }
```

### 6.8 Composants React — arborescence

```
desktop/src/
├── components/
│   ├── settings/
│   │   ├── LLMSettings.tsx                    ← NOUVEAU : section complète
│   │   ├── LLMProviderSelector.tsx            ← NOUVEAU : cartes provider
│   │   ├── LLMModelSelector.tsx               ← NOUVEAU : dropdown + fiche
│   │   ├── GenerationParams.tsx               ← NOUVEAU : temperature, max_tokens, top_p
│   │   ├── BehaviorPanel.tsx                  ← NOUVEAU : citations, incertitude, langue
│   │   ├── ContextPanel.tsx                   ← NOUVEAU : max_chunks, max_tokens
│   │   ├── SystemPromptEditor.tsx             ← NOUVEAU : éditeur de prompt
│   │   ├── GeneralSettings.tsx                ← MODIFIER : ajouter LLM params
│   │   └── ... (existants)
│   ├── chat/
│   │   ├── ChatView.tsx                       ← REFACTORING MAJEUR
│   │   ├── ChatMessage.tsx                    ← NOUVEAU : bulle message (user/assistant)
│   │   ├── AssistantMessage.tsx               ← NOUVEAU : réponse MD + sources
│   │   ├── MarkdownRenderer.tsx               ← NOUVEAU : rendu markdown
│   │   ├── SourcesPanel.tsx                   ← NOUVEAU : panneau sources
│   │   ├── SourceCard.tsx                     ← NOUVEAU : carte source cliquable
│   │   ├── CitationLink.tsx                   ← NOUVEAU : lien citation inline
│   │   ├── StreamingIndicator.tsx             ← NOUVEAU : animation "Génération..."
│   │   ├── StopButton.tsx                     ← NOUVEAU : bouton arrêt streaming
│   │   ├── GenerationDebugPanel.tsx           ← NOUVEAU : debug complet pipeline
│   │   └── ... (existants)
│   └── ui/
│       └── ... (existants)
├── hooks/
│   ├── useLLMConfig.ts                        ← NOUVEAU : hook config
│   ├── useLLMTest.ts                          ← NOUVEAU : hook test connexion
│   ├── useChat.ts                             ← NOUVEAU : hook pipeline complet
│   ├── useChatStream.ts                       ← NOUVEAU : hook streaming
│   └── ... (existants)
├── lib/
│   └── ipc.ts                                 ← MODIFIER : ajouter routes LLM + chat
└── locales/
    ├── fr.json                                ← MODIFIER : ajouter clés LLM
    └── en.json                                ← MODIFIER : ajouter clés LLM
```

### 6.9 Persistance

```json
{
  "general": {
    "ingestion_mode": "manual",
    "search_type": "hybrid",
    "llm_model": "openai/gpt-4o-mini",
    "llm_temperature": 0.1,
    "response_language": "auto"
  },
  "llm": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.1,
    "max_tokens": 2000,
    "top_p": 0.9,
    "cite_sources": true,
    "citation_format": "inline",
    "admit_uncertainty": true,
    "uncertainty_phrase": "Je n'ai pas trouvé cette information dans les documents disponibles.",
    "response_language": "auto",
    "context_max_chunks": 5,
    "context_max_tokens": 4000,
    "system_prompt": "...",
    "timeout": 60,
    "max_retries": 2,
    "streaming": true,
    "debug_default": false
  }
}
```

Les clés API (OpenAI, Anthropic, Mistral) sont stockées via le système de secrets (Étape 3).

### 6.10 Dépendances Python ajoutées

```toml
# pyproject.toml — ajouts pour Étape 9
dependencies = [
    # ... (existants Étapes 0-8)
    "openai>=1.12",               # Client OpenAI (chat completions + streaming)
    "anthropic>=0.18",            # Client Anthropic (messages + streaming)
    "tiktoken>=0.5",              # Comptage de tokens pour le budget contexte
    # httpx est déjà présent (Étape 8) — utilisé pour Mistral et Ollama
]
```

---

## 7. Critères d'acceptation

### 7.1 Fonctionnels

| # | Critère |
|---|---------|
| F1 | La section `PARAMÈTRES > Paramètres avancés > LLM / GÉNÉRATION` est accessible et affiche tous les paramètres |
| F2 | Le sélecteur de provider propose OpenAI, Anthropic, Ollama, Mistral |
| F3 | Le provider Ollama est grisé si Ollama n'est pas détecté |
| F4 | La fiche modèle affiche contexte, langues, coût et latence estimée |
| F5 | Le champ clé API est visible pour les providers cloud et fonctionne (masquage, test) |
| F6 | Le bouton "Tester la connexion" valide la connexion au LLM |
| F7 | Les sliders (température, max_tokens, top_p) sont fonctionnels avec validation des bornes |
| F8 | Les toggles de comportement (cite_sources, admit_uncertainty) fonctionnent |
| F9 | Le sélecteur de format de citation (inline / footnote) modifie les instructions du prompt |
| F10 | L'éditeur de prompt système est fonctionnel avec compteur de tokens |
| F11 | Le bouton "Restaurer le prompt par défaut" fonctionne |
| F12 | Les Paramètres généraux affichent les 3 nouveaux champs (modèle, température, langue) |
| F13 | Modifier un paramètre dans Paramètres généraux le synchronise dans Paramètres avancés (et inversement) |
| F14 | Le CHAT affiche les réponses du LLM en markdown avec mise en forme |
| F15 | Le streaming affiche les tokens progressivement |
| F16 | L'indicateur passe de "Recherche en cours..." à "Génération en cours..." |
| F17 | Le bouton "Arrêter" interrompt la génération streaming |
| F18 | Les citations `[Source: nom, p.N]` sont rendues dans la réponse |
| F19 | Le panneau Sources s'affiche sous chaque réponse avec les chunks utilisés |
| F20 | Cliquer sur une source développe l'extrait du chunk |
| F21 | Quand le LLM ne trouve pas l'info, il affiche la phrase d'incertitude |
| F22 | Le mode debug affiche le pipeline complet (retrieval + context + génération + coût) |
| F23 | Le badge "Modifié" apparaît à côté de chaque paramètre modifié |
| F24 | Le bouton "Réinitialiser au profil" restaure les valeurs par défaut |
| F25 | Tous les textes sont traduits FR/EN via i18n |

### 7.2 Techniques

| # | Critère |
|---|---------|
| T1 | `GET /api/llm/config` retourne la config courante |
| T2 | `PUT /api/llm/config` valide et persiste les modifications |
| T3 | `POST /api/llm/config/reset` restaure les valeurs du profil actif |
| T4 | `POST /api/llm/test-connection` teste la connexion au LLM configuré |
| T5 | Le provider OpenAI fonctionne avec `gpt-4o-mini` (génération + streaming) |
| T6 | Le provider Anthropic fonctionne avec `claude-3-5-sonnet` (génération + streaming) |
| T7 | Le provider Ollama fonctionne avec un modèle local installé (génération + streaming) |
| T8 | Le provider Mistral fonctionne avec `mistral-small-latest` (génération + streaming) |
| T9 | Le Context Assembler respecte `context_max_chunks` et `context_max_tokens` |
| T10 | Le Context Assembler tronque correctement le dernier chunk si le budget est dépassé |
| T11 | Le prompt système inclut les variables substituées (`{citation_format_instruction}`, `{uncertainty_phrase}`) |
| T12 | `POST /api/chat` exécute le pipeline complet : recherche → reranking → assemblage → génération |
| T13 | `POST /api/chat/stream` retourne un flux SSE avec les tokens progressifs |
| T14 | Le streaming via Tauri events fonctionne (émission + réception côté React) |
| T15 | L'arrêt du streaming interrompt effectivement la génération |
| T16 | L'estimation de coût est correcte pour les modèles connus |
| T17 | Les clés API sont stockées dans le keyring (pas dans `settings.json`) |
| T18 | Le timeout et les retries fonctionnent pour chaque provider |
| T19 | La config LLM est persistée dans `settings.json` sous `llm` |
| T20 | Les paramètres généraux sont synchronisés avec `llm.*` |
| T21 | `tsc --noEmit` ne produit aucune erreur TypeScript |
| T22 | Le CI passe sur les 4 targets (lint + build) |

---

## 8. Périmètre exclus (Étape 9)

- **Historique de conversation / Mémoire** : sera ajouté à l'Étape 10 (Agents). Chaque requête est indépendante à cette étape.
- **Query Analyzer / Intent Detection** : sera ajouté à l'Étape 10. Toute requête passe par le pipeline RAG (même "Bonjour").
- **Query Rewriting** : sera ajouté à l'Étape 10.
- **Modèle de fallback** (second modèle en cas de panne du premier) : amélioration future.
- **Few-shot examples** dans le prompt : amélioration future.
- **Chain-of-thought prompting** : amélioration future.
- **Context compression** (résumé des chunks avant injection) : amélioration future.
- **Streaming des sources** (afficher les sources avant la fin de la génération) : amélioration future.
- **Évaluation automatique** de la qualité des réponses : sera ajoutée à l'Étape 11 (Monitoring).
- **Modèles custom / fine-tunés** : non pertinent pour la V1.
- **Prompt par type de requête** (prompt différent pour les résumés, analyses, comparaisons) : amélioration future.

---

## 9. Estimation

| Tâche | Effort estimé |
|-------|---------------|
| Schéma Pydantic `LLMConfig` + validation | 0.5 jour |
| Abstraction `BaseLLMProvider` + dataclasses | 0.5 jour |
| Provider OpenAI (génération + streaming + test) | 1.5 jours |
| Provider Anthropic (génération + streaming + test) | 1.5 jours |
| Provider Ollama (génération + streaming + test + détection) | 1.5 jours |
| Provider Mistral (génération + streaming + test) | 1 jour |
| Factory `create_llm_provider` | 0.5 jour |
| `ContextAssembler` (sélection, budget tokens, formatage XML) | 1.5 jours |
| `ResponseGenerator` (orchestration, prompt, debug, coût) | 1.5 jours |
| Routes API config LLM (CRUD) | 0.5 jour |
| Routes API actions (test-connection, models) | 0.5 jour |
| Routes API chat + chat/stream (pipeline complet) | 1.5 jours |
| Commandes Tauri (config + chat + streaming events) | 1 jour |
| Composant `LLMSettings.tsx` (section paramètres complète) | 1 jour |
| Composants `LLMProviderSelector.tsx`, `LLMModelSelector.tsx` | 1 jour |
| Composants `GenerationParams.tsx`, `BehaviorPanel.tsx`, `ContextPanel.tsx` | 1 jour |
| Composant `SystemPromptEditor.tsx` (éditeur + compteur tokens + reset) | 0.5 jour |
| Modification `GeneralSettings.tsx` (3 nouveaux champs synchronisés) | 0.5 jour |
| Refactoring `ChatView.tsx` (passage de résultats bruts à conversation) | 1.5 jours |
| Composants `ChatMessage.tsx`, `AssistantMessage.tsx`, `MarkdownRenderer.tsx` | 1.5 jours |
| Composants `SourcesPanel.tsx`, `SourceCard.tsx`, `CitationLink.tsx` | 1 jour |
| Composants `StreamingIndicator.tsx`, `StopButton.tsx` | 0.5 jour |
| Composant `GenerationDebugPanel.tsx` | 0.5 jour |
| Hooks (`useLLMConfig`, `useLLMTest`, `useChat`, `useChatStream`) | 1 jour |
| Traductions i18n (FR + EN) | 0.5 jour |
| Tests unitaires providers (OpenAI, Anthropic, Ollama, Mistral — mock API) | 2 jours |
| Tests unitaires `ContextAssembler` (sélection, budget, tronquage) | 0.5 jour |
| Tests unitaires `ResponseGenerator` (prompt, variables, debug) | 0.5 jour |
| Tests d'intégration (pipeline complet : query → retrieval → reranking → génération) | 1.5 jours |
| Tests manuels + corrections | 1.5 jours |
| **Total** | **~29 jours** |
