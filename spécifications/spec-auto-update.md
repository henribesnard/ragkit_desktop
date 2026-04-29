# Spécification : Système de mise à jour (Auto-Update)

## 1. Contexte & état actuel

### 1.1 Infrastructure existante (ce qui fonctionne déjà)

L'infrastructure de mise à jour est **entièrement en place** côté backend et CI :

| Couche | Composant | État |
|--------|-----------|------|
| **Rust / Tauri** | `tauri-plugin-updater` v2.10.1 | ✅ Installé dans `Cargo.toml` |
| **Rust / Tauri** | Plugin initialisé dans `main.rs` L30 | ✅ `.plugin(tauri_plugin_updater::Builder::new().build())` |
| **Tauri config** | Endpoint updater dans `tauri.conf.json` | ✅ `https://github.com/henribesnard/ragkit_desktop/releases/latest/download/latest.json` |
| **Tauri config** | Clé publique de signature | ✅ Présente dans `tauri.conf.json` |
| **Tauri config** | `createUpdaterArtifacts: true` | ✅ Artefacts updater générés à chaque build |
| **Capabilities** | Permission `updater:default` | ✅ Dans `default.json` |
| **CI** | Workflow `desktop.yml` | ✅ Génère `latest.json` + `.sig` sur chaque tag |
| **CI** | Secrets `TAURI_SIGNING_PRIVATE_KEY` | ✅ Configurés dans GitHub |
| **Frontend npm** | `@tauri-apps/plugin-updater` v2.10.1 | ✅ Installé dans `package.json` |
| **Frontend** | `AppUpdateManager.tsx` (164 lignes) | ✅ Composant React existant |
| **Frontend** | Traductions FR/EN dans `locales/*.json` | ✅ Clés `updater.*` présentes |
| **Frontend** | Intégré dans `App.tsx` | ✅ Monté au root level |

### 1.2 Comportement actuel du composant `AppUpdateManager`

