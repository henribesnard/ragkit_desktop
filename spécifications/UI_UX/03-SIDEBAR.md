# LOKO - Sidebar & Navigation

## 1. Structure générale

La sidebar est le hub de navigation principal, inspirée d'Ollama. Elle combine navigation, historique des conversations et contrôles globaux.

```
┌─────────────────────────┐
│                         │
│  LOKO                   │  ← Header : Wordmark
│                         │
│  [✏️] Nouvelle conv.     │  ← Action principale
│                         │
│ ─────────────────────── │
│                         │
│  [🔍] Rechercher...      │  ← Recherche conversations (optionnel)
│                         │
│  Aujourd'hui            │  ← Groupe temporel
│   Comment configurer... │
│   Analyse du rapport... │
│                         │
│  Hier                   │
│   Résumé des ventes...  │
│                         │
│  7 derniers jours       │
│   Questions fréquentes  │
│   Comparaison Q1 vs Q2  │
│                         │
│                         │
│                         │
│                         │  ← Zone scrollable
│                         │
│ ─────────────────────── │
│                         │
│  [📊] Tableau de bord    │  ← Navigation secondaire
│  [⚙️] Paramètres         │
│                         │
│ ─────────────────────── │
│                         │
│  [🌐 FR] [🌙]  ● v1.2.18│  ← Footer : Langue, Thème, Status
│                         │
└─────────────────────────┘
```

## 2. Dimensions et positionnement

| Propriété | Valeur |
|-----------|--------|
| Largeur | 260px |
| Position | Fixe, côté gauche |
| Hauteur | 100vh |
| Fond | `--bg-secondary` |
| Bordure droite | 1px `--border-default` |
| z-index | 40 |
| Padding | 12px |

## 3. Sections détaillées

### 3.1 Header (Wordmark)

```
┌─────────────────────────┐
│  LOKO                    │
└─────────────────────────┘
```

- **Texte** : "LOKO", `--text-lg`, `font-weight: 700`, `letter-spacing: 0.05em`
- **Couleur** : `--primary-800` (light) / `--primary-400` (dark)
- **Padding** : 8px 12px
- **Margin-bottom** : 8px
- **Note** : Quand le logo graphique arbre sera prêt, il sera ajouté à gauche du texte (28x28px, gap 10px)

### 3.2 Bouton "Nouvelle conversation"

```
┌─────────────────────────┐
│  [✏️]  Nouvelle conv.     │
└─────────────────────────┘
```

- **Layout** : Flex, align-items center, gap 8px, width 100%
- **Icône** : `SquarePen`, 18px, `--text-secondary`
- **Texte** : `t("sidebar.newChat")`, `--text-sm`, `font-weight: 500`
- **Fond** : transparent
- **Hover** : `--bg-hover`, `--radius-md`
- **Padding** : 8px 12px
- **Height** : 36px
- **Comportement** :
  - Crée une nouvelle conversation vide
  - Redirige vers `/chat` avec un nouvel ID conversation
  - La conversation précédente est automatiquement sauvegardée
- **Raccourci clavier** : `Ctrl+N`

### 3.3 Barre de recherche (conversations)

Visible uniquement quand il y a plus de 5 conversations.

```
┌─────────────────────────┐
│  🔍 Rechercher...        │
└─────────────────────────┘
```

