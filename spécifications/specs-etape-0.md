# 🧰 RAGKIT Desktop — Spécifications Étape 0

> **Étape** : 0 — Ossature & Release 0  
> **Tag cible** : `v0.1.0`  
> **Date** : 13 février 2026  
> **Dépôt** : https://github.com/henribesnard/ragkit_desktop.git

---

## 1. Objectif

Créer le socle technique complet de l'application et livrer un premier installeur `.exe` fonctionnel. L'application s'ouvre, affiche le nom "RAGKIT" et propose trois onglets vides navigables : **CHAT**, **PARAMÈTRES**, **TABLEAU DE BORD**.

Cette étape valide de bout en bout :
- La chaîne de build Tauri + React + Python sidecar.
- La communication IPC entre le frontend et le backend.
- La distribution multi-plateforme via GitHub Actions.
- L'infrastructure i18n et le système de thème.

**Aucune fonctionnalité métier n'est implémentée à cette étape.**

---

## 2. Spécifications fonctionnelles

### 2.1 Premier lancement

Au lancement de l'application :

1. La fenêtre principale s'ouvre, centrée sur l'écran (1200×800 px, minimum 800×600).
2. Le titre de la fenêtre affiche "RAGKIT Desktop".
3. Le backend Python démarre automatiquement en arrière-plan (sidecar).
4. Une fois le backend prêt, l'interface est fonctionnelle.
5. Si le backend échoue à démarrer, un message d'erreur natif s'affiche.

### 2.2 Layout principal

```
┌─────────────────────────────────────────────────────────────┐
│  RAGKIT                                    🌙/☀️  FR/EN     │
├─────────┬───────────────────────────────────────────────────┤
│         │                                                   │
│  💬 Chat│           ZONE DE CONTENU                         │
│         │                                                   │
│  ⚙️ Para│   (contenu de l'onglet actif)                     │
│   mètres│                                                   │
│         │                                                   │
│  📊 Tabl│                                                   │
│  eau de │                                                   │
│  bord   │                                                   │
│         │                                                   │
│─────────│                                                   │
│         │                                                   │
│  v0.1.0 │                                                   │
│         │                                                   │
└─────────┴───────────────────────────────────────────────────┘
```

### 2.3 Barre latérale (Sidebar)

| Élément | Description |
|---------|-------------|
| Logo / Titre | "RAGKIT" en haut de la sidebar |
| Navigation | 3 items : Chat, Paramètres, Tableau de bord |
| Item actif | Surligné visuellement (fond différent, indicateur gauche) |
| Icônes | Lucide React : `MessageSquare`, `Settings`, `LayoutDashboard` |
| Version | Numéro de version en bas de la sidebar (`v0.1.0`) |

### 2.4 Header

| Élément | Description |
|---------|-------------|
| Titre de page | Nom de l'onglet actif (ex : "Chat", "Paramètres", "Tableau de bord") |
| Toggle thème | Bouton lune/soleil pour basculer entre thème clair et sombre |
| Sélecteur langue | Bouton FR/EN pour basculer la langue de l'interface |

### 2.5 Onglet CHAT (placeholder)

Contenu statique centré verticalement et horizontalement :

> 💬
>
> **Le chat sera disponible après configuration**
>
> Configurez votre base de connaissances pour commencer à poser des questions.

### 2.6 Onglet PARAMÈTRES (placeholder)

Contenu statique centré :

> ⚙️
>
> **Paramètres**
>
> Les paramètres de configuration apparaîtront ici après la mise en place de votre base de connaissances.

### 2.7 Onglet TABLEAU DE BORD (placeholder)

Contenu statique centré :

> 📊
>
> **Tableau de bord**
>
> Le monitoring et les statistiques apparaîtront ici une fois l'ingestion lancée.

### 2.8 Thème clair / sombre

- Deux thèmes : **clair** (light) et **sombre** (dark).
- Le thème par défaut suit la préférence système (`prefers-color-scheme`).
- L'utilisateur peut basculer via le toggle dans le header.
- Le choix est persisté dans `localStorage` (frontend) et dans les settings (backend).
- La transition entre thèmes est fluide (transition CSS ~200ms).

### 2.9 Internationalisation (i18n)

- Deux langues supportées : **Français** (par défaut) et **Anglais**.
- L'utilisateur peut basculer via le sélecteur dans le header.
- Le choix est persisté.
- Toutes les chaînes visibles sont externalisées dans les fichiers de traduction.

### 2.10 Health check backend

