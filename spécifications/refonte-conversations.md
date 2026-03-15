# Plan de refonte - Gestion des conversations LOKO

**Date** : 9 mars 2026
**Derniere revue** : 14 mars 2026
**Statut** : Termine
**Objectif** : Fiabiliser la persistence, la recuperation et l'affichage des conversations de bout en bout.

---

## 1. Diagnostic synthetique

### Symptomes rapportes

| # | Symptome | Frequence | Statut |
|---|----------|-----------|--------|
| S1 | Le contenu disparait quand on navigue et revient | Systematique | **Corrige** (C1, C2) |
| S2 | Toutes les conversations perdues apres fermeture/reouverture | Systematique | **Corrige** (C5, C7, C8) |
| S3 | La sidebar clignote pendant l'ingestion | Frequent | **Corrige** (C3, C10) |
| S4 | Aucun message pour indiquer que le chat est indisponible pendant l'ingestion | Permanent | **Corrige** (C12) |

### Causes racines confirmees (audit complet backend + frontend)

| ID | Cause | Fichier(s) | Gravite | Statut |
|----|-------|------------|---------|--------|
| C1 | `useConversation.ts` remet `history = []` avant de re-fetcher | `useConversation.ts` | Critique | **Corrige** |
| C2 | `key={id}` sur Chat detruit et remonte tout le composant a chaque navigation | `App.tsx` | Critique | **Corrige** |
| C3 | `refreshList()` met `loading=false` des la 1ere erreur, l'UI montre une liste vide | `useConversations.tsx` | Critique | **Corrige** |
| C4 | L'effet de recovery ne retente qu'une seule fois (`recoveryAttemptedRef`) | `Chat.tsx:240-262` | Eleve | **Corrige** (via `lastRecoveredIdRef`) |
| C5 | `_persist_new_messages()` execute APRES le stream (risque de perte si connexion coupee) | `chat.py:220` | Eleve | **Non-probleme** (persistance deja avant le yield) |
| C6 | `update_summary_if_needed()` exception bloque la persistance | `orchestrator.py:121,300` | Eleve | **Corrige** (try/catch + logger ajoute le 14/03) |
| C7 | `_MEMORY_CACHE` sans verrou (race condition sur eviction LRU) | `chat.py:33,60` | Moyen | **Corrige** (`_CACHE_LOCK`) |
| C8 | `_CONVERSATION_MEMORY` singleton obsolete peut devenir incoherent | `chat.py` | Moyen | **Corrige** (singleton supprime) |
| C9 | `total_messages` dans `conversations` table pas decrement apres truncation summary | `memory.py:137` | Moyen | **Benin** (truncation in-memory uniquement) |
| C10 | Timestamps identiques dans `updateConversationActivity()` causent tri instable | `useConversations.tsx:44-50` | Moyen | **Corrige** (tie-breaker par ID) |
| C11 | `creating.current` pas reinitialise si ChatPage demonte pendant creation | `App.tsx:23-65` | Moyen | **Corrige** (bloc `finally`) |
| C12 | Pas de message pour l'utilisateur pendant l'ingestion | `Chat.tsx` | UX | **Corrige** |

---

## 2. Principes de la refonte

1. **SQLite est la source de verite unique** - le frontend ne doit jamais montrer un etat vide si la base contient des donnees
2. **Jamais de flash vide** - conserver l'ancien contenu pendant le chargement du nouveau
3. **Erreurs visibles** - l'utilisateur doit voir quand un chargement echoue, pas un ecran vide
4. **Simple et previsible** - reduire le nombre de mecanismes de retry independants
5. **Persistance avant notification** - sauvegarder en SQLite AVANT d'envoyer le `done` au frontend

---

## 3. Changements backend (Python/FastAPI)

### 3.1 Persister AVANT le done event (C5) — NON-PROBLEME

**Fichier** : `ragkit/desktop/api/chat.py`

**Constat** : La persistance (`_persist_new_messages`) est deja appelee AVANT le yield du done event (ligne 220), dans le bloc `if event_type == "done"`. Pour le endpoint non-streaming `/chat`, la persistance est aussi avant le return (ligne 194). Aucun changement necessaire.

### 3.2 Proteger update_summary_if_needed (C6) — CORRIGE

**Fichier** : `ragkit/agents/orchestrator.py`

Le try/catch est en place aux lignes 121-123 et 300-302.

**Correctif du 14/03** : Le fichier utilisait `logger.exception(...)` sans avoir importe `logging` ni cree de `logger`. Ajoute `import logging` et `logger = logging.getLogger(__name__)` en tete de fichier. Sans ce correctif, toute exception dans `update_summary_if_needed()` aurait provoque un `NameError` secondaire, annulant la protection du try/catch.

