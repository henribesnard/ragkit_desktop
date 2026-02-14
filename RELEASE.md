# Procédure de release RAGKIT Desktop

## Prérequis

- Git configuré avec accès push au repo `henribesnard/ragkit_desktop`
- Node.js 20+, Rust stable, Python 3.12+ installés localement
- Le tag cible correspond à la spec en cours (voir table ci-dessous)

## Correspondance specs / versions

| Spec | Fichier | Tag cible | Version |
|------|---------|-----------|---------|
| Étape 0 | `spécifications/specs-etape-0.md` | `v0.1.0` | `0.1.0` |
| Étape 1 | `spécifications/specs-etape-1.md` | `v1.0.0` | `1.0.0` |
| Étape 2 | `spécifications/specs-etape-2.md` | `v2.0.0` | `2.0.0` |

> Adapter la table au fur et à mesure de l'avancement.

---

## 1. Vérifier la cohérence des versions

La version doit être identique dans **tous** ces fichiers :

| Fichier | Champ |
|---------|-------|
| `desktop/src-tauri/tauri.conf.json` | `"version"` |
| `desktop/src-tauri/Cargo.toml` | `version` (section `[package]`) |
| `desktop/package.json` | `"version"` |
| `pyproject.toml` | `version` (section `[project]`) |
| `ragkit/desktop/main.py` | `VERSION = "..."` |
| `desktop/src/locales/fr.json` | `"app.version"` |
| `desktop/src/locales/en.json` | `"app.version"` |

**Commande rapide de vérification :**

```bash
grep -n '"version"' desktop/src-tauri/tauri.conf.json desktop/package.json
grep -n '^version' desktop/src-tauri/Cargo.toml pyproject.toml
grep -n 'VERSION = ' ragkit/desktop/main.py
grep -n '"version"' desktop/src/locales/fr.json desktop/src/locales/en.json
```

## 2. Vérifier que tous les fichiers sont trackés par git

Le `.gitignore` contient `/lib/` (artefacts Python). Vérifier que les fichiers source ne sont pas ignorés par erreur :

```bash
git status
git check-ignore desktop/src/lib/*
```

Aucun fichier source ne doit apparaître comme ignoré.

## 3. Vérifier la compilation TypeScript

```bash
cd desktop
npx tsc --noEmit
```

Aucune erreur ne doit apparaître.

## 4. Vérifier le lint frontend

```bash
cd desktop
npm run lint
```

## 5. Vérifier les dépendances système CI (Linux)

Dans `.github/workflows/desktop.yml`, la ligne d'installation Linux doit contenir les packages **Tauri v2** :

```
libgtk-3-dev libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev libappindicator3-dev librsvg2-dev patchelf
```

Points critiques :
- `libwebkit2gtk-4.1-dev` (pas `4.0`)
- `libsoup-3.0-dev` (obligatoire pour Tauri v2)
- `libjavascriptcoregtk-4.1-dev`

## 6. Vérifier les permissions du workflow

Le workflow doit avoir la permission de créer des releases :

```yaml
permissions:
  contents: write
```

## 7. Vérifier les icônes Tauri

```bash
ls desktop/src-tauri/icons/32x32.png desktop/src-tauri/icons/128x128.png desktop/src-tauri/icons/128x128@2x.png desktop/src-tauri/icons/icon.icns desktop/src-tauri/icons/icon.ico
```

Si manquantes, les générer :

```bash
cd desktop
npx tauri icon app-icon.png
```

## 8. Commit et push

```bash
git add <fichiers modifiés>
git commit -m "description du changement"
git push origin main
```

## 9. Créer ou déplacer le tag

**Si le tag n'existe pas encore :**

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

**Si le tag existe déjà et doit être mis à jour :**

```bash
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
git tag vX.Y.Z
git push origin vX.Y.Z
```

> Le tag déclenche le workflow `desktop.yml` qui build les 3 plateformes et crée une draft release sur GitHub.

## 10. Vérifier le résultat

1. Aller sur **Actions** > vérifier que les 4 jobs passent (lint + 3 builds)
2. Aller sur **Releases** > vérifier la draft release avec les assets :
   - Windows : `.exe` (NSIS) + `.msi`
   - macOS : `.dmg`
   - Linux : `.AppImage` + `.deb`

---

## Checklist rapide (copier-coller)

```
[ ] Versions cohérentes dans les 7 fichiers
[ ] Aucun fichier source ignoré par .gitignore
[ ] `npx tsc --noEmit` sans erreur
[ ] `npm run lint` sans erreur
[ ] Dépendances Linux Tauri v2 dans le CI
[ ] `permissions: contents: write` dans le workflow
[ ] Icônes présentes dans desktop/src-tauri/icons/
[ ] Commit + push sur main
[ ] Tag créé/mis à jour et poussé
[ ] CI vert sur les 4 jobs
[ ] Draft release avec assets pour les 3 OS
```