- Le frontend vérifie périodiquement (toutes les 10s) que le backend est vivant via `GET /health`.
- Si le backend ne répond pas, un indicateur discret apparaît dans la sidebar (pastille rouge).
- Quand la connexion est rétablie, la pastille disparaît.

---

## 3. Spécifications techniques

### 3.1 Initialisation du dépôt

#### 3.1.1 Dépôt Git

```bash
git clone https://github.com/henribesnard/ragkit_desktop.git
cd ragkit_desktop
```

La branche de développement pour cette étape est `feature/etape-0-ossature`.

#### 3.1.2 Structure de fichiers à créer

```
ragkit_desktop/
├── .github/
│   └── workflows/
│       └── desktop.yml
├── ragkit/
│   ├── __init__.py
│   └── desktop/
│       ├── __init__.py
│       └── main.py
├── desktop/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Header.tsx
│   │   │   └── ui/
│   │   │       └── Button.tsx
│   │   ├── pages/
│   │   │   ├── Chat.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── Dashboard.tsx
│   │   ├── hooks/
│   │   │   ├── useTheme.ts
│   │   │   └── useBackendHealth.ts
│   │   ├── lib/
│   │   │   ├── ipc.ts
│   │   │   └── cn.ts
│   │   └── locales/
│   │       ├── fr.json
│   │       └── en.json
│   └── src-tauri/
│       ├── Cargo.toml
│       ├── tauri.conf.json
│       ├── build.rs
│       ├── capabilities/
│       │   └── default.json
│       ├── binaries/
│       │   └── .gitkeep
│       ├── icons/
│       │   ├── icon.ico
│       │   ├── icon.icns
│       │   ├── 32x32.png
│       │   ├── 128x128.png
│       │   └── 128x128@2x.png
│       └── src/
│           ├── main.rs
│           ├── backend.rs
│           └── commands.rs
├── pyproject.toml
├── ragkit-backend.spec
├── .gitignore
├── .env.example
├── README.md
└── LICENSE
```

### 3.2 Backend Python (sidecar minimal)

#### 3.2.1 `ragkit/desktop/main.py`

Le backend est une application FastAPI minimale qui expose :

| Endpoint | Méthode | Description | Réponse |
|----------|---------|-------------|---------|
| `/health` | GET | Health check | `{ "ok": true, "version": "0.1.0" }` |
| `/shutdown` | POST | Arrêt propre | `{ "ok": true }` |

```python
# ragkit/desktop/main.py
"""RAGKIT Desktop backend - Étape 0 : squelette minimal."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

VERSION = "0.1.0"


def create_app() -> FastAPI:
    app = FastAPI(title="RAGKIT Desktop API", version=VERSION)
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    @app.get("/health")
    async def health_check():
        return {"ok": True, "version": VERSION}
    
    @app.post("/shutdown")
    async def shutdown():
        logger.info("Shutdown requested")
        asyncio.get_event_loop().call_later(0.5, lambda: sys.exit(0))
        return {"ok": True}
    
    return app


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8100)
    args = parser.parse_args()
    
    app = create_app()
    logger.info(f"Starting RAGKIT backend on port {args.port}")
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")


if __name__ == "__main__":
    main()
```

#### 3.2.2 `pyproject.toml` (minimal pour Étape 0)

```toml
[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "ragkit"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
    "fastapi>=0.100",
    "uvicorn>=0.20",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "ruff>=0.1",
    "mypy>=1.0",
]
```

#### 3.2.3 `ragkit-backend.spec` (PyInstaller)

```python
# ragkit-backend.spec
a = Analysis(
    ['ragkit/desktop/main.py'],
    pathex=['.'],
    datas=[],
    hiddenimports=['uvicorn.logging', 'uvicorn.protocols.http'],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, a.binaries, a.datas,
    name='ragkit-backend',
    console=True,
    strip=False,
    upx=True,
)
```

### 3.3 Shell Rust (Tauri)

#### 3.3.1 `desktop/src-tauri/tauri.conf.json`

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "RAGKIT Desktop",
  "version": "0.1.0",
  "identifier": "com.ragkit.desktop",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "RAGKIT Desktop",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "center": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "externalBin": ["binaries/ragkit-backend"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "category": "Productivity",
    "shortDescription": "AI-powered document assistant",
    "windows": {
      "webviewInstallMode": { "type": "embedBootstrapper" },
      "nsis": {
        "installMode": "currentUser",
        "languages": ["French", "English"]
      }
    }
  },
  "plugins": {
    "shell": { "open": true }
  }
}
```

#### 3.3.2 `desktop/src-tauri/Cargo.toml`

```toml
[package]
name = "ragkit-desktop"
version = "0.1.0"
description = "RAGKIT Desktop Application"
authors = ["RAGKIT Contributors"]
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["devtools"] }
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
anyhow = "1"
tracing = "0.1"
tracing-subscriber = "0.3"
tracing-appender = "0.2"

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "s"
strip = true
```

#### 3.3.3 `desktop/src-tauri/capabilities/default.json`

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities for RAGKIT Desktop",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:allow-message",
    "dialog:allow-ask",
    "dialog:allow-confirm"
  ]
}
```

