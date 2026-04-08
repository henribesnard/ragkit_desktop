# Procedure de release RAGKIT Desktop (LOKO)

## Vue d'ensemble

Le workflow CI principal est [`desktop.yml`](/C:/Users/henri/Projets/ragkit_desktop/.github/workflows/desktop.yml).

Il peut etre lance de 2 manieres :

- automatiquement sur les tags `v*`
- manuellement via `workflow_dispatch` pour reconstruire un tag existant

Un push sur `main` sans tag ne lance pas la release desktop.

Les releases GitHub doivent etre publiees, pas en draft, pour que l'auto-update Tauri fonctionne via GitHub Releases.

```text
Modifier le code -> Bump de version -> npm run lint -> npm run build -> Commit -> Push main -> Tag -> Push tag -> CI build -> Release publiee
```

---

## 1. Fichiers de version a synchroniser

La version doit etre identique dans ces 5 fichiers :

| Fichier | Champ | Role |
|---------|-------|------|
| `desktop/src-tauri/tauri.conf.json` | `"version": "X.Y.Z"` | app Tauri |
| `desktop/src-tauri/Cargo.toml` | `version = "X.Y.Z"` | crate Rust |
| `desktop/package.json` | `"version": "X.Y.Z"` | package npm |
| `pyproject.toml` | `version = "X.Y.Z"` | package Python |
| `ragkit/desktop/main.py` | `VERSION = "X.Y.Z"` | version exposee par le backend |

Piege courant : `ragkit/desktop/main.py` est souvent oublie. C'est pourtant lui qui remonte dans `/health` et dans l'UI.

### Verification rapide

```bash
rg -n '"version": "X.Y.Z"|version = "X.Y.Z"|VERSION = "X.Y.Z"' desktop/src-tauri/tauri.conf.json desktop/src-tauri/Cargo.toml desktop/package.json pyproject.toml ragkit/desktop/main.py
```

Ou, pour verifier une version precise :

```bash
rg -n "1.4.37" desktop/src-tauri/tauri.conf.json desktop/src-tauri/Cargo.toml desktop/package.json pyproject.toml ragkit/desktop/main.py
```

---

## 2. Procedure standard

### 2.1 Verifier le lint

```bash
cd desktop && npm run lint
```

Zero erreur attendue.

### 2.2 Verifier la build frontend

```bash
cd desktop && npm run build
```

Cela lance `tsc` puis `vite build`. Zero erreur bloquante attendue.

### 2.3 Bumper la version dans les 5 fichiers

Remplacer `X.Y.Z` par la nouvelle version dans les 5 fichiers listes plus haut.

### 2.4 Commit et push

```bash
git add desktop/src-tauri/tauri.conf.json desktop/src-tauri/Cargo.toml desktop/package.json pyproject.toml ragkit/desktop/main.py
git add <autres fichiers modifies>
git commit -m "feat: release vX.Y.Z"
git push origin main
```

### 2.5 Creer le tag et le pousser

Nouveau tag :

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

Mettre a jour un tag existant :

```bash
git tag -f vX.Y.Z
git push origin -f vX.Y.Z
```

Le push du tag declenche automatiquement la release desktop.

### 2.6 Verifier le CI

Sur un push de tag normal, verifier dans GitHub Actions :

1. `lint-frontend`
2. `prepare-release`
3. `build-windows`
4. `build-other-platforms` sur Linux
5. `build-other-platforms` sur macOS Intel
6. `build-other-platforms` sur macOS Apple Silicon

La release doit ensuite apparaitre dans GitHub Releases avec les assets de build et les artefacts updater.

---

## 3. Rebuild manuel d'un tag existant

Le workflow accepte aussi un lancement manuel.

Depuis GitHub Actions :

1. ouvrir `Desktop Build`
2. cliquer sur `Run workflow`
3. renseigner `release_tag`
4. choisir `build_scope`

Valeurs possibles pour `build_scope` :

- `windows`
- `all`

Cas d'usage :

- reconstruire `v1.4.37` sans recreer de tag
- relancer seulement Windows si la build updater a rate
- republier des assets manquants sur une release existante

---

## 4. Ce que la release doit contenir

Assets attendus :

- Windows : `.exe` NSIS et eventuellement `.msi`
- Linux : `.AppImage` et `.deb`
- macOS Intel : `.dmg`
- macOS Apple Silicon : `.dmg`
- Updater : `latest.json` et fichiers `.sig`

Point important : l'updater Windows doit preferer l'installeur NSIS.

---

## 5. Erreurs frequentes

| Erreur | Cause | Correction |
|--------|-------|------------|
| La mauvaise version s'affiche dans l'application | `main.py` n'a pas ete bump | resynchroniser les 5 fichiers |
| La CI ne se lance pas | le tag n'a pas ete pousse | `git push origin vX.Y.Z` |
| Le lint casse en CI | erreur ESLint non verifiee localement | lancer `npm run lint` avant le tag |
| L'application ne voit pas la nouvelle version | release GitHub en draft | publier la release |
| La generation updater echoue | secrets de signature absents | ajouter les secrets Tauri dans GitHub |
| Le tag pointe sur le mauvais commit | tag cree trop tot | recreer le tag avec `-f` puis repousser |
| Un rebuild manuel echoue sur un tag introuvable | `release_tag` ne correspond a aucun tag distant | recreer ou repousser le tag correct |

---

## 6. Checklist rapide

```text
[ ] npm run lint
[ ] npm run build
[ ] 5 fichiers de version synchronises
[ ] commit et push sur main
[ ] tag cree et pousse
[ ] CI verte
[ ] release publiee
[ ] latest.json et .sig presents sur la release
```

---

## 7. Prerequis CI Linux

Paquets systeme requis pour Tauri v2 :

```text
libgtk-3-dev libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev libappindicator3-dev librsvg2-dev patchelf
```

Points critiques :

- `libwebkit2gtk-4.1-dev`, pas `4.0`
- `libsoup-3.0-dev`, requis pour Tauri v2

Le workflow doit garder `permissions: contents: write` pour publier la release.

---

## 8. Secrets requis pour l'auto-update

Secrets GitHub obligatoires :

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

La cle publique reste dans `desktop/src-tauri/tauri.conf.json`.
La cle privee ne doit jamais etre committee.
