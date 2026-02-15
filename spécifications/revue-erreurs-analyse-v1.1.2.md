# RAGKIT Desktop — Revue des erreurs d'analyse v1.1.2

> **Date** : 14 fevrier 2026
> **Version testee** : v1.1.2
> **Corpus de test** : `C:\Users\henri\Projets\Branham\sermons`
> **Configuration** : recursive=true, file_types=[doc, pdf], 1 dossier exclu (1948)

---

## Resultats de l'analyse

| Metrique | Valeur |
|----------|--------|
| Fichiers scannes | 1 436 |
| Documents parses OK | 429 (30%) |
| Erreurs | 1 006 (70%) |
| Fichiers dedupliques | ~1 |

---

## Diagnostic des erreurs

### Repartition des fichiers dans le corpus

| Format reel | Extension | Nombre | Resultat |
|-------------|-----------|--------|----------|
| PDF | `.pdf` | ~151 | OK (pypdf) |
| OpenXML/ZIP renomme en .doc | `.doc` | 276 | OK (python-docx) |
| **OLE2 binaire (Word legacy)** | `.doc` | **1 006** | **ECHEC** |
| Fichier vide (0 octets) | `.doc` | 2 | ECHEC |
| Fichier temporaire Word (`~$...`) | `.doc` | 1 | ECHEC |

### Cause racine : python-docx ne supporte pas le format .doc legacy

**100% des erreurs** proviennent d'une seule cause : la bibliotheque `python-docx` utilisee dans `_extract_docx()` ne supporte que le format `.docx` (Office Open XML / ZIP). Elle ne peut pas lire les fichiers `.doc` au format binaire OLE2 (Word 97-2003).

Le message d'erreur est identique pour les 1 003 fichiers OLE2 :
```
file 'X.doc' is not a Word file, content type is 'application/vnd.openxmlformats-officedocument.themeManager+xml'
```

Ce message trompeur vient de `python-docx` qui tente d'ouvrir le fichier comme un ZIP, echoue, et retourne un content type par defaut.

### Verification du format binaire

Inspection des headers de fichiers :
- **OLE2 binary** : magic bytes `D0CF11E0A1B11AE1` (signature OLE2 Compound Document) — 1 006 fichiers
- **ZIP/OpenXML** : magic bytes `504B0304` (signature ZIP) — 276 fichiers
- **Vide** : 0 octets — 2 fichiers
- **Temp Word** : fichier `~$*.doc` (lock file) — 1 fichier

### Test d'extraction OLE2 avec les librairies disponibles

| Librairie | Disponible | Resultat sur fichier OLE2 .doc |
|-----------|------------|-------------------------------|
| `python-docx` | Oui | ECHEC — "is not a Word file" |
| `docx2txt` | Oui | ECHEC — "no item named 'word/document.xml'" |
| `olefile` | Oui | Lit les streams OLE2 mais ne parse pas le texte Word |
| `win32com` (COM Word) | Oui (Windows) | OK — 106 443 chars extraits correctement |
| `antiword` | Non | Non installe |
| `textract` | Non | Non installe |
| `LibreOffice CLI` | Non teste | Necessite LibreOffice installe |

---

## Solutions proposees

### Solution 1 : Extraction OLE2 via `olefile` + extraction de texte brut (recommandee)

**Principe** : Utiliser `olefile` (deja installe) pour ouvrir le fichier OLE2, lire le stream `WordDocument` et en extraire le texte brut.

