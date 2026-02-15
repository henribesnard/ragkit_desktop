# Specifications : Ameliorations UI/UX Metadonnees

**Objectif** : Transformer l'interface de gestion des metadonnees (Ingestion Settings) en un outil professionnel, dense et agreable pour la "curation" de base de connaissances.

**Version cible** : v1.2.0
**Prerequis** : Corrections C1-C4 de `revue-globale-etape-1.md`

---

## 1. Philosophie Design

- **Densite & Clarte** : Afficher un maximum d'informations utiles sans noyer l'utilisateur.
- **Curation Rapide** : Minimiser les clics pour corriger les erreurs d'extraction (titres, auteurs).
- **Confiance** : Montrer explicitement la qualite de la donnee (badges, indicateurs visuels).
- **Coherence** : Utiliser les composants UI existants (Button, Select, Toggle, Slider) et le design system Tailwind en place.

---

## 2. Refonte du Tableau (`MetadataTable`)

### 2.1 Nouvelles Colonnes

Le tableau actuel affiche : Fichier, Type, Titre, Auteur, Taille, Tags.

Ajouter/Ajuster les colonnes pour une meilleure vue d'ensemble :

| Colonne | Position | Type | Description |
|---------|----------|------|-------------|
| **Statut** | 1ere (avant Fichier) | Icone (rond colore) | Vert = metadonnees completes (titre + auteur + langue remplis). Orange = donnees partielles ou titre douteux. Rouge = echec d'extraction. |
| **Langue** | Apres Auteur | Badge court | Badge compact : "FR", "EN", "ES". Important pour verifier la detection automatique. Si absent : "—". |
| **Date** | Apres Langue | Texte court | Date de creation du document (pas la taille du fichier, moins pertinente pour la semantique). Format : `12/04/1947`. |

Colonnes a retirer ou deplacer :
- **Taille** : Deplacer en tooltip sur le nom de fichier (info secondaire), ou garder mais en derniere position.

### 2.2 Ameliorations Visuelles du Tableau

- **Formatage des titres douteux** :
  - Si le titre est identique au nom de fichier (sans extension) : l'afficher en gris italique.
  - Si le titre contient des artefacts binaires detectes (commence par "bjbj", caracteres non-imprimables, entropie > seuil) : afficher avec un indicateur orange et tooltip "Titre extrait automatiquement, verification recommandee".
  - Titres confirmes/edites par l'utilisateur : affichage normal (couleur standard).

- **Hauteur des lignes** : Reduire le padding vertical (`py-4` -> `py-2.5`) pour une meilleure densite. Le tableau actuel est un peu aere pour 1400+ documents.

- **Empty states** : Remplacer les champs vides par des placeholders discrets ("—" en gris clair) au lieu de rien afficher. Deja partiellement fait pour Titre et Auteur, etendre a tous les champs.

- **Badge Type** : Colorer les badges de type par famille :
  - PDF : bleu
  - DOC/DOCX : bleu fonce
  - MD/TXT : gris
  - HTML : vert
  - CSV/JSON/YAML/XML : violet

- **Barre d'outils** : Ajouter un compteur de statut dans la toolbar :
  ```
  1436 documents | 430 complets | 1006 a verifier
  ```

### 2.3 Selection Multiple et Actions Batch

Pour la curation en masse :
- Ajouter une colonne checkbox en premiere position.
- Actions batch dans la toolbar (apparaissent quand >= 1 document selectionne) :
  - "Appliquer la categorie..." (select dropdown)
  - "Ajouter un tag..." (input)
  - "Regenerer les titres" (futur, via LLM)

---

## 3. Refonte du Panneau de Detail (`MetadataDetailPanel`)

### 3.1 En-tete (Sticky top)

Structure actuelle : icone + nom fichier + chemin + type/taille.

Ameliorations :

```
+---------------------------------------------------------------+
|  [<]  Document 4/1435  [>]                     [X] Fermer     |
+---------------------------------------------------------------+
|  TITRE (Editable inline)                                      |
|  [ La Foi est une Ferme Assurance           CRAYON ]          |
|                                                               |
|  Fichier : 47-0412.doc  |  DOC  |  150 Ko                    |
+---------------------------------------------------------------+
```

- **Navigation Precedent/Suivant** : Boutons `<` et `>` dans le header. Affichage du compteur "Document N/Total". **Crucial pour la validation en serie** (1400+ documents).
  - Implementation : `MetadataTable` passe la liste filtree et l'index courant au panel.
  - Les boutons naviguent dans la liste filtree/triee (pas la liste globale).
  - Le panel ne se ferme pas lors de la navigation.

- **Titre editable inline** : Le titre principal du document est un grand champ editable directement en haut du panel (pas dans la section formulaire plus bas). Double-clic ou clic sur l'icone crayon pour editer.

- **Badge de type** colore (voir section 2.2) + taille du fichier sur la meme ligne.

### 3.2 Onglet 1 : Metadonnees (General) — Vue par defaut

