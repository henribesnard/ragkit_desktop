# Plan de refonte - Gestion des conversations LOKO

**Date** : 9 mars 2026
**Statut** : A implementer
**Objectif** : Fiabiliser la persistence, la recuperation et l'affichage des conversations de bout en bout.

---

## 1. Diagnostic synthetique

### Symptomes rapportes

| # | Symptome | Frequence |
|---|----------|-----------|
| S1 | Le contenu disparait quand on navigue et revient | Systematique |
| S2 | Toutes les conversations perdues apres fermeture/reouverture | Systematique |
| S3 | La sidebar clignote pendant l'ingestion | Frequent |
| S4 | Aucun message pour indiquer que le chat est indisponible pendant l'ingestion | Permanent |

### Causes racines confirmees (audit complet backend + frontend)

| ID | Cause | Fichier(s) | Gravite |
|----|-------|------------|---------|
| C1 | `useConversation.ts` remet `history = []` avant de re-fetcher | `useConversation.ts:116` | Critique |
| C2 | `key={id}` sur Chat detruit et remonte tout le composant a chaque navigation | `App.tsx:78` | Critique |
| C3 | `refreshList()` met `loading=false` des la 1ere erreur, l'UI montre une liste vide | `useConversations.tsx:79` | Critique |
| C4 | L'effet de recovery ne retente qu'une seule fois (`recoveryAttemptedRef`) | `Chat.tsx:225-240` | Eleve |
| C5 | `_persist_new_messages()` execute APRES le stream (risque de perte si connexion coupee) | `chat.py:212` | Eleve |
| C6 | `update_summary_if_needed()` exception bloque la persistance | `orchestrator.py:119,295` | Eleve |
| C7 | `_MEMORY_CACHE` sans verrou (race condition sur eviction LRU) | `chat.py:65-72` | Moyen |
| C8 | `_CONVERSATION_MEMORY` singleton obsolete peut devenir incoherent | `chat.py:33,61-63` | Moyen |
| C9 | `total_messages` dans `conversations` table pas decrement apres truncation summary | `memory.py:137` | Moyen |
| C10 | Timestamps identiques dans `updateConversationActivity()` causent tri instable | `useConversations.tsx:174` | Moyen |
| C11 | `creating.current` pas reinitialise si ChatPage demonte pendant creation | `App.tsx:23-64` | Moyen |
| C12 | Pas de message pour l'utilisateur pendant l'ingestion | `Chat.tsx` | UX |

---

## 2. Principes de la refonte

1. **SQLite est la source de verite unique** - le frontend ne doit jamais montrer un etat vide si la base contient des donnees
2. **Jamais de flash vide** - conserver l'ancien contenu pendant le chargement du nouveau
3. **Erreurs visibles** - l'utilisateur doit voir quand un chargement echoue, pas un ecran vide
4. **Simple et previsible** - reduire le nombre de mecanismes de retry independants
5. **Persistance avant notification** - sauvegarder en SQLite AVANT d'envoyer le `done` au frontend

---

## 3. Changements backend (Python/FastAPI)

### 3.1 Persister AVANT le done event (C5)

**Fichier** : `ragkit/desktop/api/chat.py`

Actuellement `_persist_new_messages()` est appele dans le `event_generator()` quand il recoit `event_type == "done"`. Mais si la connexion HTTP est coupee avant, les messages sont perdus.

**Changement** : Deplacer la persistance dans `orchestrator.stream()` AVANT le yield du done event.

```python
# orchestrator.py - dans stream(), AVANT le yield done
self._append_memory(...)
await self.memory.update_summary_if_needed()
# Persister ICI, pas dans chat.py
self._persist_callback(self._new_messages, self.memory.state.summary)

yield {"type": "done", ...}
```

**Alternative plus simple** : Garder la persistance dans `chat.py` mais la deplacer DANS le bloc `if event_type == "done"` AVANT le yield SSE, en transformant le generateur :

```python
# chat.py - event_generator()
if event_type == "done":
    # Persister AVANT d'envoyer le done au client
    _persist_new_messages(cid, orchestrator._new_messages, orchestrator.memory.state.summary)
    # Puis seulement envoyer le done
    yield f"event: done\ndata: {json.dumps(done_payload)}\n\n"
```

C'est deja le cas actuellement (la persistance est avant le yield), mais il faut s'assurer que c'est bien le cas et le documenter.

**Pour le endpoint non-streaming `/chat`** : Persister avant le return (deja le cas, confirmer).

### 3.2 Proteger update_summary_if_needed (C6)

**Fichier** : `ragkit/agents/orchestrator.py`

