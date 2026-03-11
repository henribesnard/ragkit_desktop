# Build local Windows (.exe) - Test avant push

## Objectif

Construire le `.exe` LOKO en local pour tester l'application complete
(Tauri + sidecar Python) **avant** de push/tag vers git.

Le build produit ses fichiers dans `local-build/` (gitignore).

---

## Prerequis

| Outil | Version | Verification |
|-------|---------|--------------|
| Node.js | >= 20 | `node -v` |
| npm | >= 9 | `npm -v` |
| Rust | stable | `rustc --version` |
| Python | >= 3.10 | `python --version` |
| PyInstaller | >= 6.0 | `pyinstaller --version` |
| PyTorch CPU | - | installe a l'etape 2 |

---

## Etapes

### 1. Verifier les 5 fichiers de version

Les 5 fichiers doivent afficher le **meme** numero :

```bash
grep -n "\"version\"" desktop/src-tauri/tauri.conf.json desktop/package.json
grep -n "^version" desktop/src-tauri/Cargo.toml pyproject.toml
grep -n "VERSION = " ragkit/desktop/main.py
```

### 2. Installer les dependances Python (si pas deja fait)

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install -e ".[desktop]"
```

> `.[desktop]` installe ragkit + PyInstaller.

### 3. Construire le sidecar Python (PyInstaller)

```bash
pyinstaller ragkit-backend.spec --noconfirm
```

Produit : `dist/ragkit-backend.exe` (~150-300 Mo).

Verifier :
```bash
dist\ragkit-backend.exe --help
```

### 4. Placer le sidecar dans le dossier Tauri

Le nom doit inclure le target triple pour que Tauri le trouve :

```bash
mkdir -p desktop/src-tauri/binaries
cp dist/ragkit-backend.exe "desktop/src-tauri/binaries/ragkit-backend-x86_64-pc-windows-msvc.exe"
```

### 5. Installer les dependances frontend

```bash
cd desktop
npm ci
```

### 6. Verifier lint + build frontend

```bash
npm run lint
npm run build
```

Zero erreur attendue sur les deux commandes.

### 7. Build Tauri (mode release)

```bash
npx tauri build
```

Cela compile le Rust en release et produit les installeurs dans :
```
desktop/src-tauri/target/release/bundle/
    nsis/LOKO_X.Y.Z_x64-setup.exe     <-- installeur NSIS
    msi/LOKO_X.Y.Z_x64_en-US.msi      <-- installeur MSI
```

### 8. Copier dans le dossier local-build

```bash
mkdir -p local-build
cp "desktop/src-tauri/target/release/bundle/nsis/LOKO_*_x64-setup.exe" local-build/
```

### 9. Tester

Lancer l'installeur depuis `local-build/` :

```bash
local-build\LOKO_X.Y.Z_x64-setup.exe
```

Verifications :
- [ ] L'application demarre sans erreur
- [ ] Le sidecar Python se lance (pastille verte dans la sidebar)
- [ ] La version affichee dans le footer correspond au numero attendu
- [ ] Le chat fonctionne (si des documents sont indexes)
- [ ] Le dashboard charge correctement

---

## Raccourci : rebuild rapide

Si seul le **frontend** a change (pas de modif Python) :

```bash
cd desktop && npx tauri build
```

Si seul le **backend Python** a change :

```bash
pyinstaller ragkit-backend.spec --noconfirm
cp dist/ragkit-backend.exe "desktop/src-tauri/binaries/ragkit-backend-x86_64-pc-windows-msvc.exe"
cd desktop && npx tauri build
```

> Le build Tauri est toujours necessaire car il repackage le sidecar dans l'installeur.

---

## Nettoyage

Pour liberer l'espace disque apres les tests :

```bash
rm -rf local-build/
rm -rf dist/
rm -rf desktop/src-tauri/target/release/
rm -rf desktop/src-tauri/binaries/
```

---

## Structure des fichiers produits

```
ragkit_desktop/
  dist/                         <-- PyInstaller output (gitignore)
    ragkit-backend.exe
  desktop/src-tauri/
    binaries/                   <-- sidecar copie (gitignore)
      ragkit-backend-x86_64-pc-windows-msvc.exe
    target/release/bundle/      <-- Tauri output (gitignore)
      nsis/LOKO_X.Y.Z_x64-setup.exe
      msi/LOKO_X.Y.Z_x64_en-US.msi
  local-build/                  <-- copie pour tests (gitignore)
    LOKO_X.Y.Z_x64-setup.exe
```

Tous ces dossiers sont dans `.gitignore` — rien ne sera committe.
