# RAGKIT Desktop — Améliorations Étape 1 : Ingestion & Préprocessing

> **Version de référence** : v1.1.0
> **Date** : 14 février 2026
> **Statut** : Spécification d'amélioration
> **Spec de référence** : `specs-etape-1.md`, `metadata.md`

---

## Contexte

L'étape 1 est fonctionnelle : le wizard s'exécute, la configuration est sauvegardée, et l'analyse des documents se déclenche automatiquement à l'arrivée sur la page Paramètres. Cependant, 4 axes d'amélioration ont été identifiés lors des tests utilisateur sur la v1.1.0.

---

## Anomalie 1 — Absence d'indicateur de progression pendant l'analyse

### Constat

Quand l'analyse des documents se lance (429+ fichiers, ~280 Mo), l'utilisateur ne voit qu'un spinner statique avec le texte _"Analyse des documents en cours... Cette opération peut prendre quelques minutes"_. Aucune information de progression n'est affichée. Les logs backend ne montrent pas non plus l'avancement.

### Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `ragkit/desktop/documents.py` | Fonction `analyze_documents()` — boucle séquentielle sur les fichiers sans callback |
| `ragkit/desktop/api/ingestion.py` | Endpoint `POST /api/ingestion/analyze` — appel synchrone, pas de suivi |
| `desktop/src/hooks/useDocuments.ts` | Hook — appelle `invoke("analyze_documents")` et attend la fin |
| `desktop/src/components/settings/IngestionSettings.tsx` | UI — affiche un spinner statique |

### Actions à réaliser

**Backend (`documents.py` + `ingestion.py`)**

1. Ajouter un mécanisme de progression dans `analyze_documents()` :
   - Compter le nombre total de fichiers à traiter avant la boucle
   - À chaque fichier traité, mettre à jour un état de progression partagé (ex: variable globale thread-safe ou objet `AnalysisProgress`)
   - Structure de l'état : `{ total: int, processed: int, current_file: str, errors: int, status: "idle" | "running" | "done" | "error" }`

2. Ajouter un endpoint `GET /api/ingestion/analyze/progress` :
   - Retourne l'état de progression courant
   - Réponse : `{ total: 429, processed: 142, current_file: "report_2024.pdf", errors: 3, status: "running", percent: 33 }`

3. Rendre l'analyse asynchrone :
   - `POST /api/ingestion/analyze` lance l'analyse dans un thread/background task et retourne immédiatement `{ status: "started" }`
   - L'analyse tourne en arrière-plan et met à jour l'état de progression

**Rust (`backend.rs`)**

4. Ajouter une commande Tauri `get_analysis_progress` qui appelle `GET /api/ingestion/analyze/progress`

**Frontend (`useDocuments.ts` + `IngestionSettings.tsx`)**

5. Implémenter un polling de progression :
   - Après le lancement de l'analyse, interroger `get_analysis_progress` toutes les 500ms-1s
   - Arrêter le polling quand `status === "done"` ou `status === "error"`

6. Afficher la progression dans l'UI :
   - Barre de progression avec pourcentage : `▓▓▓▓▓▓▓▓░░░░░░░░ 33%`
   - Texte : `"142 / 429 fichiers analysés"`
   - Nom du fichier en cours : `"En cours : report_2024.pdf"`
   - Compteur d'erreurs si > 0 : `"3 erreurs"`
   - Temps estimé restant (optionnel)

### Maquette

```
┌─────────────────────────────────────────────────────────┐
│  Analyse des documents en cours...                       │
│                                                          │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░  142 / 429 fichiers (33%) │
│                                                          │
│  En cours : report_2024.pdf                              │
│  3 erreurs rencontrées                                   │
└─────────────────────────────────────────────────────────┘
```

---

## Anomalie 2 — Métadonnées incomplètes dans l'onglet Métadonnées

### Constat

La table de métadonnées (`MetadataTable.tsx`) n'affiche que 4 colonnes :
- Fichier (filename)
- Titre (title) — éditable
- Auteur (author) — éditable
- Langue (language)

Or la spécification `metadata.md` définit un modèle `DocumentMetadata` beaucoup plus riche. De plus, le modèle `DocumentInfo` dans `models.py` contient déjà des champs qui ne sont pas affichés dans la table (file_type, file_size_bytes, page_count, word_count, encoding, last_modified, keywords, description, creation_date).

### Écart entre l'existant et la spécification

#### Champs déjà extraits par le backend mais non affichés

| Champ `DocumentInfo` | Correspond à (`metadata.md`) | Affiché ? |
|---|---|---|
| `filename` | `source` | Oui |
| `title` | `title` | Oui |
| `author` | `author` | Oui |
| `language` | `language` | Oui |
| `file_path` | `source_path` | Non |
| `file_type` | `source_type` | Non |
| `file_size_bytes` | (dérivable) | Non |
| `page_count` | `page_count` | Non |
| `word_count` | `word_count` | Non |
| `encoding` | `encoding` | Non |
| `last_modified` | `modified_at` | Non |
| `keywords` | `tags` (partiel) | Non |
| `description` | (pas dans metadata.md) | Non |
| `creation_date` | `created_at` | Non |

