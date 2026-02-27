# LOKO - Refonte UI/UX : Vue d'ensemble

## Contexte

RAGKIT Desktop est une application de bureau (Tauri v2 + React + FastAPI) permettant de créer un pipeline RAG (Retrieval-Augmented Generation) local. L'application est fonctionnelle mais son interface nécessite une refonte professionnelle.

**L'application change d'identité publique :**
- **Nom projet** : RAGKIT (interne, code, repo)
- **Nom application** : **LOKO** (installateur, titre fenêtre, branding visible)
- **Logo** : Texte "LOKO" stylisé (logo graphique arbre à produire ultérieurement via outil de design dédié)

## Philosophie de design

Inspirée par Ollama, l'interface LOKO adopte une approche **minimaliste et centrée sur le chat** :

1. **Le chat est le coeur** - L'écran principal est toujours le chat, centré et épuré
2. **Sidebar discrète** - Navigation latérale fine, non intrusive
3. **Historique accessible** - Les conversations passées sont dans la sidebar
4. **Configuration progressive** - Le wizard reste le point d'entrée initial, puis les paramètres sont accessibles via la sidebar
5. **Information à la demande** - Le tableau de bord et les paramètres avancés sont accessibles mais ne polluent pas l'expérience chat

## Architecture des pages

```
┌─────────────────────────────────────────────────────┐
│  LOKO                                               │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ SIDEBAR  │          ZONE PRINCIPALE                 │
│          │                                          │
│ [Logo]   │   ┌──────────────────────────┐          │
│          │   │                          │          │
│ + Nouv.  │   │     PAGE DE CHAT         │          │
│   conv.  │   │     (centrée, max 768px) │          │
│          │   │                          │          │
│ ──────── │   │     ou DASHBOARD         │          │
│          │   │     ou SETTINGS          │          │
│ Historiq │   │                          │          │
│  conv 1  │   └──────────────────────────┘          │
│  conv 2  │                                          │
│  conv 3  │                                          │
│          │                                          │
│ ──────── │                                          │
│          │                                          │
│ Tableau  │                                          │
│ de bord  │                                          │
│          │                                          │
│ Paramèt. │                                          │
│          │                                          │
│ ──────── │                                          │
│ FR|EN 🌙 │                                          │
├──────────┴──────────────────────────────────────────┤
│  Backend: ● Connecté    v1.2.18                     │
└─────────────────────────────────────────────────────┘
```

## Documents de spécification

| Document | Contenu |
|----------|---------|
| [01-BRANDING.md](01-BRANDING.md) | Identité visuelle, logo, palette, typographie |
| [02-DESIGN-SYSTEM.md](02-DESIGN-SYSTEM.md) | Composants UI, tokens, espacements, animations |
| [03-SIDEBAR.md](03-SIDEBAR.md) | Barre latérale, navigation, historique |
| [04-CHAT.md](04-CHAT.md) | Interface de chat principale |
| [05-CONVERSATIONS.md](05-CONVERSATIONS.md) | Gestion de l'historique des conversations |
| [06-DASHBOARD-SETTINGS.md](06-DASHBOARD-SETTINGS.md) | Tableau de bord et paramètres |
| [07-BACKEND.md](07-BACKEND.md) | Modifications backend pour les conversations multi |

## Logo

Le logo graphique (arbre) sera produit ultérieurement avec un outil de design dédié. En attendant, l'identité visuelle repose sur le **wordmark "LOKO"** en texte stylisé (`font-weight: 700`, `letter-spacing: 0.05em`, couleur `--primary-800`).

## Principes directeurs

### 1. Minimalisme
- Chaque élément à l'écran doit justifier sa présence
- Espaces blancs généreux
- Pas de bordures inutiles, utiliser l'espacement et les ombres subtiles

### 2. Hiérarchie visuelle claire
- Le champ de saisie du chat est toujours le point focal
- Les actions secondaires sont visuellement atténuées
- L'information contextuelle apparaît au survol ou à la demande

### 3. Cohérence
- Même langage visuel partout (coins arrondis, ombres, transitions)
- Comportements prévisibles (hover, focus, active states)
- Dark/Light mode complet et homogène

### 4. Performance perçue
- Transitions fluides (200ms ease-out)
- Feedback immédiat sur chaque action
- Skeleton loaders plutôt que spinners

### 5. Accessibilité
- Contraste WCAG AA minimum (4.5:1 texte, 3:1 grands éléments)
- Navigation clavier complète
- Labels ARIA sur les éléments interactifs
- Focus visible sur tous les éléments focusables

## Changements majeurs vs. état actuel

| Aspect | Avant (RAGKIT) | Après (LOKO) |
|--------|----------------|--------------|
| Nom | RAGKIT Desktop | LOKO |
| Logo | Lettre "R" carrée noire | Wordmark "LOKO" (logo arbre à venir) |
| Sidebar | Nav simple (3 items) | Nav + historique conversations |
| Chat | Pleine largeur, contrôles visibles | Centré (max 768px), minimaliste |
| Conversations | Pas d'historique sidebar | Liste avec titre, date, actions |
| Dashboard | Page séparée | Accessible via sidebar |
| Settings | Page séparée | Accessible via sidebar |
| Empty state | Icône + texte | Wordmark "LOKO" + message accueillant |
| Couleur primaire | Bleu (#3b82f6) | Vert émeraude (#10B981) |
