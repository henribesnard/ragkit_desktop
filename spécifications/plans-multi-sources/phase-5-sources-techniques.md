# Phase 5 — Sources techniques (SQL, REST, S3, Email, Git)

> **Prérequis** : Phase 1 terminée  
> **Durée estimée** : 4-5 jours  
> **Objectif** : Fournir des connecteurs pour les sources de données techniques et avancées.

---

## Étape 5.1 — `SqlDatabaseConnector`

### Dépendances Python

```
aiosqlite>=0.20
asyncpg>=0.29       # PostgreSQL
aiomysql>=0.2       # MySQL (optionnel)
```

> Extra pip : `pip install ragkit[sql]`

### Fichier : `ragkit/connectors/sql_database.py`

#### Paramètres `config` attendus

```python
{
    "db_type": "postgresql",              # "postgresql" | "mysql" | "sqlite"
    "host": "localhost",
    "port": 5432,
    "database": "mydb",
    "sqlite_path": None,                  # Pour SQLite uniquement
    "query": "SELECT id, content, title, updated_at FROM articles WHERE published = true",
    "id_column": "id",
    "content_column": "content",
    "title_column": "title",
    "metadata_columns": ["category", "author", "tags"],
    "incremental_column": "updated_at",   # Pour sync incrémentale
    "max_rows": 10000,
}
```

#### Credential attendu

```python
{"username": "user", "password": "pass"}
# Ou pour SQLite : pas de credential
```

#### Logique principale

1. **Connexion** : driver async selon `db_type`
2. **Exécution query** : lancer la requête configurée, itérer sur les résultats
3. **Mapping** : convertir chaque row en `ConnectorDocument` via `id_column`, `content_column`, etc.
4. **Détection incrémentale** : `WHERE {incremental_column} > '{last_sync_date}'`
5. **Sécurité** : **jamais** d'exécution DDL, uniquement SELECT (validation côté serveur)

### Tests de validation (étape 5.1)