#### Champs spécifiés dans `metadata.md` mais absents du modèle `DocumentInfo`

| Champ spec | Catégorie | Priorité |
|---|---|---|
| `document_id` | Identification | Existant (= `id`) |
| `source_url` | Identification | Basse (pas pertinent offline) |
| `mime_type` | Identification | Moyenne |
| `ingested_at` | Temporalité | Haute |
| `version` | Temporalité | Basse |
| `char_count` | Contenu | Moyenne |
| `has_tables` | Contenu | Moyenne |
| `has_images` | Contenu | Moyenne |
| `has_code` | Contenu | Moyenne |
| `tags` | Classification | Haute |
| `category` | Classification | Moyenne |
| `confidentiality` | Classification | Basse |
| `status` | Classification | Basse |
| `parser_engine` | Parsing | Haute |
| `ocr_applied` | Parsing | Moyenne |
| `parsing_quality` | Parsing | Basse (pas implémenté) |
| `parsing_warnings` | Parsing | Basse |
| `custom` | Extensible | Basse |
| `tenant`, `domain`, `subdomain` | Hiérarchie org. | Basse (v2) |

### Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `ragkit/desktop/models.py` | Modèle `DocumentInfo` — champs à ajouter |
| `ragkit/desktop/documents.py` | `analyze_documents()` — extraction des nouveaux champs |
| `ragkit/desktop/api/ingestion.py` | Endpoint + modèle `DocumentMetadataUpdate` — champs éditables |
| `desktop/src/hooks/useDocuments.ts` | Interface `DocumentInfo` — ajouter les types |
| `desktop/src/components/settings/MetadataTable.tsx` | Table — refonte complète |

### Actions à réaliser

**Backend (`models.py` + `documents.py`)**

1. Enrichir le modèle `DocumentInfo` avec les champs prioritaires :
   ```
   + mime_type: str | None
   + ingested_at: str          # timestamp ISO au moment de l'analyse
   + char_count: int | None
   + has_tables: bool
   + has_images: bool
   + has_code: bool
   + tags: list[str]           # initialisé à partir de keywords, éditable
   + category: str | None      # éditable par l'utilisateur
   + parser_engine: str        # moteur utilisé pour ce fichier
   + ocr_applied: bool
   ```

2. Enrichir `DocumentMetadataUpdate` pour permettre l'édition :
   ```
   + tags: list[str] | None
   + category: str | None
   + language: str | None
   ```