```python
# Dans process() et stream(), entourer l'appel :
try:
    await self.memory.update_summary_if_needed()
except Exception:
    logger.exception("Summary update failed, continuing")
    # Ne pas crasher - les messages sont deja captures dans _new_messages
```

### 3.3 Ajouter un verrou sur _MEMORY_CACHE (C7)

**Fichier** : `ragkit/desktop/api/chat.py`

```python
import threading

_CACHE_LOCK = threading.Lock()

def _get_conversation_memory(conversation_id: str | None = None) -> ConversationMemory:
    cid = conversation_id or _DEFAULT_ID
    with _CACHE_LOCK:
        if cid in _MEMORY_CACHE:
            _MEMORY_CACHE[cid] = _MEMORY_CACHE.pop(cid)
            return _MEMORY_CACHE[cid]
        # ... chargement depuis SQLite ...
        _MEMORY_CACHE[cid] = memory
        return memory
```

### 3.4 Supprimer le singleton _CONVERSATION_MEMORY (C8)

**Fichier** : `ragkit/desktop/api/chat.py`

Supprimer completement `_CONVERSATION_MEMORY`. Utiliser uniquement `_MEMORY_CACHE`. Le singleton est un vestige de l'ancien code qui cause des incoherences.

```python
# SUPPRIMER :
_CONVERSATION_MEMORY: ConversationMemory | None = None

# SUPPRIMER les lignes qui le referent (61-63, 89-90, 93-94)
# Remplacer par : utiliser uniquement _MEMORY_CACHE[cid]
```

### 3.5 Robustifier _get_conversation_memory (deserialization)

**Fichier** : `ragkit/desktop/api/chat.py`

```python
# Dans _get_conversation_memory(), lors du chargement depuis SQLite :
messages = []
for m in messages_data:
    try:
        messages.append(ConversationMessage(**m))
    except (TypeError, ValueError) as exc:
        logger.warning("Skipping malformed message in %s: %s", cid, exc)
memory.state = ConversationState(
    messages=messages,
    summary=summary,
    total_messages=len(messages),
)
```

### 3.6 Corriger total_messages apres truncation (C9)

**Fichier** : `ragkit/agents/memory.py`

```python
# Dans update_summary_if_needed(), apres la truncation :
messages_to_summarize = self.state.messages[:-self.config.max_history_messages]
# ... generer le summary ...
self.state.messages = self.state.messages[-self.config.max_history_messages:]
# PAS BESOIN de toucher total_messages ici car :
# - total_messages dans conversations table est incremente par add_message()
# - La table messages garde TOUS les messages (la truncation est in-memory uniquement)
# - chat_history() lit depuis la table messages, pas depuis la memoire
# Donc le compteur en DB reste correct.
```

En fait `total_messages` en base reste correct car `add_message()` incremente et on ne supprime jamais de la table messages. Le probleme est uniquement in-memory et n'affecte pas la persistance.

### 3.7 Endpoint chat_history : retourner len(messages) au lieu de total_messages DB

**Fichier** : `ragkit/desktop/api/chat.py`

```python
# Dans chat_history() :
return ConversationHistory(
    messages=messages,
    total_messages=len(messages),  # Nombre reel de messages retournes
    has_summary=bool(conv.get("summary")) if conv else False,
)
```

---

## 4. Changements frontend (React/TypeScript)

### 4.1 Ne plus remettre l'historique a vide (C1 - CRITIQUE)

**Fichier** : `desktop/src/hooks/useConversation.ts`

Le probleme principal : `setHistory(emptyHistory)` est appele immediatement quand `conversationId` change, AVANT que le nouveau chargement soit termine. L'utilisateur voit un flash vide.

**Changement** : Ne pas reset l'historique. Garder l'ancien contenu pendant le chargement.

```typescript
useEffect(() => {
    // SUPPRIMER : setHistory(emptyHistory);
    setError(null);

    if (!conversationId) {
        setHistory(emptyHistory);  // Reset seulement si pas de conversation
        setLoading(false);
        return;
    }

    let cancelled = false;
    setLoading(true);

    const tryLoad = async () => {
        // ... meme logique de chargement et retry ...
        // setHistory(result) remplace l'ancien contenu seulement quand le nouveau est pret
    };

    void tryLoad();
    return () => { cancelled = true; /* cleanup timers */ };
}, [conversationId]);
```

### 4.2 Retirer key={id} sur Chat (C2 - CRITIQUE)

**Fichier** : `desktop/src/App.tsx`

