# LOKO - Identité visuelle & Branding

## 1. Nom et positionnement

### Nom
- **Application** : LOKO
- **Projet interne** : RAGKIT
- **Tagline** : "Your local knowledge, organized." / "Votre savoir local, organisé."

### Positionnement
LOKO est un assistant de recherche intelligent qui organise et exploite vos documents locaux.

## 2. Logo

### État actuel : Wordmark texte
Le logo graphique (arbre stylisé) sera produit ultérieurement avec un outil de design dédié (Figma, Illustrator, etc.). En attendant, l'identité visuelle repose uniquement sur le **wordmark texte "LOKO"**.

### Wordmark (sidebar)
```
LOKO
```
- "LOKO" en `font-weight: 700`, `font-size: 20px`, `letter-spacing: 0.05em`
- Couleur : `--primary-800` (light mode) / `--primary-400` (dark mode)

### Logo graphique (à produire)
Quand le logo arbre sera prêt, il sera décliné en :

| Variante | Taille | Usage |
|----------|--------|-------|
| Principal | 512x512 | Splash screen, about, installateur |
| Compact | 64x64 | Sidebar (à gauche du wordmark), favicon, system tray |
| Monochrome | 64x64 | Fond sombre, loading |

Pour le moment, les icônes système (favicon, tray, exe) restent celles par défaut de Tauri ou un simple "L" stylisé.

## 3. Palette de couleurs

### Couleurs principales

#### Vert émeraude (Primary)
Remplace le bleu actuel. Évoque la nature, la croissance, la connaissance.

| Token | Hex | Usage |
|-------|-----|-------|
| `--primary-50` | `#ECFDF5` | Fond survol léger |
| `--primary-100` | `#D1FAE5` | Fond sélection, badges |
| `--primary-200` | `#A7F3D0` | Bordures actives |
| `--primary-300` | `#6EE7B7` | Icônes secondaires |
| `--primary-400` | `#34D399` | Indicateurs, accents |
| `--primary-500` | `#10B981` | **Couleur principale** (boutons, liens) |
| `--primary-600` | `#059669` | Boutons hover |
| `--primary-700` | `#047857` | Boutons pressed |
| `--primary-800` | `#065F46` | Texte sur fond clair |
| `--primary-900` | `#064E3B` | Texte emphase maximale |

#### Neutres (Gris)

| Token | Light mode | Dark mode | Usage |
|-------|------------|-----------|-------|
| `--bg-primary` | `#FFFFFF` | `#0F0F0F` | Fond page principal |
| `--bg-secondary` | `#F9FAFB` | `#171717` | Fond sidebar, cartes |
| `--bg-tertiary` | `#F3F4F6` | `#1F1F1F` | Fond inputs, survol |
| `--bg-hover` | `#E5E7EB` | `#2A2A2A` | Survol items |
| `--border-default` | `#E5E7EB` | `#2A2A2A` | Bordures subtiles |
| `--border-strong` | `#D1D5DB` | `#404040` | Bordures visibles |
| `--text-primary` | `#111827` | `#F9FAFB` | Texte principal |
| `--text-secondary` | `#6B7280` | `#9CA3AF` | Texte secondaire |
| `--text-tertiary` | `#9CA3AF` | `#6B7280` | Texte désactivé, hints |

#### Sémantiques

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#10B981` | Succès, connecté, complété |
| `--warning` | `#F59E0B` | Avertissement, en cours |
| `--error` | `#EF4444` | Erreur, déconnecté |
| `--info` | `#3B82F6` | Information, aide |

### Dégradés

```css
/* Header/Hero gradient */
--gradient-hero: linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%);

/* Subtle background gradient */
--gradient-subtle: linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);

/* Button hover gradient */
--gradient-button: linear-gradient(135deg, #059669 0%, #047857 100%);
```

## 4. Typographie

### Police système
Conserver l'approche système pour la performance et la cohérence native :

```css
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
--font-mono: "SF Mono", "Cascadia Code", "Fira Code", Consolas,
             "Liberation Mono", monospace;
```

### Échelle typographique

