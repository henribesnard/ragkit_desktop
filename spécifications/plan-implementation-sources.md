# Plan d'implementation detaille - Sources multi-types

> **Date** : 2026-05-30
> **Contexte** : Audit complet du codebase + plan d'action pour chaque source

---

## 0. Etat des lieux - Synthese

### Ce qui est DEJA en place

| Couche | Composant | Etat |
|---|---|---|
| **Modeles** | `SourceType` (13 types), `SourceEntry`, `SyncFrequency`, `SourceStatus` | COMPLET |
| **Interface connecteur** | `BaseConnector` ABC, `ConnectorDocument`, `ConnectorChangeDetection` | COMPLET |
| **Registry** | Factory pattern `@register_connector` + `create_connector()` | COMPLET |
| **Credentials** | `CredentialManager` (keyring + OAuth2 refresh) | COMPLET |
| **API REST sources** | CRUD + OAuth flow + test/sync (`/api/sources/*`) | COMPLET |
| **Sync Scheduler** | `SyncScheduler` avec frequence configurable | COMPLET |
| **Ingestion Runtime** | Multi-source aware, utilise `create_connector()` | COMPLET |
| **Frontend - SourceManager** | Grille de sources avec CRUD, test, sync | COMPLET |
| **Frontend - SourceAddDialog** | Selection de type + formulaire dynamique | COMPLET |
| **Frontend - 13 formulaires** | Un formulaire specifique par type de source | COMPLET |
| **Frontend - useSources hook** | Appels API pour gestion des sources | COMPLET |

### Ce qui MANQUE pour passer en production

| Lacune | Impact | Priorite |
|---|---|---|
| Connecteur IMAP = placeholder vide | Messagerie inutilisable | HAUTE |
| `test_connection()` = copie de `validate_config()` sur 5 connecteurs | Test de connexion non reel | HAUTE |
| Pas de retry/backoff reseau sur les connecteurs cloud | Echecs silencieux en conditions reelles | HAUTE |
| Pas de rate limiting client sur les APIs externes | Risque de ban/quota depasse | MOYENNE |
| Wizard SourceStep = seul `local_folder` actif | UX bridee | MOYENNE |
| Pas de tests unitaires pour les connecteurs | Regression possible | HAUTE |
| Pas de cache local temporaire pour fichiers cloud | Re-telechargement complet a chaque sync | MOYENNE |
| `DocumentInfo.source_id/source_type` non remplis a l'ingestion | Citation de source impossible dans le chat | HAUTE |

---

## Phase 1 : Fondations transversales (pre-requis pour toutes les sources)

### 1.1 Resilience reseau (`ragkit/connectors/http_utils.py`) - NOUVEAU

**Probleme** : Aucun connecteur ne gere le retry, le timeout adaptatif ou le rate limiting.

**Implementation** :

```
ragkit/connectors/http_utils.py
```

- `RetryableHttpClient` : wrapper autour de `httpx.AsyncClient`
  - Retry avec backoff exponentiel (3 tentatives, facteur 2, jitter)
  - Gestion des codes 429 (Too Many Requests) avec respect du header `Retry-After`
  - Timeout adaptatif par connecteur (configurable via `config.timeout_seconds`)
  - Semaphore globale pour limiter la concurrence (defaut: 5 requetes paralleles)
  - Logging structure de chaque tentative (duree, statut, retry count)

**Fichiers a modifier** :
- `web_url.py` : remplacer `httpx.AsyncClient` direct par `RetryableHttpClient`
- `rss_feed.py` : idem pour `_fetch_full_article()`
- `confluence.py` : idem pour `_api_get()`
- `notion.py` : idem pour `_api_get()`, `_api_post()`
- `onedrive.py` : idem pour `_graph_request()`
- `rest_api.py` : idem pour `_request()`
- `s3_bucket.py` : ajouter retry config sur `aiobotocore`

**Bonnes pratiques RAG** :
- Un connecteur qui echoue sur un document ne doit PAS bloquer les autres (fail-open)
- Les erreurs par document sont collectees et reportees dans `IngestionProgress`

---

### 1.2 Tracabilite source dans le pipeline d'ingestion