### 3.3 Ajouter un verrou sur _MEMORY_CACHE (C7) — CORRIGE

**Fichier** : `ragkit/desktop/api/chat.py`

`_CACHE_LOCK = threading.Lock()` (ligne 33) protege toutes les operations sur `_MEMORY_CACHE` dans `_get_conversation_memory()`.

### 3.4 Supprimer le singleton _CONVERSATION_MEMORY (C8) — CORRIGE

**Fichier** : `ragkit/desktop/api/chat.py`

Le singleton `_CONVERSATION_MEMORY` a ete completement supprime. Seul `_MEMORY_CACHE` est utilise.

### 3.5 Robustifier _get_conversation_memory (deserialization) — CORRIGE

**Fichier** : `ragkit/desktop/api/chat.py`

La deserialization des messages est protegee par un try/except par message (lignes 83-89), avec un `logger.warning` pour les messages malformes.

### 3.6 Corriger total_messages apres truncation (C9) — BENIN

**Fichier** : `ragkit/agents/memory.py`

`total_messages` en base reste correct car `add_message()` incremente et on ne supprime jamais de la table messages. La truncation est uniquement in-memory. Le compteur in-memory peut diverger mais n'est pas utilise pour la persistance.

### 3.7 Endpoint chat_history : retourner len(messages) (C9) — CORRIGE

**Fichier** : `ragkit/desktop/api/chat.py`

`chat_history()` retourne `total_messages=len(messages)` (lignes 305-309), soit le nombre reel de messages retournes.

---

## 4. Changements frontend (React/TypeScript)

### 4.1 Ne plus remettre l'historique a vide (C1 - CRITIQUE) — CORRIGE

**Fichier** : `desktop/src/hooks/useConversation.ts`

L'historique n'est plus remis a vide avant le re-fetch. Un commentaire explicite (ligne 84) documente ce choix. L'ancien contenu reste visible pendant le chargement. Le reset ne se fait que lors d'un changement effectif de `conversationId` (via `lastConversationIdRef`).

### 4.2 Retirer key={id} sur Chat (C2 - CRITIQUE) — CORRIGE

**Fichier** : `desktop/src/App.tsx`

Le `key={id}` a ete retire (ligne 79 : `return <Chat />`). Un commentaire en tete de fichier documente le choix. Un effect de nettoyage dans `Chat.tsx` (lignes 210-217) reinitialise l'etat du stream quand `urlId` change.

### 4.3 Garder loading=true jusqu'au premier succes (C3 - CRITIQUE) — CORRIGE

**Fichier** : `desktop/src/hooks/useConversations.tsx`

`refreshList()` ne met `setLoading(false)` que sur succes (ligne 92). Le catch retourne `null` sans toucher au loading. Le retry loop abandonne apres `MAX_STARTUP_RETRIES = 20` (ligne 106).

### 4.4 Recovery : retenter par conversation (C4) — CORRIGE (approche differente)

**Fichier** : `desktop/src/pages/Chat.tsx`

Au lieu de supprimer la limite de retry comme propose initialement, l'implementation utilise `lastRecoveredIdRef` (ligne 240) : le recovery est tente une fois par conversation ID (pas une fois globalement). C'est un compromis raisonnable qui evite les boucles infinies tout en permettant le recovery lors du changement de conversation.

### 4.5 Stabiliser le tri sidebar (C10) — CORRIGE

**Fichier** : `desktop/src/hooks/useConversations.tsx`

Le tri utilise un tie-breaker par `a.id.localeCompare(b.id)` (lignes 44-50 dans `groupConversations()`).

### 4.6 Corriger creating.current dans ChatPage (C11) — CORRIGE

**Fichier** : `desktop/src/App.tsx`

Le bloc `finally` (lignes 63-65) reinitialise toujours `creating.current = false`, meme si le composant est demonte.

### 4.7 Message d'indisponibilite pendant l'ingestion (C12) — CORRIGE

**Fichier** : `desktop/src/pages/Chat.tsx`

- Le formulaire bloque la soumission quand `isIngesting` est true (ligne 294)
- Le placeholder du champ de saisie change pendant l'ingestion (lignes 327-329)
- L'`EmptyState` recoit `isIngesting` pour adapter son affichage (ligne 369)
- Le bouton d'envoi est desactive visuellement et fonctionnellement quand `isIngesting` (ligne 622, corrige le 14/03)
- Un bandeau amber avec spinner s'affiche au-dessus de la zone de saisie pendant l'ingestion (ajoute le 14/03)
- Les cles de traduction `chat.ingestionInProgress` et `chat.inputPlaceholderIngestion` sont presentes dans fr.json et en.json

