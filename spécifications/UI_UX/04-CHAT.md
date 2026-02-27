# LOKO - Interface de Chat

## 1. Vue d'ensemble

Le chat est la page principale de LOKO. Il est centré, épuré, et rappelle les interfaces conversationnelles modernes (Ollama, ChatGPT). L'objectif est de minimiser le bruit visuel pour se concentrer sur la conversation.

## 2. Layout

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                                                          │
│                     [Zone messages]                       │
│                      max-width: 768px                    │
│                      centré horizontalement              │
│                                                          │
│           ┌─ Message utilisateur ──────────────┐         │
│           │  Comment fonctionne le RAG ?        │         │
│           └─────────────────────────────────────┘         │
│                                                          │
│  ┌─ Réponse assistant ──────────────────────────┐        │
│  │  Le RAG (Retrieval-Augmented Generation)...   │        │
│  │                                               │        │
│  │  Sources: [doc1.pdf] [doc2.md]               │        │
│  │                            [👍] [👎] [📋] [🔄]│        │
│  └───────────────────────────────────────────────┘        │
│                                                          │
│                                                          │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Posez une question...                   [+] [▲] │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│              semantic ▾     [Debug]                       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Dimensions

| Élément | Valeur |
|---------|--------|
| Largeur max messages | 768px |
| Largeur max input | 768px |
| Centrage | `margin: 0 auto` |
| Padding horizontal zone | 20px |
| Padding vertical messages | 32px top, 0 bottom |
| Gap entre messages | 24px |
| Padding bottom (sous input) | 24px |

## 3. Empty State (nouvelle conversation)

Quand aucun message n'est présent :

```
                   LOKO

         Posez-moi une question sur vos documents.


   ┌──────────────────────────────────────────────────┐
   │  Posez une question...                   [+] [▲] │
   └──────────────────────────────────────────────────┘
```

- **Wordmark** : "LOKO", `--text-2xl`, `font-weight: 700`, `letter-spacing: 0.05em`, `--primary-800` / `--primary-400` (dark), centré
- **Titre** : `--text-xl`, `--text-primary`, `font-weight: 600`
- **Sous-titre** : `--text-base`, `--text-secondary`
- **Position** : Centré verticalement dans la zone messages (légèrement au-dessus du centre)
- **Animation** : Fade-in subtil au chargement

### Variante : Base non configurée

Si le pipeline RAG n'est pas encore prêt :

```
                   LOKO

            Bienvenue sur LOKO !
      Configurez votre base de connaissances
         pour commencer à poser des questions.

              [Lancer la configuration]
```

- Le bouton redirige vers le wizard ou les paramètres

## 4. Messages

### 4.1 Message utilisateur

```
                          ┌─────────────────────────┐
                          │ Comment fonctionne le    │
                          │ pipeline RAG ?           │
                          └─────────────────────────┘
```

- **Alignement** : Droite
- **Fond** : `--primary-500`
- **Texte** : Blanc, `--text-base`
- **Border-radius** : 20px 20px 4px 20px (coin bas-droit pointu)
- **Padding** : 12px 16px
- **Max-width** : 80% de la zone messages
- **Animation d'entrée** : Slide-up + fade-in, 200ms

### 4.2 Message assistant

```
┌─────────────────────────────────────────────┐
│ Le RAG (Retrieval-Augmented Generation)     │
│ est une technique qui combine la recherche  │
│ d'information dans une base de documents    │
│ avec la génération de texte par un LLM.     │
│                                             │
│ Voici les étapes principales :              │
│ 1. **Indexation** des documents             │
│ 2. **Recherche** des passages pertinents    │
│ 3. **Génération** de la réponse             │
│                                             │
│ Sources:                                    │
│ [📄 guide-rag.pdf] [📄 architecture.md]      │
│                                             │
│                      [👍] [👎] [📋] [🔄]     │
└─────────────────────────────────────────────┘
```

- **Alignement** : Gauche
- **Fond** : `--bg-secondary` (light), `--bg-tertiary` (dark)
- **Bordure** : 1px `--border-default`
- **Texte** : `--text-primary`, `--text-base`
- **Border-radius** : 4px 20px 20px 20px (coin haut-gauche pointu)
- **Padding** : 16px
- **Max-width** : 85% de la zone messages
- **Contenu** : Markdown rendu (gras, italique, listes, code, liens)

#### Rendu Markdown

| Élément | Style |
|---------|-------|
| **Gras** | `font-weight: 600` |
| *Italique* | `font-style: italic` |
| `Code inline` | `--font-mono`, `--text-sm`, fond `--bg-tertiary`, padding 2px 6px, `--radius-sm` |
| Bloc de code | `--font-mono`, `--text-sm`, fond `--bg-tertiary`, padding 16px, `--radius-md`, scrollable |
| Listes | Padding-left 20px, marker `--text-tertiary` |
| Liens | `--primary-500`, underline au hover |