**Probleme** : Les champs `source_id`, `source_type`, `source_name`, `original_url` de `DocumentInfo` ne sont pas remplis lors de l'ingestion.

**Fichiers a modifier** :
- `ragkit/desktop/ingestion_runtime.py` : dans la boucle d'ingestion, propager les metadonnees du `SourceEntry` et du `ConnectorDocument` vers le `DocumentInfo` sauvegarde

**Impact** : Permet au chat de citer la source precise ("Google Drive > Dossier RH > contrat.pdf" plutot que juste "contrat.pdf")

---

### 1.3 Cache local de fichiers telecharges

**Probleme** : Les connecteurs cloud re-telechargent le contenu complet a chaque sync.

**Implementation** (`ragkit/connectors/download_cache.py`) :

- Cache disque dans `{data_dir}/connector_cache/{source_id}/`
- Cle = `doc_id`, valeur = contenu brut + metadonnees (hash, date)
- TTL configurable (defaut: 24h)
- Nettoyage automatique des fichiers orphelins apres suppression de source
- Taille max du cache configurable (defaut: 1 Go)

**Connecteurs concernes** : Google Drive, OneDrive, Dropbox, S3, Git Repo

---

### 1.4 Tests unitaires des connecteurs

**Structure** (`tests/connectors/`) :

```
tests/connectors/
    conftest.py                 # Fixtures partagees (mock httpx, mock config)
    test_local_directory.py
    test_web_url.py
    test_rss_feed.py
    test_google_drive.py
    test_onedrive.py
    test_dropbox.py
    test_confluence.py
    test_notion.py
    test_sql_database.py
    test_rest_api.py
    test_s3_bucket.py
    test_email_imap.py
    test_git_repo.py
    test_registry.py
    test_credentials.py
    test_http_utils.py
```

**Pour chaque connecteur, tester** :
1. `validate_config()` avec config valide et invalide
2. `test_connection()` avec mock reussi et echoue
3. `list_documents()` avec mock de reponse API
4. `detect_changes()` avec ajout/modif/suppression
5. `fetch_document_content()` avec doc existant et inexistant

---

## Phase 2 : Source "Site Web" (`web_url`) - AMELIORATIONS

### Etat actuel
Le connecteur `WebUrlConnector` est **fonctionnel** : crawl BFS avec profondeur, robots.txt, extraction HTML/markdown/text, filtrage par patterns.

### Ameliorations a apporter

| # | Amelioration | Fichier | Detail |
|---|---|---|---|
| 2.1 | Retry reseau | `web_url.py` | Integrer `RetryableHttpClient` (Phase 1.1) |
| 2.2 | Extraction markdown amelioree | `web_url.py` | Remplacer `_html_to_markdown()` basique par `markdownify` ou `html2text` pour une conversion plus fidele (tableaux, liens, images) |
| 2.3 | Detection de contenu principal | `web_url.py` | Integrer `readability-lxml` ou `trafilatura` pour extraire le contenu principal et ignorer navigation/footer/sidebar |
| 2.4 | Gestion JavaScript | `web_url.py` | Option `render_js: bool` avec fallback Playwright headless pour les SPA (dependance optionnelle) |
| 2.5 | Sitemap.xml | `web_url.py` | Parser `sitemap.xml` comme alternative au crawl BFS pour decouvrir les pages |
| 2.6 | Crawl parallele | `web_url.py` | Utiliser `asyncio.Semaphore` pour crawler N pages en parallele (defaut: 3) |
| 2.7 | `test_connection()` reel | `web_url.py` | Deja fait (HTTP GET sur chaque URL) |

**Dependances Python a ajouter** (optionnelles) :
- `trafilatura` (~3 Mo) - extraction de contenu principal
- `markdownify` (~0.5 Mo) - conversion HTML vers Markdown fidele
- `playwright` (optionnel) - rendu JavaScript

**Formulaire frontend** (`WebUrlForm.tsx`) :
- Deja complet : URLs, profondeur, patterns include/exclude, mode extraction, robots.txt, user-agent
- Ajouter : toggle "Rendu JavaScript" (si Playwright disponible)
- Ajouter : toggle "Extraction intelligente du contenu" (trafilatura)

