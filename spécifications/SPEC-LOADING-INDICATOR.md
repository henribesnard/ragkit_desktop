# Spec : Indicateur de progression intelligent du chat

## Contexte

Actuellement, quand l'utilisateur envoie une question, il voit un curseur clignotant dans une bulle vide pendant toute la phase de "pré-traitement" (analyse d'intention, réécriture, recherche de documents). Aucun texte n'apparaît tant que le LLM n'a pas commencé à streamer des tokens. Sur un modèle local (Ollama), cette phase peut durer 5-15 secondes sans aucun feedback.

## Objectif

Afficher en temps réel les étapes du pipeline sous forme de messages de statut dans la bulle assistant, AVANT que les tokens ne commencent à arriver.

## Pipeline actuel (trace complète)

```
Frontend (Chat.tsx)
  └→ useChatStream.startStream(payload)
       └→ invoke("chat_orchestrated", { query: payload })
            └→ Rust chat_stream() — POST /api/chat/stream
                 └→ Python chat_stream() — SSE StreamingResponse
                      └→ orchestrator.stream(query)
                           │
                           ├─ 1. analyzer.analyze(query, history)     ← LLM call (~1-5s)
                           │     → AnalysisResult { intent, needs_rag }
                           │
                           ├─ [si needs_rag = true]
                           │   ├─ 2. rewriter.rewrite(query, history) ← LLM call (~1-3s)
                           │   │     → RewriteResult { rewritten_queries }
                           │   │
                           │   ├─ 3. retrieve_handler(rewrite_query)  ← Vector search (~0.5-2s)
                           │   │     → retrieval_results + deduplication
                           │   │
                           │   └─ 4. response_generator.stream_events()  ← LLM streaming
                           │         → yield { type: "token", content }  (par token)
                           │         → yield { type: "done", answer, sources }
                           │
                           └─ [si needs_rag = false]
                               └─ 4. llm.stream() direct → tokens
```

### Événements SSE actuels (Python → Rust → Frontend)

| Événement SSE | Émis par       | Tauri event          | Contenu                    |
|---------------|----------------|----------------------|----------------------------|
| `token`       | orchestrator   | `chat-stream-chunk`  | `{ content: "..." }`       |
| `done`        | orchestrator   | `chat-stream-done`   | `{ answer, sources, ... }` |
| `error`       | chat_stream    | `chat-stream-done`   | `{ error: "..." }`         |

**Manquant** : aucun événement entre le début de la requête et le premier `token`.

## Design proposé

### Nouvel événement SSE : `status`

Ajouter un événement `status` émis par l'orchestrateur à chaque transition d'étape :

```
event: status
data: {"step": "analyzing", "detail": null}

event: status
data: {"step": "rewriting", "detail": null}

event: status
data: {"step": "retrieving", "detail": null}

event: status
data: {"step": "retrieved", "detail": {"count": 12, "search_type": "hybrid"}}

event: status
data: {"step": "generating", "detail": null}

event: token
data: {"content": "Selon "}
...
```

### Étapes (steps)

| Step          | Moment dans le code                               | Message FR                         | Message EN                        |
|---------------|----------------------------------------------------|------------------------------------|-----------------------------------|
| `analyzing`   | Avant `analyzer.analyze()`                         | Analyse de l'intention...          | Analyzing intent...               |
| `rewriting`   | Avant `rewriter.rewrite()`                         | Reformulation de la question...    | Rewriting query...                |
| `retrieving`  | Avant `retrieve_handler()`                         | Recherche dans les documents...    | Searching documents...            |
| `retrieved`   | Après `_collect_rag_retrieval()` retourne          | {count} documents trouvés          | {count} documents found           |
| `generating`  | Avant `response_generator.stream_events()`         | Préparation de la réponse...       | Preparing response...             |

Pour les requêtes non-RAG (greeting, chitchat, out_of_scope) :

| Step          | Moment dans le code                               | Message FR                         | Message EN                        |
|---------------|----------------------------------------------------|------------------------------------|-----------------------------------|
| `analyzing`   | Avant `analyzer.analyze()`                         | Analyse de l'intention...          | Analyzing intent...               |
| `generating`  | Avant `llm.stream()`                               | Préparation de la réponse...       | Preparing response...             |

## Modifications par fichier

### 1. `ragkit/agents/orchestrator.py` — méthode `stream()`

