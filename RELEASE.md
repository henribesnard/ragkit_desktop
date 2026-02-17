# ProcÃ©dure de release RAGKIT Desktop

## PrÃ©requis

- Git configurÃ© avec accÃ¨s push au repo `henribesnard/ragkit_desktop`
- Node.js 20+, Rust stable, Python 3.12+ installÃ©s localement
- Le tag cible correspond Ã  la spec en cours (voir table ci-dessous)

## Correspondance specs / versions

| Spec | Fichier | Tag cible | Version |
|------|---------|-----------|---------|
| Étape 0 | `spécifications/specs-etape-0.md` | `v0.1.0` | `0.1.0` |
| Étape 1 | `spécifications/specs-etape-1.md` | `v1.0.0` | `1.0.0` |
| Étape 2 | `spécifications/specs-etape-2.md` | `v2.0.0` | `2.0.0` |
| Étape 3 | `spécifications/specs-etape-3.md` | `v3.0.0` | `3.0.0` |
| Étape 4 | `spécifications/specs-etape-4.md` | `v4.0.0` | `4.0.0` |
| Étape 5 | `spécifications/specs-etape-5.md` | `v5.0.0` | `5.0.0` |
| Étape 6 | `spécifications/specs-etape-6.md` | `v6.0.0` | `6.0.0` |
| Étape 7 | `spécifications/specs-etape-7.md` | `v7.0.0` | `7.0.0` |
| Étape 8 | `spécifications/specs-etape-8.md` | `v8.0.0` | `8.0.0` |
| Étape 9 | `spécifications/specs-etape-9.md` | `v9.0.0` | `9.0.0` |

> Adapter la table au fur et à mesure de l'avancement.

---

## 1. VÃ©rifier la cohÃ©rence des versions

La version doit Ãªtre identique dans **tous** ces fichiers :

| Fichier | Champ |
|---------|-------|
| `desktop/src-tauri/tauri.conf.json` | `"version"` |
| `desktop/src-tauri/Cargo.toml` | `version` (section `[package]`) |
| `desktop/package.json` | `"version"` |
| `pyproject.toml` | `version` (section `[project]`) |
| `ragkit/desktop/main.py` | `VERSION = "..."` |
| `desktop/src/locales/fr.json` | `"app.version"` |
| `desktop/src/locales/en.json` | `"app.version"` |

**Commande rapide de vÃ©rification :**

```bash
grep -n '"version"' desktop/src-tauri/tauri.conf.json desktop/package.json
grep -n '^version' desktop/src-tauri/Cargo.toml pyproject.toml
grep -n 'VERSION = ' ragkit/desktop/main.py
grep -n '"version"' desktop/src/locales/fr.json desktop/src/locales/en.json
```

## 2. VÃ©rifier que tous les fichiers sont trackÃ©s par git

Le `.gitignore` contient `/lib/` (artefacts Python). VÃ©rifier que les fichiers source ne sont pas ignorÃ©s par erreur :

```bash
git status
git check-ignore desktop/src/lib/*
```

Aucun fichier source ne doit apparaÃ®tre comme ignorÃ©.

## 3. VÃ©rifier la compilation TypeScript

```bash
cd desktop
npx tsc --noEmit
```

Aucune erreur ne doit apparaÃ®tre.

## 4. VÃ©rifier le lint frontend

```bash
cd desktop
npm run lint
```

## 5. VÃ©rifier les dÃ©pendances systÃ¨me CI (Linux)

Dans `.github/workflows/desktop.yml`, la ligne d'installation Linux doit contenir les packages **Tauri v2** :

```
libgtk-3-dev libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev libappindicator3-dev librsvg2-dev patchelf
```

Points critiques :
- `libwebkit2gtk-4.1-dev` (pas `4.0`)
- `libsoup-3.0-dev` (obligatoire pour Tauri v2)
- `libjavascriptcoregtk-4.1-dev`

## 6. VÃ©rifier les permissions du workflow

Le workflow doit avoir la permission de crÃ©er des releases :

```yaml
permissions:
  contents: write
```

## 7. VÃ©rifier les icÃ´nes Tauri

```bash
ls desktop/src-tauri/icons/32x32.png desktop/src-tauri/icons/128x128.png desktop/src-tauri/icons/128x128@2x.png desktop/src-tauri/icons/icon.icns desktop/src-tauri/icons/icon.ico
```

Si manquantes, les gÃ©nÃ©rer :

```bash
cd desktop
npx tauri icon app-icon.png
```

## 8. Commit et push

```bash
git add <fichiers modifiÃ©s>
git commit -m "description du changement"
git push origin main
```

## 9. CrÃ©er ou dÃ©placer le tag

**Si le tag n'existe pas encore :**

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

**Si le tag existe dÃ©jÃ  et doit Ãªtre mis Ã  jour :**

```bash
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
git tag vX.Y.Z
git push origin vX.Y.Z
```

> Le tag dÃ©clenche le workflow `desktop.yml` qui build les 3 plateformes et crÃ©e une draft release sur GitHub.

## 10. VÃ©rifier le rÃ©sultat

1. Aller sur **Actions** > vÃ©rifier que les 4 jobs passent (lint + 3 builds)
2. Aller sur **Releases** > vÃ©rifier la draft release avec les assets :
   - Windows : `.exe` (NSIS) + `.msi`
   - macOS : `.dmg`
   - Linux : `.AppImage` + `.deb`

---

## Checklist rapide (copier-coller)

```
[ ] Versions cohÃ©rentes dans les 7 fichiers
[ ] Aucun fichier source ignorÃ© par .gitignore
[ ] `npx tsc --noEmit` sans erreur
[ ] `npm run lint` sans erreur
[ ] DÃ©pendances Linux Tauri v2 dans le CI
[ ] `permissions: contents: write` dans le workflow
[ ] IcÃ´nes prÃ©sentes dans desktop/src-tauri/icons/
[ ] Commit + push sur main
[ ] Tag crÃ©Ã©/mis Ã  jour et poussÃ©
[ ] CI vert sur les 4 jobs
[ ] Draft release avec assets pour les 3 OS
```


