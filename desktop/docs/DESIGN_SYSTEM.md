# LOKO Design System

> **Version**: 1.4.44
> **Dernière mise à jour**: 2026-05-30
> **Direction visuelle**: "Coffre" (Sovereign Teal)

---

## 📋 Table des Matières

1. [Introduction](#introduction)
2. [Couleurs](#couleurs)
3. [Typographie](#typographie)
4. [Composants](#composants)
5. [Tokens CSS](#tokens-css)
6. [Guidelines d'utilisation](#guidelines-dutilisation)
7. [Exemples](#exemples)

---

## Introduction

Le design system **LOKO** est conçu pour une application RAG locale, privée et souveraine. Il met l'accent sur:

- 🔒 **Sécurité visuelle**: Métaphore du coffre-fort avec logo en forme de serrure
- 🌿 **Vert souverain**: Palette teal/émeraude évoquant la confiance et l'autonomie
- 🎨 **Light & Dark**: Support complet des deux thèmes
- ⚡ **Performance**: Fonts bundlées localement (Geist), CSS optimisé
- ♿ **Accessibilité**: Contraste WCAG AA, navigation clavier

---

## Couleurs

### Brand Scale (Sovereign Teal)

Palette principale du vert souverain, utilisée pour les accents et éléments interactifs.

| Token | Hex | Usage |
|-------|-----|-------|
| `--brand-50` | `#E7F4EF` | Backgrounds faibles, badges |
| `--brand-100` | `#C7E8DC` | Backgrounds légers |
| `--brand-200` | `#93D3BE` | Hover states subtils |
| `--brand-300` | `#58B89C` | Accents secondaires |
| `--brand-400` | `#239C7C` | Accents forts |
| `--brand-500` | `#0F7D63` | **Couleur principale** (light mode) |
| `--brand-600` | `#0B6450` | Hover/pressed (light mode) |
| `--brand-700` | `#0A5142` | Accents profonds |
| `--brand-800` | `#093F34` | Accents très profonds |

### Light Theme

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#F4F6F4` | Arrière-plan principal |
| `--surface` | `#FFFFFF` | Cartes, panneaux, surfaces élevées |
| `--surface-2` | `#EEF1EE` | Surfaces secondaires, hover |
| `--surface-3` | `#E6EAE6` | Surfaces tertiaires |
| `--border` | `#E2E7E2` | Bordures standard |
| `--border-strong` | `#CFD6CF` | Bordures fortes, séparateurs |
| `--text` | `#15201C` | Texte principal |
| `--text-2` | `#586560` | Texte secondaire |
| `--text-3` | `#8B958F` | Texte tertiaire, placeholders |
| `--brand` | `var(--brand-500)` | Accent (alias) |
| `--brand-hover` | `var(--brand-600)` | Accent hover |
| `--brand-fg` | `#FFFFFF` | Texte sur fond brand |
| `--brand-weak` | `var(--brand-50)` | Background brand faible |
| `--code-bg` | `#F2F5F2` | Background code blocks |

### Dark Theme

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#0B100E` | Arrière-plan principal |
| `--surface` | `#131A17` | Cartes, panneaux |
| `--surface-2` | `#19221E` | Surfaces secondaires |
| `--surface-3` | `#202B27` | Surfaces tertiaires |
| `--border` | `#26322D` | Bordures standard |
| `--border-strong` | `#36453F` | Bordures fortes |
| `--text` | `#E9EEEB` | Texte principal |
| `--text-2` | `#9AA6A0` | Texte secondaire |
| `--text-3` | `#69736E` | Texte tertiaire |
| `--brand` | `#2FC39E` | Accent (plus lumineux) |
| `--brand-hover` | `#44D2AE` | Accent hover |
| `--brand-fg` | `#042019` | Texte sur fond brand (sombre) |
| `--brand-weak` | `rgba(47,195,158,.12)` | Background brand faible |
| `--code-bg` | `#101714` | Background code blocks |

### Semantic Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--success` | `#0F7D63` | `#2FC39E` | Succès (alias brand) |
| `--warning` | `#B7791F` | `#E0A93B` | Avertissements |
| `--warn-bg` | `#FBEFD6` | `rgba(224,169,59,.14)` | Background warnings |
| `--danger` | `#C0432F` | `#E0705C` | Erreurs, actions destructives |
| `--danger-bg` | `#F8E4DF` | `rgba(224,112,92,.14)` | Background errors |
| `--info` | `#2563A8` | `#6FB0E8` | Informations |

---

## Typographie

### Fonts

**Geist** (Sans-serif) et **Geist Mono** (Monospace) sont bundlées localement.

```css
font-family: var(--font-sans);  /* Geist */
font-family: var(--font-mono);  /* Geist Mono */
```

### Type Scale

| Élément | Size | Weight | Letter-spacing | Line-height |
|---------|------|--------|----------------|-------------|
| **H1** | 26-38px | 600 | -0.025em | 1.2 |
| **H2** | 21-24px | 600 | -0.02em | 1.3 |
| **H3** | 18-19px | 600 | -0.015em | 1.4 |
| **Body** | 14px | 400 | -0.011em | 1.5 |
| **Body large** | 15px | 400 | -0.011em | 1.55 |
| **Small** | 13px | 500 | 0 | 1.45 |
| **Caption** | 12px | 500 | 0 | 1.4 |
| **Mono** | 13px | 400-500 | 0 | 1.5 |

### Exemples

```html
<!-- Heading principal -->
<h1 style="font-size: 26px; font-weight: 600; letter-spacing: -0.025em;">
  Titre principal
</h1>

<!-- Body text -->
<p style="font-size: 14px; color: var(--text-2); line-height: 1.5;">
  Texte de paragraphe standard
</p>

<!-- Mono tag -->
<span class="mono-tag">v1.4.44</span>
```

---

## Composants

### Buttons

#### Variantes

```html
<!-- Primary (action principale) -->
<button class="btn btn-primary">Sauvegarder</button>

<!-- Secondary (action secondaire) -->
<button class="btn btn-secondary">Annuler</button>

<!-- Ghost (action tertiaire) -->
<button class="btn btn-ghost">Aperçu</button>

<!-- Sizes -->
<button class="btn btn-lg btn-primary">Large</button>
<button class="btn btn-primary">Default</button>
<button class="btn btn-sm btn-primary">Small</button>

<!-- Icon button -->
<button class="btn-icon">
  <Icon size={18} />
</button>
```

#### CSS Classes

| Class | Description |
|-------|-------------|
| `.btn` | Base button |
| `.btn-primary` | Accent brand, texte blanc |
| `.btn-secondary` | Background surface, bordure |
| `.btn-ghost` | Transparent, hover subtil |
| `.btn-lg` | Height 44px |
| `.btn-sm` | Height 32px |
| `.btn-icon` | Button carré 38×38px |

---

### Badges

```html
<!-- Brand badge -->
<span class="loko-badge loko-badge-brand">
  <CheckCircle size={14} /> Actif
</span>

<!-- Neutral badge -->
<span class="loko-badge loko-badge-neutral">En attente</span>

<!-- Warning badge -->
<span class="loko-badge loko-badge-warn">Attention</span>

<!-- Mono badge (valeurs techniques) -->
<span class="loko-badge loko-badge-mono">p.142</span>
<span class="mono-tag">512 tokens</span>
```

---

### Cards & Panels

```html
<!-- Card standard -->
<div class="loko-card" style="padding: 20px;">
  Contenu de la carte
</div>

<!-- Panel (sans shadow) -->
<div class="loko-panel" style="padding: 18px;">
  Contenu du panneau
</div>

<!-- Interactive/selectable card -->
<button class="loko-card-select active">
  <div class="loko-card-icon">
    <Icon size={22} />
  </div>
  <div style="font-size: 16px; font-weight: 600;">Titre</div>
  <div style="font-size: 13px; color: var(--text-3);">Description</div>
</button>
```

---

### Inputs & Forms

```html
<!-- Label + Input -->
<label class="field-label">Nom du projet</label>
<input class="input" type="text" placeholder="Entrez un nom" />
<div class="field-hint">Utilisé pour identifier votre configuration</div>

<!-- Textarea -->
<label class="field-label">Description</label>
<textarea class="textarea" rows="4" placeholder="Décrivez votre projet..."></textarea>

<!-- Select -->
<label class="field-label">Modèle</label>
<select class="select">
  <option>GPT-4o</option>
  <option>Claude 3.5 Sonnet</option>
</select>
```

---

### Toggle (Switch)

```tsx
import { Toggle } from "@/components/ui/Toggle";

<Toggle
  checked={enabled}
  onChange={setEnabled}
  label="Activer la fonctionnalité"
/>
```

**CSS**: `.loko-switch`, `.loko-switch.on`

---

### Slider

```tsx
import { Slider } from "@/components/ui/Slider";

<Slider
  value={chunkSize}
  min={128}
  max={2048}
  step={64}
  onChange={setChunkSize}
  label="Taille des chunks"
  formatValue={(v) => `${v} tokens`}
/>
```

**CSS**: `.loko-slider`, `.loko-slider .fill`, `.loko-slider .knob`

---

### Navigation

```html
<!-- Sidebar brand -->
<div class="nav-brand">
  <LokoGlyph size={28} />
  <span class="wm">LOKO</span>
</div>

<!-- Section header -->
<div class="nav-section">Configuration</div>

<!-- Nav item -->
<div class="nav-item active">
  <Icon size={18} />
  <span class="lbl">Chat</span>
  <span class="count">3</span>
</div>

<!-- Status indicator -->
<div class="nav-status">
  <div class="dot" />
  <span>Backend <b>actif</b></span>
</div>
```

---

### Accordion

```html
<div class="acc open">
  <div class="acc-head">
    <div class="ic-box">
      <Icon size={18} />
    </div>
    <div class="t">
      <div class="name">Titre de la section</div>
      <div class="desc">Description courte</div>
    </div>
    <ChevronDown class="chev" size={18} />
  </div>
  <div class="acc-body">
    Contenu de l'accordéon
  </div>
</div>
```

---

### Segmented Control

```html
<div class="segmented">
  <button class="active">Option 1</button>
  <button>Option 2</button>
  <button>Option 3</button>
</div>
```

---

### Steps/Progress

```html
<div class="steps">
  <div class="s done">
    <div class="n">1</div>
    <span>Profil</span>
  </div>
  <div class="bar done" />
  <div class="s active">
    <div class="n">2</div>
    <span>Sources</span>
  </div>
  <div class="bar" />
  <div class="s">
    <div class="n">3</div>
    <span>Configuration</span>
  </div>
</div>
```

---

### Citation Badges

```html
<!-- Inline citation -->
<sup class="cite-sup">1</sup>

<!-- Block citation -->
<button class="cite">
  <div class="num">1</div>
  document.pdf • p.12
</button>
```

---

## Tokens CSS

### Spacing (4px scale)

```css
--space-0: 0px;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### Border Radius

```css
--radius-sm: 6px;   /* Badges, petits éléments */
--radius-md: 8px;   /* Inputs, buttons small */
--radius-lg: 12px;  /* Panels, cards */
--radius-xl: 16px;  /* Cards larges */
--radius-2xl: 24px; /* Modals, overlays */
--radius-full: 9999px; /* Pills, avatars */
```

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(20,40,33,.06), 0 1px 3px rgba(20,40,33,.05);
--shadow-md: 0 2px 6px rgba(20,40,33,.06), 0 8px 24px rgba(20,40,33,.07);
--shadow-pop: 0 8px 28px rgba(20,40,33,.13), 0 0 0 1px rgba(20,40,33,.05);
```

### Transitions

```css
--transition-fast: 150ms ease-out;
--transition-base: 200ms ease-out;
--transition-slow: 300ms ease-out;
--transition-spring: 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Layout

```css
--sidebar-width: 232px;
--sidebar-collapsed-width: 64px;
--chat-max-width: 800px;
--settings-max-width: 1200px;
```

---

## Guidelines d'Utilisation

### ✅ Bonnes Pratiques

1. **Toujours utiliser les tokens CSS** plutôt que des valeurs en dur
   ```tsx
   // ✅ Bon
   <div style={{ color: "var(--text-2)" }}>

   // ❌ Mauvais
   <div style={{ color: "#586560" }}>
   ```

2. **Privilégier les classes CSS** pour les composants réutilisables
   ```tsx
   // ✅ Bon
   <button className="btn btn-primary">

   // ❌ Mauvais (sauf cas spécifique)
   <button style={{ background: "var(--brand)", height: 38 }}>
   ```

3. **Utiliser les composants React** pour Toggle, Slider, etc.
   ```tsx
   // ✅ Bon
   import { Toggle } from "@/components/ui/Toggle";
   <Toggle checked={value} onChange={setValue} />

   // ❌ Mauvais
   <input type="checkbox" />
   ```

4. **Respecter la hiérarchie typographique**
   - H1: Titre principal de page (1 par page max)
   - H2: Sections principales
   - H3: Sous-sections
   - Body: Texte standard
   - Caption: Labels, hints

5. **Dark mode**: Les tokens s'adaptent automatiquement
   - Ne jamais coder de couleurs spécifiques au thème
   - Utiliser `.dark` sur l'élément parent si besoin

### ❌ Anti-Pratiques

1. **Ne pas mélanger Tailwind et LOKO** pour le même composant
   ```tsx
   // ❌ Mauvais
   <button className="btn btn-primary bg-blue-500">
   ```

2. **Ne pas hardcoder les couleurs brand**
   ```tsx
   // ❌ Mauvais
   <div style={{ background: "#0F7D63" }}>

   // ✅ Bon
   <div style={{ background: "var(--brand)" }}>
   ```

3. **Ne pas ignorer l'accessibilité**
   - Toujours ajouter `aria-label` sur les boutons icône
   - Respecter les contrastes (WCAG AA minimum)
   - Support clavier sur les éléments interactifs

---

## Exemples

### Card avec icône et sélection

```tsx
function ProfileCard({ active, onSelect, icon: Icon, title, description }: Props) {
  return (
    <button
      className={cn("loko-card-select", active && "active")}
      onClick={onSelect}
    >
      <div className="loko-card-icon">
        <Icon size={22} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
        {description}
      </div>
    </button>
  );
}
```

### Setting row avec toggle

```tsx
<div className="set-row">
  <div className="meta">
    <div className="k">
      <Shield size={16} />
      Détection PII
    </div>
    <div className="v">
      Anonymise automatiquement les données sensibles
    </div>
  </div>
  <div className="ctl">
    <Toggle checked={piiEnabled} onChange={setPiiEnabled} />
  </div>
</div>
```

### Formulaire complet

```tsx
<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
  <div>
    <label className="field-label">Nom du projet</label>
    <input
      className="input"
      type="text"
      value={name}
      onChange={(e) => setName(e.target.value)}
      placeholder="Mon projet RAG"
    />
    <div className="field-hint">
      Ce nom sera utilisé dans les logs et exports
    </div>
  </div>

  <div>
    <Slider
      value={chunkSize}
      min={128}
      max={2048}
      step={64}
      onChange={setChunkSize}
      label="Taille des chunks"
      formatValue={(v) => `${v} tokens`}
    />
  </div>

  <div className="flex gap-3">
    <button className="btn btn-secondary flex-1">Annuler</button>
    <button className="btn btn-primary flex-1">Sauvegarder</button>
  </div>
</div>
```

---

## Ressources

- **Fichier CSS principal**: [`desktop/src/index.css`](../src/index.css)
- **Composants brand**: [`desktop/src/components/brand/`](../src/components/brand/)
- **Composants UI**: [`desktop/src/components/ui/`](../src/components/ui/)
- **Handoff design**: [`_handoff_tmp/ragkit/project/`](../../_handoff_tmp/ragkit/project/)
- **Fonts**: [`desktop/src/assets/fonts/`](../src/assets/fonts/)

---

## Changelog

### v1.4.44 (2026-05-30)
- ✅ Design system complet à 100%
- ✅ Unification Toggle component avec `.loko-switch`
- ✅ Unification Slider component avec `.loko-slider`
- ✅ Ajout classes `.loko-card-select` et `.loko-card-icon`
- ✅ Documentation complète créée

### v1.4.43
- ✅ Nouveau logo LOKO keyhole
- ✅ Application couleurs brand dans wizard

### v1.4.42
- ✅ Design system LOKO initial
- ✅ Tokens CSS light/dark
- ✅ Composants de base

---

**Maintenu par**: L'équipe RAGKit Desktop
**Licence**: Voir LICENSE à la racine du projet