Le `key={id}` force React a detruire et recreer tout le composant Chat. C'est trop destructif - on perd tout l'etat local (streaming en cours, historique charge, etc.).

**Changement** : Retirer le key et laisser Chat gerer le changement de conversation en interne.

```tsx
// AVANT :
return <Chat key={id} />;

// APRES :
return <Chat />;
```

Chat utilisera deja `urlId` de `useParams()` comme dependance dans ses effects. Le `useConversation(urlId)` changera automatiquement quand l'URL change, sans detruire le composant.

**Impact** : Le hook `useChatStream` doit nettoyer son etat quand `urlId` change :

```typescript
// Dans Chat.tsx, ajouter un effect de nettoyage :
useEffect(() => {
    // Quand la conversation change, nettoyer le stream en cours
    clearStreamState();
    setActiveQuery(null);
}, [urlId, clearStreamState]);
```

### 4.3 Garder loading=true jusqu'au premier succes (C3 - CRITIQUE)

**Fichier** : `desktop/src/hooks/useConversations.tsx`

```typescript
const refreshList = useCallback(async (): Promise<ConversationListItem[] | null> => {
    try {
        const list = await ipc.listConversations() as ConversationListItem[];
        const normalized = Array.isArray(list) ? list : [];
        setConversations(normalized);
        setLoading(false);  // Succes : arreter le loading
        return normalized;
    } catch {
        // NE PAS mettre setLoading(false) ici
        // Le retry loop dans useEffect continuera a essayer
        return null;
    }
}, []);
```

Et dans le retry loop, ajouter un etat distinct pour "premier chargement reussi" :

```typescript
useEffect(() => {
    const MAX_STARTUP_RETRIES = 30;  // ~60 secondes
    let active = true;
    let attempt = 0;

    const tryLoad = async () => {
        const list = await refreshList();
        if (list !== null || !active) return;
        attempt += 1;
        if (attempt >= MAX_STARTUP_RETRIES) {
            setLoading(false);  // Abandonner apres 60s
            return;
        }
        const delay = Math.min(5000, 500 + attempt * 500);
        retryTimerRef.current = setTimeout(() => void tryLoad(), delay);
    };

    void tryLoad();
    return () => { active = false; /* cleanup */ };
}, [refreshList]);
```

### 4.4 Retirer recoveryAttemptedRef - toujours retenter (C4)

**Fichier** : `desktop/src/pages/Chat.tsx`

```typescript
// SUPPRIMER recoveryAttemptedRef
// Remplacer l'effet de recovery par :
useEffect(() => {
    if (historyLoading || !urlId || isStreaming) return;
    if (history.messages.length > 0) return;

    const conv = conversations.find((c) => c.id === urlId);
    if (!conv || conv.messageCount === 0) return;

    // Retenter sans limite de tentatives
    // Le debounce est naturel : cet effect ne se re-execute que quand ses deps changent
    console.warn("[Chat] History empty but conversation has", conv.messageCount, "messages - retrying");
    void refreshHistory();
}, [historyLoading, urlId, history.messages.length, conversations, isStreaming, refreshHistory]);
```

### 4.5 Stabiliser le tri sidebar (C10)

**Fichier** : `desktop/src/hooks/useConversations.tsx`

Ajouter un tie-breaker par ID pour eviter le tri instable quand les timestamps sont identiques :

```typescript
const sorted = [...conversations]
    .filter((c) => !c.archived)
    .sort((a, b) => {
        const timeDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.id.localeCompare(b.id);  // Tie-breaker stable
    });
```

### 4.6 Corriger creating.current dans ChatPage (C11)

**Fichier** : `desktop/src/App.tsx`

```typescript
useEffect(() => {
    if (convLoading || id || creating.current) return;

    creating.current = true;
    let unmounted = false;
    void (async () => {
        try {
            // ... logique existante ...
        } catch (error) {
            console.warn("[ChatPage] Failed to create conversation:", error);
        } finally {
            creating.current = false;  // Toujours reset, meme si unmounted
        }
    })();
    return () => { unmounted = true; };
}, [convLoading, id, createConversation, navigate, conversations, refreshList]);
```

### 4.7 Message d'indisponibilite pendant l'ingestion (C12)

**Fichier** : `desktop/src/pages/Chat.tsx`

Quand `isIngesting` est true, afficher un bandeau au-dessus de la zone de saisie :

```tsx
{isIngesting && (
    <div className="mx-4 mb-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t('chat.ingestionInProgress')}
    </div>
)}
```

Desactiver aussi visuellement le bouton d'envoi :

```tsx
<button
    type="submit"
    disabled={isStreaming || !query.trim() || !chatReady.ready || !selectedModeEnabled || isIngesting}
>
```

