# LOKO - Gestion des Conversations

## 1. Vue d'ensemble

Le système de conversations permet de gérer un historique persistant des échanges avec le pipeline RAG. Chaque conversation est un fil de discussion indépendant avec ses propres paramètres de recherche et son contexte.

## 2. Cycle de vie d'une conversation

```
  [Création]  →  [Active]  →  [Archivée]
                    ↓              ↓
               [Supprimée]   [Restaurée → Active]
                    ↓
               [Définitivement supprimée]
```

### 2.1 Création

**Déclencheur** : Clic "Nouvelle conversation" ou `Ctrl+N`

1. Génération d'un UUID v4 unique
2. Création de l'entrée dans l'index : `{id, title: "", updatedAt: now, archived: false}`
3. Fichier vide : `conversations/{id}.json`
4. L'ancienne conversation est sauvegardée automatiquement
5. Le chat affiche l'empty state
6. Le champ de saisie reçoit le focus

### 2.2 Premier message

1. L'utilisateur envoie son premier message
2. Le message est ajouté au fichier conversation
3. La réponse assistant est streamée et ajoutée
4. **Génération du titre** :
   - Requête au LLM : "Génère un titre court (max 50 caractères) pour cette conversation qui commence par : [premier message]"
   - Si LLM indisponible : Truncate du premier message à 50 caractères
   - Le titre est mis à jour dans l'index
   - L'item sidebar affiche le nouveau titre

### 2.3 Messages suivants

1. Chaque paire question/réponse est ajoutée au fichier conversation
2. `updatedAt` est mis à jour dans l'index
3. La conversation remonte en haut de son groupe temporel (ou change de groupe)

### 2.4 Archivage

1. L'utilisateur clique "Archiver" dans le menu contextuel
2. `archived: true` dans l'index
3. La conversation disparaît de la liste principale
4. Accessible via un filtre "Archives" en bas de la sidebar

### 2.5 Suppression

1. L'utilisateur clique "Supprimer"
2. Dialog de confirmation (voir 03-SIDEBAR.md)
3. Si confirmé :
   - Suppression de l'entrée dans l'index
   - Suppression du fichier `conversations/{id}.json`
   - Si c'était la conversation active : redirection vers "Nouvelle conversation"
   - Animation de disparition (slide-out gauche, 200ms)

## 3. Stockage et persistance

### 3.1 Structure des fichiers

```
{app_data_dir}/conversations/
├── index.json                    // Index léger pour la sidebar
├── {uuid-1}.json                 // Conversation complète 1
├── {uuid-2}.json                 // Conversation complète 2
└── ...
```

### 3.2 Format de l'index

```json
{
  "version": 1,
  "conversations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Configuration du pipeline RAG",
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T11:45:00Z",
      "messageCount": 12,
      "archived": false,
      "searchMode": "semantic"
    }
  ]
}
```

### 3.3 Format d'une conversation