- **Layout** : Input avec icône intégrée à gauche
- **Height** : 32px
- **Fond** : `--bg-tertiary`
- **Border** : none
- **Border-radius** : `--radius-md`
- **Placeholder** : "Rechercher..." / "Search...", `--text-tertiary`
- **Icône** : `Search`, 14px, `--text-tertiary`
- **Padding-left** : 32px (pour l'icône)
- **Margin** : 0 0 8px 0
- **Comportement** : Filtre les conversations en temps réel par titre

### 3.4 Liste des conversations (zone scrollable)

#### Groupes temporels

Les conversations sont regroupées par période :

| Groupe | Condition |
|--------|-----------|
| Aujourd'hui | Même jour |
| Hier | Jour précédent |
| 7 derniers jours | 2-7 jours |
| 30 derniers jours | 8-30 jours |
| Plus ancien | > 30 jours |

**Label de groupe :**
- Texte : `--text-xs`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.05em`
- Couleur : `--text-tertiary`
- Padding : 8px 12px 4px
- Margin-top : 8px (sauf premier groupe)

#### Item de conversation

```
┌─────────────────────────────┐
│  Comment configurer le pi...│
│                       [...] │
└─────────────────────────────┘
```

**État normal :**
- **Padding** : 8px 12px
- **Border-radius** : `--radius-md`
- **Fond** : transparent
- **Texte** : `--text-sm`, `--text-primary`, truncate (1 ligne, ellipsis)
- **Cursor** : pointer

**État hover :**
- **Fond** : `--bg-hover`
- **Bouton menu** : Apparaît (icône `MoreHorizontal`, 16px, `--text-tertiary`)
  - Position : Droite, centré verticalement
  - Ce bouton est masqué par défaut, visible au hover

**État actif (conversation courante) :**
- **Fond** : `--bg-hover`
- **Texte** : `--text-primary`, `font-weight: 500`
- **Bordure gauche** : 2px `--primary-500` (indicateur visuel)

**État édition (renommage) :**
- Le texte devient un input inline
- Focus automatique, sélection complète
- Entrée pour valider, Escape pour annuler

#### Menu contextuel de conversation

Apparaît au clic sur `[...]` ou au clic droit :

```
┌──────────────────────┐
│  ✏️ Renommer          │
│  📁 Archiver          │
│  ──────────────────── │
│  🗑️ Supprimer         │
└──────────────────────┘
```

| Action | Icône | Comportement |
|--------|-------|-------------|
| Renommer | `Pencil` | Passage en mode édition inline |
| Archiver | `Archive` | Déplace dans "Archives" (masqué de la liste, récupérable) |
| Supprimer | `Trash2` | Dialog de confirmation → suppression définitive |

**Dialog de confirmation (suppression) :**
```
┌─────────────────────────────────────┐
│  Supprimer la conversation ?        │
│                                     │
│  Cette action est irréversible.     │
│  La conversation "Comment config..."│
│  sera définitivement supprimée.     │
│                                     │
│           [Annuler]  [Supprimer]    │
└─────────────────────────────────────┘
```

### 3.5 Navigation secondaire

Séparée de l'historique par un trait fin.

```
│ ─────────────────────── │
│  [📊] Tableau de bord    │
│  [⚙️] Paramètres         │
│ ─────────────────────── │
```

- **Layout** : Identique aux items de conversation
- **Icônes** : `LayoutDashboard`, `Settings`, 18px
- **Texte** : `--text-sm`, `--text-secondary`
- **Hover** : `--bg-hover`, texte `--text-primary`
- **Actif** : Fond `--bg-hover`, texte `--primary-500`, icône `--primary-500`
- **Séparateur** : 1px `--border-default`, margin 8px 12px

### 3.6 Footer

```
┌─────────────────────────┐
│  [FR ▾]  [🌙]  ● v1.2.18│
└─────────────────────────┘
```

**Layout** : Flex, justify-content space-between, align-items center

#### Sélecteur de langue
- **Type** : Bouton texte avec dropdown
- **Affichage** : Code langue actuelle ("FR" / "EN")
- **Taille** : `--text-xs`, `font-weight: 500`
- **Dropdown** : Liste des langues disponibles

#### Toggle thème
- **Type** : Bouton icône
- **Icônes** : `Moon` (pour passer en dark), `Sun` (pour passer en light)
- **Taille** : 16px
- **Couleur** : `--text-tertiary`
- **Hover** : `--text-primary`

#### Indicateur backend
- **Pastille** : Cercle 8px
  - Vert (`--success`) : Connecté
  - Rouge (`--error`) : Déconnecté
  - Orange (`--warning`) : Connexion en cours
- **Version** : `--text-xs`, `--text-tertiary`, affiché à côté de la pastille
- **Tooltip au survol** : "Backend connecté" / "Backend déconnecté"

## 4. Comportements

### 4.1 Création de conversation

1. Utilisateur clique "Nouvelle conversation" (ou `Ctrl+N`)
2. Conversation actuelle sauvegardée automatiquement
3. Nouvelle conversation créée avec ID unique
4. Redirection vers `/chat` avec conversation vide
5. Le titre sera automatiquement généré à partir du premier message envoyé
6. La nouvelle conversation apparaît dans "Aujourd'hui"

### 4.2 Navigation entre conversations

1. Clic sur une conversation dans la liste
2. Chargement des messages de cette conversation
3. L'item devient "actif" visuellement
4. Scroll automatique vers le dernier message
5. Le champ de saisie reçoit le focus

### 4.3 Titre automatique des conversations

- **Génération** : Après le premier échange (question + réponse), le LLM génère un titre court (max 50 caractères)
- **Fallback** : Si le LLM n'est pas disponible, utiliser les 50 premiers caractères du premier message utilisateur
- **Renommage** : L'utilisateur peut toujours renommer manuellement via le menu contextuel

### 4.4 Scroll de la liste

- Zone de conversations : `overflow-y: auto`
- Scrollbar fine (6px) et discrète
- Les groupes temporels sont "sticky" (restent visibles en haut pendant le scroll)

### 4.5 Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl+N` | Nouvelle conversation |
| `Ctrl+Shift+S` | Ouvrir paramètres |
| `Ctrl+Shift+D` | Ouvrir tableau de bord |
| `Ctrl+K` | Focus recherche conversations |
| `↑/↓` dans la recherche | Naviguer dans les résultats |
| `Enter` dans la recherche | Ouvrir la conversation sélectionnée |
| `Escape` | Fermer recherche / menu contextuel |

## 5. Données (structure TypeScript)

```typescript
// === Types alignés sur les data structures backend ===

// Source RAG (identique à ChatSource backend)
interface ChatSource {
  id: number;
  chunk_id: string;
  title: string;                   // Nom du document
  path: string | null;             // Chemin fichier
  page: number | null;             // Numéro de page
  score: number;                   // Score de pertinence
  text_preview: string;            // Extrait du passage
}

// Message dans une conversation (aligné sur ConversationMessageDTO backend)
interface ConversationMessage {
  id: string;                      // UUID frontend (pour React keys)
  role: "user" | "assistant";
  content: string;                 // Texte (Markdown pour assistant)
  timestamp: string;               // ISO 8601
  intent?: string | null;          // Intent détecté (user messages)
  sources?: ChatSource[] | null;   // Sources RAG (assistant seulement)
  query_log_id?: string | null;    // UUID pour feedback/tracking
  feedback?: "positive" | "negative" | null;
  metadata?: MessageMetadata | null; // Debug info (si mode debug actif)
}

// Métadonnées debug (optionnel, stocké si mode debug actif)
interface MessageMetadata {
  searchMode: "semantic" | "lexical" | "hybrid";
  topK?: number;
  latencyMs?: number;
  tokensUsed?: number;
  rewrittenQuery?: string | null;
  needsRag?: boolean;
}

// Conversation complète (stockée dans conversations/{id}.json)
interface Conversation {
  id: string;                      // UUID
  title: string;                   // Titre généré ou personnalisé
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601 (dernier message)
  searchMode: "semantic" | "lexical" | "hybrid";
  messages: ConversationMessage[];
}

// Item léger pour la sidebar (stocké dans index.json)
interface ConversationListItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  archived: boolean;
  searchMode: "semantic" | "lexical" | "hybrid";
}

type TemporalGroup = "today" | "yesterday" | "last7days" | "last30days" | "older";
```

> **Note** : Ces interfaces sont alignées sur les types backend (`ChatSource`, `ConversationMessageDTO`, `OrchestratedChatResponse`). Voir [07-BACKEND.md](07-BACKEND.md) pour les détails du flux de données.

## 6. Stockage

Les conversations sont stockées localement :
- **Format** : JSON
- **Emplacement** : `app_data_dir/conversations/`
- **Index** : `conversations/index.json` (liste légère pour la sidebar)
- **Détail** : `conversations/{id}.json` (messages complets, chargé à la demande)

```
conversations/
├── index.json          // [{id, title, updatedAt, archived}, ...]
├── conv-abc123.json    // Messages complets conversation 1
├── conv-def456.json    // Messages complets conversation 2
└── ...
```

Cela permet un chargement rapide de la sidebar (index seulement) et un chargement lazy des messages au clic.