Ajouter les cles de traduction :

```json
// fr.json
"chat.ingestionInProgress": "L'ingestion est en cours. Le chat sera disponible une fois l'ingestion terminee."

// en.json
"chat.ingestionInProgress": "Ingestion in progress. Chat will be available once ingestion is complete."
```

### 4.8 Simplifier useConversation - un seul mecanisme de retry

**Fichier** : `desktop/src/hooks/useConversation.ts`

Actuellement il y a deux mecanismes de retry independants (useEffect + refresh()). Les unifier :

```typescript
// Le useEffect gere le chargement initial et les retries
// La methode refresh() utilise le MEME mecanisme en re-declenchant le useEffect

const [retryTrigger, setRetryTrigger] = useState(0);

const refresh = useCallback(async (): Promise<ConversationHistory> => {
    // Declencher un re-chargement via le useEffect
    setRetryTrigger(prev => prev + 1);
    // Retourner l'historique actuel (le useEffect mettra a jour)
    return history;
}, [history]);

useEffect(() => {
    // ... logique de chargement avec retry ...
}, [conversationId, retryTrigger]);
```

Ou plus simplement, garder les deux mais s'assurer que `refresh()` a la meme logique de retry que le useEffect :

```typescript
const refresh = useCallback(async (): Promise<ConversationHistory> => {
    if (!conversationId) return emptyHistory;
    setLoading(true);
    const expectedCount = Math.max(0, minExpectedRef.current);

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
            const payload = await invoke<ConversationHistory>("get_conversation_history", {
                conversation_id: conversationId,
            });
            const result = parseHistory(payload);
            if (shouldRetryForUnexpectedEmptyHistory(result, expectedCount) && attempt < RETRY_DELAYS_MS.length) {
                await new Promise<void>(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
                continue;
            }
            setHistory(result);
            setError(null);
            setLoading(false);
            return result;
        } catch (err: any) {
            if (attempt >= RETRY_DELAYS_MS.length) {
                setError(String(err));
                setLoading(false);
                return history;  // Retourner l'ancien, pas emptyHistory
            }
            await new Promise<void>(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        }
    }
    setLoading(false);
    return history;
}, [conversationId, history]);
```

---

## 5. Ordre d'implementation

Les changements sont classes par priorite. Chaque phase peut etre livree independamment.

### Phase 1 - Corrections critiques (1 session)

Corrige les 3 symptomes principaux : conversations qui disparaissent, liste vide au demarrage.

| # | Changement | Section | Fichier(s) |
|---|-----------|---------|------------|
| 1 | Ne plus reset history a vide avant re-fetch | 4.1 | `useConversation.ts` |
| 2 | Retirer `key={id}` sur Chat | 4.2 | `App.tsx` + `Chat.tsx` |
| 3 | Garder `loading=true` jusqu'au 1er succes | 4.3 | `useConversations.tsx` |
| 4 | Retirer `recoveryAttemptedRef` | 4.4 | `Chat.tsx` |
| 5 | Stabiliser tri sidebar (tie-breaker) | 4.5 | `useConversations.tsx` |
| 6 | Corriger `creating.current` | 4.6 | `App.tsx` |

### Phase 2 - Robustesse backend (1 session)

Protege contre la perte de donnees dans les cas limites.

| # | Changement | Section | Fichier(s) |
|---|-----------|---------|------------|
| 7 | Proteger `update_summary_if_needed` avec try/catch | 3.2 | `orchestrator.py` |
| 8 | Ajouter verrou sur `_MEMORY_CACHE` | 3.3 | `chat.py` |
| 9 | Supprimer singleton `_CONVERSATION_MEMORY` | 3.4 | `chat.py` |
| 10 | Robustifier deserialization dans `_get_conversation_memory` | 3.5 | `chat.py` |
| 11 | Retourner `len(messages)` dans `chat_history` | 3.7 | `chat.py` |

### Phase 3 - UX ingestion + polish (1 session)

Ameliore l'experience pendant l'ingestion et simplifie le code.

| # | Changement | Section | Fichier(s) |
|---|-----------|---------|------------|
| 12 | Bandeau "ingestion en cours" + bouton desactive | 4.7 | `Chat.tsx` + traductions |
| 13 | Simplifier retry dans `useConversation` | 4.8 | `useConversation.ts` |

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
3. **Attendu** : bandeau "ingestion en cours", bouton d'envoi desactive
4. Attendre la fin de l'ingestion
5. **Attendu** : le bandeau disparait, le chat est utilisable

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