#### 3.3.4 `desktop/src-tauri/src/main.rs`

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend;
mod commands;

use tauri::Manager;

fn get_log_dir() -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    let home = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string());
    #[cfg(not(target_os = "windows"))]
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    
    std::path::PathBuf::from(home).join(".ragkit").join("logs")
}

fn main() {
    let log_dir = get_log_dir();
    let _ = std::fs::create_dir_all(&log_dir);
    
    let file_appender = tracing_appender::rolling::daily(&log_dir, "ragkit-desktop.log");
    tracing_subscriber::fmt()
        .with_writer(file_appender)
        .with_ansi(false)
        .init();
    
    tracing::info!("=== RAGKIT Desktop v0.1.0 starting ===");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = backend::start_backend(&app_handle).await {
                    tracing::error!("Failed to start backend: {}", e);
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app_handle = window.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    backend::stop_backend(&app_handle).await;
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::health_check,
        ])
        .run(tauri::generate_context!())
        .expect("error while running RAGKIT Desktop");
}
```

#### 3.3.5 `desktop/src-tauri/src/commands.rs` (minimal)

```rust
use serde::{Deserialize, Serialize};
use crate::backend::backend_request;
use reqwest::Method;

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthCheckResponse {
    pub ok: bool,
    pub version: Option<String>,
}

#[tauri::command]
pub async fn health_check() -> Result<HealthCheckResponse, String> {
    backend_request(Method::GET, "/health", None)
        .await
        .map_err(|e| e.to_string())
}
```

#### 3.3.6 `desktop/src-tauri/src/backend.rs`

Reprend la logique existante de gestion du sidecar :
- Allocation dynamique de port.
- Mode dev : lance `python -m ragkit.desktop.main --port {port}`.
- Mode prod : lance le binaire PyInstaller sidecar.
- Attente du backend (polling `/health` pendant 30s max).
- Arrêt propre via `POST /shutdown`.

### 3.4 Frontend React

#### 3.4.1 `desktop/package.json`

```json
{
  "name": "ragkit-desktop",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "lint": "eslint src --ext ts,tsx",
    "format": "prettier --write src/"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "i18next": "^23.12.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-i18next": "^14.1.2",
    "react-router-dom": "^6.26.0",
    "lucide-react": "^0.441.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.2"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "eslint": "^8.57.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "postcss": "^8.4.45",
    "prettier": "^3.3.3",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.4",
    "vite": "^5.4.3"
  }
}
```

#### 3.4.2 `desktop/src/App.tsx`

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { Chat } from "./pages/Chat";
import { Settings } from "./pages/Settings";
import { Dashboard } from "./pages/Dashboard";
import { useTheme } from "./hooks/useTheme";
import "./i18n";

export default function App() {
  useTheme(); // Applique le thème clair/sombre

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/chat" element={<Chat />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="*" element={<Navigate to="/chat" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
```

#### 3.4.3 Composant `Sidebar`

| Prop / Comportement | Description |
|---------------------|-------------|
| Items de navigation | 3 liens : Chat (`/chat`), Paramètres (`/settings`), Tableau de bord (`/dashboard`) |
| Item actif | Détecté via `useLocation()`, surligné avec `bg-blue-50 dark:bg-gray-800` |
| Icônes | `MessageSquare`, `Settings`, `LayoutDashboard` de lucide-react |
| Version | `v0.1.0` affiché en bas, `text-xs text-gray-400` |
| Indicateur backend | Pastille verte/rouge selon `useBackendHealth()` |
| Largeur | `w-56` (224px), fixe |
| Bordure | `border-r border-gray-200 dark:border-gray-700` |

#### 3.4.4 Composant `Header`

| Prop / Comportement | Description |
|---------------------|-------------|
| Titre de page | Dynamique selon la route active, via i18n |
| Toggle thème | Bouton icône : `Sun` (si dark) / `Moon` (si light) |
| Sélecteur langue | Bouton `FR` / `EN`, bascule i18next |
| Hauteur | `h-14` (56px) |
| Bordure | `border-b border-gray-200 dark:border-gray-700` |