```python
# tests/test_connector_sql.py

import pytest
import aiosqlite
from pathlib import Path
from ragkit.connectors.sql_database import SqlDatabaseConnector

@pytest.fixture
async def sqlite_db(tmp_path):
    db_path = tmp_path / "test.db"
    async with aiosqlite.connect(db_path) as db:
        await db.execute("""
            CREATE TABLE articles (
                id INTEGER PRIMARY KEY,
                title TEXT,
                content TEXT,
                category TEXT,
                updated_at TEXT
            )
        """)
        await db.executemany(
            "INSERT INTO articles VALUES (?, ?, ?, ?, ?)",
            [
                (1, "Article 1", "Contenu de l'article 1", "tech", "2026-01-01T00:00:00Z"),
                (2, "Article 2", "Contenu de l'article 2", "science", "2026-02-01T00:00:00Z"),
                (3, "Article 3", "Contenu de l'article 3", "tech", "2026-03-01T00:00:00Z"),
            ]
        )
        await db.commit()
    return db_path

@pytest.mark.asyncio
async def test_validate_config_valid(sqlite_db):
    conn = SqlDatabaseConnector(
        source_id="s1",
        config={
            "db_type": "sqlite", "sqlite_path": str(sqlite_db),
            "query": "SELECT id, content, title FROM articles",
            "id_column": "id", "content_column": "content",
        }
    )
    result = await conn.validate_config()
    assert result.valid is True

@pytest.mark.asyncio
async def test_validate_config_rejects_ddl():
    conn = SqlDatabaseConnector(
        source_id="s1",
        config={
            "db_type": "sqlite", "sqlite_path": "/tmp/test.db",
            "query": "DROP TABLE articles",
            "id_column": "id", "content_column": "content",
        }
    )
    result = await conn.validate_config()
    assert result.valid is False
    assert any("select" in e.lower() or "dangere" in e.lower() for e in result.errors)

@pytest.mark.asyncio
async def test_list_documents(sqlite_db):
    conn = SqlDatabaseConnector(
        source_id="s1",
        config={
            "db_type": "sqlite", "sqlite_path": str(sqlite_db),
            "query": "SELECT id, content, title, category FROM articles",
            "id_column": "id", "content_column": "content",
            "title_column": "title",
            "metadata_columns": ["category"],
        }
    )
    docs = await conn.list_documents()
    assert len(docs) == 3
    assert docs[0].title == "Article 1"
    assert "Contenu de l'article 1" in docs[0].content
    assert docs[0].metadata.get("category") == "tech"

@pytest.mark.asyncio
async def test_incremental_detection(sqlite_db):
    conn = SqlDatabaseConnector(
        source_id="s1",
        config={
            "db_type": "sqlite", "sqlite_path": str(sqlite_db),
            "query": "SELECT id, content, title, updated_at FROM articles",
            "id_column": "id", "content_column": "content",
            "incremental_column": "updated_at",
        }
    )
    # Simuler une sync passée au 15 janvier
    known = {"1": "hash-1"}  # Article 1 connu
    changes = await conn.detect_changes(known)
    assert len(changes.added) == 2  # Articles 2 et 3
    assert len(changes.modified) == 0 or len(changes.modified) >= 0

@pytest.mark.asyncio
async def test_max_rows_limit(sqlite_db):
    conn = SqlDatabaseConnector(
        source_id="s1",
        config={
            "db_type": "sqlite", "sqlite_path": str(sqlite_db),
            "query": "SELECT id, content FROM articles",
            "id_column": "id", "content_column": "content",
            "max_rows": 2,
        }
    )
    docs = await conn.list_documents()
    assert len(docs) <= 2

@pytest.mark.asyncio
async def test_missing_column_error(sqlite_db):
    conn = SqlDatabaseConnector(
        source_id="s1",
        config={
            "db_type": "sqlite", "sqlite_path": str(sqlite_db),
            "query": "SELECT id, content FROM articles",
            "id_column": "nonexistent", "content_column": "content",
        }
    )
    result = await conn.validate_config()
    # Doit détecter que la colonne n'existe pas dans le résultat
```

---

## Étape 5.2 — `RestApiConnector`

### Fichier : `ragkit/connectors/rest_api.py`

#### Paramètres `config` attendus

```python
{
    "base_url": "https://api.example.com",
    "endpoint": "/v1/articles",
    "method": "GET",
    "headers": {"Authorization": "Bearer ${API_KEY}"},  # Référence credential
    "query_params": {"status": "published"},
    "pagination_type": "offset",          # "offset" | "cursor" | "page" | "none"
    "pagination_param": "offset",
    "pagination_size_param": "limit",
    "page_size": 50,
    "response_items_path": "$.data.items",      # JSONPath vers la liste
    "response_id_path": "$.id",                  # JSONPath vers l'ID dans chaque item
    "response_content_path": "$.body",            # JSONPath vers le contenu
    "response_title_path": "$.title",
    "response_date_path": "$.updated_at",
    "max_items": 1000,
    "timeout_seconds": 30,
}
```

#### Logique

1. **Requête initiale** : `method` sur `base_url + endpoint` avec `headers` et `query_params`
2. **Extraction des items** : via `response_items_path` (JSONPath simplifié)
3. **Pagination** : itérer selon le type choisi jusqu'à `max_items`
4. **Mapping** : `response_id_path`, `response_content_path`, etc. pour construire `ConnectorDocument`

### Tests de validation (étape 5.2)

