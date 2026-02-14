# Spécification différentielle — Étape 1 : Reste à faire

> **Base** : `specs-etape-1.md`
> **État actuel** : tag `v1.0.4` (commit `5e72ab0`)
> **Date d'analyse** : 13 février 2026

Ce document recense de manière exhaustive les écarts entre l'implémentation actuelle et la spécification `specs-etape-1.md`. Chaque item est classé par priorité (P0 = bloquant, P1 = fonctionnel manquant, P2 = cosmétique/qualité).

---

## 0. Architecture : deux backends parallèles non raccordés

**Constat critique** : il existe deux jeux de modèles et de logique métier en parallèle, non raccordés :

| Fichier | Rôle | Utilisé en prod ? |
|---------|------|-------------------|
| `ragkit/config/ingestion_schema.py` | Schéma Pydantic simplifié (sans validators) | **OUI** — importé par `wizard.py` et `ingestion.py` |
| `ragkit/desktop/models.py` | Schéma Pydantic complet (avec validators, `SettingsPayload`, `DocumentMetadataUpdate`, `AnalysisResult`, etc.) | **NON** — importé seulement par `documents.py` |
| `ragkit/desktop/api/wizard.py` | Routes wizard (version simplifiée, inline) | **OUI** — branché sur FastAPI |
| `ragkit/desktop/api/ingestion.py` | Routes ingestion (stubs) | **OUI** — branché sur FastAPI |
| `ragkit/desktop/documents.py` | Logique complète de parsing/analyse (PDF, DOCX, MD, TXT, HTML, JSON, YAML, déduplication, détection langue, extraction métadonnées) | **NON** — jamais appelé |

**Action requise** : Unifier sur `ragkit/desktop/models.py` (le plus complet) et brancher `ragkit/desktop/documents.py` sur les endpoints API. Supprimer `ragkit/config/ingestion_schema.py` et `ragkit/config/manager.py` en fusionnant leur rôle dans les modules `models.py` / `documents.py` existants, ou bien faire pointer les routes vers la bonne couche.

---

## 1. Bug utilisateur — Les dossiers exclus ne changent pas le compteur (P0)

### Symptôme
Sur l'écran 3, décocher des sous-dossiers dans l'arborescence ne modifie pas le compteur « X fichiers trouvés · Y Mo ».

### Cause racine
`FolderStep.tsx` :
- Le compteur affiche `state.folderStats.files` et `state.folderStats.size_mb`, qui sont calculés une seule fois par `validate_folder` au moment de la sélection du dossier.
- Quand l'utilisateur coche/décoche un sous-dossier, seul `excludedFolders` dans le state est mis à jour — aucun recalcul n'est déclenché.
- La spec (§2.1.3) dit : **« nombre de fichiers et taille totale mis à jour dynamiquement selon les filtres »**.