Les champs sont alignés sur les data structures backend (`ChatSource`, `ConversationMessageDTO`, `OrchestratedChatResponse`).

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Configuration du pipeline RAG",
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T11:45:00Z",
  "searchMode": "semantic",
  "messages": [
    {
      "id": "msg-001",
      "role": "user",
      "content": "Comment configurer le pipeline RAG ?",
      "timestamp": "2025-01-15T10:30:00Z",
      "intent": "question"
    },
    {
      "id": "msg-002",
      "role": "assistant",
      "content": "Pour configurer le pipeline RAG, voici les étapes...",
      "timestamp": "2025-01-15T10:30:05Z",
      "sources": [
        {
          "id": 1,
          "chunk_id": "doc_123_chunk_456",
          "title": "guide-rag.pdf",
          "path": "/documents/guide-rag.pdf",
          "page": 12,
          "score": 0.89,
          "text_preview": "Le pipeline RAG se compose de trois étapes..."
        }
      ],
      "query_log_id": "7a1b2c3d-4e5f-6789-abcd-ef0123456789",
      "feedback": "positive",
      "metadata": {
        "searchMode": "semantic",
        "topK": 5,
        "latencyMs": 230,
        "tokensUsed": 342,
        "rewrittenQuery": null,
        "needsRag": true
      }
    }
  ]
}
```

### 3.4 Sauvegarde automatique

- **Quand** : Après chaque message ajouté (user ou assistant)
- **Méthode** : Écriture atomique (write to temp → rename)
- **Debounce** : Non, écriture immédiate (les messages sont des événements discrets)
- **Index** : Mis à jour à chaque modification (updatedAt, messageCount)

## 4. Gestion dans la sidebar

### 4.1 Affichage

- Les conversations sont triées par `updatedAt` DESC (la plus récente en premier)
- Regroupées par période temporelle (voir 03-SIDEBAR.md §3.4)
- Seul le titre est affiché (pas de preview du dernier message)
- La conversation active a un indicateur visuel (bordure gauche verte)

### 4.2 Actions sur une conversation

| Action | Accès | Comportement |
|--------|-------|-------------|
| **Ouvrir** | Clic sur l'item | Charge les messages, affiche dans le chat |
| **Renommer** | Menu > Renommer | Edition inline du titre |
| **Archiver** | Menu > Archiver | Masque de la liste, déplace dans archives |
| **Supprimer** | Menu > Supprimer | Confirmation puis suppression définitive |
| **Désarchiver** | Dans vue archives > Restaurer | Remet `archived: false` |

### 4.3 Section Archives

Accessible via un bouton discret en bas de la liste de conversations :

```
│  7 derniers jours       │
│   Questions fréquentes  │
│                         │
│  [📁 Archives (3)]       │  ← Visible seulement s'il y a des archives
│                         │
```

- **Style** : Bouton ghost, `--text-xs`, `--text-tertiary`
- **Clic** : Affiche une vue filtrée montrant uniquement les conversations archivées
- **Chaque item archivé** a un bouton "Restaurer" au lieu de "Archiver" dans son menu

## 5. Recherche de conversations

### 5.1 Comportement

1. L'utilisateur tape dans le champ de recherche
2. Recherche en temps réel (debounce 200ms) dans les titres
3. Les groupes temporels sont masqués pendant la recherche
4. Les résultats s'affichent dans une liste plate, triée par pertinence
5. Si aucun résultat : "Aucune conversation trouvée" + bouton "Nouvelle conversation"
6. Quand le champ est vidé : retour à la vue normale

### 5.2 Algorithme de recherche

- Recherche dans le titre (prioritaire)
- Recherche dans le contenu des messages (secondaire, si implémenté)
- Case-insensitive
- Supporte les accents (normalize NFD)
- Highlight des termes trouvés dans les résultats

## 6. Export de conversation

### 6.1 Accès

Bouton dans le header de la zone chat (quand une conversation est active) :

```
                                            [📤] [...]
```

### 6.2 Formats disponibles

| Format | Contenu |
|--------|---------|
| **JSON** | Export complet (messages, sources, metadata) |
| **Markdown** | Messages formatés en Markdown lisible |
| **CSV** | Tableau : timestamp, role, content |

### 6.3 Dialog d'export

```
┌─────────────────────────────────────┐
│  Exporter la conversation           │
│                                     │
│  Format :                           │
│  ○ JSON (complet)                   │
│  ○ Markdown (lisible)               │
│  ● CSV (tableau)                    │
│                                     │
│  ☑ Inclure les sources              │
│  ☑ Inclure les métadonnées          │
│                                     │
│           [Annuler]  [Exporter]     │
└─────────────────────────────────────┘
```

## 7. Limites et performances

| Paramètre | Valeur | Raison |
|-----------|--------|--------|
| Conversations max (index) | 1000 | Performance sidebar |
| Messages max par conversation | 500 | Performance rendu + mémoire |
| Taille max fichier conversation | 5 MB | Stockage local |
| Titre max | 100 caractères | Affichage sidebar |

### Quand les limites sont atteintes

- **1000 conversations** : Les plus anciennes non-archivées sont auto-archivées
- **500 messages** : Notification "Conversation longue, créez-en une nouvelle pour de meilleures performances"
- **5 MB** : Truncate des sources/metadata les plus anciens

## 8. Intégration avec le pipeline existant

> **Important** : Le backend maintient un `ConversationMemory` en mémoire pour le contexte LLM (sliding_window/summary). Le frontend est la source de vérité pour la persistance. Les deux doivent être synchronisés. Voir [07-BACKEND.md](07-BACKEND.md) pour l'architecture complète.

### 8.1 Hook `useConversations` (nouveau, remplace `useConversation`)

```typescript
interface UseConversationsReturn {
  // État
  conversations: ConversationListItem[];   // Index pour la sidebar
  activeConversation: Conversation | null; // Conversation chargée
  loading: boolean;