---

## Phase 3 : Source "Flux RSS/Atom" (`rss_feed`) - AMELIORATIONS

### Etat actuel
Le connecteur `RssFeedConnector` est **fonctionnel** : parsing feedparser, full content fetch optionnel, filtrage par age.

### Ameliorations a apporter

| # | Amelioration | Fichier | Detail |
|---|---|---|---|
| 3.1 | `test_connection()` reel | `rss_feed.py` | Deja fait (parse + validation du flux) |
| 3.2 | Gestion Atom | `rss_feed.py` | feedparser gere deja Atom nativement - verifier les edge cases |
| 3.3 | Full content extraction | `rss_feed.py` | Utiliser `trafilatura` au lieu du BeautifulSoup basique dans `_fetch_full_article()` |
| 3.4 | Deduplication par GUID | `rss_feed.py` | Deja fait via `entry_id` / `guid` |
| 3.5 | Retry reseau | `rss_feed.py` | Integrer `RetryableHttpClient` pour `_fetch_full_article()` |

**Pas de nouvelle dependance requise.**

---

## Phase 4 : Source "Base de donnees SQL" (`sql_database`) - AMELIORATIONS

### Etat actuel
Le connecteur `SqlDatabaseConnector` est **fonctionnel** : SQLite (synchrone), PostgreSQL (asyncpg), MySQL (aiomysql).

### Ameliorations a apporter

| # | Amelioration | Fichier | Detail |
|---|---|---|---|
| 4.1 | `test_connection()` reel | `sql_database.py` | Executer une requete `SELECT 1` pour verifier la connexion reelle |
| 4.2 | Validation injection SQL | `sql_database.py` | Deja fait partiellement (`_is_select_query`). Renforcer : interdire `--`, `;`, sous-requetes `UNION` |
| 4.3 | Connection pooling | `sql_database.py` | Utiliser un pool de connexions asyncpg/aiomysql pour eviter d'ouvrir/fermer a chaque sync |
| 4.4 | Incremental avec timestamp | `sql_database.py` | Ajouter support `WHERE incremental_column > :last_sync` dans la requete |
| 4.5 | Credentials dans keyring | `sql_database.py` | Deja supporte via `self.credential` |
| 4.6 | Preview des resultats | Frontend | Bouton "Apercu" qui execute la requete avec LIMIT 5 et affiche les resultats |

**Formulaire frontend** (`SqlDatabaseForm.tsx`) :
- Deja complet : type DB, host/port/database, query, colonnes
- Ajouter : bouton "Tester la requete" avec preview

---

## Phase 5 : Source "API REST generique" (`rest_api`) - AMELIORATIONS

### Etat actuel
Le connecteur `RestApiConnector` est **fonctionnel** : GET/POST, pagination (offset/cursor/page), JSONPath extraction.

### Ameliorations a apporter

| # | Amelioration | Fichier | Detail |
|---|---|---|---|
| 5.1 | `test_connection()` reel | `rest_api.py` | Executer la requete avec LIMIT 1 et verifier la structure JSON |
| 5.2 | Retry reseau | `rest_api.py` | Integrer `RetryableHttpClient` |
| 5.3 | Variables de template | `rest_api.py` | Deja supporte (`${token}` dans headers). Ajouter support dans l'URL et le body |
| 5.4 | Authentification OAuth2 | `rest_api.py` | Supporter OAuth2 client_credentials grant en plus des API keys statiques |
| 5.5 | Webhook mode | `rest_api.py` | Option pour recevoir des push plutot que poll (webhook endpoint local) |

**Formulaire frontend** (`RestApiForm.tsx`) :
- Deja complet : URL, method, headers, params, pagination, JSONPath
- Ajouter : assistant visuel JSONPath avec apercu de la reponse

---

## Phase 6 : Source "Google Drive" (`google_drive`) - AMELIORATIONS

### Etat actuel
Le connecteur `GoogleDriveConnector` est **fonctionnel** : API Drive v3, OAuth2, export Google Docs, refresh token, listing recursif.

### Ameliorations a apporter