### 4.3 Section Sources (dans message assistant)

Affichée sous le contenu texte quand des sources RAG existent :

```
Sources:
[📄 guide-rag.pdf p.12] [📄 architecture.md §3]
```

- **Label** : "Sources:", `--text-xs`, `--text-tertiary`, `font-weight: 600`, `text-transform: uppercase`
- **Tags source** : Badges cliquables
  - Fond : `--bg-tertiary`
  - Texte : `--text-sm`, `--text-secondary`
  - Icône : `FileText`, 12px
  - Border-radius : `--radius-sm`
  - Hover : `--bg-hover`, `--text-primary`
  - Clic : Ouvre un popover avec le contenu du passage (chunk)

#### Popover de source

```
┌─────────────────────────────────────┐
│  📄 guide-rag.pdf - Page 12         │
│ ─────────────────────────────────── │
│                                     │
│  "Le pipeline RAG se compose de     │
│  trois étapes principales : la      │
│  segmentation du texte en chunks,   │
│  l'indexation vectorielle, et la    │
│  recherche par similarité..."       │
│                                     │
│  Score: 0.89  │  Rank: 1           │
└─────────────────────────────────────┘
```

- Apparaît au clic sur un badge source
- Max-width : 480px
- Max-height : 300px, scrollable
- Fond : `--bg-primary`, `--shadow-lg`

### 4.4 Actions sur message assistant

Ligne d'actions sous le message, visible au hover :

```
[👍] [👎] [📋] [🔄]
```

| Bouton | Icône | Action |
|--------|-------|--------|
| Feedback positif | `ThumbsUp` | Enregistre feedback positif |
| Feedback négatif | `ThumbsDown` | Enregistre feedback négatif |
| Copier | `Copy` | Copie le contenu dans le presse-papier |
| Régénérer | `RefreshCw` | Régénère la réponse |

- **Style** : Boutons ghost, 28x28px, `--text-tertiary`
- **Hover** : `--text-secondary`, fond `--bg-hover`
- **Actif (feedback donné)** : `--primary-500` (positif), `--error` (négatif)
- **Visibilité** : Apparaissent au hover du message (sauf sur mobile : toujours visibles)
- **Position** : Bas-droite du message, gap 4px

### 4.5 Indicateur de génération (streaming)

Pendant que l'assistant génère sa réponse :

```
┌─────────────────────────────────────────────┐
│ Le RAG est une technique qui...             │
│ █                                           │
│                                             │
│                            [■ Arrêter]      │
└─────────────────────────────────────────────┘
```

- **Curseur** : Bloc rectangulaire clignotant (`--primary-500`, animation blink 530ms)
- **Bouton arrêter** : Apparaît pendant la génération
  - Icône `Square` (filled), 12px + texte "Arrêter"
  - Style : Bouton `outline`, `--text-secondary`
  - Hover : `--error`

### 4.6 Typing indicator (avant le premier token)

```
┌───────────────┐
│  ●  ●  ●      │
└───────────────┘
```

- 3 cercles de 6px, `--text-tertiary`
- Animation : bounce séquentiel (voir design system)
- Affiché entre la soumission et le premier token de la réponse

## 5. Zone de saisie

### 5.1 Barre de chat principale

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Posez une question sur vos documents...    [+] [▲]  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- **Container** : `--bg-tertiary`, `--radius-xl` (16px), `--shadow-sm`
- **Width** : 100% (dans le container max 768px)
- **Min-height** : 52px
- **Max-height** : 200px (puis scroll interne)
- **Padding** : 14px 16px
- **Padding-right** : 96px (espace pour les boutons)

#### Textarea
- **Type** : `<textarea>` auto-growing
- **Placeholder** : Adaptatif selon le contexte
  - Normal : "Posez une question sur vos documents..." / "Ask a question about your documents..."
  - Pendant ingestion : "Ingestion en cours... Vous pouvez déjà poser des questions."
  - Non configuré : "Configurez votre base de connaissances d'abord."
- **Font** : `--text-base`, `--font-sans`
- **Couleur** : `--text-primary`
- **Resize** : none (auto-grow gère la hauteur)
- **Focus** : Pas de outline visible sur le textarea, l'outline est sur le container

#### Bouton envoi
- **Position** : Bas-droite du container
- **Forme** : Cercle 36px
- **Fond** : `--primary-500` (actif) / `--bg-hover` (inactif/vide)
- **Icône** : `ArrowUp`, 18px, blanc (actif) / `--text-tertiary` (inactif)
- **Hover (actif)** : `--primary-600`
- **Animation** : `--transition-spring` au hover
- **Désactivé quand** :
  - Champ vide
  - Réponse en cours de génération
  - Backend déconnecté

#### Bouton pièce jointe (futur)
- **Position** : Gauche du bouton envoi
- **Forme** : Cercle 36px, fond transparent
- **Icône** : `Plus`, 18px, `--text-tertiary`
- **Hover** : `--bg-hover`
- **Note** : Pour une future fonctionnalité d'ajout de fichiers inline