Ajouter des `yield` de type `status` avant chaque étape dans la méthode `stream()` :

```python
async def stream(self, query, *, include_debug=False):
    # ...
    yield {"type": "status", "step": "analyzing"}
    analysis = await self.analyzer.analyze(query, history)

    if analysis.needs_rag:
        yield {"type": "status", "step": "rewriting"}
        # ... (dans _collect_rag_retrieval, le rewriting se fait en premier)

        yield {"type": "status", "step": "retrieving"}
        # ... retrieve_handler()

        yield {"type": "status", "step": "retrieved", "detail": {
            "count": len(deduped),
            "search_type": resolved_search_type
        }}

        yield {"type": "status", "step": "generating"}
        async for event in self.response_generator.stream_events(...):
            yield event
    else:
        yield {"type": "status", "step": "generating"}
        async for chunk in self.llm.stream(...):
            yield ...
```

**Note** : `_collect_rag_retrieval` est actuellement une méthode `async` classique (pas un générateur). Il faut soit :
- (Option A) La transformer en `AsyncIterator` qui yield des status puis retourne les résultats via un wrapper
- (Option B, plus simple) Séparer les appels : yield le status avant d'appeler, puis appeler. Les yields de status se font dans `stream()` directement, en découpant `_collect_rag_retrieval` en deux phases explicites.

**Recommandation** : Option B — garder `_collect_rag_retrieval` tel quel et émettre les status dans `stream()` en appelant rewriter et retrieve_handler séparément :

```python
async def stream(self, query, *, include_debug=False):
    # ...
    yield {"type": "status", "step": "analyzing"}
    analysis = await self.analyzer.analyze(query, history)

    if analysis.needs_rag:
        yield {"type": "status", "step": "rewriting"}
        rewrite = await self.rewriter.rewrite(query, history)
        queries = rewrite.rewritten_queries or [query]
        rewritten_query = queries[0] if queries and queries[0] != query else None

        yield {"type": "status", "step": "retrieving"}
        # Inliner la logique de retrieve (boucle sur queries, dedup)
        merged_results = []
        for rq in queries:
            response = await self.retrieve_handler(rq)
            merged_results.extend(response.results)
        deduped = self._deduplicate_results(merged_results)

        yield {"type": "status", "step": "retrieved", "detail": {
            "count": len(deduped),
            "search_type": resolved_search_type
        }}

        yield {"type": "status", "step": "generating"}
        async for event in self.response_generator.stream_events(...):
            yield event
    # ...
```

### 2. `ragkit/desktop/api/chat.py` — `chat_stream()`

Propager le nouvel événement `status` dans le SSE :

```python
if event_type == "status":
    status_payload = {
        "step": str(event.get("step", "")),
        "detail": event.get("detail"),
    }
    yield f"event: status\ndata: {json.dumps(status_payload, ensure_ascii=False)}\n\n"
    continue
```

### 3. `desktop/src-tauri/src/commands.rs` — `chat_stream()`

Ajouter le handling de l'événement SSE `status` dans la boucle de parsing :

```rust
} else if event_name == "status" {
    let parsed: serde_json::Value = serde_json::from_str(&data_payload)
        .unwrap_or_else(|_| serde_json::json!({}));
    window
        .emit("chat-stream-status", parsed)
        .map_err(|e| e.to_string())?;
}
```

Nouvel événement Tauri : `chat-stream-status`

### 4. `desktop/src/hooks/useChatStream.ts`

Ajouter un state pour le step courant et écouter le nouvel événement :

```typescript
export interface StreamStatus {
  step: "analyzing" | "rewriting" | "retrieving" | "retrieved" | "generating";
  detail?: { count?: number; search_type?: string } | null;
}

export function useChatStream() {
  // ... existing state ...
  const [status, setStatus] = useState<StreamStatus | null>(null);
  const unlistenStatusRef = useRef<null | (() => void)>(null);

  // Dans cleanupListeners, ajouter :
  // if (unlistenStatusRef.current) { unlistenStatusRef.current(); ... }

  // Dans startStream, ajouter :
  // setStatus(null);
  // const statusUnlisten = await listen<StreamStatus>("chat-stream-status", (event) => {
  //   setStatus(event.payload);
  // });
  // unlistenStatusRef.current = statusUnlisten;

  // Dans clear, ajouter : setStatus(null);

  return {
    // ... existing ...
    status,  // nouveau
  };
}
```