| # | Amelioration | Fichier | Detail |
|---|---|---|---|
| 6.1 | Retry avec backoff | `google_drive.py` | Gestion des erreurs 429/503 avec retry automatique |
| 6.2 | Shared Drives | `google_drive.py` | Deja supporte via `include_shared`. Verifier les permissions `supportsAllDrives` |
| 6.3 | Export ameliore | `google_drive.py` | Google Slides vers texte structure, Google Sheets vers Markdown table |
| 6.4 | Change detection via Changes API | `google_drive.py` | Utiliser `changes.list()` avec `startPageToken` au lieu de re-lister tout |
| 6.5 | Quota monitoring | `google_drive.py` | Logger le quota restant (header `X-RateLimit-Remaining`) |
| 6.6 | Selection de dossiers UI | Frontend | Arborescence Drive navigable au lieu de saisie manuelle des folder_ids |

**Flux OAuth dans le frontend** :
- Deja en place : `/api/sources/{id}/oauth/start` -> URL auth -> `/api/sources/oauth/callback`
- Amelioration : ouvrir la page OAuth dans une fenetre Tauri `WebviewWindow` au lieu du navigateur systeme

---

## Phase 7 : Source "OneDrive / SharePoint" (`onedrive`) - AMELIORATIONS

### Etat actuel
Le connecteur `OneDriveConnector` est **fonctionnel** : Microsoft Graph API, OAuth2/MSAL, delta queries, telechargement binaire.

### Ameliorations a apporter

| # | Amelioration | Fichier | Detail |
|---|---|---|---|
| 7.1 | Delta queries | `onedrive.py` | Deja implemente (`_detect_changes_delta`). Verifier la persistance du delta_link |
| 7.2 | SharePoint sites | `onedrive.py` | Deja supporte via `site_id`. Ajouter endpoint de decouverte des sites disponibles |
| 7.3 | Retry reseau | `onedrive.py` | Integrer `RetryableHttpClient` pour `_graph_request()` |
| 7.4 | Pagination Graph | `onedrive.py` | Gerer `@odata.nextLink` dans `_list_folder_children()` pour les dossiers > 200 items |
| 7.5 | Parsing fichiers Office | `onedrive.py` | Deja delegue a `documents._extract_content()`. Verifier le support .xlsx, .pptx |

---

## Phase 8 : Source "Dropbox" (`dropbox`) - AMELIORATIONS

### Etat actuel
Le connecteur `DropboxConnector` est **fonctionnel** : SDK Dropbox, cursor-based change detection, listing recursif.

### Ameliorations a apporter

| # | Amelioration | Fichier | Detail |
|---|---|---|---|
| 8.1 | Sharing links | `dropbox.py` | Recuperer le shared link pour chaque fichier (pour citation dans le chat) |
| 8.2 | Batch download | `dropbox.py` | Utiliser `files_download_zip` pour les dossiers volumineux |
| 8.3 | Paper documents | `dropbox.py` | Supporter l'export des documents Dropbox Paper |
| 8.4 | Retry reseau | `dropbox.py` | Le SDK Dropbox a son propre retry interne. Verifier sa configuration |

---

## Phase 9 : Source "Confluence" (`confluence`) - AMELIORATIONS

### Etat actuel
Le connecteur `ConfluenceConnector` est **fonctionnel** : REST API, pagination, filtrage par space/labels, nettoyage HTML Confluence.

### Ameliorations a apporter

| # | Amelioration | Fichier | Detail |
|---|---|---|---|
| 9.1 | `test_connection()` reel | `confluence.py` | Appeler `/rest/api/space` pour verifier l'acces reel |
| 9.2 | Attachments | `confluence.py` | Implementer `include_attachments` : lister et telecharger les pieces jointes |
| 9.3 | Comments | `confluence.py` | Implementer `include_comments` : recuperer les commentaires de chaque page |
| 9.4 | Macros Confluence | `confluence.py` | Mieux gerer les macros `ac:structured-macro` (code blocks, info panels, etc.) |
| 9.5 | Confluence Data Center | `confluence.py` | Verifier compatibilite avec Confluence Server/Data Center (pas seulement Cloud) |
| 9.6 | CQL incremental | `confluence.py` | Utiliser CQL `lastModified > "YYYY-MM-DD"` pour la detection incrementale |