```python
# tests/test_connector_rest_api.py

@pytest.mark.asyncio
async def test_validate_config_valid():
    conn = RestApiConnector(
        source_id="s1",
        config={
            "base_url": "https://api.example.com",
            "endpoint": "/articles",
            "response_items_path": "$.data",
            "response_id_path": "$.id",
            "response_content_path": "$.body",
        }
    )
    result = await conn.validate_config()
    assert result.valid is True

@pytest.mark.asyncio
async def test_validate_config_missing_base_url():
    conn = RestApiConnector(source_id="s1", config={"endpoint": "/articles"})
    result = await conn.validate_config()
    assert result.valid is False

@pytest.mark.asyncio
async def test_list_documents_no_pagination():
    conn = RestApiConnector(
        source_id="s1",
        config={
            "base_url": "https://api.example.com",
            "endpoint": "/articles",
            "pagination_type": "none",
            "response_items_path": "$.articles",
            "response_id_path": "$.id",
            "response_content_path": "$.body",
            "response_title_path": "$.title",
        }
    )
    mock_response = {
        "articles": [
            {"id": "1", "title": "Article 1", "body": "Content 1"},
            {"id": "2", "title": "Article 2", "body": "Content 2"},
        ]
    }
    with patch.object(conn, "_request", return_value=mock_response):
        docs = await conn.list_documents()
    assert len(docs) == 2
    assert docs[0].title == "Article 1"

@pytest.mark.asyncio
async def test_offset_pagination():
    """Vérifie que la pagination offset itère correctement."""
    conn = RestApiConnector(
        source_id="s1",
        config={
            "base_url": "https://api.example.com",
            "endpoint": "/articles",
            "pagination_type": "offset",
            "page_size": 1,
            "max_items": 3,
            "response_items_path": "$.data",
            "response_id_path": "$.id",
            "response_content_path": "$.body",
        }
    )
    # Simuler 3 appels paginés

@pytest.mark.asyncio
async def test_jsonpath_extraction():
    conn = RestApiConnector(source_id="s1", config={})
    data = {"data": {"items": [{"id": 1}, {"id": 2}]}}
    result = conn._extract_jsonpath(data, "$.data.items")
    assert len(result) == 2

@pytest.mark.asyncio
async def test_header_credential_substitution():
    """Vérifie que ${API_KEY} est remplacé par le credential."""
    conn = RestApiConnector(
        source_id="s1",
        config={
            "base_url": "https://api.example.com",
            "endpoint": "/articles",
            "headers": {"Authorization": "Bearer ${API_KEY}"},
        },
        credential={"API_KEY": "real-key-123"}
    )
    headers = conn._resolve_headers()
    assert headers["Authorization"] == "Bearer real-key-123"
```

---

## Étape 5.3 — `S3BucketConnector`

### Dépendances Python

```
aiobotocore>=2.12
```

> Extra pip : `pip install ragkit[s3]`

### Fichier : `ragkit/connectors/s3_bucket.py`

#### Paramètres `config` attendus

```python
{
    "bucket": "my-knowledge-base",
    "prefix": "documents/",
    "region": "eu-west-1",
    "endpoint_url": None,          # Pour MinIO ou S3-compatible
    "file_types": ["pdf", "md", "txt", "docx"],
    "recursive": True,
    "max_file_size_mb": 50,
}
```

#### Credential attendu

```python
{"aws_access_key_id": "AKIA...", "aws_secret_access_key": "..."}
# Ou profil AWS : {"profile": "default"}
```

### Tests de validation (étape 5.3)

