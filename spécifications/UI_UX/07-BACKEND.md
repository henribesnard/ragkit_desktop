# LOKO - Modifications Backend pour la gestion des conversations

## 1. Probleme architectural

### Etat actuel

Le backend FastAPI maintient une **unique** `ConversationMemory` en memoire :
- Stocke tous les messages de la conversation courante
- Gere le contexte LLM (sliding_window de 10 messages ou summary)
- Perdue au redemarrage du backend

Le frontend recupere l'historique via `GET /api/chat/history` et l'affiche, mais ne persiste rien entre sessions.

### Besoin LOKO

LOKO necessite :
- **Multiples conversations** avec historique persistant
- **Changement de conversation** sans perdre le contexte
- **Persistance** des conversations entre sessions/redemarrages
- **Generation de titre** automatique

### Architecture choisie : Hybride

```
Frontend (Tauri FS)                Backend (FastAPI)
┌─────────────────┐               ┌────────────────────────┐
│ conversations/   │               │ ConversationMemory     │
│ ├── index.json   │  ──switch──>  │ (1 active a la fois)   │
│ ├── {id-1}.json  │               │                        │
│ ├── {id-2}.json  │               │ - sliding_window       │
│ └── ...          │               │ - summary              │
│                  │               │ - context LLM           │
│ Source de verite  │               │ Cache de travail        │
│ pour l'affichage │               │ pour le LLM            │
└─────────────────┘               └────────────────────────┘
```

**Principe** :
- Le **frontend** est la source de verite pour les conversations (stockage fichier via Tauri FS)
- Le **backend** maintient le contexte LLM de la conversation active
- Au **changement de conversation**, le frontend envoie l'historique au backend pour restaurer le contexte
- Au **premier lancement**, si des conversations existent, le frontend restaure la derniere active

## 2. Nouveaux endpoints backend

### 2.1 `POST /api/chat/restore` - Restaurer une conversation

Quand l'utilisateur ouvre une conversation existante, le frontend envoie l'historique au backend pour restaurer le contexte LLM.

```python
class RestoreConversationPayload(BaseModel):
    messages: List[ConversationMessageDTO]

@router.post("/chat/restore")
async def restore_conversation(payload: RestoreConversationPayload):
    """
    Efface la memoire courante et la remplace par les messages fournis.
    Le backend applique sa strategie (sliding_window/summary) pour
    construire le contexte LLM a partir de cet historique.
    """
    memory = get_conversation_memory()
    memory.clear()
    for msg in payload.messages:
        memory.add_message(
            role=msg.role,
            content=msg.content,
            intent=msg.intent,
            sources=msg.sources,
            query_log_id=msg.query_log_id,
            feedback=msg.feedback,
        )
    return {"success": True, "messages_loaded": len(payload.messages)}
```

**Flux** :
1. Utilisateur clique sur conversation X dans la sidebar
2. Frontend charge `conversations/{x}.json`
3. Frontend `POST /api/chat/restore` avec les messages
4. Backend reconstruit le contexte LLM
5. Frontend affiche les messages et attend la prochaine question

### 2.2 `POST /api/chat/generate-title` - Generer un titre

```python
class GenerateTitlePayload(BaseModel):
    first_message: str
    first_response: str

class GenerateTitleResponse(BaseModel):
    title: str

@router.post("/chat/generate-title", response_model=GenerateTitleResponse)
async def generate_title(payload: GenerateTitlePayload):
    """
    Genere un titre court (max 50 caracteres) pour une conversation
    a partir du premier echange.
    """
    llm = get_llm_service()
    prompt = (
        "Generate a very short title (max 50 characters, no quotes) "
        "for a conversation that starts with this exchange:\n\n"
        f"User: {payload.first_message}\n"
        f"Assistant: {payload.first_response[:200]}\n\n"
        "Title:"
    )
    title = await llm.generate(prompt, max_tokens=30)
    return GenerateTitleResponse(title=title.strip()[:50])
```

**Fallback frontend** : Si l'endpoint echoue ou le LLM n'est pas configure, le frontend utilise les 50 premiers caracteres du premier message.

### 2.3 Modification de `POST /api/chat/new` existant

L'endpoint existant reste inchange. Il est appele quand l'utilisateur cree une nouvelle conversation (vide le contexte backend).

```python
@router.post("/chat/new")
async def new_chat():
    memory = get_conversation_memory()
    memory.clear()
    return {"success": True}
```

### 2.4 Modification de `POST /api/chat/stream` et `POST /api/chat`

Aucune modification necessaire. Le backend continue d'utiliser sa `ConversationMemory` courante. La seule difference est que le frontend appelle `restore` avant de chatter quand il change de conversation.

## 3. Modifications Rust (Tauri IPC)

### Nouvelles commandes

