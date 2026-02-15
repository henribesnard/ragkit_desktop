# Revue Globale - Validation Etape 1 (Ingestion & Preprocessing)

**Date** : 15 fevrier 2026
**Version** : v1.1.3
**Referentiel** : `specifications/specs-etape-1.md`

---

## 1. Synthese

L'objectif de l'Etape 1 (Ingestion, Profilage, Parsing) est **globalement atteint**. Le systeme permet de configurer une source, de definir un profil, d'analyser les documents et de visualiser les resultats. Les 1436 documents du corpus de test sont desormais tous parses (0 erreur en v1.1.3 contre 1006 erreurs en v1.1.2 grace a l'ajout du support legacy .doc via `olefile`).

Cependant, des problemes de **qualite de donnees** (artefacts d'extraction .doc) et de **completude UI** (champs manquants dans le panneau de detail) ont ete identifies et necessitent correction avant de passer a l'Etape 2.

---

## 2. Conformite aux Criteres d'Acceptation Fonctionnels

| # | Critere | Statut | Observations |
|---|---------|--------|--------------|
| **F1** | Au premier lancement, le wizard plein ecran se lance automatiquement | OK | `useSetupStatus` detecte l'absence de `settings.json` et affiche `Onboarding`. Sidebar masquee. |
| **F2** | Wizard 4 ecrans avec navigation Suivant/Retour + progression | OK | `WizardContainer` orchestre les 4 etapes. `WizardProgress` affiche les pastilles. Navigation Retour fonctionnelle. |
| **F3** | Ecran 2 : 5 profils sous forme de cartes cliquables avec icones | OK | `ProfileStep` + `ProfileCard` implementes. Selection radio avec contour colore. |
| **F4** | 6 questions de calibrage avec tooltip explicatif | OK | `CalibrationQuestion` avec toggle Oui/Non et tooltip info. Section depliable. |
| **F5** | Ecran 3 : dialogue natif pour selectionner un dossier | OK | `@tauri-apps/plugin-dialog` `open({ directory: true })` utilise. |
| **F6** | Arborescence des sous-dossiers avec checkboxes pour exclure | **PARTIEL** | `FolderStep` permet de selectionner un dossier et de voir les stats, mais l'arborescence visuelle avec checkboxes par sous-dossier (`FolderTree`) n'est pas implementee dans le wizard. Les exclusions sont gerees manuellement dans `SourceSettings` via ajout de noms de dossier. |
| **F7** | Ecran 4 : types de fichiers trouves avec compteurs et taille | OK | `FileTypesStep` affiche les types supportes/non supportes avec compteurs. |
| **F8** | Types non supportes grises avec info-bulle | OK | Section "Non supportes" avec icone et message explicatif. |
| **F9** | Recapitulatif profil en bas de l'ecran 4 en langage humain | OK | `ProfileSummary` affiche le profil, calibrage et parametres cles. |
| **F10** | Apres "Terminer", sidebar reapparait et onglet Ingestion affiche | OK | `completeWizard` dans `WizardContainer` appelle le backend, sauvegarde la config, puis navigue vers `/settings`. |
| **F11** | Section Ingestion : 3 sous-sections Source, Parsing, Preprocessing | OK | `IngestionSettings` affiche les 3 sections via `SourceSettings`, `ParsingSettings`, `PreprocessingSettings`. |
| **F12** | Tableau de metadonnees : edition titre et auteur par document | OK | `MetadataTable` + `MetadataDetailPanel`. Clic sur une ligne ouvre le panneau lateral avec champs editables (titre, auteur, langue, tags, categorie). |
| **F13** | Bouton "Reanalyser" relance l'analyse | OK | `handleReanalyze()` appelle `analyzeDocuments()`. Barre de progression affichee pendant l'analyse. |
| **F14** | Au redemarrage, le wizard ne se relance pas | OK | `useSetupStatus` verifie `setup_completed: true` dans `settings.json`. |
| **F15** | Tous les textes traduits FR/EN via i18n | **PARTIEL** | Les cles principales du wizard et des settings sont traduites. Cependant, certains textes restent en dur en francais dans les composants : `MetadataDetailPanel` ("Detail du document", "Auteur", "Langue", "Sauvegarder"...), `MetadataTable` ("Rechercher...", "Tous les types"), `IngestionSettings` ("Configuration sauvegardee"). |

### Synthese F1-F15

- **11/15 conformes** (F1-F5, F7-F11, F13-F14)
- **2/15 partiels** (F6 : arborescence interactive manquante, F15 : textes hardcodes)
- **0/15 non conformes**

---

## 3. Conformite aux Criteres d'Acceptation Techniques

| # | Critere | Statut | Observations |
|---|---------|--------|--------------|
| **T1** | `POST /api/wizard/validate-folder` retourne `valid: true` pour un dossier accessible | OK | Endpoint fonctionnel, retourne stats (fichiers, taille, extensions). |
| **T2** | `POST /api/wizard/analyze-profile` retourne la config complete calculee | OK | Retourne profil + config complete avec modificateurs appliques. |
| **T3** | 5 profils x 6 questions : toutes combinaisons produisent des configs valides | **NON TESTE** | Aucun test parametrise ecrit. Les combinaisons de base fonctionnent manuellement mais la couverture exhaustive n'est pas verifiee. |
| **T4** | Scan recursif respecte `excluded_dirs` et `exclusion_patterns` | OK | `_iter_files()` filtre les dossiers exclus et les patterns. Correction v1.1.3 : filtrage `~$` temp files. |
| **T5** | Extraction metadonnees sur PDF, DOCX, MD, TXT | **OK+** | Fonctionne sur PDF, DOCX, MD, TXT **et** DOC legacy (v1.1.3 via `olefile`). Au-dela du scope initial. |
| **T6** | Detection de langue sur le contenu extrait | OK | `langdetect` utilise dans `_extract_content()`. Champ `language` rempli. |
| **T7** | Config complete persistee dans `~/.ragkit/config/settings.json` | OK | Sauvegarde via `_save_settings()`. Format JSON conforme au schema. |
| **T8** | `GET /api/ingestion/config` retourne la config sauvegardee | OK | Endpoint fonctionnel. |
| **T9** | `PUT /api/ingestion/config` valide et persiste les modifications | OK | Validation Pydantic + persistence. Auto-save sur chaque changement UI. |
| **T10** | `tsc --noEmit` aucune erreur TypeScript | OK | Verifie en v1.1.2. |
| **T11** | CI passe sur les 4 targets | OK | Tag v1.1.3 pousse, CI operationnel. |

### Synthese T1-T11

- **9/11 conformes** (T1-T2, T4-T11)
- **1/11 non teste** (T3 : tests parametrises)
- **0/11 non conformes**

---

## 4. Problemes Identifies

### 4.1 Qualite d'extraction des fichiers .doc (Word 97-2003)

- **Probleme** : L'extracteur `olefile` recupere le texte brut du flux binaire OLE2. Cela inclut souvent des en-tetes de formatage au debut du texte (sequences "bjbj", caracteres non-imprimables).
- **Symptome** : Titres de documents commencant par des artefacts binaires (ex: `bjbjxxxxxxxxxx La Foi...`).
- **Impact** : L'utilisateur perd confiance dans la qualite de l'indexation. Les titres "bruites" degradent aussi la recherche semantique future.
- **Priorite** : **Haute** - Affecte 1006/1436 documents (70% du corpus).

### 4.2 Donnees manquantes dans l'interface (MetadataDetailPanel)

- **Description** (`description`) : Le champ existe dans le modele `DocumentInfo` et est extrait par le backend (premiers paragraphes du document), mais il n'est **ni affiche ni editable** dans le `MetadataDetailPanel`.
- **Keywords vs Tags** : Le backend extrait des `keywords` (automatiques) et permet des `tags` (manuels). L'interface fusionne les deux dans un seul champ "Tags" sans distinction visuelle. L'utilisateur ne sait pas quels tags sont automatiques et lesquels sont manuels.
- **Priorite** : **Moyenne** - Fonctionnel mais incomplet par rapport au spec (section 2.2 : "description" fait partie des metadonnees fonctionnelles editables).

### 4.3 Experience de validation en serie

- **Navigation** : L'utilisateur doit fermer le panneau de detail pour selectionner le document suivant. Pour valider/corriger une liste de 1000+ documents, c'est extremement fastidieux.
- **Pas de navigation Precedent/Suivant** dans le `MetadataDetailPanel`.
- **Priorite** : **Haute** - Impact majeur sur la productivite de "curation".

### 4.4 Arborescence interactive des sous-dossiers (F6)

- **Probleme** : Le spec prevoit une arborescence visuelle avec checkboxes par sous-dossier dans l'ecran 3 du wizard (`FolderTree`). Le composant n'est pas implemente. Les exclusions sont gerees manuellement dans `SourceSettings` (ajout de noms de dossiers texte).
- **Impact** : L'experience est moins intuitive qu'une arborescence visuelle, surtout pour les corpus avec beaucoup de sous-dossiers.
- **Priorite** : **Basse** - Le workaround (champ texte) est fonctionnel. Amelioration UX future.

### 4.5 Patterns d'exclusion non exposes dans l'UI

- **Probleme** : Le parametre `source.exclusion_patterns` (patterns glob comme `*_draft.*`, `*_old.*`) est supporte par le backend et le modele Pydantic, mais n'a **pas de champ correspondant** dans `SourceSettings.tsx`. Seul `excluded_dirs` est expose.
- **Priorite** : **Basse** - Fonctionnalite avancee, la majorite des utilisateurs n'en a pas besoin immediatement.

### 4.6 Internationalisation incomplete (F15)

- **Probleme** : Certains textes sont en dur en francais dans les composants React au lieu d'utiliser les cles i18n.
- **Fichiers concernes** :
  - `MetadataDetailPanel.tsx` : "Detail du document", "Auteur", "Langue", "Categorie", "Tags", "Sauvegarder", "Annuler", "Informations techniques"...
  - `MetadataTable.tsx` : "Rechercher...", "Tous les types", "Aucun document analyse"
  - `IngestionSettings.tsx` : "Configuration sauvegardee", "Chargement de la configuration..."
  - `SourceSettings.tsx` : "Repertoire source", "Scanner les sous-dossiers", "Types de fichiers inclus"
  - `ParsingSettings.tsx`, `PreprocessingSettings.tsx` : Labels en dur
- **Priorite** : **Basse** - L'application est principalement utilisee en francais. A corriger avant une diffusion internationale.

---

## 5. Recommandations de Correction

### 5.1 Corrections prioritaires (avant Etape 2)

| # | Action | Effort | Composants |
|---|--------|--------|------------|
| **C1** | Ameliorer le nettoyage `_extract_doc_legacy()` pour supprimer les artefacts "bjbj" et les en-tetes binaires | 0.5j | `documents.py` |
| **C2** | Si le titre extrait contient des caracteres non-imprimables ou une entropie suspecte, fallback sur le nom de fichier | 0.5j | `documents.py` |
| **C3** | Ajouter le champ `description` (Textarea editable) au `MetadataDetailPanel` | 0.5j | `MetadataDetailPanel.tsx` |
| **C4** | Ajouter la navigation Precedent/Suivant dans le `MetadataDetailPanel` | 0.5j | `MetadataDetailPanel.tsx`, `MetadataTable.tsx` |

### 5.2 Corrections souhaitables (v1.2.0)

| # | Action | Effort | Composants |
|---|--------|--------|------------|
| **C5** | Distinguer visuellement keywords (auto, gris) vs tags (manuels, bleu) | 0.5j | `MetadataDetailPanel.tsx` |
| **C6** | Ajouter le champ `exclusion_patterns` dans `SourceSettings` | 0.5j | `SourceSettings.tsx` |
| **C7** | Extraire tous les labels en dur vers les fichiers i18n | 1j | Tous les composants settings |
| **C8** | Ecrire des tests parametrises pour les combinaisons profil x calibrage (T3) | 1j | Tests backend |

### 5.3 Ameliorations futures (v1.3+)

| # | Action | Effort | Composants |
|---|--------|--------|------------|
| **C9** | Implementer l'arborescence visuelle `FolderTree` avec checkboxes (F6) | 2j | `FolderTree.tsx`, `FolderStep.tsx` |
| **C10** | Support `win32com` optionnel pour extraction .doc parfaite (Windows) | 1j | `documents.py` |

---

## 6. Decision

**Verdict** : L'Etape 1 est **validee avec reserves**. Les criteres fonctionnels et techniques essentiels sont conformes. Les corrections C1-C4 (nettoyage .doc, description, navigation) doivent etre implementees avant de passer a l'Etape 2 (Chunking).

**Prochaines actions** :
1. Implementer les corrections C1-C4 (2 jours)
2. Implementer les ameliorations UI/UX decrites dans `ameliorations-ui-ux.md`
3. Tag v1.2.0 apres corrections
4. Demarrer l'Etape 2 (Chunking)