---

## Phase 10 : Source "Notion" (`notion`) - AMELIORATIONS

### Etat actuel
Le connecteur `NotionConnector` est **fonctionnel** : API Notion, database queries, blocks parsing, rich text extraction.

### Ameliorations a apporter

| # | Amelioration | Fichier | Detail |
|---|---|---|---|
| 10.1 | `test_connection()` reel | `notion.py` | Appeler `/v1/users/me` pour verifier le token |
| 10.2 | Sous-pages recursives | `notion.py` | Implementer `include_subpages` : parcourir les `child_page` blocks recursivement |
| 10.3 | Blocs imbriques | `notion.py` | Parcourir `has_children: true` recursivement pour les listes imbriquees, toggles, etc. |
| 10.4 | Images et fichiers | `notion.py` | Extraire les URLs des images/fichiers inline pour les inclure en metadata |
| 10.5 | Database properties | `notion.py` | Convertir les proprietes Notion (select, multi-select, date, relation) en texte lisible |
| 10.6 | Rate limiting | `notion.py` | L'API Notion a un rate limit strict (3 req/sec). Respecter `Retry-After` |

---

## Phase 11 : Source "Messagerie IMAP" (`email_imap`) - IMPLEMENTATION COMPLETE

### Etat actuel
Le connecteur `EmailImapConnector` est un **PLACEHOLDER** : `_fetch_emails()` retourne une liste vide.

### Implementation requise

**C'est le seul connecteur qui necessite un travail substantiel.**

| # | Tache | Detail |
|---|---|---|
| 11.1 | Connexion IMAP async | Utiliser `aioimaplib` pour se connecter au serveur IMAP avec SSL/STARTTLS |
| 11.2 | Listing des dossiers | `IMAP LIST` pour enumerer les dossiers disponibles (INBOX, Sent, etc.) |
| 11.3 | Recherche d'emails | Construire les criteres IMAP SEARCH : `SINCE date_from`, `FROM sender_filter`, `SUBJECT subject_filter` |
| 11.4 | Fetch des messages | `IMAP FETCH` avec `(RFC822)` pour recuperer le contenu complet |
| 11.5 | Parsing MIME | Utiliser `email.message_from_bytes()` (stdlib) pour parser les messages multipart |
| 11.6 | Extraction du corps | Preferer `text/plain`, fallback vers `text/html` nettoye via BeautifulSoup |
| 11.7 | Pieces jointes | Si `include_attachments`, extraire les fichiers attaches et les parser via `documents._extract_content()` |
| 11.8 | UIDVALIDITY | Stocker `UIDVALIDITY` pour detecter les resets de dossier |
| 11.9 | Detection incrementale | Utiliser `UID SEARCH` avec `UID > last_uid` pour ne chercher que les nouveaux emails |
| 11.10 | OAuth2 Gmail | Supporter `XOAUTH2` pour Gmail (au lieu de mot de passe applicatif) |
| 11.11 | `test_connection()` | Se connecter, s'authentifier, verifier les dossiers accessibles |
| 11.12 | Encodage | Gerer les encodages divers (UTF-8, ISO-8859-1, base64, quoted-printable) |

**Implementation de `_fetch_emails()`** :

```python
async def _fetch_emails(self) -> list[dict[str, Any]]:
    """Recupere les emails depuis le serveur IMAP."""
    import email
    from email.header import decode_header

    host = self._server()
    port = self._port()
    cred = self.credential or {}

    if self._use_ssl():
        imap = aioimaplib.IMAP4_SSL(host=host, port=port)
    else:
        imap = aioimaplib.IMAP4(host=host, port=port)

    await imap.wait_hello_from_server()
    await imap.login(cred["username"], cred["password"])

    results = []
    for folder in self._folders():
        await imap.select(folder)

        # Build search criteria
        criteria = self._build_search_criteria()
        _, data = await imap.search(criteria)
        uids = data[0].split()[-self._max_emails():]

        for uid in uids:
            _, msg_data = await imap.fetch(uid, "(RFC822)")
            raw = msg_data[1]
            msg = email.message_from_bytes(raw)

            subject = self._decode_header(msg["Subject"])
            sender = self._decode_header(msg["From"])
            date = msg["Date"]
            body = self._extract_body(msg)

            results.append({
                "uid": uid.decode(),
                "subject": subject,
                "from": sender,
                "date": date,
                "body": body,
                "folder": folder,
            })

    await imap.logout()
    return results
```

