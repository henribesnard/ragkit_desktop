# Procedure de release RAGKIT Desktop (LOKO)

## Vue d'ensemble

Le CI (`desktop.yml`) se declenche uniquement sur les tags `v*`.
Un push sans tag ne lance aucun build.

Les releases doivent etre **publiees** (pas en draft) pour que l'auto-update Tauri fonctionne via GitHub Releases.

```
Modifier le code → Bump les 5 fichiers de version → Commit → Push → Tag → Push tag → CI build
```

---

## 1. Fichiers de version (les 5 a synchroniser)

La version doit etre **identique** dans ces 5 fichiers :

| Fichier | Champ | Exemple |
|---------|-------|---------|
| `desktop/src-tauri/tauri.conf.json` | `"version": "X.Y.Z"` | Frontend Tauri |
| `desktop/src-tauri/Cargo.toml` | `version = "X.Y.Z"` | Rust sidecar |
| `desktop/package.json` | `"version": "X.Y.Z"` | Node/npm |
| `pyproject.toml` | `version = "X.Y.Z"` | Python package |
| `ragkit/desktop/main.py` | `VERSION = "X.Y.Z"` | Backend runtime (affiche dans le footer) |

> **Piege courant** : `main.py` est souvent oublie car il n'est pas un fichier de config standard.
> C'est pourtant lui qui alimente le `/health` endpoint et la version affichee dans la sidebar.

### Commande de verification

```bash
grep -n '"version"' desktop/src-tauri/tauri.conf.json desktop/package.json
grep -n '^version' desktop/src-tauri/Cargo.toml pyproject.toml
grep -n 'VERSION = ' ragkit/desktop/main.py
```

Les 5 lignes doivent afficher le meme numero de version.

---

## 2. Procedure complete (pas a pas)

### 2.1 Verifier que le code compile

```bash
cd desktop && npm run build
```

Cela lance `tsc` (TypeScript) puis `vite build`. Zero erreur attendue.

### 2.2 Verifier le lint

```bash
cd desktop && npm run lint
```

Zero erreur attendue. Le CI echoue sur les erreurs de lint.

### 2.3 Bumper la version dans les 5 fichiers

Remplacer `X.Y.Z` par le nouveau numero dans les 5 fichiers ci-dessus.
Utiliser une recherche globale de l'ancien numero pour ne rien oublier :

```bash
grep -rn "1.4.17" desktop/src-tauri/tauri.conf.json desktop/src-tauri/Cargo.toml desktop/package.json pyproject.toml ragkit/desktop/main.py
```

### 2.4 Commit et push

```bash
git add desktop/src-tauri/tauri.conf.json desktop/src-tauri/Cargo.toml desktop/package.json pyproject.toml ragkit/desktop/main.py
git add <autres fichiers modifies>
git commit -m "fix: vX.Y.Z - Description du changement"
git push origin main
```

### 2.5 Creer le tag et le pousser

**Nouveau tag :**
```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

**Mettre a jour un tag existant (force) :**
```bash
git tag -f vX.Y.Z
git push origin -f vX.Y.Z
```

> Le push du tag declenche le workflow CI qui build les 3 plateformes.

### 2.6 Verifier le CI

1. Aller sur **Actions** > verifier que les 4 jobs passent (lint + 3 builds)
2. Aller sur **Releases** > verifier la release publiee avec les assets et les fichiers d'update :
   - Windows : `.exe` (NSIS) + `.msi`
   - macOS : `.dmg`
   - Linux : `.AppImage` + `.deb`
   - Updater : `latest.json` + signatures `.sig`

---

## 3. Erreurs frequentes

| Erreur | Cause | Solution |
|--------|-------|----------|
| Version "v1.4.15" affichee alors qu'on est en v1.4.17 | `main.py` oublie lors du bump | Toujours bumper les **5** fichiers |
| CI ne se declenche pas | Pas de tag pousse | Verifier `git push origin vX.Y.Z` |
| CI echoue sur lint | Erreur ESLint non detectee localement | Lancer `npm run lint` avant de push |
| L'application ne voit pas la nouvelle version | Release GitHub encore en draft | Publier la release, `releases/latest` ignore les drafts |
| La build release echoue pendant la generation updater | Secrets de signature absents | Ajouter `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` dans GitHub |
| Tag pointe sur un mauvais commit | Tag cree avant le dernier commit | `git tag -f vX.Y.Z && git push origin -f vX.Y.Z` |
| `invoke` frontend "reussit" avec erreur backend | Rust `request()` ne verifie pas les codes HTTP | Voir MEMORY.md — comportement connu |

---

## 4. Checklist rapide

```
[ ] npm run build — zero erreur
[ ] npm run lint — zero erreur
[ ] 5 fichiers de version synchronises (tauri.conf.json, Cargo.toml, package.json, pyproject.toml, main.py)
[ ] Commit et push sur main
[ ] Tag cree et pousse (git tag vX.Y.Z && git push origin vX.Y.Z)
[ ] CI vert sur les 4 jobs
[ ] Release publiee avec assets pour les 3 OS
[ ] `latest.json` et fichiers `.sig` presents sur la release
```

---

## 5. Prerequis systeme CI (Linux)

Dans `.github/workflows/desktop.yml`, les packages Tauri v2 requis :

```
libgtk-3-dev libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev libappindicator3-dev librsvg2-dev patchelf
```

Points critiques :
- `libwebkit2gtk-4.1-dev` (pas `4.0`)
- `libsoup-3.0-dev` (obligatoire pour Tauri v2)

Le workflow doit avoir `permissions: contents: write` pour creer des releases.

---

## 6. Secrets requis pour l'auto-update

Le workflow GitHub a besoin de 2 secrets :

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

La cle publique est embarquee dans `desktop/src-tauri/tauri.conf.json`.
La cle privee ne doit jamais etre committee.