  // CRUD Conversations
  createConversation: () => Promise<string>;        // Crée + POST /api/chat/new
  openConversation: (id: string) => Promise<void>;  // Charge + POST /api/chat/restore
  deleteConversation: (id: string) => Promise<void>;
  archiveConversation: (id: string) => Promise<void>;
  unarchiveConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;

  // Messages (opèrent sur la conversation active)
  addMessage: (message: Omit<ConversationMessage, "id">) => Promise<void>;
  updateMessage: (messageId: string, updates: Partial<ConversationMessage>) => Promise<void>;

  // Recherche
  searchConversations: (query: string) => ConversationListItem[];

  // Export
  exportConversation: (id: string, format: ExportFormat) => Promise<void>;
}
```

### 8.2 Intégration avec `useChatStream`

Le hook de chat stream existant doit être modifié pour :
1. Appeler `addMessage({ role: "user", content, timestamp })` avant de lancer le stream
2. Quand le stream émet `"done"` avec `OrchestratedChatResponse` :
   - Appeler `addMessage({ role: "assistant", content: response.answer, sources: response.sources, query_log_id: response.query_log_id, intent: response.intent })`
   - Si `include_debug`: stocker `response.debug` dans `metadata`
3. Si premier échange (messageCount === 2) : appeler `generateConversationTitle`
4. **Ne plus appeler `refreshHistory()`** (l'historique est maintenant géré frontend)

### 8.3 Synchronisation frontend ↔ backend

| Action utilisateur | Frontend (Tauri FS) | Backend (FastAPI) |
|-------------------|---------------------|-------------------|
| Nouvelle conversation | Crée fichier + index entry | `POST /api/chat/new` (clear memory) |
| Envoyer message | Ajoute au fichier JSON | `POST /api/chat/stream` (utilise memory existante) |
| Changer de conversation | Charge fichier JSON | `POST /api/chat/restore` (envoie messages) |
| Démarrage app | Charge index + dernière conv. | `POST /api/chat/restore` |
| Supprimer conversation | Supprime fichier + index | `POST /api/chat/new` (si c'était l'active) |
| Feedback | Met à jour message dans fichier | `POST /api/feedback` (existant) |

### 8.4 Stockage fichier (Tauri FS)

```typescript
import { readTextFile, writeTextFile, removeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { appDataDir } from '@tauri-apps/api/path';
import { join } from '@tauri-apps/api/path';

// Emplacement : {app_data_dir}/conversations/
// Nécessite le plugin tauri-plugin-fs (voir 07-BACKEND.md §5)
```

### 8.5 Hook `useConversationTitle` (nouveau)

```typescript
interface UseConversationTitleReturn {
  generateTitle: (firstMessage: string, firstResponse: string) => Promise<string>;
  loading: boolean;
}
```

- Appelle `POST /api/chat/generate-title` (nouvel endpoint, voir 07-BACKEND.md §2.2)
- **Fallback** : Si l'endpoint échoue, tronque le premier message à 50 caractères
- Appelé automatiquement après le premier échange réussi

## 9. Migration depuis l'état actuel

Le `useConversation` actuel :
- Stocke l'historique en React state (mémoire)
- Récupère depuis le backend via `GET /api/chat/history`
- Pas de persistance entre sessions

### Plan de migration

1. **Phase 1** : Créer `useConversations` avec stockage Tauri FS
2. **Phase 2** : Modifier `Chat.tsx` pour utiliser `useConversations` au lieu de `useConversation`
3. **Phase 3** : Ajouter endpoints backend (`restore`, `generate-title`)
4. **Phase 4** : Supprimer l'ancien `useConversation` et les appels à `GET /api/chat/history`

Pas de migration de données nécessaire : les conversations actuelles ne sont pas persistées entre sessions. L'endpoint `GET /api/chat/history` peut être conservé temporairement mais sera déprécié.