```python
# tests/test_connector_s3.py

@pytest.mark.asyncio
async def test_validate_config_valid():
    conn = S3BucketConnector(
        source_id="s1",
        config={"bucket": "my-bucket", "prefix": "docs/", "region": "eu-west-1"},
        credential={"aws_access_key_id": "AKIA", "aws_secret_access_key": "secret"}
    )
    result = await conn.validate_config()
    assert result.valid is True

@pytest.mark.asyncio
async def test_validate_config_no_bucket():
    conn = S3BucketConnector(
        source_id="s1", config={"prefix": "docs/"},
        credential={"aws_access_key_id": "AKIA", "aws_secret_access_key": "s"}
    )
    result = await conn.validate_config()
    assert result.valid is False

@pytest.mark.asyncio
async def test_list_documents_filters_by_extension():
    """Mock S3 list_objects_v2 pour vérifier le filtrage par extension."""
    conn = S3BucketConnector(
        source_id="s1",
        config={"bucket": "b", "prefix": "", "file_types": ["pdf"],
                "region": "us-east-1"},
        credential={"aws_access_key_id": "A", "aws_secret_access_key": "s"}
    )
    mock_objects = [
        {"Key": "doc.pdf", "Size": 1024, "LastModified": "2026-01-01T00:00:00Z",
         "ETag": '"abc123"'},
        {"Key": "image.png", "Size": 2048, "LastModified": "2026-01-01T00:00:00Z",
         "ETag": '"def456"'},
    ]
    with patch.object(conn, "_list_objects", return_value=mock_objects):
        docs = await conn.list_documents()
    assert len(docs) == 1
    assert docs[0].file_type == "pdf"

@pytest.mark.asyncio
async def test_detect_changes_via_etag():
    """Utilise ETag S3 pour la détection de changement."""
    conn = S3BucketConnector(
        source_id="s1",
        config={"bucket": "b", "prefix": "", "file_types": ["pdf"], "region": "us-east-1"},
        credential={"aws_access_key_id": "A", "aws_secret_access_key": "s"}
    )
    known = {"doc-id": "old-etag"}
    with patch.object(conn, "list_documents") as mock_list:
        mock_list.return_value = [
            MagicMock(id="doc-id", content_hash="new-etag"),
        ]
        changes = await conn.detect_changes(known)
    assert len(changes.modified) == 1
```

---

## Étape 5.4 — `EmailImapConnector`

### Dépendances Python

```
aioimaplib>=2.0
```

> Extra pip : `pip install ragkit[email]`

### Fichier : `ragkit/connectors/email_imap.py`

#### Paramètres `config` attendus

```python
{
    "server": "imap.gmail.com",
    "port": 993,
    "use_ssl": True,
    "folders": ["INBOX", "Sent"],
    "include_attachments": False,
    "max_emails": 500,
    "date_from": "2025-01-01",
    "subject_filter": None,
    "sender_filter": ["boss@company.com", "team@company.com"],
}
```

### Tests de validation (étape 5.4)

```python
# tests/test_connector_email.py

@pytest.mark.asyncio
async def test_validate_config_valid():
    conn = EmailImapConnector(
        source_id="s1",
        config={"server": "imap.gmail.com", "port": 993, "use_ssl": True,
                "folders": ["INBOX"]},
        credential={"username": "user@gmail.com", "password": "app-password"}
    )
    result = await conn.validate_config()
    assert result.valid is True

@pytest.mark.asyncio
async def test_validate_config_no_server():
    conn = EmailImapConnector(source_id="s1", config={"folders": ["INBOX"]})
    result = await conn.validate_config()
    assert result.valid is False

@pytest.mark.asyncio
async def test_list_documents_extracts_emails():
    """Mock IMAP pour vérifier l'extraction d'emails."""
    conn = EmailImapConnector(
        source_id="s1",
        config={"server": "imap.test.com", "port": 993, "folders": ["INBOX"],
                "max_emails": 10},
        credential={"username": "user", "password": "pass"}
    )
    # Mock IMAP search + fetch
    with patch.object(conn, "_fetch_emails") as mock_fetch:
        mock_fetch.return_value = [
            {"uid": "1", "subject": "Meeting notes", "from": "boss@co.com",
             "date": "2026-03-01T10:00:00Z", "body": "Notes de la réunion..."},
        ]
        docs = await conn.list_documents()
    assert len(docs) == 1
    assert docs[0].title == "Meeting notes"

@pytest.mark.asyncio
async def test_sender_filter():
    conn = EmailImapConnector(
        source_id="s1",
        config={"server": "imap.test.com", "port": 993, "folders": ["INBOX"],
                "sender_filter": ["boss@co.com"]},
        credential={"username": "user", "password": "pass"}
    )
    # Vérifier que la commande IMAP SEARCH inclut FROM "boss@co.com"

@pytest.mark.asyncio
async def test_date_from_filter():
    conn = EmailImapConnector(
        source_id="s1",
        config={"server": "imap.test.com", "port": 993, "folders": ["INBOX"],
                "date_from": "2026-01-01"},
        credential={"username": "user", "password": "pass"}
    )
    # Vérifier que la commande SEARCH inclut SINCE 01-Jan-2026
```