### 5. `desktop/src/pages/Chat.tsx` — Composant `StreamingIndicator`

Remplacer le curseur clignotant seul par un indicateur de progression quand `status` est défini et `!streamedAnswer` :

```tsx
// Avant les tokens (status affiché, pas encore de contenu)
{isStreaming && !streamedAnswer && status && (
  <StreamingStatusIndicator status={status} />
)}

// Quand les tokens arrivent, le composant disparaît naturellement
// car streamedAnswer devient truthy
```

### 6. Nouveau composant `desktop/src/components/chat/StreamingStatusIndicator.tsx`

```
┌─────────────────────────────────────────┐
│  ● Analyse de l'intention...            │  ← step: analyzing
│  ✓ Analyse de l'intention               │
│  ● Recherche dans les documents...      │  ← step: retrieving
│  ✓ 12 documents trouvés                 │  ← step: retrieved
│  ● Préparation de la réponse...         │  ← step: generating
└─────────────────────────────────────────┘
```

**Comportement** :
- Chaque étape s'ajoute à la liste (comme un log en temps réel)
- L'étape en cours a un spinner animé (●)
- Les étapes terminées ont un check vert (✓)
- Quand le premier token arrive, tout l'indicateur disparaît et la réponse streamée prend le relais
- Style : texte petit (12px), couleur `--text-tertiary`, pas de bulle — juste du texte minimaliste

**State interne** :
```typescript
interface StatusStep {
  step: string;
  label: string;
  done: boolean;
}

// À chaque nouveau status reçu :
// 1. Marquer le step précédent comme done
// 2. Ajouter le nouveau step (done: false)
// Labels via i18n
```

### 7. Traductions `desktop/src/locales/fr.json` et `en.json`

```json
"chat": {
  "status": {
    "analyzing": "Analyse de l'intention",
    "rewriting": "Reformulation de la question",
    "retrieving": "Recherche dans les documents",
    "retrieved": "{{count}} documents trouvés",
    "generating": "Préparation de la réponse"
  }
}
```

## UX : cas limites

1. **Étape `analyzing` avec `always_retrieve: true`** : Le analyzer retourne immédiatement (0ms). Le status `analyzing` apparaîtra un instant puis passera à `rewriting`/`retrieving`. C'est OK — le feedback est quand même utile.

2. **Requête non-RAG** (greeting, chitchat) : Seules les étapes `analyzing` → `generating` apparaissent. Pas de `rewriting`/`retrieving`.

3. **Erreur pendant une étape** : L'événement `error` arrive et le composant affiche l'erreur normalement. Les étapes de status disparaissent.

4. **Stream stoppé** : L'utilisateur clique stop → le composant est nettoyé via `clearStreamState()`.

5. **Transition status → tokens** : Dès que `streamedAnswer` est truthy (premier token reçu), le `StreamingStatusIndicator` disparaît et la bulle de réponse streamée prend le relais. Pas de flash car React fait le swap en un seul render.

## Résumé des fichiers à modifier

| Fichier | Type de modification |
|---------|---------------------|
| `ragkit/agents/orchestrator.py` | Ajouter `yield {"type": "status", ...}` dans `stream()` |
| `ragkit/desktop/api/chat.py` | Propager événement SSE `status` |
| `desktop/src-tauri/src/commands.rs` | Émettre `chat-stream-status` côté Tauri |
| `desktop/src/hooks/useChatStream.ts` | Écouter `chat-stream-status`, exposer `status` |
| `desktop/src/pages/Chat.tsx` | Afficher `StreamingStatusIndicator` pendant le pré-traitement |
| `desktop/src/components/chat/StreamingStatusIndicator.tsx` | Nouveau composant (liste d'étapes animée) |
| `desktop/src/locales/fr.json` | Clés `chat.status.*` |
| `desktop/src/locales/en.json` | Clés `chat.status.*` |

## Ordre d'implémentation recommandé

1. `orchestrator.py` — yield des status events
2. `chat.py` — SSE propagation
3. `commands.rs` — Tauri event emission
4. `useChatStream.ts` — listener + state
5. `StreamingStatusIndicator.tsx` — composant UI
6. `Chat.tsx` — intégration du composant
7. `fr.json` + `en.json` — traductions
8. Test : envoyer une question RAG et vérifier que les étapes s'affichent séquentiellement