#### Soumission
- **Entrée** : `Enter` envoie le message
- **Nouvelle ligne** : `Shift+Enter`
- **Quand désactivé** : Le champ montre un tooltip expliquant pourquoi

### 5.2 Barre d'options (sous la zone de saisie)

Ligne discrète sous le champ de saisie pour les options de recherche :

```
        semantic ▾          [Debug]
```

- **Position** : Sous le container input, centré
- **Espacement** : Padding-top 8px

#### Sélecteur de mode de recherche
- **Type** : Dropdown compact
- **Options** : Sémantique, Lexical, Hybride
- **Style** : Texte `--text-xs`, `--text-tertiary`, pas de bordure
- **Hover** : `--text-secondary`
- **Icône** : Chevron-down 12px

#### Mode Debug
- **Type** : Toggle compact
- **Style** : Texte "Debug", `--text-xs`, `--text-tertiary`
- **Actif** : `--primary-500`
- **Comportement** : Affiche les scores, metadata, et détails techniques dans les messages assistant

## 6. Mode Debug (informations avancées)

Quand activé, les messages assistant affichent des informations supplémentaires :

```
┌─────────────────────────────────────────────┐
│ Le RAG est une technique qui...             │
│                                             │
│ ┌─ Debug ──────────────────────────────────┐│
│ │ Mode: semantic │ Top-K: 5 │ Score: 0.89  ││
│ │ Latency: 230ms │ Tokens: 342             ││
│ │ Intent: question │ Rewritten: false       ││
│ │                                          ││
│ │ Chunks:                                  ││
│ │  #1 guide.pdf p.12  score: 0.89          ││
│ │  #2 arch.md §3      score: 0.76          ││
│ │  #3 faq.txt l.45    score: 0.71          ││
│ └──────────────────────────────────────────┘│
│                                             │
│ Sources: [📄 guide.pdf] [📄 arch.md]         │
│                      [👍] [👎] [📋] [🔄]     │
└─────────────────────────────────────────────┘
```

- **Section Debug** :
  - Fond : `--bg-tertiary`
  - Bordure : 1px dashed `--border-default`
  - Border-radius : `--radius-md`
  - Padding : 12px
  - Font : `--font-mono`, `--text-xs`
  - Collapsible (clic sur "Debug" pour toggle)

## 7. Indicateurs d'état

### 7.1 Bannière d'ingestion

Si une ingestion est en cours, une bannière discrète apparaît en haut de la zone chat :

```
┌──────────────────────────────────────────────────────┐
│  ⟳ Ingestion en cours... 42/128 fichiers (33%)      │
└──────────────────────────────────────────────────────┘
```

- **Position** : Haut de la zone messages, sticky
- **Fond** : `--primary-50` (light) / `--primary-900` avec opacity 0.2 (dark)
- **Texte** : `--text-sm`, `--primary-700` (light) / `--primary-300` (dark)
- **Icône** : `Loader2` (animé rotation), 14px
- **Border-radius** : `--radius-md`
- **Padding** : 8px 16px
- **Margin-bottom** : 16px
- **Peut être fermée** : Bouton X à droite

### 7.2 État "Backend déconnecté"

Overlay discret sur la zone de saisie :

```
┌──────────────────────────────────────────────────────┐
│  ⚠ Backend déconnecté. Reconnexion...        [+] [▲] │
└──────────────────────────────────────────────────────┘
```

- Input désactivé
- Texte placeholder remplacé par le message d'erreur
- Couleur texte : `--warning`
- Bouton envoi grisé

## 8. Scroll et navigation

### Auto-scroll
- Quand un nouveau message apparaît : scroll automatique vers le bas
- Si l'utilisateur a scrollé manuellement vers le haut : **pas d'auto-scroll**
- Un bouton "↓ Nouveaux messages" apparaît en bas quand l'utilisateur a scrollé loin du bas

### Bouton scroll-to-bottom

```
      [↓]
```

- **Position** : Fixe, centré horizontalement, 80px au-dessus de l'input
- **Forme** : Cercle 36px
- **Fond** : `--bg-primary`, `--shadow-md`, bordure 1px `--border-default`
- **Icône** : `ArrowDown`, 16px, `--text-secondary`
- **Hover** : `--shadow-lg`
- **Animation** : Fade-in/out, `--transition-base`
- **Visible quand** : L'utilisateur est à plus de 100px du bas

## 9. Raccourcis clavier (page chat)

| Raccourci | Action |
|-----------|--------|
| `Enter` | Envoyer le message |
| `Shift+Enter` | Nouvelle ligne |
| `Escape` | Arrêter la génération en cours |
| `Ctrl+C` (dans un message) | Copier le message |
| `Ctrl+Shift+C` | Copier le dernier message assistant |
| `/` (quand input vide) | Focus sur le champ de saisie |