```
+---------------------------------------------------------------+
|  [ Metadonnees ]   [ Apercu & Technique ]                     |
+---------------------------------------------------------------+
|                                                               |
|  Auteur                Date de creation                       |
|  [ William Branham ]   [ 12/04/1947    CALENDRIER ]           |
|                                                               |
|  Langue                Categorie                              |
|  [ FR       ]          [ Sermons            v ]               |
|                                                               |
|  Description                                                  |
|  +-----------------------------------------------------------+|
|  | Sermon preche a ...                                       ||
|  |                                                           ||
|  |                                                       ::: ||
|  +-----------------------------------------------------------+|
|                                                               |
|  Mots-cles (auto)                                             |
|  (Foi) (Guerison) (Priere)                                    |
|                                                               |
|  Tags (manuels)                                               |
|  (Important) [ + Ajouter ]                                    |
|                                                               |
+---------------------------------------------------------------+
|                      [ Sauvegarder ]                          |
+---------------------------------------------------------------+
```

Changements par rapport a l'existant :

- **Ajout du champ Description** : Grand `Textarea` auto-expansible. Affiche la description generee automatiquement (premiers paragraphes). Editable par l'utilisateur.

- **Distinction Keywords / Tags** :
  - **Mots-cles (auto)** : Badges gris, non editables directement (extraits automatiquement). L'utilisateur peut les supprimer mais pas en ajouter dans cette section.
  - **Tags (manuels)** : Badges bleus, editables. Bouton "+ Ajouter" + saisie Enter. C'est la section "curation humaine".

- **Categorie** : Transformer le champ texte libre en `Select` avec suggestions predefinies (basees sur le profil actif) + option "Autre..." pour saisie libre.

### 3.3 Onglet 2 : Apercu & Technique

Cet onglet est **nouveau** et n'existe pas actuellement. Il fournit des outils de diagnostic.

```
+---------------------------------------------------------------+
|  [ Metadonnees ]   [ Apercu & Technique ]                     |
+---------------------------------------------------------------+
|                                                               |
|  APERCU DU TEXTE EXTRAIT                                      |
|  +-----------------------------------------------------------+|
|  | "bjbjxxxxxxx La Foi est une Ferme Assurance de            ||
|  | ce que l'on espere, une demonstration de ce               ||
|  | qu'on ne voit pas. Hebreux 11:1..."                       ||
|  |                                                           ||
|  | [500 premiers caracteres]                                 ||
|  +-----------------------------------------------------------+|
|                                                               |
|  INFORMATIONS TECHNIQUES                                      |
|  Chemin      C:\Users\...\47-0412.doc                         |
|  Taille      150 Ko                                           |
|  Cree le     12/04/1947                                       |
|  Modifie le  15/01/2025                                       |
|  Indexe le   15/02/2026 14:32                                 |
|  Moteur      olefile (legacy)                                 |
|  OCR         Non                                              |
|  Encodage    utf-8                                            |
|  MD5         a1b2c3d4e5f6...                                  |
|                                                               |
+---------------------------------------------------------------+
```

- **Apercu du texte** : Afficher les 500 premiers caracteres extraits du document. Permet a l'utilisateur de voir immediatement si l'extraction est "garbage" (ex: `bjbj...`, caracteres binaires) **sans ouvrir le fichier**. C'est la fonctionnalite qui apportera le plus de valeur pour diagnostiquer les problemes d'extraction .doc.

- **Metadonnees techniques** : Tableau complet. Deplacer ici les informations techniques actuellement dans la vue principale (dates, moteur, OCR). La section technique actuelle du panel est deja bien structuree, il suffit de la deplacer dans cet onglet.

### 3.4 Actions du Panel

- **Ouvrir le fichier** : Bouton pour ouvrir le fichier source dans l'explorateur systeme (`tauri::api::shell::open`). Utile pour verifier visuellement un document suspect.
- **Ignorer/Exclure** : Retirer le document de l'index (ajouter a une ignore list). Le document ne sera plus indexe lors des reanalyses.

---

## 4. Maquette Wireframe Complete

```
+============================================================================+
|  INGESTION & PREPROCESSING                                                  |
+============================================================================+
|  [ Configuration ]   [ Metadonnees (1436) ]                                |
+============================================================================+
|                                                                            |
|  1436 documents | 430 complets | 1006 a verifier                          |
|                                                                            |
|  [Rechercher...            ]  [Type: Tous v]  [50/page v]                  |
|                                                                            |
|  +------------------------------------------------------------------------+|
|  | [] | St | Fichier         | Type | Titre              | Auteur | Lg | Date     | Tags         ||
|  |----+----+-----------------+------+--------------------+--------+----+----------+--------------||
|  | [] | V  | 47-0412.doc     | DOC  | La Foi est une..   | W.B.   | FR | 12/04/47 | (Foi)(Guer.) ||
|  | [] | V  | rapport-2024.pdf| PDF  | Rapport annuel '24 | J.Doe  | FR | 01/01/24 | (Finance)    ||
|  | [] | O  | notes.doc       | DOC  | bjbjxxx Notes...   | —      | FR | —        | —            ||
|  | [] | V  | procedure.docx  | DOCX | Procedure qualite  | —      | FR | 15/03/23 | (Qualite)    ||
|  +------------------------------------------------------------------------+|
|                                                                            |
|  1-50 sur 1436                                       [<] Page 1/29 [>]     |
|                                                                            |
+============================================================================+

Legende statut : V = Vert (complet), O = Orange (a verifier), R = Rouge (erreur)
```