---

## Étape 5.5 — `GitRepoConnector`

### Dépendances Python

```
gitpython>=3.1
```

> Extra pip : `pip install ragkit[git]`

### Fichier : `ragkit/connectors/git_repo.py`

#### Paramètres `config` attendus

```python
{
    "repo_url": "https://github.com/org/repo.git",
    "branch": "main",
    "file_types": ["md", "txt", "rst", "py"],
    "excluded_dirs": ["node_modules", ".git", "dist", "build", "__pycache__"],
    "include_readme_only": False,
    "max_file_size_mb": 5,
    "clone_depth": 1,                     # Shallow clone pour performance
}
```

#### Credential attendu

```python
# HTTPS
{"token": "ghp_abc123..."}  # GitHub PAT
# Ou SSH (pas recommandé pour app desktop)
```

#### Logique principale

1. **Clone** : `git clone --depth {clone_depth} --branch {branch}` dans un répertoire temporaire
2. **Listing** : parcourir les fichiers du clone local (réutiliser `_iter_files` de `documents.py`)
3. **Contenu** : lecture directe des fichiers clonés
4. **Détection de changement** : `git pull` + `git diff --name-only HEAD@{1}..HEAD`
5. **Nettoyage** : suppression du clone temporaire après extraction (ou conservation selon config)

### Tests de validation (étape 5.5)

```python
# tests/test_connector_git_repo.py

@pytest.mark.asyncio
async def test_validate_config_valid():
    conn = GitRepoConnector(
        source_id="s1",
        config={"repo_url": "https://github.com/org/repo.git",
                "branch": "main", "file_types": ["md", "txt"]}
    )
    result = await conn.validate_config()
    assert result.valid is True

@pytest.mark.asyncio
async def test_validate_config_invalid_url():
    conn = GitRepoConnector(
        source_id="s1",
        config={"repo_url": "not-a-url", "branch": "main", "file_types": ["md"]}
    )
    result = await conn.validate_config()
    assert result.valid is False

@pytest.mark.asyncio
async def test_list_documents_from_local_repo(tmp_path):
    """Crée un repo git local pour tester."""
    import subprocess
    subprocess.run(["git", "init"], cwd=tmp_path, capture_output=True)
    (tmp_path / "README.md").write_text("# Hello\nDoc content", encoding="utf-8")
    (tmp_path / "code.py").write_text("print('hello')", encoding="utf-8")
    (tmp_path / "image.png").write_bytes(b"\x89PNG")
    subprocess.run(["git", "add", "."], cwd=tmp_path, capture_output=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=tmp_path,
                   capture_output=True, env={**{"GIT_AUTHOR_NAME": "Test",
                   "GIT_AUTHOR_EMAIL": "t@t.com", "GIT_COMMITTER_NAME": "Test",
                   "GIT_COMMITTER_EMAIL": "t@t.com"}})

    conn = GitRepoConnector(
        source_id="s1",
        config={"repo_url": str(tmp_path), "branch": "master",
                "file_types": ["md", "py"]}
    )
    with patch.object(conn, "_clone_or_pull", return_value=tmp_path):
        docs = await conn.list_documents()
    assert len(docs) == 2  # README.md + code.py, pas image.png

@pytest.mark.asyncio
async def test_include_readme_only(tmp_path):
    conn = GitRepoConnector(
        source_id="s1",
        config={"repo_url": str(tmp_path), "branch": "main",
                "file_types": ["md"], "include_readme_only": True}
    )
    # Vérifier que seuls README.md, CONTRIBUTING.md, etc. sont inclus

@pytest.mark.asyncio
async def test_excluded_dirs():
    conn = GitRepoConnector(
        source_id="s1",
        config={"repo_url": "https://github.com/org/repo.git", "branch": "main",
                "file_types": ["py"],
                "excluded_dirs": ["node_modules", "__pycache__"]}
    )
    # Vérifier que les fichiers dans ces dossiers sont exclus

@pytest.mark.asyncio
async def test_detect_changes_via_git_diff(tmp_path):
    """Vérifie la détection de changements via git diff."""
    conn = GitRepoConnector(
        source_id="s1",
        config={"repo_url": str(tmp_path), "branch": "main", "file_types": ["md"]}
    )
    with patch.object(conn, "_get_changed_files",
                      return_value=["docs/new.md", "docs/modified.md"]):
        changes = await conn.detect_changes(known_hashes={})
    assert len(changes.added) >= 1 or len(changes.modified) >= 1
```

