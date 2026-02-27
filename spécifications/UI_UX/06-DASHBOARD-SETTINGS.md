# LOKO - Dashboard & Paramètres

## 1. Tableau de bord (Dashboard)

### 1.1 Accès

- Via la sidebar : icône `LayoutDashboard` + "Tableau de bord"
- Route : `/dashboard`
- Remplace la zone de chat quand actif

### 1.2 Layout

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Tableau de bord                                     │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Backend  │  │ Ingestion│  │ Documents│          │
│  │ ● En     │  │ ✓ Prêt   │  │ 128      │          │
│  │ ligne    │  │          │  │ fichiers │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                      │
│  ┌─────────────────────────────────────┐             │
│  │ Métriques de recherche              │             │
│  │                                     │             │
│  │ Requêtes (7j) : 342                │             │
│  │ Latence moy.  : 230ms              │             │
│  │ Score moyen   : 0.78               │             │
│  │ Feedback +    : 85%                │             │
│  └─────────────────────────────────────┘             │
│                                                      │
│  ┌─────────────────────────────────────┐             │
│  │ Journal des requêtes                │             │
│  │                                     │             │
│  │ 10:30 "Comment configurer..." 0.89 │             │
│  │ 10:25 "Résumé du rapport..."  0.76 │             │
│  │ 10:20 "Quels sont les..."     0.82 │             │
│  │                     [Voir tout]     │             │
│  └─────────────────────────────────────┘             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 1.3 Spécifications des cartes

**Container** : max-width 900px, centré, padding 32px

#### Carte "Statut" (ligne de 3 cartes)

| Carte | Icône | Valeur | Couleur |
|-------|-------|--------|---------|
| Backend | `Server` | En ligne / Hors ligne | Vert / Rouge |
| Ingestion | `Database` | Prêt / En cours / Non configuré | Vert / Orange / Gris |
| Documents | `FileText` | Nombre de fichiers indexés | `--text-primary` |

- **Layout** : Grid 3 colonnes, gap 16px
- **Carte** : `--bg-secondary`, bordure, `--radius-lg`, padding 20px
- **Icône** : 24px, dans cercle 40px fond `--primary-50`
- **Label** : `--text-xs`, `--text-tertiary`, uppercase
- **Valeur** : `--text-lg`, `font-weight: 600`

#### Carte "Métriques de recherche"

- **Fond** : `--bg-secondary`, `--radius-lg`, padding 20px
- **Titre** : `--text-md`, `font-weight: 600`
- **Métriques** : Grid 2 colonnes
  - Label : `--text-sm`, `--text-secondary`
  - Valeur : `--text-base`, `font-weight: 600`
- **Données** : Issues de `get_dashboard_metrics()` et `get_dashboard_latency()`

#### Carte "Journal des requêtes"

- **Fond** : `--bg-secondary`, `--radius-lg`, padding 20px
- **Titre** : `--text-md`, `font-weight: 600`
- **Liste** : 5 dernières requêtes
  - Heure : `--text-xs`, `--text-tertiary`, 60px largeur fixe
  - Requête : `--text-sm`, `--text-primary`, truncate
  - Score : Badge coloré selon la valeur
- **"Voir tout"** : Lien vers la vue complète du journal
- **Données** : Issues de `get_query_logs()`

### 1.4 Alertes