---

## 5. Specifications Techniques d'Implementation

### 5.1 MetadataTable.tsx — Modifications

```typescript
// Nouvelles props du MetadataDetailPanel
interface MetadataDetailPanelProps {
    document: DocumentInfo | null;
    documents: DocumentInfo[];     // NOUVEAU : liste filtree pour navigation
    currentIndex: number;          // NOUVEAU : index courant dans la liste
    onClose: () => void;
    onSave: (id: string, updates: any) => Promise<void>;
    onNavigate: (index: number) => void;  // NOUVEAU : callback navigation
}

// Fonction d'evaluation du statut
function getDocumentStatus(doc: DocumentInfo): 'complete' | 'partial' | 'error' {
    const hasTitle = doc.title && doc.title !== doc.filename.replace(/\.[^.]+$/, '');
    const hasAuthor = !!doc.author;
    const hasLanguage = !!doc.language;
    const isSuspicious = doc.title && /^[^\w\s]|bjbj/i.test(doc.title);

    if (isSuspicious) return 'error';
    if (hasTitle && hasAuthor && hasLanguage) return 'complete';
    return 'partial';
}
```

### 5.2 MetadataDetailPanel.tsx — Modifications

- Ajouter `useState` pour `description` (initialise depuis `document.description`).
- Ajouter `description` dans le payload `onSave`.
- Ajouter les boutons de navigation dans le header.
- Ajouter un systeme d'onglets (Metadonnees / Apercu & Technique).
- Deplacer la section technique existante dans l'onglet 2.
- Ajouter l'apercu texte dans l'onglet 2 (nouveau champ `text_preview` dans `DocumentInfo` ou utiliser `description` comme approximation).

### 5.3 Backend — Ajouts necessaires

- **`text_preview`** : Ajouter un champ `text_preview: str | None` dans `DocumentInfo` contenant les 500 premiers caracteres du texte extrait. A remplir lors de l'analyse.
- **Endpoint "ouvrir fichier"** : Pas besoin de route backend — utiliser l'API Tauri `shell.open(file_path)` directement depuis le frontend.

### 5.4 Donnees necessaires (deja en base)

| Champ | Disponible en `DocumentInfo` | Affiche dans le panel actuel | Action |
|-------|------------------------------|------------------------------|--------|
| `title` | Oui | Oui (editable) | Aucune |
| `author` | Oui | Oui (editable) | Aucune |
| `language` | Oui | Oui (editable) | Aucune |
| `description` | Oui | **Non** | **Ajouter** |
| `keywords` | Oui | Fusionne avec tags | **Separer visuellement** |
| `tags` | Oui | Oui (editable) | Aucune |
| `category` | Oui | Oui (editable) | Transformer en Select |
| `creation_date` | Oui | Oui (technique) | Deplacer en onglet 2 |
| `last_modified` | Oui | Oui (technique) | Deplacer en onglet 2 |
| `parser_engine` | Oui | Oui (technique) | Deplacer en onglet 2 |
| `ocr_applied` | Oui | Oui (technique) | Deplacer en onglet 2 |
| `encoding` | Oui | **Non** | **Ajouter** en onglet 2 |
| `text_preview` | **Non** | **Non** | **Ajouter** au modele + onglet 2 |

---

## 6. Roadmap d'Implementation

### Phase 1 — v1.1.4 (Quick wins, 2 jours)

Corrections fonctionnelles prioritaires (C1-C4 de `revue-globale-etape-1.md`) :

1. Nettoyage artefacts "bjbj" dans `_extract_doc_legacy()`.
2. Fallback titre sur nom de fichier si titre douteux.
3. Ajouter `description` au panel de detail (Textarea editable).
4. Ajouter navigation Precedent/Suivant dans le panel.

### Phase 2 — v1.2.0 (Redesign UI, 3 jours)

Refonte esthetique et fonctionnelle :

1. Nouvelles colonnes tableau (Statut, Langue, Date).
2. Indicateur visuel de titre douteux (gris italique + tooltip).
3. Badges de type colores par famille.
4. Onglets dans le panel (Metadonnees / Apercu & Technique).
5. Apercu texte (500 premiers caracteres).
6. Separation visuelle Keywords (auto) vs Tags (manuels).
7. Compteur de statut dans la toolbar.
8. Densite amelioree (padding reduit).

### Phase 3 — v1.3.0 (Curation avancee, futur)

1. Selection multiple + actions batch.
2. Categorie en Select avec suggestions du profil.
3. Bouton "Ouvrir le fichier" (shell.open).
4. Bouton "Exclure" (ignore list).
5. Export CSV des metadonnees.

---

**Note** : L'ajout de l'apercu du texte (Phase 2, point 5) est la fonctionnalite qui apportera le plus de valeur immediate pour diagnostiquer les problemes d'extraction .doc et renforcer la confiance de l'utilisateur dans la qualite de l'indexation.