#### 3.4.5 Pages placeholder

Chaque page (Chat, Settings, Dashboard) affiche un contenu statique centré avec :
- Une icône large (48px) en gris clair.
- Un titre en gras.
- Un sous-titre descriptif.

Tout le texte est externalisé via i18n.

#### 3.4.6 Hook `useTheme`

```typescript
// desktop/src/hooks/useTheme.ts
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("ragkit-theme") as Theme | null;
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark" : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("ragkit-theme", theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === "light" ? "dark" : "light");
  
  return { theme, toggle };
}
```

#### 3.4.7 Hook `useBackendHealth`

```typescript
// desktop/src/hooks/useBackendHealth.ts
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useBackendHealth(intervalMs = 10_000) {
  const [isHealthy, setIsHealthy] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res: any = await invoke("health_check");
        setIsHealthy(res?.ok === true);
      } catch {
        setIsHealthy(false);
      }
    };
    
    check();
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return isHealthy;
}
```

#### 3.4.8 Client IPC minimal (`lib/ipc.ts`)

```typescript
// desktop/src/lib/ipc.ts
import { invoke } from "@tauri-apps/api/core";

interface HealthCheckResponse {
  ok: boolean;
  version?: string;
}

export const ipc = {
  healthCheck: () => invoke<HealthCheckResponse>("health_check"),
};
```

#### 3.4.9 Utilitaire `cn` pour Tailwind

```typescript
// desktop/src/lib/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

#### 3.4.10 Configuration i18n

```typescript
// desktop/src/i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./locales/fr.json";
import en from "./locales/en.json";

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: localStorage.getItem("ragkit-lang") || "fr",
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

export default i18n;
```

#### 3.4.11 Fichiers de traduction (Étape 0)

**`desktop/src/locales/fr.json`**

```json
{
  "app": {
    "name": "RAGKIT",
    "version": "v0.1.0"
  },
  "navigation": {
    "chat": "Chat",
    "settings": "Paramètres",
    "dashboard": "Tableau de bord"
  },
  "layout": {
    "darkMode": "Mode sombre",
    "lightMode": "Mode clair"
  },
  "chat": {
    "title": "Chat",
    "placeholder": "Le chat sera disponible après configuration",
    "description": "Configurez votre base de connaissances pour commencer à poser des questions."
  },
  "settings": {
    "title": "Paramètres",
    "placeholder": "Les paramètres de configuration apparaîtront ici",
    "description": "Les paramètres de configuration apparaîtront ici après la mise en place de votre base de connaissances."
  },
  "dashboard": {
    "title": "Tableau de bord",
    "placeholder": "Le monitoring apparaîtra ici",
    "description": "Le monitoring et les statistiques apparaîtront ici une fois l'ingestion lancée."
  },
  "backend": {
    "connected": "Backend connecté",
    "disconnected": "Backend déconnecté"
  }
}
```

**`desktop/src/locales/en.json`**

```json
{
  "app": {
    "name": "RAGKIT",
    "version": "v0.1.0"
  },
  "navigation": {
    "chat": "Chat",
    "settings": "Settings",
    "dashboard": "Dashboard"
  },
  "layout": {
    "darkMode": "Dark mode",
    "lightMode": "Light mode"
  },
  "chat": {
    "title": "Chat",
    "placeholder": "Chat will be available after configuration",
    "description": "Configure your knowledge base to start asking questions."
  },
  "settings": {
    "title": "Settings",
    "placeholder": "Configuration settings will appear here",
    "description": "Configuration settings will appear here after setting up your knowledge base."
  },
  "dashboard": {
    "title": "Dashboard",
    "placeholder": "Monitoring will appear here",
    "description": "Monitoring and statistics will appear here once ingestion is launched."
  },
  "backend": {
    "connected": "Backend connected",
    "disconnected": "Backend disconnected"
  }
}
```

### 3.5 Tailwind CSS

#### 3.5.1 `desktop/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
      },
    },
  },
  plugins: [],
};
```

#### 3.5.2 `desktop/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    user-select: none;
  }

  /* Smooth transitions for theme switching */
  * {
    @apply transition-colors duration-200;
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    @apply bg-transparent;
  }
  ::-webkit-scrollbar-thumb {
    @apply bg-gray-300 dark:bg-gray-600 rounded-full;
  }
}
```

### 3.6 CI/CD

#### 3.6.1 `desktop.yml` (GitHub Actions)

Le workflow CI reprend la structure existante avec :

1. **Job `lint-frontend`** :
   - Checkout, setup Node 20, `npm ci`, `npx tsc --noEmit`, `npm run lint`.

2. **Job `build`** (matrix multi-plateforme) :
   - Platforms : `ubuntu-22.04`, `windows-latest`, `macos-latest` (x64 + arm64).
   - Setup : Node 20, Rust stable, Python 3.12.
   - Build Python backend : `pip install -e ".[desktop]"` puis `pyinstaller ragkit-backend.spec`.
   - Rename sidecar binaire selon la target Tauri.
   - Build Tauri : `npm ci` puis `npm run tauri build`.
   - Upload des artefacts (NSIS/MSI, DMG, AppImage/DEB).

### 3.7 Vite config

```typescript
// desktop/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
});
```

---

## 4. Design system (Étape 0)

### 4.1 Palette de couleurs

| Rôle | Light | Dark |
|------|-------|------|
| Background principal | `gray-50` (#f9fafb) | `gray-900` (#111827) |
| Background sidebar | `white` (#ffffff) | `gray-800` (#1f2937) |
| Background cartes | `white` (#ffffff) | `gray-800` (#1f2937) |
| Texte principal | `gray-900` (#111827) | `gray-100` (#f3f4f6) |
| Texte secondaire | `gray-500` (#6b7280) | `gray-400` (#9ca3af) |
| Bordures | `gray-200` (#e5e7eb) | `gray-700` (#374151) |
| Accent / actif | `blue-600` (#2563eb) | `blue-400` (#60a5fa) |
| Succès | `green-500` (#22c55e) | `green-400` (#4ade80) |
| Erreur | `red-500` (#ef4444) | `red-400` (#f87171) |

### 4.2 Typographie

- **Font** : système (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`)
- **Taille base** : 14px (`text-sm`)
- **Titres** : `text-lg font-semibold` (pages), `text-sm font-medium` (sections)

