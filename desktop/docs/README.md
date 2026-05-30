# Documentation

Bienvenue dans la documentation du projet RAGKit Desktop.

## 📚 Contenu

### Design System
- **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** - Documentation complète du design system LOKO
  - Couleurs et tokens
  - Typographie
  - Composants UI
  - Guidelines d'utilisation
  - Exemples de code

### Page de Démonstration
- **[DesignSystem.tsx](../src/pages/DesignSystem.tsx)** - Page interactive de démonstration
  - Galerie visuelle de tous les composants
  - Exemples live et interactifs
  - Référence rapide pour les développeurs

## 🚀 Accéder à la Démo

Pour voir la page de démonstration du design system en action:

1. Ajouter la route dans `App.tsx`:
   ```tsx
   import { DesignSystem } from "@/pages/DesignSystem";

   // Dans le Router:
   <Route path="/design" element={<DesignSystem />} />
   ```

2. Lancer l'application:
   ```bash
   npm run tauri dev
   ```

3. Naviguer vers: `http://localhost:1420/design`

## 📖 Guide Rapide

### Utiliser les Couleurs

```tsx
// ✅ Bon - Utiliser les tokens CSS
<div style={{ color: "var(--text-2)" }}>Texte secondaire</div>

// ❌ Mauvais - Hardcoder les couleurs
<div style={{ color: "#586560" }}>Texte secondaire</div>
```

### Utiliser les Composants

```tsx
// Boutons
import { Button } from "@/components/ui/Button";
<button className="btn btn-primary">Sauvegarder</button>

// Toggle
import { Toggle } from "@/components/ui/Toggle";
<Toggle checked={value} onChange={setValue} label="Option" />

// Slider
import { Slider } from "@/components/ui/Slider";
<Slider value={val} min={0} max={100} onChange={setVal} />
```

### Créer des Cards

```tsx
// Card standard
<div className="loko-card" style={{ padding: 24 }}>
  Contenu
</div>

// Card sélectionnable
<button className={`loko-card-select ${active ? 'active' : ''}`}>
  <div className="loko-card-icon">
    <Icon size={22} />
  </div>
  <div>Titre</div>
  <div>Description</div>
</button>
```

## 🎨 Ressources

- **Fonts**: [`../src/assets/fonts/`](../src/assets/fonts/)
  - Geist-Variable.woff2
  - GeistMono-Variable.woff2

- **CSS Principal**: [`../src/index.css`](../src/index.css)
  - Tous les tokens et variables CSS
  - Classes de composants
  - Animations

- **Composants Brand**: [`../src/components/brand/`](../src/components/brand/)
  - LokoGlyph.tsx (logo avec variantes)
  - Wordmark.tsx (lockup logo + texte)

- **Composants UI**: [`../src/components/ui/`](../src/components/ui/)
  - Toggle.tsx
  - Slider.tsx
  - Button.tsx
  - etc.

## 🔗 Liens Utiles

- [Tauri Documentation](https://tauri.app)
- [React Documentation](https://react.dev)
- [TailwindCSS Documentation](https://tailwindcss.com)
- [Geist Font](https://vercel.com/font)

## 📝 Contribution

Lors de l'ajout de nouveaux composants:

1. **Respecter le design system** - Utiliser les tokens CSS existants
2. **Documenter** - Ajouter des exemples dans DESIGN_SYSTEM.md
3. **Tester** - Vérifier en light et dark mode
4. **Accessibilité** - Support clavier et ARIA labels

## 📜 Changelog

Voir [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md#changelog) pour l'historique des changements.