3. Enrichir `_extract_content()` et les extracteurs spécifiques :
   - Détecter `has_tables` (recherche de patterns tabulaires dans le texte extrait)
   - Détecter `has_code` (recherche de blocs de code markdown ou d'indentation systématique)
   - Détecter `has_images` (pour PDF : vérifier les objets image ; pour DOCX : vérifier les relations image)
   - Calculer `char_count` à partir du texte extrait
   - Enregistrer `mime_type` via `mimetypes.guess_type()`
   - Enregistrer `parser_engine` utilisé et `ocr_applied`

4. Ajouter `ingested_at = datetime.now(timezone.utc).isoformat()` dans `analyze_documents()`

**Frontend (`MetadataTable.tsx` + `useDocuments.ts`)**

5. Refondre `MetadataTable` en un composant tabulaire avancé :

   **Vue par défaut (colonnes visibles)** :
   | Fichier | Type | Taille | Pages | Mots | Langue | Titre | Auteur | Tags |

   **Fonctionnalités** :
   - Colonnes redimensionnables et triables (clic sur l'en-tête)
   - Pagination ou scroll virtualisé pour les grandes listes (429+ docs)
   - Barre de recherche/filtre en haut de la table
   - Filtre par type de fichier (dropdown)
   - Filtre par langue (dropdown)
   - Sélection de colonnes visibles (bouton "Colonnes" avec checkboxes)

6. Ajouter un panneau de détail au clic sur une ligne :
   - Slide-over ou modal affichant toutes les métadonnées du document
   - Champs éditables : titre, auteur, tags, catégorie, langue
   - Champs en lecture seule : chemin, taille, dates, compteurs, parsing info
   - Bouton "Sauvegarder" qui appelle `PUT /api/ingestion/documents/{id}/metadata`

7. Mettre à jour l'interface TypeScript `DocumentInfo` dans `useDocuments.ts` avec tous les nouveaux champs

### Maquette table

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  🔍 Rechercher...                          [Type ▼] [Langue ▼] [Colonnes ⚙]    │
├──────────────────────────────────────────────────────────────────────────────────┤
│  Fichier          │ Type │ Taille  │ Pages │ Mots  │ Langue │ Titre     │ Tags  │
├───────────────────┼──────┼─────────┼───────┼───────┼────────┼───────────┼───────┤
│  rapport_2024.pdf │ PDF  │ 2.4 Mo  │  45   │ 12540 │  FR    │ Rapport...│ fin...│
│  guide_api.md     │ MD   │ 0.1 Mo  │   -   │  3200 │  FR    │ Guide ... │ api...│
│  contract.docx    │ DOCX │ 0.8 Mo  │  12   │  4100 │  FR    │ Contrat...│       │
├──────────────────────────────────────────────────────────────────────────────────┤
│                          ← 1  2  3  4  5 →    Affichage 1-50 sur 429           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Maquette panneau de détail

```
┌─── Détail du document ──────────────────────────────┐
│                                                      │
│  Fichier : rapport_2024.pdf                          │
│  Chemin  : reports/2024/rapport_2024.pdf             │
│  Type    : PDF  ·  MIME : application/pdf            │
│  Taille  : 2.4 Mo  ·  Encoding : -                  │
│                                                      │
│  ── Contenu ──                                       │
│  Pages : 45  ·  Mots : 12 540  ·  Caractères : 78k  │
│  Tableaux : Oui  ·  Images : Oui  ·  Code : Non     │
│                                                      │
│  ── Identification ──                                │
│  Titre  : [Rapport annuel 2024          ] ✏️         │
│  Auteur : [Jean Dupont                  ] ✏️         │
│  Langue : [FR ▼                         ] ✏️         │
│                                                      │
│  ── Classification ──                                │
│  Tags     : [finance] [rapport] [+ Ajouter]  ✏️     │
│  Catégorie: [Rapports ▼                 ] ✏️         │
│                                                      │
│  ── Dates ──                                         │
│  Créé le    : 2024-03-15                             │
│  Modifié le : 2024-11-20                             │
│  Indexé le  : 2026-02-13T14:32:00Z                   │
│                                                      │
│  ── Parsing ──                                       │
│  Moteur : PyPDF  ·  OCR : Non                        │
│                                                      │
│           [Annuler]  [Sauvegarder]                    │
└──────────────────────────────────────────────────────┘
```

---

## Anomalie 3 — Onglet Configuration figé (non modifiable)

### Constat

Dans l'onglet "Configuration" de la page Paramètres, les contrôles sont partiellement fonctionnels :

| Composant | État actuel | Problème |
|-----------|-------------|----------|
| `SourceSettings` | **Bouton "Modifier" désactivé** (`disabled`), chemin en lecture seule | L'utilisateur ne peut pas changer le dossier source après le wizard |
| `SourceSettings` | Checkbox "Scanner les sous-dossiers" | Appelle `onChange` mais l'effet est incertain |
| `ParsingSettings` | Selects et toggles présents | Les `onChange` appellent `handleConfigChange` qui fait `updateConfig` — **devrait fonctionner** mais non vérifié |
| `PreprocessingSettings` | Selects, toggles et slider | Idem |
| Bouton "Réanalyser" | Appelle `analyzeDocuments()` | Fonctionnel mais sans feedback de progression (voir Anomalie 1) |
| Bouton "Réinitialiser" | Appelle `invoke("reset_ingestion_config")` | Non vérifié |

### Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `desktop/src/components/settings/SourceSettings.tsx` | Bouton "Modifier" désactivé en dur |
| `desktop/src/components/settings/IngestionSettings.tsx` | `handleConfigChange` — logique de mise à jour |
| `desktop/src/hooks/useIngestionConfig.ts` | `updateConfig` — appelle `invoke("update_ingestion_config")` |
| `desktop/src-tauri/src/backend.rs` | Commande Rust `update_ingestion_config` — ne vérifie pas les codes HTTP |
| `ragkit/desktop/api/ingestion.py` | `PUT /api/ingestion/config` — sauvegarde la config |

### Analyse du flux de données

```
UI onChange → handleConfigChange(key, value)
  → clone profonde de config
  → modification par chemin (ex: "parsing.engine")
  → updateConfig(newConfig)
    → invoke("update_ingestion_config", { config: newConfig })
      → Rust request() → PUT /api/ingestion/config
        → Python: sauvegarde en mémoire + disque
        → Retourne la config mise à jour
      → Rust: retourne Ok(response_json)  ⚠️ même si HTTP 4xx/5xx
    → setConfig(response)
```

**Point critique** : la fonction `request()` dans `backend.rs` ne vérifie pas les codes HTTP de retour. Si le backend retourne une erreur 422 (validation Pydantic), le frontend reçoit le JSON d'erreur comme si c'était la config mise à jour, sans erreur visible.

### Actions à réaliser

**Source — Rendre le dossier modifiable**

1. Activer le bouton "Modifier" dans `SourceSettings.tsx` :
   - Au clic, ouvrir le dialogue natif Tauri (`@tauri-apps/plugin-dialog`) pour sélectionner un nouveau dossier
   - Mettre à jour `source.path` via `onChange("source.path", selectedPath)`
   - Afficher les dossiers exclus avec possibilité de modifier la liste
   - Afficher les types de fichiers inclus avec possibilité de modifier

2. Ajouter les contrôles manquants dans `SourceSettings.tsx` :
   - Liste des types de fichiers inclus (checkboxes)
   - Patterns d'exclusion (champ texte)
   - Taille max par fichier (input number + slider)
   - Liste des dossiers exclus (si récursif activé)

**Parsing & Préprocessing — Vérifier le fonctionnement**

3. Tester et corriger le flux `handleConfigChange` → `updateConfig` :
   - Vérifier que `invoke("update_ingestion_config")` envoie bien le bon format au backend
   - Vérifier que la commande Rust `update_ingestion_config` transmet correctement le payload
   - Le paramètre envoyé est `{ config: newConfig }` mais la commande Rust attend peut-être `{ params: newConfig }` → vérifier la cohérence

4. Ajouter une gestion d'erreur visible :
   - Si `updateConfig` échoue, afficher un toast/notification d'erreur
   - Ajouter un indicateur de sauvegarde (ex: "Sauvegardé" temporaire après succès)

**Rust (`backend.rs`)**

5. Corriger `request()` pour vérifier les codes HTTP :
   - Si le statut n'est pas 2xx, retourner `Err(...)` au lieu de `Ok(error_body)`
   - Cela permet au frontend de catcher les erreurs correctement dans les blocs `try/catch` des `invoke()`

**Feedback utilisateur**

6. Ajouter un toast/notification de confirmation après chaque modification :
   - Succès : "Configuration sauvegardée"
   - Erreur : "Erreur lors de la sauvegarde : {detail}"

---

## Anomalie 4 — Affichage non optimisé pour les grandes listes

### Constat

Avec 429 documents, la table `MetadataTable` rend toutes les lignes d'un coup dans le DOM. Cela entraîne :
- Un rendu initial lent
- Un scroll saccadé sur les machines modestes
- Pas de pagination ni de filtrage
- Pas de tri

### Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `desktop/src/components/settings/MetadataTable.tsx` | Rendu de la table |
| `desktop/src/hooks/useDocuments.ts` | Données brutes sans pagination |

### Actions à réaliser

1. **Pagination côté frontend** :
   - Ajouter un état `page` et `pageSize` (défaut : 50 par page)
   - Découper `documents` en pages avec `slice()`
   - Afficher les contrôles de navigation : `← 1 2 3 4 5 →` + sélecteur de taille de page

2. **Tri** :
   - Clic sur les en-têtes de colonnes pour trier (ascendant/descendant)
   - Icône de tri dans l'en-tête (▲/▼)
   - Tri côté frontend (les données sont déjà en mémoire)

3. **Filtrage et recherche** :
   - Barre de recherche globale (filtre sur filename, title, author)
   - Filtres par type de fichier (dropdown multi-select)
   - Filtre par langue (dropdown)
   - Les filtres s'appliquent avant la pagination

4. **Virtualisation (optionnel, si performance insuffisante)** :
   - Remplacer le rendu par une liste virtualisée (`@tanstack/react-virtual` ou `react-window`)
   - Ne rendre que les lignes visibles dans le viewport

5. **Statistiques résumées** :
   - Au-dessus de la table, afficher un résumé :
     ```
     429 documents · 280 Mo · 12 types · 3 langues · 5 erreurs
     ```

---

## Récapitulatif des priorités

| # | Anomalie | Priorité | Complexité |
|---|----------|----------|------------|
| 1 | Progression analyse | **Haute** | Moyenne |
| 2 | Métadonnées complètes | **Haute** | Haute |
| 3 | Configuration figée | **Haute** | Moyenne |
| 4 | Optimisation affichage | Moyenne | Moyenne |

### Ordre d'implémentation recommandé

1. **Anomalie 3** (Configuration figée) — Débloquer l'édition de la config est prérequis pour que l'utilisateur puisse ajuster les paramètres avant de relancer une analyse.
2. **Anomalie 1** (Progression) — Sans retour visuel, l'utilisateur ne sait pas si l'analyse tourne ou a planté.
3. **Anomalie 2** (Métadonnées) — Enrichir le modèle et l'affichage des métadonnées.
4. **Anomalie 4** (Optimisation affichage) — Peut être traité en même temps que l'anomalie 2 (refonte de MetadataTable).

### Version cible

Ces améliorations devraient être livrées en **v1.2.0**.
