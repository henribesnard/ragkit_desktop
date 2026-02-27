# LOKO - Design System

## 1. Tokens de design

### Espacements

Échelle basée sur 4px :

| Token | Valeur | Usage |
|-------|--------|-------|
| `--space-0` | 0px | Reset |
| `--space-1` | 4px | Espacement interne minimal (padding badges) |
| `--space-2` | 8px | Espacement entre icône et texte |
| `--space-3` | 12px | Padding interne boutons, inputs |
| `--space-4` | 16px | Margin entre éléments de même groupe |
| `--space-5` | 20px | Padding sections |
| `--space-6` | 24px | Gap entre sections |
| `--space-8` | 32px | Margin entre groupes distincts |
| `--space-10` | 40px | Padding zone principale |
| `--space-12` | 48px | Grande séparation |
| `--space-16` | 64px | Marge top/bottom page |

### Coins arrondis

| Token | Valeur | Usage |
|-------|--------|-------|
| `--radius-sm` | 6px | Badges, tags, petits éléments |
| `--radius-md` | 8px | Boutons, inputs, cartes |
| `--radius-lg` | 12px | Modales, panels |
| `--radius-xl` | 16px | Barre de chat, cartes larges |
| `--radius-2xl` | 24px | Bulles de messages |
| `--radius-full` | 9999px | Avatars, bouton d'envoi |

### Ombres

| Token | Valeur | Usage |
|-------|--------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | Éléments surélevés subtils |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)` | Cartes, inputs focus |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)` | Dropdowns, tooltips |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)` | Modales, popovers |

> En dark mode, les ombres sont remplacées par des bordures subtiles (`--border-default`) car les ombres sont invisibles sur fond sombre.

### Transitions

| Token | Valeur | Usage |
|-------|--------|-------|
| `--transition-fast` | `150ms ease-out` | Hover states, toggles |
| `--transition-base` | `200ms ease-out` | Apparition éléments, sidebar |
| `--transition-slow` | `300ms ease-out` | Ouverture panels, modales |
| `--transition-spring` | `400ms cubic-bezier(0.34, 1.56, 0.64, 1)` | Rebond (bouton envoi, notifications) |

## 2. Composants UI

### 2.1 Bouton

#### Variantes

| Variante | Fond | Texte | Bordure | Usage |
|----------|------|-------|---------|-------|
| `primary` | `--primary-500` | `white` | none | Action principale (Envoyer, Sauvegarder) |
| `secondary` | `--bg-tertiary` | `--text-primary` | none | Action secondaire |
| `ghost` | transparent | `--text-secondary` | none | Actions tertiaires, navigation |
| `danger` | `--error` | `white` | none | Suppression, actions destructives |
| `outline` | transparent | `--primary-500` | `--primary-500` | Alternative visible mais non dominante |

#### Tailles

| Taille | Height | Padding H | Font | Usage |
|--------|--------|-----------|------|-------|
| `sm` | 32px | 12px | 13px | Actions inline, sidebar |
| `md` | 36px | 16px | 14px | Standard |
| `lg` | 40px | 20px | 14px | Actions principales |
| `icon` | 32x32px | 0 | - | Boutons icône seule |

#### États

| État | Modification |
|------|-------------|
| Default | Comme défini ci-dessus |
| Hover | `filter: brightness(0.95)` + `--shadow-xs` |
| Active/Pressed | `filter: brightness(0.9)` + `transform: scale(0.98)` |
| Focus | `outline: 2px solid --primary-400` + `outline-offset: 2px` |
| Disabled | `opacity: 0.5` + `cursor: not-allowed` |
| Loading | Texte remplacé par spinner + `cursor: wait` |

### 2.2 Input / Textarea

#### Barre de chat (composant principal)

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Send a message...                          [+] [▲]  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- **Container** : `--bg-tertiary`, `--radius-xl` (16px), `--shadow-sm`
- **Padding** : 16px horizontal, 12px vertical
- **Placeholder** : `--text-tertiary`, `font-style: normal`
- **Texte** : `--text-primary`, `--text-base`
- **Hauteur** : Auto-expandable (min 48px, max 200px)
- **Bouton envoi** : Cercle `--primary-500`, 36px, icône `ArrowUp` blanc
  - Désactivé (grisé) quand le champ est vide
  - Animation `--transition-spring` au hover
- **Bouton pièce jointe** : Cercle `--bg-hover`, 36px, icône `Plus`
- **Focus** : Bordure `--primary-200`, `--shadow-sm`

#### Input standard (settings)

- **Height** : 36px
- **Padding** : 8px 12px
- **Border** : 1px `--border-default`
- **Border-radius** : `--radius-md`
- **Focus** : Border `--primary-500`, ring 2px `--primary-100`

### 2.3 Carte (Card)

```
┌──────────────────────────────┐
│  Titre                       │
│  Description secondaire      │
│                              │
│  Contenu                     │
│                              │
│              [Action]        │
└──────────────────────────────┘
```

- **Fond** : `--bg-primary` (light), `--bg-secondary` (dark)
- **Bordure** : 1px `--border-default`
- **Border-radius** : `--radius-lg`
- **Padding** : `--space-5` (20px)
- **Ombre** : `--shadow-xs` (light mode seulement)
- **Hover (si cliquable)** : `--bg-hover`, `--shadow-sm`

### 2.4 Badge / Tag

| Variante | Fond | Texte | Usage |
|----------|------|-------|-------|
| `default` | `--bg-tertiary` | `--text-secondary` | Métadonnées |
| `success` | `#D1FAE5` | `#065F46` | Connecté, complété |
| `warning` | `#FEF3C7` | `#92400E` | En cours, attention |
| `error` | `#FEE2E2` | `#991B1B` | Erreur, déconnecté |
| `info` | `#DBEAFE` | `#1E40AF` | Information |