### 4.8 Simplifier useConversation - un seul mecanisme de retry — CORRIGE

**Fichier** : `desktop/src/hooks/useConversation.ts`

Le mecanisme de retry est unifie : `retryTrigger` (ligne 62) declenche le meme `useEffect` pour le chargement initial et les refresh. Le commentaire en lignes 50-53 documente explicitement cette architecture.

---

## 5. Ordre d'implementation — BILAN

### Phase 1 - Corrections critiques — TERMINEE

| # | Changement | Section | Statut |
|---|-----------|---------|--------|
| 1 | Ne plus reset history a vide avant re-fetch | 4.1 | **Fait** |
| 2 | Retirer `key={id}` sur Chat | 4.2 | **Fait** |
| 3 | Garder `loading=true` jusqu'au 1er succes | 4.3 | **Fait** |
| 4 | Retirer `recoveryAttemptedRef` | 4.4 | **Fait** (via `lastRecoveredIdRef`) |
| 5 | Stabiliser tri sidebar (tie-breaker) | 4.5 | **Fait** |
| 6 | Corriger `creating.current` | 4.6 | **Fait** |

### Phase 2 - Robustesse backend — TERMINEE

| # | Changement | Section | Statut |
|---|-----------|---------|--------|
| 7 | Proteger `update_summary_if_needed` avec try/catch | 3.2 | **Fait** (+ correctif logger 14/03) |
| 8 | Ajouter verrou sur `_MEMORY_CACHE` | 3.3 | **Fait** |
| 9 | Supprimer singleton `_CONVERSATION_MEMORY` | 3.4 | **Fait** |
| 10 | Robustifier deserialization dans `_get_conversation_memory` | 3.5 | **Fait** |
| 11 | Retourner `len(messages)` dans `chat_history` | 3.7 | **Fait** |

### Phase 3 - UX ingestion + polish — TERMINEE

| # | Changement | Section | Statut |
|---|-----------|---------|--------|
| 12 | Bouton desactive + bandeau pendant ingestion | 4.7 | **Fait** (14/03) |
| 13 | Simplifier retry dans `useConversation` | 4.8 | **Fait** |

---

## 6. Verification

Apres chaque phase, verifier ces scenarios :

### Scenario A - Navigation aller-retour
1. Ouvrir une conversation avec des messages
2. Naviguer vers Dashboard
3. Revenir sur la conversation
4. **Attendu** : les messages sont toujours la, sans flash vide

### Scenario B - Fermeture/reouverture
1. Envoyer un message dans une conversation
2. Fermer l'application
3. Rouvrir l'application
4. **Attendu** : la conversation et ses messages sont visibles dans la sidebar et le chat

### Scenario C - Chat pendant ingestion
1. Lancer une ingestion
2. Naviguer vers le chat
3. **Attendu** : bandeau "ingestion en cours" avec spinner, placeholder adapte, bouton d'envoi desactive
4. Attendre la fin de l'ingestion
5. **Attendu** : le chat est utilisable

### Scenario D - Backend lent au demarrage
1. Ouvrir l'application (backend met 10s a demarrer)
2. **Attendu** : spinner de chargement visible pendant 10s
3. Quand le backend est pret, les conversations apparaissent
4. **Attendu** : pas de creation de conversation vide fantome

### Scenario E - Conversations longues (>10 messages)
1. Envoyer 12+ messages (declencher le summary)
2. Fermer et rouvrir l'application
3. **Attendu** : tous les messages sont visibles (la truncation est in-memory, SQLite a tout)

### Scenario F - Build
```bash
cd desktop && npm run build
```
**Attendu** : zero erreurs TypeScript

---

## 7. Correctifs appliques le 14 mars 2026

1. **`orchestrator.py`** : Ajout de `import logging` et `logger = logging.getLogger(__name__)`. Sans cela, les blocs `try/except` autour de `update_summary_if_needed()` (C6) auraient provoque un `NameError: name 'logger' is not defined` au lieu de capturer l'exception.

2. **`Chat.tsx`** : Ajout de `|| isIngesting` dans la prop `disabled` du bouton d'envoi et dans les conditions de style du bouton, pour que le bouton soit visuellement desactive pendant l'ingestion. Ajout d'un bandeau amber avec spinner `Loader2` au-dessus de la zone de saisie, affiche conditionnellement quand `isIngesting` est true.