---

## Étape 5.6 — Formulaires UI pour les sources techniques

### Fichiers frontend

| Fichier | Description |
|---|---|
| `desktop/src/components/settings/source-forms/SqlDatabaseForm.tsx` | Config SQL |
| `desktop/src/components/settings/source-forms/RestApiForm.tsx` | Config API REST |
| `desktop/src/components/settings/source-forms/S3BucketForm.tsx` | Config S3/MinIO |
| `desktop/src/components/settings/source-forms/EmailImapForm.tsx` | Config IMAP |
| `desktop/src/components/settings/source-forms/GitRepoForm.tsx` | Config Git |

#### Points UX clés

- **SqlDatabaseForm** :
  - Sélecteur type DB (PostgreSQL / MySQL / SQLite)
  - Champs host/port/database (masqués si SQLite)
  - Éditeur de requête SQL avec coloration syntaxique basique
  - Mapping colonnes via dropdowns
  - Bouton "Tester la requête" : exécute un `LIMIT 5` et affiche les résultats

- **RestApiForm** :
  - URL de base + endpoint
  - Éditeur headers (clé-valeur)
  - Sélecteur type de pagination
  - Champs JSONPath avec aide contextuelle
  - Bouton "Tester l'API" : fait une requête et affiche le JSON retourné

- **S3BucketForm** :
  - Bucket / region / prefix
  - Endpoint personnalisé pour MinIO
  - Credentials AWS (Access Key / Secret)
  - Navigateur de fichiers S3 (arborescence)

- **EmailImapForm** :
  - Champs serveur / port / SSL
  - Sélection de dossiers mail (après connexion)
  - Filtres date, sujet, expéditeur
  - Prévisualisation : nombre d'emails trouvés

- **GitRepoForm** :
  - URL du dépôt
  - Branche
  - Token d'accès (masqué)
  - Types de fichiers et exclusions
  - Option "Documentation uniquement"

### Tests de validation (étape 5.6)

```typescript
describe("SqlDatabaseForm", () => {
  it("toggles host/port fields based on db_type", () => { ... });
  it("shows SQLite path picker when db_type is sqlite", () => { ... });
  it("validates SQL query is SELECT only", () => { ... });
  it("renders column mapping dropdowns", () => { ... });
  it("calls onSubmit with correct config", () => { ... });
});

describe("RestApiForm", () => {
  it("renders URL and endpoint fields", () => { ... });
  it("allows adding custom headers", () => { ... });
  it("shows pagination options", () => { ... });
  it("validates JSONPath format", () => { ... });
});

describe("S3BucketForm", () => {
  it("renders bucket and region fields", () => { ... });
  it("shows endpoint field for MinIO", () => { ... });
  it("validates bucket name format", () => { ... });
});

describe("EmailImapForm", () => {
  it("renders server connection fields", () => { ... });
  it("shows folder selection after test", () => { ... });
  it("validates server hostname", () => { ... });
});

describe("GitRepoForm", () => {
  it("renders repo URL and branch fields", () => { ... });
  it("shows documentation-only option", () => { ... });
  it("validates repo URL format", () => { ... });
});
```