Le composant existant ([AppUpdateManager.tsx](file:///c:/Users/henri/Projets/ragkit_desktop/desktop/src/components/ui/AppUpdateManager.tsx)) fonctionne ainsi :

1. **Vérification automatique** au montage du composant (= démarrage de l'app)
2. **Vérification périodique** toutes les **6 heures** (`CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000`)
3. Si une mise à jour est trouvée, un **dialog modal** (`ConfirmDialog`) s'affiche avec :
   - Titre : "Mise à jour disponible"
   - Message : "La version X.Y.Z est disponible..."
   - Bouton **"Mettre à jour et redémarrer"** → lance `downloadAndInstall()` puis `relaunch()`
   - Bouton **"Plus tard"** → masque le dialog et mémorise la version refusée (dans `dismissedVersionRef`)
4. Pendant le téléchargement, le dialog affiche la **progression en %**
5. En cas d'erreur, un bouton **"Réessayer"** apparaît

### 1.3 Ce qui manque (problème identifié)

| Problème | Description |
|----------|-------------|
| **Pas de vérification manuelle** | L'utilisateur ne peut pas déclencher une recherche de mise à jour lui-même |
| **Pas de section "À propos"** | Aucun endroit dans l'UI pour voir la version actuelle de l'application |
| **Pas de contrôle utilisateur** | L'utilisateur subit la notification sans pouvoir configurer le comportement |
| **Version dismissée volatile** | La version refusée est stockée en `useRef` (perdue au redémarrage), ce qui fait que le dialog réapparaît à chaque lancement |

---

## 2. Spécification cible

### 2.1 Philosophie

L'utilisateur doit avoir le **contrôle total** sur les mises à jour :
- Pouvoir **rechercher** manuellement une mise à jour à tout moment
- Pouvoir **choisir** d'installer ou de reporter
- Pouvoir **voir** la version actuelle de l'application
- Continuer à être **notifié** automatiquement (opt-in, pas intrusif)

### 2.2 Fonctionnalités détaillées

#### F1 — Section « À propos / Mise à jour » dans les Paramètres

Ajouter une nouvelle section dans la page [Settings.tsx](file:///c:/Users/henri/Projets/ragkit_desktop/desktop/src/pages/Settings.tsx) accessible depuis la navigation latérale.

**Contenu de la section :**

```
┌─────────────────────────────────────────────────────┐
│ À propos de LOKO                                     │
│                                                       │
│ Version actuelle : v1.4.37                           │
│                                                       │
│ ┌───────────────────────────────────────────────┐     │
│ │  🔍 Rechercher une mise à jour                │     │
│ └───────────────────────────────────────────────┘     │
│                                                       │
│ ── ou si une mise à jour est trouvée ──              │
│                                                       │
│ ┌───────────────────────────────────────────────┐     │
│ │  ✅ Version 1.5.0 disponible                   │     │
│ │                                                │     │
│ │  ┌──────────────────────┐                      │     │
│ │  │ Installer et redémarrer │                   │     │
│ │  └──────────────────────┘                      │     │
│ │                                                │     │
│ │  ┌──────────────────────┐                      │     │
│ │  │ Reporter              │                     │     │
│ │  └──────────────────────┘                      │     │
│ └───────────────────────────────────────────────┘     │
│                                                       │
│ Vérification automatique : ✅ activée                │
│ Dernière vérification : il y a 2 heures              │
└─────────────────────────────────────────────────────┘
```

**États possibles de la section :**

| État | Affichage |
|------|-----------|
| `idle` | Bouton "Rechercher une mise à jour" + texte "Dernière vérification : il y a X" |
| `checking` | Spinner + "Vérification en cours..." (bouton désactivé) |
| `up-to-date` | ✅ "Vous utilisez la version la plus récente." |
| `available` | Badge vert "Version X.Y.Z disponible" + bouton "Installer et redémarrer" + bouton "Reporter" |
| `downloading` | Barre de progression avec % + "Téléchargement en cours..." |
| `installing` | Spinner + "Installation... L'application va redémarrer." |
| `error` | ❌ Message d'erreur + bouton "Réessayer" |

#### F2 — Indicateur de mise à jour dans la Sidebar

Ajouter un **badge discret** dans le footer de la [Sidebar.tsx](file:///c:/Users/henri/Projets/ragkit_desktop/desktop/src/components/layout/Sidebar.tsx), à côté de l'indicateur de version actuel.

**Comportement :**
- Quand une mise à jour est disponible, afficher un **petit point coloré** (dot notification) à côté de la version
- Au clic sur la version ou le dot, naviguer automatiquement vers `Paramètres > À propos`
- Le dot disparaît quand l'utilisateur a vu la page "À propos" avec la mise à jour affichée

#### F3 — Vérification automatique en arrière-plan (conservée et améliorée)

Le mécanisme existant de vérification toutes les 6h est conservé mais amélioré :

- **La vérification automatique reste activée par défaut**
- L'utilisateur peut la **désactiver** via un toggle dans la section "À propos"
- La préférence est persistée en `localStorage` (clé : `loko-auto-update-check`)
- La **dernière date de vérification** est persistée en `localStorage` (clé : `loko-last-update-check`)
- Si une mise à jour est disponible et l'utilisateur ne l'a pas encore vue dans la page Settings, le **dialog modal existant** s'affiche toujours (mais une seule fois par version et par session)

#### F4 — Persistance de la version refusée

La version refusée par l'utilisateur (via "Plus tard" ou "Reporter") est persistée en `localStorage` (clé : `loko-dismissed-update-version`) au lieu d'un simple `useRef`.

Cela évite que le dialog réapparaisse à chaque redémarrage pour la même version.

---

## 3. Architecture technique

### 3.1 Nouveau hook : `useAppUpdater`

Créer un **hook centralisé** qui remplace la logique actuellement dispersée dans `AppUpdateManager.tsx`.

**Fichier :** `desktop/src/hooks/useAppUpdater.ts`

```typescript
// État exposé par le hook
interface UpdaterState {
  // Version actuelle de l'app (depuis Tauri)
  currentVersion: string | null;
  // Version disponible (null = pas de mise à jour / pas encore vérifié)  
  availableVersion: string | null;
  // État du processus
  status: "idle" | "checking" | "up-to-date" | "available" | "downloading" | "installing" | "error";
  // Progression du téléchargement (0-100, null si pas applicable)
  downloadPercent: number | null;
  // Message d'erreur (null si pas d'erreur)
  errorMessage: string | null;
  // Dernière vérification (timestamp ISO)
  lastCheckedAt: string | null;
  // Vérification automatique activée
  autoCheckEnabled: boolean;
}

interface UpdaterActions {
  // Lancer une vérification manuelle
  checkForUpdates: () => Promise<void>;
  // Lancer le téléchargement et l'installation
  installUpdate: () => Promise<void>;
  // Reporter la mise à jour (persiste la version refusée)
  dismissUpdate: () => void;
  // Activer/désactiver la vérification automatique
  setAutoCheckEnabled: (enabled: boolean) => void;
}
```

**Logique interne :**
1. Au montage, lire `localStorage` pour `loko-auto-update-check` et `loko-last-update-check`
2. Obtenir la version actuelle via `getVersion()` de `@tauri-apps/api/app`
3. Si auto-check activé, planifier un `setInterval` de 6h
4. Sur `checkForUpdates()`, appeler `check()` de `@tauri-apps/plugin-updater`
5. Stocker l'objet `Update` dans un `useRef` pour le cycle de vie
6. Sur `installUpdate()`, appeler `update.downloadAndInstall()` puis `relaunch()`
7. Sur `dismissUpdate()`, écrire la version dans `loko-dismissed-update-version` de `localStorage`

### 3.2 Provider/Context pour partager l'état

Créer un **contexte React** pour partager l'état de l'updater entre `AppUpdateManager` (dialog), `Sidebar` (badge) et `Settings > About` (section complète).

**Fichier :** `desktop/src/hooks/useAppUpdater.ts` (même fichier, exporte aussi le Provider)

```typescript
export const AppUpdaterProvider: React.FC<{ children: React.ReactNode }>;
export function useAppUpdater(): UpdaterState & UpdaterActions;
```

### 3.3 Composant `AboutSettings`

**Fichier :** `desktop/src/components/settings/AboutSettings.tsx`

Ce composant consomme le hook `useAppUpdater()` et affiche la section complète décrite en F1.

**Structure JSX :**
```
<section>
  <h2>À propos de LOKO</h2>
  
  <div class="version-card">
    <span>Version actuelle</span>
    <span class="version-number">v{currentVersion}</span>
  </div>

  {/* Zone dynamique selon le status */}
  <UpdateStatusCard ... />

  <div class="auto-check-toggle">
    <Toggle ... />
    <span>Vérification automatique des mises à jour</span>
  </div>

  {lastCheckedAt && (
    <span class="last-checked">
      Dernière vérification : {formatRelativeTime(lastCheckedAt)}
    </span>
  )}
</section>
```

### 3.4 Modifications du composant `AppUpdateManager`

Le composant **continue d'exister** mais est simplifié :
- Il consomme `useAppUpdater()` au lieu de gérer son propre état
- Il ne fait **que** afficher le dialog modal de notification
- Le dialog ne s'affiche que si :
  - `status === "available"` ET
  - L'utilisateur n'a pas encore visité la page "À propos" depuis que la mise à jour a été détectée ET
  - La version n'a pas été refusée (persistée en `localStorage`)
- Ce composant n'a plus de logique de vérification périodique (déplacée dans le hook)

### 3.5 Modifications de la Sidebar

Dans [Sidebar.tsx](file:///c:/Users/henri/Projets/ragkit_desktop/desktop/src/components/layout/Sidebar.tsx), modifier la zone de version (L364-382) :

```typescript
// Avant
{backendVersion ? `v${backendVersion}` : "..."}

// Après : ajout d'un dot de notification + clic pour naviguer
const { availableVersion, status } = useAppUpdater();
const hasUpdate = status === "available";

<div 
  className="flex items-center gap-1.5 cursor-pointer"
  onClick={() => navigate("/settings/about")}
  title={hasUpdate ? t("updater.availableTitle") : t("backend.connected")}
>
  <div className="w-2 h-2 rounded-full" style={{ background: ... }} />
  <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
    {backendVersion ? `v${backendVersion}` : "..."}
  </span>
  {hasUpdate && (
    <div 
      className="w-2 h-2 rounded-full animate-pulse" 
      style={{ background: "var(--primary-500)" }} 
    />
  )}
</div>
```

### 3.6 Modifications de la page Settings

Dans [Settings.tsx](file:///c:/Users/henri/Projets/ragkit_desktop/desktop/src/pages/Settings.tsx) :

1. Ajouter `"about"` au type `Section`
2. Ajouter le bouton nav avec icône `Info` de lucide-react
3. Ajouter le rendu conditionnel `{activeSection === "about" && <AboutSettings />}`
4. La section "À propos" est **toujours visible** quel que soit le niveau d'expertise
5. Elle apparaît en **dernière position** dans la navigation, après "Sécurité"

### 3.7 Modifications de l'App (Provider)

Dans [App.tsx](file:///c:/Users/henri/Projets/ragkit_desktop/desktop/src/App.tsx) :

```typescript
// Envelopper l'application dans le Provider
import { AppUpdaterProvider } from "./hooks/useAppUpdater";

return (
  <AppUpdaterProvider>
    <AppUpdateManager />
    <BrowserRouter>
      ...
    </BrowserRouter>
  </AppUpdaterProvider>
);
```

---

## 4. Traductions à ajouter

### 4.1 Français (`fr.json`)

```json
{
  "updater": {
    // Clés existantes conservées...
    "aboutTitle": "À propos de LOKO",
    "currentVersion": "Version actuelle",
    "checkForUpdates": "Rechercher une mise à jour",
    "checking": "Vérification en cours...",
    "upToDate": "Vous utilisez la version la plus récente.",
    "newVersionAvailable": "Une nouvelle version est disponible !",
    "version": "Version {{version}}",
    "installAndRestart": "Installer et redémarrer",
    "postpone": "Reporter",
    "downloading": "Téléchargement en cours...",
    "downloadPercent": "Téléchargement : {{percent}}%",
    "installing": "Installation en cours...",
    "installRestart": "L'application va redémarrer automatiquement.",
    "updateError": "La mise à jour a échoué : {{error}}",
    "retry": "Réessayer",
    "autoCheck": "Vérification automatique des mises à jour",
    "lastChecked": "Dernière vérification : {{time}}",
    "neverChecked": "Jamais vérifié"
  }
}
```

### 4.2 Anglais (`en.json`)

```json
{
  "updater": {
    // Clés existantes conservées...
    "aboutTitle": "About LOKO",
    "currentVersion": "Current version",
    "checkForUpdates": "Check for updates",
    "checking": "Checking...",
    "upToDate": "You are using the latest version.",
    "newVersionAvailable": "A new version is available!",
    "version": "Version {{version}}",
    "installAndRestart": "Install and restart",
    "postpone": "Postpone",
    "downloading": "Downloading...",
    "downloadPercent": "Downloading: {{percent}}%",
    "installing": "Installing...",
    "installRestart": "The application will restart automatically.",
    "updateError": "Update failed: {{error}}",
    "retry": "Retry",
    "autoCheck": "Automatically check for updates",
    "lastChecked": "Last checked: {{time}}",
    "neverChecked": "Never checked"
  }
}
```

---

## 5. Fichiers à créer / modifier

| Action | Fichier | Description |
|--------|---------|-------------|
| **CRÉER** | `desktop/src/hooks/useAppUpdater.ts` | Hook + Context + Provider centralisé |
| **CRÉER** | `desktop/src/components/settings/AboutSettings.tsx` | Composant de la section "À propos" |
| **MODIFIER** | `desktop/src/components/ui/AppUpdateManager.tsx` | Simplifier : consomme le hook au lieu de gérer l'état |
| **MODIFIER** | `desktop/src/components/layout/Sidebar.tsx` | Ajouter badge de notification + clic vers settings |
| **MODIFIER** | `desktop/src/pages/Settings.tsx` | Ajouter section "about" dans la navigation |
| **MODIFIER** | `desktop/src/App.tsx` | Envelopper dans `AppUpdaterProvider` |
| **MODIFIER** | `desktop/src/locales/fr.json` | Nouvelles clés de traduction |
| **MODIFIER** | `desktop/src/locales/en.json` | Nouvelles clés de traduction |

---

## 6. Clés `localStorage` utilisées

| Clé | Type | Default | Description |
|-----|------|---------|-------------|
| `loko-auto-update-check` | `"true" \| "false"` | `"true"` | Vérification automatique activée |
| `loko-last-update-check` | ISO timestamp string | `null` | Date de dernière vérification |
| `loko-dismissed-update-version` | semver string | `null` | Version refusée par l'utilisateur |

---

## 7. Flux utilisateur

### 7.1 Flux automatique (au démarrage)

```mermaid
flowchart TD
    A[App démarre] --> B{Auto-check activé ?}
    B -- Non --> Z[Fin - Rien ne se passe]
    B -- Oui --> C[check\(\) via Tauri updater]
    C --> D{Mise à jour disponible ?}
    D -- Non --> E[Stocker lastCheckedAt]
    D -- Oui --> F{Version déjà refusée ?}
    F -- Oui --> E
    F -- Non --> G[Afficher dialog modal]
    G --> H{Choix utilisateur}
    H -- "Installer" --> I[downloadAndInstall\(\)]
    I --> J[relaunch\(\)]
    H -- "Plus tard" --> K[Stocker version refusée dans localStorage]
    K --> L[Badge dot dans Sidebar]
```

### 7.2 Flux manuel (depuis Settings)

```mermaid
flowchart TD
    A[Utilisateur ouvre Settings > À propos] --> B[Voit version actuelle]
    B --> C[Clique "Rechercher une mise à jour"]
    C --> D[status = checking, spinner affiché]
    D --> E{Résultat}
    E -- "Pas de mise à jour" --> F[Affiche "Vous utilisez la version la plus récente"]
    E -- "Mise à jour trouvée" --> G[Affiche card avec version + bouton install]
    E -- "Erreur réseau" --> H[Affiche erreur + bouton réessayer]
    G --> I{Choix utilisateur}
    I -- "Installer et redémarrer" --> J[downloadAndInstall\(\) avec barre de progression]
    J --> K[relaunch\(\)]
    I -- "Reporter" --> L[Masquer mais garder le badge dans Sidebar]
```

---

## 8. Contraintes & edge cases

1. **Mode développement** : `check()` retourne toujours `null` en dev. Le composant doit gérer ce cas gracieusement.
2. **Pas de connexion réseau** : `check()` lèvera une erreur. Afficher un message clair ("Impossible de vérifier. Vérifiez votre connexion.").
3. **Release GitHub en draft** : L'updater ne verra pas la mise à jour. C'est un pré-requis CI, pas un problème frontend.
4. **Utilisateur ferme la fenêtre pendant le download** : Le download est interrompu. Au prochain lancement, la vérification auto reprendra.
5. **Multiples vérifications simultanées** : Le hook utilise un `isCheckingRef` pour empêcher les appels concurrents (comportement existant conservé).
6. **Version actuelle** : Obtenue via `getVersion()` de `@tauri-apps/api/app`. Retourne la version de `tauri.conf.json`.

---

## 9. Design de l'UI

### 9.1 Section "À propos" — Mockup textuel

```
╭────────────────────────────────────────────────────╮
│                                                     │
│  ℹ️  À propos de LOKO                               │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  │  LOKO                                         │  │
│  │  Version 1.4.37                               │  │
│  │                                               │  │
│  │  Votre assistant documentaire intelligent     │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Mises à jour                                       │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  ┌──────────────────────────────────┐               │
│  │  🔍 Rechercher une mise à jour   │               │
│  └──────────────────────────────────┘               │
│                                                     │
│  ☑ Vérification automatique des mises à jour        │
│  Dernière vérification : il y a 2 heures            │
│                                                     │
╰────────────────────────────────────────────────────╯
```

### 9.2 Quand une mise à jour est disponible

```
╭────────────────────────────────────────────────────╮
│                                                     │
│  Mises à jour                                       │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  🟢 Nouvelle version disponible !              │  │
│  │                                               │  │
│  │  Version 1.5.0                                │  │
│  │                                               │  │
│  │  ┌────────────────────────┐ ┌──────────┐      │  │
│  │  │ Installer et redémarrer│ │ Reporter │      │  │
│  │  └────────────────────────┘ └──────────┘      │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
╰────────────────────────────────────────────────────╯
```

### 9.3 Pendant le téléchargement

```
╭────────────────────────────────────────────────────╮
│  ┌───────────────────────────────────────────────┐  │
│  │  ⬇️  Téléchargement en cours...                │  │
│  │                                               │  │
│  │  ████████████████░░░░░░░░░░░░  67%            │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
╰────────────────────────────────────────────────────╯
```

---

## 10. Priorité d'implémentation

| Ordre | Tâche | Effort estimé |
|-------|-------|---------------|
| 1 | Créer `useAppUpdater.ts` (hook + context) | Moyen |
| 2 | Créer `AboutSettings.tsx` | Moyen |
| 3 | Intégrer dans `Settings.tsx` (section "about") | Faible |
| 4 | Modifier `App.tsx` (Provider) | Faible |
| 5 | Modifier `AppUpdateManager.tsx` (consomme le hook) | Faible |
| 6 | Ajouter les traductions FR/EN | Faible |
| 7 | Modifier `Sidebar.tsx` (badge notification) | Faible |

Total estimé : **~400 lignes de code** (200 hook + 150 AboutSettings + 50 modifications).