---

## 5. Critères d'acceptation

### 5.1 Fonctionnels

| # | Critère | Vérifié par |
|---|---------|-------------|
| F1 | L'installeur `.exe` Windows s'installe et lance l'application | Test manuel |
| F2 | La fenêtre affiche "RAGKIT Desktop" dans la barre de titre | Test manuel |
| F3 | La sidebar affiche les 3 items de navigation avec icônes | Test manuel |
| F4 | Cliquer sur un item de navigation affiche le contenu placeholder correspondant | Test manuel |
| F5 | Le toggle thème bascule entre clair et sombre | Test manuel |
| F6 | Le sélecteur de langue bascule entre FR et EN | Test manuel |
| F7 | Le choix de thème et de langue persiste après redémarrage | Test manuel |
| F8 | L'indicateur backend (pastille) est vert quand le backend est prêt | Test manuel |
| F9 | Le numéro de version `v0.1.0` est visible dans la sidebar | Test manuel |

### 5.2 Techniques

| # | Critère | Vérifié par |
|---|---------|-------------|
| T1 | Le backend Python démarre automatiquement au lancement | Logs Rust |
| T2 | `GET /health` retourne `{ "ok": true, "version": "0.1.0" }` | curl / test |
| T3 | Le backend s'arrête proprement à la fermeture de l'application | Logs Rust |
| T4 | `npm run tauri:dev` lance l'application en mode développement | Test dev |
| T5 | `npm run tauri:build` produit un installeur fonctionnel | CI / test manual |
| T6 | Le CI GitHub Actions passe (lint + build) sur les 4 targets | GitHub Actions |
| T7 | `tsc --noEmit` ne produit aucune erreur TypeScript | CI |
| T8 | Aucune erreur dans la console du webview au lancement | DevTools |

---

## 6. Périmètre exclus (Étape 0)

Les éléments suivants sont explicitement **hors périmètre** de l'Étape 0 :

- Wizard de configuration / onboarding.
- Toute fonctionnalité métier (parsing, chunking, embedding, recherche, LLM).
- Routes API autres que `/health` et `/shutdown`.
- Base de données SQLite.
- Gestion des clés API.
- Stockage de settings (autres que thème et langue dans localStorage).
- Commandes IPC autres que `health_check`.

Ces fonctionnalités seront ajoutées progressivement aux étapes suivantes.

---

## 7. Estimation

| Tâche | Effort estimé |
|-------|---------------|
| Init dépôt + structure | 0.5 jour |
| Backend Python minimal | 0.5 jour |
| Tauri shell (Rust) | 1 jour |
| Frontend React (layout, sidebar, header, pages, i18n, thème) | 1.5 jours |
| CI/CD GitHub Actions | 0.5 jour |
| Tests manuels + corrections | 0.5 jour |
| **Total** | **~4.5 jours** |