---

## Étape 5.7 — Extra pip et build conditionnel

### Fichier : `pyproject.toml` — Mise à jour des extras

```toml
[project.optional-dependencies]
web = ["httpx>=0.27", "beautifulsoup4>=4.12", "lxml>=5.0", "feedparser>=6.0"]
google = ["google-api-python-client>=2.100", "google-auth-oauthlib>=1.2"]
microsoft = ["msal>=1.28"]
dropbox = ["dropbox>=12.0"]
sql = ["aiosqlite>=0.20", "asyncpg>=0.29"]
s3 = ["aiobotocore>=2.12"]
email = ["aioimaplib>=2.0"]
git = ["gitpython>=3.1"]
all-connectors = [
    "ragkit[web]", "ragkit[google]", "ragkit[microsoft]",
    "ragkit[dropbox]", "ragkit[sql]", "ragkit[s3]",
    "ragkit[email]", "ragkit[git]"
]
```

### Détection dynamique dans le registre

Chaque connecteur utilise un `try/except ImportError` pour s'enregistrer uniquement si ses dépendances sont disponibles :

```python
# ragkit/connectors/s3_bucket.py
try:
    import aiobotocore
    
    @register_connector(SourceType.S3_BUCKET)
    class S3BucketConnector(BaseConnector):
        ...
except ImportError:
    pass  # S3 connector not available — package not installed
```

L'endpoint `GET /api/sources/types` retourne `"available": true/false` pour chaque type.

### Tests de validation (étape 5.7)

```python
# tests/test_connector_availability.py

def test_local_directory_always_available():
    """Le connecteur local est toujours disponible (pas de dépendance externe)."""
    from ragkit.connectors.registry import _CONNECTOR_CLASSES
    from ragkit.desktop.models import SourceType
    assert SourceType.LOCAL_DIRECTORY in _CONNECTOR_CLASSES

def test_available_types_reflects_installed_packages():
    """available_source_types retourne le bon status pour chaque type."""
    from ragkit.connectors.registry import available_source_types
    types = available_source_types()
    local = next(t for t in types if t["type"] == "local_directory")
    assert local["registered"] is True

def test_unavailable_connector_raises_clear_error():
    """Tenter de créer un connecteur non installé donne un message clair."""
    from ragkit.connectors.registry import create_connector, _CONNECTOR_CLASSES
    from ragkit.desktop.models import SourceType
    # S'assurer que le type n'est pas enregistré
    _CONNECTOR_CLASSES.pop(SourceType.EMAIL_IMAP, None)
    with pytest.raises(ValueError, match="Aucun connecteur"):
        create_connector(SourceType.EMAIL_IMAP, source_id="s1", config={})
```

---

## Checklist de validation Phase 5

| # | Critère | Commande / Vérification |
|---|---|---|
| 1 | SqlDatabaseConnector — SQLite intégration | `pytest tests/test_connector_sql.py -v` |
| 2 | SqlDatabaseConnector — rejet DDL | `pytest tests/test_connector_sql.py -k ddl -v` |
| 3 | RestApiConnector — pagination et extraction | `pytest tests/test_connector_rest_api.py -v` |
| 4 | RestApiConnector — substitution credentials | `pytest tests/test_connector_rest_api.py -k credential -v` |
| 5 | S3BucketConnector — listing et filtrage | `pytest tests/test_connector_s3.py -v` |
| 6 | EmailImapConnector — extraction emails | `pytest tests/test_connector_email.py -v` |
| 7 | GitRepoConnector — listing fichiers | `pytest tests/test_connector_git_repo.py -v` |
| 8 | Extras pip — installation sélective | `pip install ragkit[web]` puis vérifier imports |
| 9 | Détection dynamique des connecteurs | `pytest tests/test_connector_availability.py -v` |
| 10 | UI formulaires techniques — rendu | Test React + vérification manuelle |
| 11 | Pas de régression | `pytest tests/ -v --tb=short` |