Si des alertes sont actives (latence élevée, taux d'erreur, etc.), elles apparaissent en bannière au-dessus des cartes :

```
┌──────────────────────────────────────────────────────┐
│  ⚠ Latence moyenne élevée (>500ms) sur les 24h    × │
└──────────────────────────────────────────────────────┘
```

- Fond : `--warning` avec opacity 0.1
- Bordure gauche : 3px `--warning`
- Texte : `--text-sm`
- Bouton fermer : `X` à droite

## 2. Paramètres (Settings)

### 2.1 Accès

- Via la sidebar : icône `Settings` + "Paramètres"
- Route : `/settings`
- Remplace la zone de chat quand actif

### 2.2 Layout

Le layout des paramètres reste proche de l'actuel mais avec le nouveau design system :

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Paramètres                                          │
│                                                      │
│  ┌─────────┬────────────────────────────────┐       │
│  │ Général │                                │       │
│  │ Source  │  [Contenu de la section        │       │
│  │ Chunk.  │   sélectionnée]                │       │
│  │ Embed.  │                                │       │
│  │ Vector  │                                │       │
│  │ Seman.  │                                │       │
│  │ Lexical │                                │       │
│  │ Hybrid  │                                │       │
│  │ Rerank  │                                │       │
│  │ LLM     │                                │       │
│  │ Agents  │                                │       │
│  │ Monit.  │                                │       │
│  │ Sécu.   │                                │       │
│  │         │                                │       │
│  │ Export  │                                │       │
│  │ Niveau  │                                │       │
│  └─────────┴────────────────────────────────┘       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 2.3 Navigation interne

- **Container** : max-width 900px, centré
- **Layout** : Grid 2 colonnes (200px nav + 1fr contenu)
- **Navigation** : Liste verticale d'onglets
  - Item : padding 8px 12px, `--radius-md`
  - Actif : Fond `--bg-hover`, texte `--primary-500`, bordure gauche 2px `--primary-500`
  - Hover : Fond `--bg-hover`
  - Texte : `--text-sm`
  - Icône : 16px à gauche du texte

### 2.4 Section de paramètres (template)

Chaque section suit le même template :

```
┌──────────────────────────────────────┐
│  Titre de la section                 │
│  Description courte de la section    │
│                                      │
│  ┌─────────────────────────────────┐ │
│  │ Label du paramètre       [val] │ │
│  │ Description du paramètre       │ │
│  ├─────────────────────────────────┤ │
│  │ Label du paramètre       [val] │ │
│  │ Description du paramètre       │ │
│  └─────────────────────────────────┘ │
│                                      │
│         [Réinitialiser] [Sauvegarder]│
└──────────────────────────────────────┘
```

- **Titre** : `--text-lg`, `font-weight: 600`
- **Description** : `--text-sm`, `--text-secondary`, margin-bottom 24px
- **Groupe de paramètres** : Carte avec bordure, séparateurs internes
- **Item paramètre** :
  - Label : `--text-sm`, `font-weight: 500`
  - Description : `--text-xs`, `--text-tertiary`
  - Contrôle : Aligné à droite (input, select, toggle, slider)
  - Séparateur entre items : 1px `--border-default`
  - Padding : 12px 16px
- **Boutons footer** :
  - "Réinitialiser" : Bouton `ghost`
  - "Sauvegarder" : Bouton `primary`
  - Position : Bas de la section, aligné à droite, gap 8px

### 2.5 Sections visibles selon niveau d'expertise

Le comportement existant est conservé. Les sections visibles dépendent du niveau d'expertise (Simple, Intermédiaire, Expert) tel que défini dans `lib/visibility.ts`.

### 2.6 Notifications de sauvegarde

Après une sauvegarde réussie :

```
┌──────────────────────────────┐
│  ✓ Paramètres sauvegardés    │
└──────────────────────────────┘
```

- **Type** : Toast notification
- **Position** : Bas-centre de la zone principale
- **Fond** : `--success` avec opacity 0.9
- **Texte** : Blanc, `--text-sm`
- **Durée** : 3 secondes, puis fade-out
- **Animation** : Slide-up + fade-in

## 3. Transitions entre pages

### 3.1 Chat → Dashboard / Settings

- La zone principale fait un crossfade (fade-out page actuelle → fade-in nouvelle page)
- Durée : 150ms
- La sidebar reste statique (pas de transition)
- La conversation active est préservée en mémoire

### 3.2 Dashboard / Settings → Chat

- Même crossfade
- Le chat revient exactement où l'utilisateur l'a laissé
- La position de scroll est restaurée

### 3.3 URL et routing

| Route | Page | Titre fenêtre |
|-------|------|---------------|
| `/chat` | Chat (par défaut) | LOKO |
| `/chat/:id` | Chat avec conversation spécifique | LOKO - {titre conversation} |
| `/dashboard` | Tableau de bord | LOKO - Tableau de bord |
| `/settings` | Paramètres | LOKO - Paramètres |
| `/settings/:section` | Section paramètres spécifique | LOKO - Paramètres |
| `*` | Redirect → `/chat` | LOKO |

## 4. Onboarding / Wizard

### 4.1 Première utilisation

Le wizard d'onboarding existant est conservé. Changements visuels :

- **Logo** : Remplacer le "R" noir par le wordmark "LOKO"
- **Couleur d'accent** : Remplacer le bleu par le vert émeraude
- **Titre** : "Bienvenue sur LOKO" au lieu de "Bienvenue sur RAGKIT"
- **Textes** : Mise à jour des traductions pour utiliser "LOKO"

### 4.2 Après le wizard

Quand le wizard est terminé :
1. Transition fluide vers le layout principal (sidebar + chat)
2. L'empty state du chat affiche le message d'accueil
3. Si l'ingestion a été lancée, la bannière de progression s'affiche
4. Le champ de saisie reçoit le focus automatiquement

## 5. Résumé des changements impactant les fichiers existants

### Fichiers frontend à modifier

| Fichier | Changement |
|---------|-----------|
| `App.tsx` | Ajouter route `/chat/:id`, mettre à jour les titres |
| `Sidebar.tsx` | Refonte complète (historique, nouveau design) |
| `Chat.tsx` | Recentrer, simplifier visuellement, intégrer `useConversations` |
| `Dashboard.tsx` | Appliquer nouveau design system |
| `Settings.tsx` | Appliquer nouveau design system |
| `WizardContainer.tsx` | Mettre à jour le branding |
| `WelcomeStep.tsx` | Nouveau wordmark et textes |
| `useChatStream.ts` | Intégrer `addMessage` au lieu de `refreshHistory` |
| `index.css` | Variables CSS, nouvelle palette |
| `tailwind.config.js` | Couleur primary → emerald |
| `fr.json` / `en.json` | Nouveaux textes (sidebar, conversations, LOKO) |
| `lib/ipc.ts` | Ajouter wrappers `restoreConversation`, `generateConversationTitle` |
| `package.json` | Ajouter `@tauri-apps/plugin-fs` |

### Fichiers backend à modifier

| Fichier | Changement |
|---------|-----------|
| `ragkit/desktop/api/chat.py` | Endpoints `restore` et `generate-title` |
| `ragkit/config/llm_schema.py` | Nouveaux modèles Pydantic |
| `ragkit/agents/memory.py` | Méthode `restore_from_messages()` |
| `desktop/src-tauri/src/commands.rs` | Commandes Tauri `restore_conversation`, `generate_conversation_title` |
| `desktop/src-tauri/src/lib.rs` | Enregistrer nouvelles commandes + plugin FS |
| `desktop/src-tauri/Cargo.toml` | Dépendance `tauri-plugin-fs` |
| `desktop/src-tauri/capabilities/default.json` | Permissions FS |

> Voir [07-BACKEND.md](07-BACKEND.md) pour les détails complets.

### Nouveaux fichiers frontend à créer

| Fichier | Contenu |
|---------|---------|
| `hooks/useConversations.ts` | Gestion CRUD conversations + stockage Tauri FS + sync backend |
| `hooks/useConversationTitle.ts` | Génération auto du titre via endpoint `generate-title` |
| `components/layout/ConversationList.tsx` | Liste des conversations sidebar |
| `components/layout/ConversationItem.tsx` | Item de conversation avec menu |
| `components/layout/ConversationSearch.tsx` | Barre de recherche conversations |
| `components/chat/EmptyState.tsx` | Nouvel empty state avec wordmark LOKO |
| `components/chat/TypingIndicator.tsx` | Indicateur 3 points animé |
| `components/chat/ScrollToBottom.tsx` | Bouton scroll vers le bas |
| `components/ui/Toast.tsx` | Composant de notification toast |
| `components/ui/ContextMenu.tsx` | Menu contextuel réutilisable |
| `components/ui/ConfirmDialog.tsx` | Dialog de confirmation réutilisable |

### Fichiers à déprécier (après migration)

| Fichier | Raison |
|---------|--------|
| `hooks/useConversation.ts` | Remplacé par `useConversations.ts` |

L'endpoint `GET /api/chat/history` reste fonctionnel mais ne sera plus appelé par le frontend.