**Dependance** : `aioimaplib` (deja dans le spec, ~1 Mo)

**Formulaire frontend** (`EmailImapForm.tsx`) :
- Deja complet : server, port, SSL, dossiers, filtres, max emails

---

## Phase 12 : Source "S3 / MinIO" (`s3_bucket`) - AMELIORATIONS

### Etat actuel
Le connecteur `S3BucketConnector` est **fonctionnel** : listing pagine, telechargement, filtrage par type/taille.

### Ameliorations a apporter

| # | Amelioration | Fichier | Detail |
|---|---|---|---|
| 12.1 | `test_connection()` reel | `s3_bucket.py` | Appeler `head_bucket()` pour verifier l'acces |
| 12.2 | Parsing binaire | `s3_bucket.py` | Utiliser `documents._extract_content()` au lieu de `decode("utf-8")` pour supporter PDF/DOCX |
| 12.3 | Credentials AWS profiles | `s3_bucket.py` | Supporter les profiles AWS (`~/.aws/credentials`) en plus des access keys |
| 12.4 | MinIO health check | `s3_bucket.py` | Endpoint `/minio/health/live` pour MinIO |
| 12.5 | Cache local | `s3_bucket.py` | Integrer le cache de telechargement (Phase 1.3) |

---

## Phase 13 : Source "Git Repository" (`git_repo`) - AMELIORATIONS

### Etat actuel
Le connecteur `GitRepoConnector` est **fonctionnel** : clone/pull via subprocess, detection de changements via git diff.

### Ameliorations a apporter

| # | Amelioration | Fichier | Detail |
|---|---|---|---|
| 13.1 | `test_connection()` reel | `git_repo.py` | Executer `git ls-remote` pour verifier l'acces au depot |
| 13.2 | Authentification | `git_repo.py` | Supporter PAT dans l'URL HTTPS (`https://token@github.com/...`) et cles SSH |
| 13.3 | Sparse checkout | `git_repo.py` | Utiliser sparse-checkout pour ne cloner que les dossiers pertinents (docs/, README) |
| 13.4 | Nettoyage du cache | `git_repo.py` | Supprimer le clone local quand la source est supprimee |
| 13.5 | Fichiers binaires | `git_repo.py` | Detecter et ignorer les fichiers binaires (images, archives) via `git check-attr` |

---

## Phase 14 : Integration dans le Wizard

### Etat actuel
Le composant `SourceStep.tsx` definit 5 types mais seul `local_folder` est `available: true`.

### Implementation

| # | Tache | Fichier | Detail |
|---|---|---|---|
| 14.1 | Activer les types | `SourceStep.tsx` | Passer `available: true` pour chaque type au fur et a mesure de leur validation |
| 14.2 | Mapping des types | `SourceStep.tsx` | Mapper les types UI (`database`, `website`, `email`, `api`) vers les `SourceType` backend multiples |
| 14.3 | Formulaires dans le wizard | `SourceStep.tsx` | Reutiliser les composants `*Form.tsx` deja existants dans `source-forms/` |
| 14.4 | Multi-sources dans le wizard | `SourceStep.tsx` | Permettre d'ajouter plusieurs sources pendant le wizard (pas une seule) |
| 14.5 | Test de connexion dans le wizard | `SourceStep.tsx` | Ajouter un bouton "Tester" avant de passer a l'etape suivante |

**Mapping des categories UI** :

| Categorie Wizard | Types Backend |
|---|---|
| Dossier local | `local_directory` |
| Base de donnees | `sql_database` |
| Site web | `web_url`, `rss_feed` |
| Messagerie | `email_imap` |
| API / Connecteur | `rest_api`, `google_drive`, `onedrive`, `dropbox`, `confluence`, `notion`, `s3_bucket`, `git_repo` |