### Correction requise
Deux options :
1. **Option A (recommandée)** : après chaque toggle d'exclusion, rappeler le backend `scan_folder` avec les `excluded_dirs` à jour et recalculer les stats.
2. **Option B** : calculer les stats côté frontend en soustrayant les `file_count` des nœuds exclus dans le tree. Plus rapide mais approximatif (ne gère pas les patterns d'exclusion).

---

## 2. Écran 3 — Patterns d'exclusion avancés manquants (P1)

### Spec (§2.1.3)
```
▸ Patterns d'exclusion avancés
┌────────────────────────────────────────────────────────┐
│  Exclure les fichiers contenant : [*_draft.*, *_old.*] │
│  Taille maximale par fichier :    [50] Mo              │
└────────────────────────────────────────────────────────┘
```

### État actuel
Section complètement absente de `FolderStep.tsx`. Le champ `exclusion_patterns` et `max_file_size_mb` existent dans `SourceConfig` mais ne sont exposés nulle part dans le wizard.

### Correction requise
- Ajouter une section dépliable « Patterns d'exclusion avancés » (repliée par défaut) en dessous de l'arborescence.
- Champ texte pour les patterns glob (séparés par virgule) → `exclusionPatterns` dans le state wizard.
- Champ numérique pour la taille max → `maxFileSizeMb` dans le state wizard.
- Passer ces valeurs au `scan_folder` / `validate_folder` pour recalcul dynamique.
- Inclure dans la config finale via `completeWizard()`.

---

## 3. Écran 4 — FileTypesStep incomplet (P0)

### 3.1 Pas d'appel à `scan_folder`

**Spec (§2.1.4)** : « Scan automatique : au chargement, appel backend qui scanne le dossier sélectionné et liste tous les types trouvés avec compteurs. »

**État actuel** : `FileTypesStep.tsx` affiche les extensions brutes depuis `state.folderStats.extensions` (issues de `validate_folder`). Pas d'appel à `scan_folder` qui retourne les types **supportés** vs **non supportés** avec compteurs et tailles par type.

**Correction requise** :
- Au montage de `FileTypesStep`, appeler `invoke("scan_folder", { params: { folder_path, recursive, excluded_dirs, exclusion_patterns } })`.
- Stocker le résultat `FolderScanResult` (avec `supported_types` et `unsupported_types`) dans le state wizard.
- Afficher deux sections distinctes : « Supportés » (avec checkboxes) et « Non supportés » (grisés, avec info-bulle).

### 3.2 Checkboxes non fonctionnelles

**Spec** : « Types supportés : cochés par défaut. L'utilisateur peut décocher. »

**État actuel** : `<input type="checkbox" checked readOnly />` — les checkboxes sont en lecture seule et le state `includedFileTypes` n'est jamais modifié.

**Correction requise** :
- Remplacer `readOnly` par un `onChange` qui met à jour `includedFileTypes` dans `useWizard.ts`.
- Le compteur total en bas doit refléter uniquement les types cochés.

### 3.3 Section « Non supportés » absente

**Spec (§2.1.4)** : « Types non supportés : grisés avec icône ⊘ et info-bulle explicative. Non cochables. »

**État actuel** : Tous les types sont affichés dans une seule liste sans distinction supporté/non supporté.

**Correction requise** :
- Séparer en deux blocs visuels : `supported_types` et `unsupported_types` (données issues de `scan_folder`).
- Les non supportés doivent être grisés avec icône ⊘ et un message explicatif (ex : « Les images ne sont pas encore supportées »).

### 3.4 Récapitulatif du profil incomplet

**Spec (§2.1.4)** :
```
Profil détecté : 📜 Juridique / Réglementaire
Calibrage : Q1=Non Q2=Oui Q3=Oui Q4=Oui Q5=Non Q6=Oui

Paramètres appliqués :
· Chunking : récursif, 1536 tokens
· Recherche : hybride + reranking
· Température LLM : 0.1
· Citations : oui, format footnote
```

**État actuel** (`ProfileSummary.tsx`) : Affiche seulement le nom du profil + 1-2 « paramètres clés » génériques (« Standard », « Extraction tableaux », etc.). Pas de détail des réponses de calibrage ni des paramètres calculés.

**Correction requise** :
- Afficher les réponses de calibrage (Q1–Q6) avec Oui/Non.
- Afficher les paramètres clés calculés par le profil + modificateurs : chunking strategy/size, architecture de recherche, température LLM, format de citation.
- Ces données doivent venir du résultat de `analyze_wizard_profile` (qui doit lui-même les calculer — voir §5).

---

## 4. Écran 4 — Redirection post-wizard (P1)

### Spec (§2.1.4, critère F10)
« Après "Terminer", la sidebar réapparaît et l'onglet Paramètres > Ingestion est affiché. »

### État actuel
`WizardContainer.tsx` fait un `window.location.reload()`. Après le fix `ingestion.py`, l'app se recharge correctement vers la page principale (Chat par défaut).

### Correction requise
Après le reload, naviguer vers `/settings` (pas `/chat`). Deux options :
1. Stocker un flag `?setup=complete` dans l'URL et le détecter dans `App.tsx` pour rediriger.
2. Utiliser un state transitoire (localStorage ou Zustand) pour déclencher la navigation vers Settings.

---

## 5. Backend — `analyze_profile` incomplet (P0)

### 5.1 Profils manquants (section 4.2.1)

| Profil | Implémenté ? | Détails |
|--------|-------------|---------|
| `technical_documentation` | Partiel | Manque `preprocessing.deduplication_strategy: exact` (c'est le défaut donc OK), mais le `deduplication_threshold` de `0.95` est bien appliqué. OK au final. |
| `faq_support` | Partiel | OK pour l'essentiel. |
| `legal_compliance` | Partiel | OK pour l'essentiel. |
| `reports_analysis` | **NON** | Aucune configuration spécifique. Devrait avoir `table_extraction_strategy: markdown`, `deduplication_threshold: 0.95`. |
| `general` | **NON** | Aucune configuration spécifique. Devrait avoir `deduplication_threshold: 0.90`. |

**Correction requise** : Implémenter les defaults pour `reports_analysis` et `general` selon la matrice 4.2.1 complète.

### 5.2 Modificateurs de calibrage manquants (section 4.4)

| Q# | Implémenté ? | Modifications attendues si OUI |
|----|-------------|-------------------------------|
| Q1 | **OUI** | `table_extraction_strategy→markdown`, `ocr_enabled→true`, `image_captioning_enabled→true` |
| Q2 | **NON** | Paramètres futurs : `retrieval.semantic.top_k += 10`, `llm.context_max_chunks += 3`, etc. Doivent être stockés dans `SettingsPayload`. |
| Q3 | **NON** | Paramètres futurs : `chunking.chunk_size ×= 1.5`, `chunking.chunk_overlap ×= 1.5`, etc. |
| Q4 | **NON** | Paramètres futurs : `rerank.enabled → true`, `llm.temperature → min(profil, 0.1)`, etc. |
| Q5 | **NON** | Paramètres futurs : `ingestion.mode → auto`, `ingestion.watch_enabled → true`. |
| Q6 | **NON** | Paramètres futurs : `chunking.add_chunk_index → true`, `llm.cite_sources → true`, `llm.citation_format → footnote`. |

**Correction requise** : Même si les paramètres des étapes futures (chunking, embedding, retrieval, rerank, llm, agents) ne sont pas utilisés à l'étape 1, ils doivent être **calculés et stockés** dans `settings.json` pour les étapes suivantes. L'endpoint `analyze_profile` doit retourner un `SettingsPayload` complet (modèle déjà défini dans `models.py`).

### 5.3 Format de persistance incomplet (section 5.6)

**Spec** : Le fichier `settings.json` doit contenir toutes les sections : `version`, `setup_completed`, `profile`, `calibration_answers`, `ingestion`, `chunking`, `embedding`, `retrieval`, `rerank`, `llm`, `agents`.

**État actuel** : Seule la section `ingestion` (source + parsing + preprocessing) est sauvegardée. Le modèle `SettingsPayload` existe dans `models.py` mais n'est pas utilisé.

**Correction requise** :
- `complete_wizard` doit sauvegarder un `SettingsPayload` complet, pas juste un `IngestionConfig`.
- `ConfigManager` doit sauvegarder/charger un `SettingsPayload`.
- Le check `hasCompletedSetup` côté frontend doit vérifier `setup_completed: true` (pas `source.path.length > 0`).

---

## 6. Backend — Pipeline d'analyse des documents non branché (P0)

### Spec (§2.2, critères F12, F13, T5, T6)
- Après le wizard, le backend parcourt tous les documents retenus et extrait les métadonnées (techniques + fonctionnelles).
- Le tableau de métadonnées éditables est affiché dans Paramètres > Ingestion.
- Le bouton « Réanalyser » relance l'analyse.

### État actuel
- `ragkit/desktop/documents.py` contient une implémentation **complète et fonctionnelle** de `analyze_documents()` avec parsing PDF/DOCX/MD/TXT/HTML/JSON/YAML, détection de langue, extraction de mots-clés, déduplication, etc.
- **MAIS** : les endpoints dans `ragkit/desktop/api/ingestion.py` ne l'appellent jamais :
  - `POST /api/ingestion/analyze` → retourne `{"status": "started"}` (stub).
  - `GET /api/ingestion/documents` → retourne `[]` (liste vide en mémoire).
  - `PUT /api/ingestion/documents/{id}/metadata` → retourne un mock.

### Correction requise
1. Importer et appeler `documents.analyze_documents(config)` dans l'endpoint `POST /api/ingestion/analyze`.
2. Stocker le résultat dans `_DOCUMENTS` (ou un store persistant).
3. Faire que `GET /api/ingestion/documents` retourne les documents analysés.
4. Faire que `PUT /api/ingestion/documents/{id}/metadata` modifie réellement les métadonnées en mémoire.
5. Déclencher automatiquement l'analyse après `complete_wizard`.

---

## 7. Backend — Dépendances Python manquantes (P1)

### Spec (§5.7)
```toml
dependencies = [
    "fastapi>=0.100",
    "uvicorn>=0.20",
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
    "pyyaml>=6.0",
    "python-dotenv>=1.0",
    "langdetect>=1.0",
    "unstructured>=0.10",
]
```

### État actuel (`pyproject.toml`)
```toml
dependencies = [
    "fastapi>=0.100",
    "uvicorn>=0.20",
]
```

### Correction requise
Ajouter les dépendances manquantes :
- `pydantic>=2.0` (utilisé partout, fonctionne par chance via FastAPI qui le tire en transitive)
- `langdetect>=1.0` (importé dans `documents.py` avec try/except → détection de langue silencieusement désactivée)
- `pypdf>=3.0` (pour l'extraction PDF — importé dans `documents.py` avec try/except)
- `python-docx>=0.8` (pour l'extraction DOCX — importé dans `documents.py` avec try/except)
- `pyyaml>=6.0` (pour le parsing YAML — importé dans `documents.py` avec try/except)

**Note** : `unstructured>=0.10` est une dépendance lourde (~1 Go). Elle peut être mise en optionnel si le moteur `auto` utilise `pypdf`/`python-docx` directement (ce que fait `documents.py` actuellement).

---

## 8. Frontend — MetadataTable non fonctionnel (P1)

### Spec (§2.3, critère F12)
« Le tableau de métadonnées permet d'éditer titre et auteur pour chaque document. »

### État actuel
`MetadataTable.tsx` :
- Les champs titre et auteur sont des `<input>` avec `defaultValue` mais aucun `onChange` handler.
- Aucun appel à `update_document_metadata` n'est déclenché.
- Le tableau est toujours vide car `_DOCUMENTS` n'est jamais peuplé (voir §6).

### Correction requise
1. Ajouter un `onChange`/`onBlur` handler sur chaque input.
2. Appeler `invoke("update_document_metadata", { id, metadata: { title, author } })`.
3. Brancher le backend pour persister les modifications (voir §6).

---

## 9. Frontend — SourceSettings minimal (P2)

### Spec (§2.3)
La section Source dans Paramètres doit afficher :
- Répertoire (avec bouton Modifier)
- Récursif (checkbox)
- Sous-dossiers exclus (liste)
- Types de fichiers (liste)
- Patterns d'exclusion (champ texte)
- Taille max fichier (champ numérique)

### État actuel
`SourceSettings.tsx` n'affiche que :
- Répertoire (lecture seule, bouton « Modifier » désactivé)
- Récursif (checkbox)

### Correction requise
Ajouter les champs manquants :
- Liste des sous-dossiers exclus (éditable).
- Liste des types de fichiers (avec checkboxes).
- Champ patterns d'exclusion.
- Champ numérique taille max.
- Rendre le bouton « Modifier » fonctionnel (ouvre le dialogue natif).

---

## 10. Frontend — Traductions i18n incomplètes (P2)

### Spec (critère F15)
« Tous les textes sont traduits FR/EN via i18n. »

### État actuel
`fr.json` et `en.json` ne contiennent que les clés de base : `app`, `navigation`, `layout`, `chat`, `settings`, `dashboard`, `backend`.

### Manquant
- Namespace `wizard.*` : titres des étapes, textes des profils, questions de calibrage, tooltips, boutons.
- Namespace `ingestion.*` : labels des sections Source/Parsing/Preprocessing, labels de chaque champ, options des selects, descriptions.
- Namespace `documents.*` : titres du tableau, colonnes, messages vides.

### Correction requise
Tous les textes actuellement en dur dans les composants doivent utiliser `useTranslation()` avec des clés i18n.

---

## 11. Frontend — `ipc.ts` non utilisé comme couche d'abstraction (P2)

### Spec (§5.4)
`lib/ipc.ts` doit exposer toutes les routes comme fonctions typées.

### État actuel
`ipc.ts` ne contient que `healthCheck`. Tous les composants appellent `invoke()` directement.

### Correction requise
Centraliser tous les appels dans `ipc.ts` avec des signatures typées :
```typescript
export const ipc = {
    healthCheck: () => invoke<...>("health_check"),
    validateFolder: (path: string, recursive?: boolean) => invoke<...>("validate_folder", { path, recursive }),
    scanFolder: (params: ScanFolderParams) => invoke<...>("scan_folder", { params }),
    // ... etc.
};
```

---

## 12. ParsingSettings — Langue OCR non éditable (P2)

### Spec (§2.3)
```
Langue OCR :  [▾ fra, eng]
```

### État actuel
`ParsingSettings.tsx` n'affiche pas de champ pour `parsing.ocr_language`. Quand l'OCR est activé, seul le moteur OCR est affiché.

### Correction requise
Ajouter un champ multi-select ou tag input pour les langues OCR (apparaît quand `ocr_enabled` est true).

---

## Synthèse par priorité

### P0 — Bloquants fonctionnels

| # | Item | Fichiers impactés |
|---|------|-------------------|
| 1 | Compteur de fichiers ne change pas quand on exclut des dossiers | `FolderStep.tsx`, `useWizard.ts` |
| 3 | FileTypesStep : pas d'appel `scan_folder`, checkboxes non fonctionnelles, pas de section « non supportés » | `FileTypesStep.tsx`, `useWizard.ts` |
| 5 | `analyze_profile` : profils `reports_analysis`/`general` manquants, modificateurs Q2–Q6 manquants, pas de stockage des params futures | `wizard.py` |
| 6 | Pipeline d'analyse des documents non branché sur les endpoints API | `ingestion.py`, `documents.py` |

### P1 — Fonctionnels manquants

| # | Item | Fichiers impactés |
|---|------|-------------------|
| 0 | Unification des deux backends parallèles (`ingestion_schema.py` vs `models.py`) | Architecture globale |
| 2 | Patterns d'exclusion avancés absents de l'écran 3 | `FolderStep.tsx`, `useWizard.ts` |
| 4 | Redirection vers Settings après wizard (pas vers Chat) | `WizardContainer.tsx`, `App.tsx` |
| 7 | Dépendances Python manquantes (`langdetect`, `pypdf`, `python-docx`, `pyyaml`) | `pyproject.toml` |
| 8 | MetadataTable : édition titre/auteur non fonctionnelle | `MetadataTable.tsx`, `ingestion.py` |

### P2 — Qualité / cosmétique

| # | Item | Fichiers impactés |
|---|------|-------------------|
| 9 | SourceSettings : champs manquants (excluded_dirs, file_types, patterns, max_size) | `SourceSettings.tsx` |
| 10 | Traductions i18n : textes en dur au lieu de clés i18n | `fr.json`, `en.json`, tous les composants wizard + settings |
| 11 | `ipc.ts` : pas de couche d'abstraction centralisée | `ipc.ts` |
| 12 | ParsingSettings : champ langue OCR manquant | `ParsingSettings.tsx` |

---

## Critères d'acceptation non satisfaits

| Critère | Statut | Blocage |
|---------|--------|---------|
| F1 — Wizard au premier lancement | ✅ OK | — |
| F2 — 4 écrans avec navigation | ✅ OK | — |
| F3 — 5 profils en cartes | ✅ OK | — |
| F4 — 6 questions avec tooltips | ✅ OK | — |
| F5 — Dialogue natif sélection dossier | ✅ OK | — |
| F6 — Arborescence avec checkboxes exclusion | ⚠️ Partiel | §1 — exclusion ne change pas les compteurs |
| F7 — Types de fichiers avec compteurs | ❌ KO | §3 — pas d'appel scan_folder, pas de distinction supporté/non supporté |
| F8 — Types non supportés grisés | ❌ KO | §3.3 |
| F9 — Récapitulatif profil détaillé | ❌ KO | §3.4 |
| F10 — Après wizard → onglet Paramètres > Ingestion | ❌ KO | §4 — redirige vers Chat |
| F11 — 3 sous-sections Source/Parsing/Preprocessing | ✅ OK | — |
| F12 — Tableau métadonnées éditable | ❌ KO | §6 + §8 — tableau vide, édition non fonctionnelle |
| F13 — Bouton Réanalyser | ❌ KO | §6 — l'analyse n'est pas implémentée côté API |
| F14 — Wizard ne se relance pas au redémarrage | ✅ OK | — (corrigé en v1.0.4) |
| F15 — Traductions FR/EN complètes | ❌ KO | §10 |
| T1 — validate-folder retourne valid:true | ✅ OK | — |
| T2 — analyze-profile retourne config complète | ❌ KO | §5 — config partielle |
| T3 — 5×6 combinaisons valides | ❌ KO | §5 — manque 2 profils et 5 modifiers |
| T4 — Scan respecte excluded_dirs/patterns | ⚠️ Backend OK | Frontend ne les transmet pas |
| T5 — Extraction métadonnées PDF/DOCX/MD/TXT | ⚠️ Code existe | §6 — non branché |
| T6 — Détection langue | ⚠️ Code existe | §6 + §7 — non branché + dépendance manquante |
| T7 — Config persistée dans settings.json | ⚠️ Partiel | §5.3 — format simplifié, pas le SettingsPayload complet |
| T8 — GET config retourne la config sauvegardée | ✅ OK | — (corrigé en v1.0.4) |
| T9 — PUT config valide et persiste | ✅ OK | — (corrigé en v1.0.4) |
| T10 — tsc --noEmit sans erreur | ✅ OK | — |
| T11 — CI passe sur 4 targets | ✅ OK | — |