| Token | Taille | Line-height | Poids | Usage |
|-------|--------|-------------|-------|-------|
| `--text-xs` | 11px | 16px | 400 | Labels, badges, timestamps |
| `--text-sm` | 13px | 20px | 400 | Texte secondaire, navigation |
| `--text-base` | 14px | 22px | 400 | Texte courant, messages chat |
| `--text-md` | 15px | 24px | 500 | Titres de section |
| `--text-lg` | 18px | 28px | 600 | Titres de page |
| `--text-xl` | 24px | 32px | 700 | Titre principal, empty states |
| `--text-2xl` | 30px | 36px | 700 | Splash screen, héro |

### Règles typographiques
- **Messages utilisateur** : `--text-base`, `--font-sans`, `font-weight: 400`
- **Messages assistant** : `--text-base`, `--font-sans`, `font-weight: 400`, avec Markdown rendu
- **Code dans les messages** : `--font-mono`, `--text-sm`, fond `--bg-tertiary`
- **Titres conversations** : `--text-sm`, `font-weight: 500`, truncate à 1 ligne
- **Timestamps** : `--text-xs`, `--text-tertiary`

## 5. Iconographie

### Bibliothèque
Continuer avec **Lucide React** (déjà utilisé) pour la cohérence.

### Tailles standards

| Contexte | Taille | Stroke width |
|----------|--------|-------------|
| Navigation sidebar | 20px | 1.5px |
| Actions inline | 16px | 1.5px |
| Empty states | 48px | 1px |
| Boutons icon-only | 18px | 1.5px |

### Icônes clés

| Élément | Icône Lucide | Nom |
|---------|-------------|-----|
| Nouvelle conversation | `SquarePen` | square-pen |
| Paramètres | `Settings` | settings |
| Tableau de bord | `LayoutDashboard` | layout-dashboard |
| Supprimer conversation | `Trash2` | trash-2 |
| Archiver conversation | `Archive` | archive |
| Recherche conversations | `Search` | search |
| Envoyer message | `ArrowUp` | arrow-up (dans cercle) |
| Pièce jointe | `Plus` | plus (dans cercle) |
| Menu conversation | `MoreHorizontal` | more-horizontal |
| Thème sombre | `Moon` | moon |
| Thème clair | `Sun` | sun |
| Langue | `Globe` | globe |
| Backend connecté | `Circle` (filled) | circle |
| Copier message | `Copy` | copy |
| Régénérer | `RefreshCw` | refresh-cw |

## 6. Identifiants techniques à mettre à jour

| Fichier | Champ | Avant | Après |
|---------|-------|-------|-------|
| `tauri.conf.json` | `productName` | `RAGKIT` | `LOKO` |
| `tauri.conf.json` | `title` | `RAGKIT Desktop` | `LOKO` |
| `tauri.conf.json` | `identifier` | `com.henribesnard.ragkit` | `com.henribesnard.loko` |
| `package.json` | `name` | `ragkit-desktop` | `loko` |
| `locales/fr.json` | `app.name` | `RAGKIT` | `LOKO` |
| `locales/en.json` | `app.name` | `RAGKIT` | `LOKO` |
| `Cargo.toml` | `name` (optionnel) | `ragkit-desktop` | Garder ragkit (interne) |
| `main.py` | `APP_NAME` | `RAGKIT` | `LOKO` |
| Sidebar | Logo + texte | "R" + RAGKIT | Wordmark "LOKO" |
| Installateur | Nom | RAGKIT Desktop Setup | LOKO Setup |
| Barre de titre | Titre fenêtre | RAGKIT Desktop | LOKO |

## 7. Favicon et icônes système

À produire quand le logo graphique sera prêt. Formats requis :

| Format | Taille | Usage |
|--------|--------|-------|
| `icon.ico` | Multi (16, 32, 48, 256) | Windows favicon + exe icon |
| `icon.png` | 512x512 | macOS app icon base |
| `32x32.png` | 32x32 | System tray |
| `128x128.png` | 128x128 | macOS dock, Windows taskbar |
| `128x128@2x.png` | 256x256 | macOS Retina |

Emplacement : `desktop/src-tauri/icons/`

En attendant, conserver les icônes Tauri par défaut.