---

## Phase 15 : Qualite et monitoring

### 15.1 Metriques par source dans le dashboard

- Nombre de documents par source (deja dans `SourceEntry.document_count`)
- Taille totale par source
- Historique de synchronisation par source
- Graphique de repartition des sources
- Alertes en cas d'echec de sync

### 15.2 Logging structure

- Chaque sync produit un rapport detaille :
  - Documents ajoutes / modifies / supprimes / echoues
  - Duree de la sync
  - Erreurs par document avec stack trace
  - Quota API consomme (si applicable)

### 15.3 Export de configuration

- La configuration multi-sources doit etre exportable/importable
- Les credentials ne sont JAMAIS inclus dans l'export
- Format JSON compatible avec la migration automatique

---

## Ordre de priorite recommande

| Priorite | Phase | Effort | Impact |
|---|---|---|---|
| **P0** | Phase 1 (Fondations transversales) | Moyen | Prerequis pour tout le reste |
| **P0** | Phase 11 (Email IMAP) | Important | Seul connecteur placeholder |
| **P1** | Phase 14 (Wizard) | Moyen | Debloquer l'UX pour les utilisateurs |
| **P1** | Phase 2 (Web - ameliorations) | Moyen | Source la plus demandee |
| **P1** | Phase 4 (SQL - test_connection) | Faible | Quick win |
| **P1** | Phase 5 (REST API - test_connection) | Faible | Quick win |
| **P2** | Phase 9 (Confluence - attachments) | Moyen | Fonctionnalite attendue |
| **P2** | Phase 10 (Notion - sous-pages) | Moyen | Fonctionnalite attendue |
| **P2** | Phase 6 (Google Drive - Changes API) | Moyen | Optimisation perf |
| **P2** | Phase 7 (OneDrive - pagination) | Faible | Bug fix potentiel |
| **P3** | Phase 3 (RSS - trafilatura) | Faible | Nice-to-have |
| **P3** | Phase 8 (Dropbox - Paper) | Faible | Cas d'usage rare |
| **P3** | Phase 12 (S3 - parsing binaire) | Faible | Quick fix |
| **P3** | Phase 13 (Git - sparse checkout) | Faible | Optimisation |
| **P3** | Phase 15 (Monitoring) | Moyen | Polish |

---

## Dependances Python additionnelles

| Package | Sources | Statut | Taille |
|---|---|---|---|
| `trafilatura` | Web, RSS | A ajouter (optionnel) | ~3 Mo |
| `markdownify` | Web | A ajouter (optionnel) | ~0.5 Mo |
| `aioimaplib` | Email IMAP | A ajouter (optionnel) | ~1 Mo |
| `httpx` | Web, RSS, Confluence, Notion, OneDrive, REST | Deja present | - |
| `beautifulsoup4` | Web, RSS, Confluence, Email | Deja present | - |
| `feedparser` | RSS | Deja present | - |
| `google-api-python-client` | Google Drive | Deja present (optionnel) | - |
| `dropbox` | Dropbox | Deja present (optionnel) | - |
| `asyncpg` | SQL (PostgreSQL) | Deja present (optionnel) | - |
| `aiomysql` | SQL (MySQL) | Deja present (optionnel) | - |
| `aiobotocore` | S3 | Deja present (optionnel) | - |
| `keyring` | Credentials | Deja present | - |

> Toutes les nouvelles dependances doivent rester **optionnelles** via extras pip.

---

## Resume

L'architecture multi-sources est **solide et bien concue**. Les 13 connecteurs backend existent, les formulaires frontend existent, l'API REST et le scheduler sont en place. Le travail restant se concentre sur :

1. **Fiabilisation** : retry reseau, test_connection reel, rate limiting
2. **Completion** : connecteur IMAP (seul placeholder)
3. **Deblocage UX** : activer les types dans le wizard
4. **Ameliorations qualitatives** : extraction de contenu plus fine, sous-pages Notion, attachments Confluence
5. **Monitoring** : metriques et alertes par source