**Avantages** :
- Pas de dependance externe (olefile est deja dans l'environnement)
- Fonctionne sur toutes les plateformes (Windows, macOS, Linux)
- Rapide (lecture directe du stream binaire)
- Pas besoin de Microsoft Word installe

**Inconvenients** :
- Le format binaire Word est complexe — l'extraction de texte sera basique (pas de mise en forme, pas de tableaux structures)
- Necessite un parseur minimaliste du format Word binary (lecture du stream `WordDocument` + extraction des runs de texte)

**Implementation** :
- Fichier : `ragkit/desktop/documents.py`, fonction `_extract_docx()`
- Ajouter une detection du format en amont : si magic bytes = OLE2, basculer vers `_extract_doc_legacy()`
- Utiliser `olefile.OleFileIO()` pour ouvrir le fichier
- Lire le stream `WordDocument` et extraire le texte ASCII/Unicode (les runs de texte sont encodes en CP1252 ou UTF-16LE)
- Alternative simplifiee : lire le stream binaire et extraire toutes les sequences de texte lisibles via regex

**Complexite** : Moyenne

### Solution 2 : Conversion via `win32com` (Windows uniquement)

**Principe** : Utiliser l'API COM de Microsoft Word pour ouvrir le `.doc` et extraire le texte.

**Avantages** :
- Extraction parfaite (Word fait le parsing)
- Supporte tous les formats Word (97, 2000, 2003, XP)
- `win32com` est deja disponible dans l'environnement

**Inconvenients** :
- **Windows uniquement** — ne fonctionnera pas sur macOS/Linux
- **Necessite Microsoft Word installe** — pas garanti sur toutes les machines
- Lent (lance un processus Word en arriere-plan pour chaque fichier)
- Peut etre instable sur de gros volumes (1 000+ fichiers)

**Implementation** :
- Fichier : `ragkit/desktop/documents.py`, nouvelle fonction `_extract_doc_com()`
- Ouvrir Word via `win32com.client.Dispatch('Word.Application')`
- Garder une instance ouverte pour tout le batch (ne pas ouvrir/fermer Word pour chaque fichier)
- Extraire `doc.Content.Text`, `doc.CoreProperties` pour les metadonnees
- Fallback vers la Solution 1 si Word n'est pas disponible

**Complexite** : Faible (code simple) mais fragile (dependance systeme)

### Solution 3 : Conversion batch via LibreOffice CLI

**Principe** : Utiliser `soffice --convert-to docx` pour convertir les `.doc` en `.docx` avant l'analyse.

**Avantages** :
- Conversion fidele
- Cross-platform (Windows, macOS, Linux)
- Les fichiers convertis peuvent ensuite etre parses par `python-docx` normalement

**Inconvenients** :
- Necessite LibreOffice installe (non inclus dans le build)
- Etape de conversion supplementaire (temps + espace disque temporaire)
- Gestion de fichiers temporaires a implementer

**Complexite** : Moyenne

### Solution 4 : Ignorer les .doc OLE2 avec avertissement clair

**Principe** : Detecter le format OLE2 avant le parsing, skipper le fichier et afficher un avertissement explicite a l'utilisateur.

**Avantages** :
- Aucune dependance supplementaire
- Rapide a implementer
- Evite les 1 000 messages d'erreur qui polluent les logs

**Inconvenients** :
- 70% du corpus n'est pas indexe
- Mauvaise experience utilisateur

**Implementation** :
- Dans `_extract_content()`, lire les 4 premiers octets du fichier
- Si magic = `D0CF11E0` et extension = `.doc` → retourner une erreur specifique : "Format Word legacy (.doc 97-2003) non supporte. Convertissez en .docx."
- Afficher cet avertissement dans l'UI avec un lien/bouton pour convertir

**Complexite** : Faible

---

## Recommandation

**Approche en 2 phases** :

### Phase 1 (immediate) : Detection + extraction basique via olefile

1. Detecter le format reel du fichier par ses magic bytes (OLE2 vs ZIP vs autre)
2. Pour les fichiers OLE2 `.doc` :
   - Ouvrir avec `olefile`
   - Extraire le texte brut du stream `WordDocument` (methode simplifiee : extraction des sequences de texte lisibles)
   - Extraire les metadonnees du stream `SummaryInformation` (titre, auteur, date de creation)
3. Pour les fichiers `.doc` vides ou temporaires (`~$`) :
   - Les exclure silencieusement (pas d'erreur, pas dans le compteur)

### Phase 2 (optionnelle) : Support win32com comme moteur avance

1. Si `win32com` est disponible ET Word est installe, l'utiliser comme extracteur principal pour `.doc` OLE2
2. Sinon, fallback vers olefile (Phase 1)
3. Ajouter une option dans la config : `parsing.doc_legacy_engine: "auto" | "olefile" | "win32com"`

---

## Erreurs mineures additionnelles

### Fichiers vides (2 fichiers)

```
58-0223 - Jesus-Christ Est Le Meme Hier... .doc : 0 octets
58-0324 - Ecoutez-Le.doc : 0 octets
```

**Correction** : Dans `_extract_content()`, verifier `path.stat().st_size == 0` avant de tenter le parsing. Retourner un `ParsedContent` vide sans generer d'erreur.

### Fichier temporaire Word (1 fichier)

```
~$-0705 - Entretien Prive... .doc : 162 octets (fichier lock Word)
```

**Correction** : Dans `_iter_files()`, exclure les fichiers commencant par `~$` (fichiers temporaires Office). Ajouter au filtre :
```python
if path.name.startswith('~$'):
    continue
```

---

## Impact sur les metriques

| Scenario | Documents OK | Erreurs | Taux de succes |
|----------|-------------|---------|----------------|
| Actuel (v1.1.2) | 429 | 1 006 | 30% |
| Avec Phase 1 (olefile) | ~1 430 | ~5 | ~99.7% |
| Avec Phase 2 (win32com) | ~1 433 | ~3 | ~99.8% |

---

## Fichiers a modifier

| Fichier | Modification |
|---------|-------------|
| `ragkit/desktop/documents.py` | Ajouter `_extract_doc_legacy()`, modifier `_extract_content()` pour detecter OLE2, exclure `~$` et fichiers vides |
| `ragkit/desktop/models.py` | Eventuellement ajouter un champ `parsing_warnings: list[str]` a `DocumentInfo` |
| `pyproject.toml` | `olefile` est deja installe, rien a ajouter |