- **Padding** : 2px 8px
- **Border-radius** : `--radius-sm`
- **Font** : `--text-xs`, `font-weight: 500`

### 2.5 Toggle / Switch

- **Taille** : 36x20px (track), 16x16px (thumb)
- **Off** : Track `--bg-hover`, thumb blanc
- **On** : Track `--primary-500`, thumb blanc
- **Transition** : `--transition-fast`
- **Focus** : Ring 2px `--primary-100`

### 2.6 Tooltip

- **Fond** : `#1F2937` (light), `#F9FAFB` (dark)
- **Texte** : Blanc (light), `--text-primary` (dark)
- **Padding** : 6px 12px
- **Border-radius** : `--radius-sm`
- **Font** : `--text-xs`
- **Ombre** : `--shadow-md`
- **Délai apparition** : 500ms
- **Animation** : Fade-in `--transition-fast`

### 2.7 Dropdown / Menu contextuel

```
┌──────────────────────┐
│  ✏️ Renommer          │
│  📁 Archiver          │
│  ──────────────────── │
│  🗑️ Supprimer         │
└──────────────────────┘
```

- **Fond** : `--bg-primary`
- **Bordure** : 1px `--border-default`
- **Border-radius** : `--radius-md`
- **Ombre** : `--shadow-lg`
- **Item padding** : 8px 12px
- **Item hover** : `--bg-hover`
- **Item danger** : Texte `--error` au hover
- **Séparateur** : 1px `--border-default`, margin 4px 0

### 2.8 Modal / Dialog

- **Overlay** : `rgba(0,0,0,0.5)` avec backdrop-blur 4px
- **Container** : `--bg-primary`, `--radius-lg`, `--shadow-lg`
- **Largeur** : 400-560px, centré
- **Padding** : 24px
- **Animation** : Scale 0.95→1 + fade-in, `--transition-base`
- **Header** : Titre `--text-lg` + bouton fermer (X)
- **Footer** : Boutons alignés à droite, gap 8px

### 2.9 Skeleton Loader

- **Fond** : `--bg-tertiary`
- **Animation** : Shimmer gradient (gauche→droite), 1.5s loop
- **Border-radius** : Même que l'élément qu'il remplace
- **Usage** : Remplace le contenu pendant le chargement (messages, sidebar items, dashboard cards)

## 3. Layouts

### 3.1 Layout principal

```css
.app-layout {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  height: 100vh;
  overflow: hidden;
}
```

| Variable | Valeur |
|----------|--------|
| `--sidebar-width` | 260px |
| `--sidebar-collapsed-width` | 64px |
| `--chat-max-width` | 768px |
| `--settings-max-width` | 900px |

### 3.2 Zone de chat

```css
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: var(--chat-max-width);
  margin: 0 auto;
  padding: 0 var(--space-5);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-8) 0;
}

.chat-input-wrapper {
  padding: var(--space-4) 0 var(--space-6);
  position: sticky;
  bottom: 0;
}
```

### 3.3 Zone settings/dashboard

```css
.content-container {
  max-width: var(--settings-max-width);
  margin: 0 auto;
  padding: var(--space-8) var(--space-5);
  overflow-y: auto;
  height: 100vh;
}
```

## 4. Responsive et redimensionnement

### Points de rupture (fenêtre Tauri)

| Breakpoint | Largeur | Comportement |
|------------|---------|-------------|
| Compact | < 800px | Sidebar masquée (overlay), chat pleine largeur |
| Standard | 800-1200px | Sidebar visible, chat centré |
| Large | > 1200px | Sidebar visible, chat centré avec marges généreuses |

### Comportement sidebar responsive
- **< 800px** : Sidebar masquée par défaut, accessible via bouton hamburger, apparaît en overlay avec backdrop
- **>= 800px** : Sidebar toujours visible, largeur fixe 260px

## 5. Scrollbar personnalisée

```css
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--border-strong);
}
```

## 6. Animations clés

### Apparition de message chat
```css
@keyframes message-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* Durée: 200ms ease-out */
```

### Typing indicator (3 dots)
```css
@keyframes typing-dot {
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-4px); }
}
/* 3 cercles avec delay: 0ms, 150ms, 300ms */
```

### Skeleton shimmer
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
/* Durée: 1.5s linear infinite */
```

### Sidebar item hover
```css
.sidebar-item {
  transition: background-color var(--transition-fast),
              color var(--transition-fast);
}
```