```rust
// commands.rs

#[tauri::command]
pub async fn restore_conversation(
    app: AppHandle,
    messages: serde_json::Value
) -> Result<serde_json::Value, String> {
    request(
        Method::POST,
        "/api/chat/restore",
        Some(serde_json::json!({ "messages": messages })),
        &app
    ).await
}

#[tauri::command]
pub async fn generate_conversation_title(
    app: AppHandle,
    first_message: String,
    first_response: String,
) -> Result<serde_json::Value, String> {
    request(
        Method::POST,
        "/api/chat/generate-title",
        Some(serde_json::json!({
            "first_message": first_message,
            "first_response": first_response,
        })),
        &app
    ).await
}
```

### IPC wrapper frontend

```typescript
// lib/ipc.ts - Ajouts

export async function restoreConversation(
  messages: ConversationMessage[]
): Promise<{ success: boolean; messages_loaded: number }> {
  return invoke("restore_conversation", { messages });
}

export async function generateConversationTitle(
  firstMessage: string,
  firstResponse: string,
): Promise<{ title: string }> {
  return invoke("generate_conversation_title", {
    first_message: firstMessage,
    first_response: firstResponse,
  });
}
```

## 4. Flux complets

### 4.1 Nouvelle conversation

```
1. Utilisateur clique "Nouvelle conversation"
2. Frontend: POST /api/chat/new (vide le backend)
3. Frontend: Cree index entry {id, title: "", createdAt: now}
4. Frontend: Cree fichier conversations/{id}.json vide
5. Frontend: Navigue vers /chat/{id}
6. Chat affiche empty state
```

### 4.2 Envoyer un message

```
1. Utilisateur tape et envoie
2. Frontend: Ajoute message user au fichier conversation
3. Frontend: invoke("chat_orchestrated", { query: payload })
4. Backend: Stream tokens via SSE
5. Frontend: Accumule le contenu streame
6. Backend: "done" event avec OrchestratedChatResponse complet
7. Frontend: Ajoute message assistant au fichier conversation
   - content: response.answer
   - sources: response.sources
   - intent: response.intent
   - query_log_id: response.query_log_id
   - metadata: response.debug (si mode debug actif)
8. Frontend: Met a jour index (updatedAt, messageCount)
9. Si premier echange: appelle generate-title
```

### 4.3 Changer de conversation

```
1. Utilisateur clique sur conversation Y dans la sidebar
2. Frontend: Sauvegarde la conversation courante (deja fait par auto-save)
3. Frontend: Charge conversations/{y}.json
4. Frontend: POST /api/chat/restore avec les messages
5. Backend: Reconstruit le contexte LLM
6. Frontend: Affiche les messages
7. Frontend: Navigue vers /chat/{y}
```

### 4.4 Demarrage de l'application

```
1. App demarre, backend lance
2. Frontend: Charge index.json
3. Frontend: Si derniere conversation active existe:
   a. Charge ses messages
   b. POST /api/chat/restore
   c. Affiche les messages
4. Sinon: Affiche empty state (nouvelle conversation)
```

### 4.5 Feedback sur un message

```
1. Utilisateur clique thumbs up/down
2. Frontend: Met a jour le message dans le fichier conversation
3. Frontend: POST /api/feedback avec query_log_id + value
   (endpoint existant, pas de changement)
```

## 5. Dependances et prerequis

### Plugin Tauri FS

Le stockage fichier necessite `@tauri-apps/plugin-fs`. A ajouter :

```bash
# package.json
npm install @tauri-apps/plugin-fs

# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-fs = "2"

# src-tauri/src/lib.rs ou main.rs
app.plugin(tauri_plugin_fs::init())

# src-tauri/capabilities/default.json
{
  "permissions": [
    "fs:default",
    "fs:allow-app-data-read",
    "fs:allow-app-data-write"
  ]
}
```

### Pas de migration de donnees

L'historique actuel est en memoire backend (perdu au redemarrage). Pas de donnees a migrer. La premiere fois que LOKO demarre apres la refonte, l'index sera vide.

## 6. Resume des fichiers backend a modifier

| Fichier | Modification |
|---------|-------------|
| `ragkit/desktop/api/chat.py` | Ajouter endpoints `restore` et `generate-title` |
| `ragkit/config/llm_schema.py` | Ajouter `RestoreConversationPayload`, `GenerateTitlePayload` |
| `ragkit/agents/memory.py` | Ajouter methode `restore_from_messages(messages)` |
| `desktop/src-tauri/src/commands.rs` | Ajouter commandes `restore_conversation`, `generate_conversation_title` |
| `desktop/src-tauri/src/lib.rs` | Enregistrer les nouvelles commandes |
| `desktop/src/lib/ipc.ts` | Ajouter wrappers `restoreConversation`, `generateConversationTitle` |
| `desktop/src-tauri/Cargo.toml` | Ajouter `tauri-plugin-fs` |
| `desktop/package.json` | Ajouter `@tauri-apps/plugin-fs` |
| `desktop/src-tauri/capabilities/default.json` | Permissions FS |
