# Phase 1 — Fondations et refactoring multi-sources

> **Prérequis** : Aucun  
> **Durée estimée** : 3-4 jours  
> **Objectif** : Transformer l'architecture mono-source actuelle en architecture multi-sources tout en maintenant la rétrocompatibilité.

---

## Étape 1.1 — Nouveau modèle de données

### Fichier : `ragkit/desktop/models.py`

#### Ajouts

```python
class SourceType(str, Enum):
    LOCAL_DIRECTORY = "local_directory"
    WEB_URL = "web_url"
    RSS_FEED = "rss_feed"
    GOOGLE_DRIVE = "google_drive"
    ONEDRIVE = "onedrive"
    DROPBOX = "dropbox"
    CONFLUENCE = "confluence"
    NOTION = "notion"
    SQL_DATABASE = "sql_database"
    REST_API = "rest_api"
    S3_BUCKET = "s3_bucket"
    EMAIL_IMAP = "email_imap"
    GIT_REPO = "git_repo"

class SyncFrequency(str, Enum):
    MANUAL = "manual"
    EVERY_15_MIN = "15min"
    HOURLY = "1h"
    EVERY_6H = "6h"
    DAILY = "24h"
    WEEKLY = "7d"

class SourceStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"
    SYNCING = "syncing"

class SourceEntry(BaseModel):
    """Configuration d'une source individuelle dans la liste multi-sources."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str                              # Nom affiché
    type: SourceType
    enabled: bool = True
    sync_frequency: SyncFrequency = SyncFrequency.MANUAL
    status: SourceStatus = SourceStatus.ACTIVE
    last_sync_at: str | None = None
    last_sync_status: str | None = None
    last_sync_error: str | None = None
    document_count: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    # Paramètres spécifiques au type de source (contenu variable)
    config: dict[str, Any] = Field(default_factory=dict)
    # Référence au credential dans le keyring (jamais en clair)
    credential_key: str | None = None
```

#### Modifications

```diff
 class IngestionConfig(BaseModel):
-    source: SourceConfig
+    source: SourceConfig                    # Conservé pour rétrocompat
+    sources: list[SourceEntry] = Field(default_factory=list)
     parsing: ParsingConfig = Field(default_factory=ParsingConfig)
     preprocessing: PreprocessingConfig = Field(default_factory=PreprocessingConfig)
```

#### Ajout dans `DocumentInfo`

```diff
 class DocumentInfo(BaseModel):
     # ... champs existants ...
+    source_id: str | None = None        # ID de la SourceEntry d'origine
+    source_type: str | None = None      # Type de source (local_directory, web_url, etc.)
+    source_name: str | None = None      # Nom affiché de la source
+    original_url: str | None = None     # URL d'origine pour sources web/cloud
```

### Tests de validation (étape 1.1)

```python
# tests/test_models_multi_sources.py

def test_source_type_enum_values():
    """Vérifie que tous les types de source sont définis."""
    assert SourceType.LOCAL_DIRECTORY.value == "local_directory"
    assert SourceType.WEB_URL.value == "web_url"
    assert len(SourceType) == 13

def test_source_entry_defaults():
    """Vérifie les valeurs par défaut d'une SourceEntry."""
    entry = SourceEntry(name="Test", type=SourceType.LOCAL_DIRECTORY)
    assert entry.enabled is True
    assert entry.sync_frequency == SyncFrequency.MANUAL
    assert entry.status == SourceStatus.ACTIVE
    assert entry.id  # auto-generated UUID
    assert entry.created_at  # auto-generated timestamp

def test_source_entry_local_config():
    """Vérifie qu'une source local_directory accepte les bons paramètres config."""
    entry = SourceEntry(
        name="Mes docs",
        type=SourceType.LOCAL_DIRECTORY,
        config={
            "path": "C:/Users/test/docs",
            "recursive": True,
            "file_types": ["pdf", "md"],
            "excluded_dirs": [".git"],
            "max_file_size_mb": 50,
        }
    )
    assert entry.config["path"] == "C:/Users/test/docs"

def test_ingestion_config_backward_compat():
    """Vérifie que l'ancien format source unique fonctionne toujours."""
    config = IngestionConfig(source=SourceConfig(path="C:/docs"))
    assert config.source.path == "C:/docs"
    assert config.sources == []

def test_ingestion_config_multi_sources():
    """Vérifie le nouveau format multi-sources."""
    config = IngestionConfig(
        source=SourceConfig(path=""),
        sources=[
            SourceEntry(name="Local", type=SourceType.LOCAL_DIRECTORY,
                       config={"path": "C:/docs"}),
            SourceEntry(name="Blog", type=SourceType.WEB_URL,
                       config={"urls": ["https://example.com"]}),
        ]
    )
    assert len(config.sources) == 2

def test_document_info_source_tracking():
    """Vérifie les nouveaux champs de traçabilité source sur DocumentInfo."""
    doc = DocumentInfo(
        id="abc123", filename="test.pdf", file_path="test.pdf",
        file_type="pdf", file_size_bytes=1024, last_modified="2026-01-01T00:00:00Z",
        source_id="src-1", source_type="local_directory", source_name="Mes docs"
    )
    assert doc.source_id == "src-1"
    assert doc.source_type == "local_directory"
```

---

## Étape 1.2 — Interface abstraite `BaseConnector`

### Nouveau dossier : `ragkit/connectors/`

#### `ragkit/connectors/__init__.py`
Fichier d'initialisation vide.

#### `ragkit/connectors/base.py`

```python
"""Interface abstraite pour tous les connecteurs de source."""

from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

@dataclass
class ConnectorDocument:
    """Document unifié produit par tout connecteur."""
    id: str                        # Identifiant unique du document
    source_id: str                 # ID de la SourceEntry parente
    title: str
    content: str                   # Texte extrait (prêt pour chunking)
    content_type: str = "text"     # "text", "html", "markdown"
    url: str | None = None
    file_path: str | None = None
    file_type: str | None = None
    file_size_bytes: int = 0
    last_modified: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    content_hash: str = ""         # SHA-256 du contenu

@dataclass
class ConnectorValidationResult:
    valid: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

@dataclass
class ConnectorChangeDetection:
    added: list[ConnectorDocument] = field(default_factory=list)
    modified: list[ConnectorDocument] = field(default_factory=list)
    removed_ids: list[str] = field(default_factory=list)

class BaseConnector(ABC):
    """Interface commune que chaque connecteur de source doit implémenter."""

    def __init__(self, source_id: str, config: dict[str, Any],
                 credential: dict[str, Any] | None = None):
        self.source_id = source_id
        self.config = config
        self.credential = credential

    @abstractmethod
    async def validate_config(self) -> ConnectorValidationResult:
        """Vérifie la validité de la configuration."""
        ...

    @abstractmethod
    async def test_connection(self) -> ConnectorValidationResult:
        """Teste la connexion à la source."""
        ...

    @abstractmethod
    async def list_documents(self) -> list[ConnectorDocument]:
        """Liste tous les documents disponibles."""
        ...

    @abstractmethod
    async def fetch_document_content(self, doc_id: str) -> str:
        """Récupère le contenu textuel d'un document spécifique."""
        ...

    @abstractmethod
    async def detect_changes(
        self, known_hashes: dict[str, str]
    ) -> ConnectorChangeDetection:
        """Compare l'état actuel avec les hashes connus pour détecter les changements."""
        ...

    def supported_file_types(self) -> list[str]:
        """Types de fichiers supportés par ce connecteur (override optionnel)."""
        return []
```

#### `ragkit/connectors/registry.py`

```python
"""Registre des connecteurs disponibles (factory pattern)."""

from __future__ import annotations
from typing import Any
from ragkit.connectors.base import BaseConnector
from ragkit.desktop.models import SourceType

_CONNECTOR_CLASSES: dict[SourceType, type[BaseConnector]] = {}

def register_connector(source_type: SourceType):
    """Décorateur pour enregistrer un connecteur dans le registre."""
    def decorator(cls: type[BaseConnector]):
        _CONNECTOR_CLASSES[source_type] = cls
        return cls
    return decorator

def create_connector(
    source_type: SourceType,
    source_id: str,
    config: dict[str, Any],
    credential: dict[str, Any] | None = None,
) -> BaseConnector:
    """Instancie le connecteur adapté au type de source."""
    cls = _CONNECTOR_CLASSES.get(source_type)
    if cls is None:
        available = ", ".join(t.value for t in _CONNECTOR_CLASSES)
        raise ValueError(
            f"Aucun connecteur enregistré pour le type '{source_type.value}'. "
            f"Types disponibles : {available}"
        )
    return cls(source_id=source_id, config=config, credential=credential)

def available_source_types() -> list[dict[str, str]]:
    """Retourne les types de source disponibles avec métadonnées."""
    return [
        {"type": st.value, "registered": st in _CONNECTOR_CLASSES}
        for st in SourceType
    ]
```

### Tests de validation (étape 1.2)

```python
# tests/test_connectors_base.py

import pytest
from ragkit.connectors.base import (
    BaseConnector, ConnectorDocument, ConnectorValidationResult,
    ConnectorChangeDetection,
)
from ragkit.connectors.registry import (
    register_connector, create_connector, available_source_types, _CONNECTOR_CLASSES,
)
from ragkit.desktop.models import SourceType

class DummyConnector(BaseConnector):
    async def validate_config(self):
        return ConnectorValidationResult(valid=True)
    async def test_connection(self):
        return ConnectorValidationResult(valid=True)
    async def list_documents(self):
        return []
    async def fetch_document_content(self, doc_id):
        return ""
    async def detect_changes(self, known_hashes):
        return ConnectorChangeDetection()

def test_connector_document_creation():
    doc = ConnectorDocument(
        id="doc-1", source_id="src-1", title="Test",
        content="Hello world", file_type="txt",
        file_size_bytes=11, last_modified="2026-01-01T00:00:00Z"
    )
    assert doc.id == "doc-1"
    assert doc.content_type == "text"  # default

def test_base_connector_is_abstract():
    with pytest.raises(TypeError):
        BaseConnector(source_id="x", config={})

def test_dummy_connector_instantiation():
    conn = DummyConnector(source_id="s1", config={"path": "/tmp"})
    assert conn.source_id == "s1"

@pytest.mark.asyncio
async def test_dummy_connector_validate():
    conn = DummyConnector(source_id="s1", config={})
    result = await conn.validate_config()
    assert result.valid is True

def test_register_and_create_connector():
    # Cleanup
    _CONNECTOR_CLASSES.pop(SourceType.LOCAL_DIRECTORY, None)

    @register_connector(SourceType.LOCAL_DIRECTORY)
    class TestLocal(DummyConnector):
        pass

    connector = create_connector(
        SourceType.LOCAL_DIRECTORY, source_id="s1", config={"path": "/tmp"}
    )
    assert isinstance(connector, TestLocal)

    # Cleanup
    _CONNECTOR_CLASSES.pop(SourceType.LOCAL_DIRECTORY, None)

def test_create_connector_unknown_type():
    with pytest.raises(ValueError, match="Aucun connecteur"):
        create_connector(SourceType.NOTION, source_id="s1", config={})

def test_available_source_types():
    types = available_source_types()
    assert len(types) == len(SourceType)
    assert all("type" in t and "registered" in t for t in types)
```

---

## Étape 1.3 — `LocalDirectoryConnector` (migration de l'existant)

### Fichier : `ragkit/connectors/local_directory.py`

Refactoring de la logique existante de `ragkit/desktop/documents.py` dans le format connecteur.

```python
"""Connecteur pour les répertoires locaux — migration de l'existant."""

from __future__ import annotations
import hashlib
from pathlib import Path
from datetime import datetime, timezone

from ragkit.connectors.base import (
    BaseConnector, ConnectorDocument, ConnectorValidationResult,
    ConnectorChangeDetection,
)
from ragkit.connectors.registry import register_connector
from ragkit.desktop.models import SourceType
from ragkit.desktop import documents  # Réutilise les fonctions existantes

@register_connector(SourceType.LOCAL_DIRECTORY)
class LocalDirectoryConnector(BaseConnector):

    @property
    def _root(self) -> Path:
        return Path(self.config.get("path", "")).expanduser()

    @property
    def _recursive(self) -> bool:
        return bool(self.config.get("recursive", True))

    @property
    def _file_types(self) -> list[str]:
        return self.config.get("file_types", ["pdf", "docx", "md", "txt"])

    @property
    def _excluded_dirs(self) -> list[str]:
        return self.config.get("excluded_dirs", [])

    @property
    def _max_file_size_mb(self) -> int:
        return int(self.config.get("max_file_size_mb", 50))

    async def validate_config(self) -> ConnectorValidationResult:
        errors = []
        if not self.config.get("path"):
            errors.append("Le chemin source est requis.")
        elif not self._root.exists():
            errors.append(f"Le répertoire '{self._root}' n'existe pas.")
        elif not self._root.is_dir():
            errors.append(f"'{self._root}' n'est pas un répertoire.")
        if not self._file_types:
            errors.append("Au moins un type de fichier doit être sélectionné.")
        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors)

    async def test_connection(self) -> ConnectorValidationResult:
        return await self.validate_config()

    async def list_documents(self) -> list[ConnectorDocument]:
        if not self._root.exists():
            return []
        selected = set(self._file_types)
        result = []
        for file_path in documents._iter_files(
            self._root,
            recursive=self._recursive,
            excluded_dirs=self._excluded_dirs,
            exclusion_patterns=self.config.get("exclusion_patterns", []),
            max_file_size_mb=self._max_file_size_mb,
        ):
            ext = documents._normalize_extension(file_path.suffix)
            if ext not in selected:
                continue
            rel = file_path.relative_to(self._root).as_posix()
            stat = file_path.stat()
            content_hash = hashlib.sha256(file_path.read_bytes()).hexdigest()
            result.append(ConnectorDocument(
                id=hashlib.sha256(f"{self.source_id}:{rel}".encode()).hexdigest(),
                source_id=self.source_id,
                title=file_path.stem,
                content="",  # Le contenu sera chargé au moment du fetch
                file_path=rel,
                file_type=ext,
                file_size_bytes=stat.st_size,
                last_modified=datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ).isoformat(),
                content_hash=content_hash,
            ))
        return result

    async def fetch_document_content(self, doc_id: str) -> str:
        # Recherche le fichier par ID dans la liste
        for doc in await self.list_documents():
            if doc.id == doc_id and doc.file_path:
                file_path = self._root / doc.file_path
                parsed = documents._extract_content(file_path)
                return parsed.text
        raise FileNotFoundError(f"Document {doc_id} not found")

    async def detect_changes(
        self, known_hashes: dict[str, str]
    ) -> ConnectorChangeDetection:
        current_docs = await self.list_documents()
        current_by_id = {d.id: d for d in current_docs}
        added = [d for d in current_docs if d.id not in known_hashes]
        modified = [
            d for d in current_docs
            if d.id in known_hashes and d.content_hash != known_hashes[d.id]
        ]
        removed_ids = [did for did in known_hashes if did not in current_by_id]
        return ConnectorChangeDetection(
            added=added, modified=modified, removed_ids=removed_ids
        )

    def supported_file_types(self) -> list[str]:
        return list(documents.SUPPORTED_FILE_TYPES)
```

### Tests de validation (étape 1.3)

```python
# tests/test_connector_local_directory.py

import pytest
import tempfile
from pathlib import Path
from ragkit.connectors.local_directory import LocalDirectoryConnector

@pytest.fixture
def tmp_source(tmp_path):
    """Crée un répertoire temporaire avec des fichiers de test."""
    (tmp_path / "doc1.txt").write_text("Hello world", encoding="utf-8")
    (tmp_path / "doc2.md").write_text("# Title\nContent", encoding="utf-8")
    (tmp_path / "image.png").write_bytes(b"\x89PNG")
    sub = tmp_path / "sub"
    sub.mkdir()
    (sub / "doc3.txt").write_text("Sub content", encoding="utf-8")
    return tmp_path

@pytest.mark.asyncio
async def test_validate_config_valid(tmp_source):
    conn = LocalDirectoryConnector(
        source_id="s1",
        config={"path": str(tmp_source), "file_types": ["txt", "md"]}
    )
    result = await conn.validate_config()
    assert result.valid is True

@pytest.mark.asyncio
async def test_validate_config_missing_path():
    conn = LocalDirectoryConnector(source_id="s1", config={})
    result = await conn.validate_config()
    assert result.valid is False
    assert any("chemin" in e.lower() for e in result.errors)

@pytest.mark.asyncio
async def test_validate_config_nonexistent_path():
    conn = LocalDirectoryConnector(
        source_id="s1",
        config={"path": "/nonexistent/path/12345", "file_types": ["txt"]}
    )
    result = await conn.validate_config()
    assert result.valid is False

@pytest.mark.asyncio
async def test_list_documents_filters_by_type(tmp_source):
    conn = LocalDirectoryConnector(
        source_id="s1",
        config={"path": str(tmp_source), "file_types": ["txt"], "recursive": True}
    )
    docs = await conn.list_documents()
    assert len(docs) == 2  # doc1.txt + sub/doc3.txt
    assert all(d.file_type == "txt" for d in docs)

@pytest.mark.asyncio
async def test_list_documents_non_recursive(tmp_source):
    conn = LocalDirectoryConnector(
        source_id="s1",
        config={"path": str(tmp_source), "file_types": ["txt"], "recursive": False}
    )
    docs = await conn.list_documents()
    assert len(docs) == 1  # Only doc1.txt (sub/doc3.txt excluded)

@pytest.mark.asyncio
async def test_fetch_document_content(tmp_source):
    conn = LocalDirectoryConnector(
        source_id="s1",
        config={"path": str(tmp_source), "file_types": ["txt"], "recursive": False}
    )
    docs = await conn.list_documents()
    content = await conn.fetch_document_content(docs[0].id)
    assert "Hello world" in content

@pytest.mark.asyncio
async def test_detect_changes_new_files(tmp_source):
    conn = LocalDirectoryConnector(
        source_id="s1",
        config={"path": str(tmp_source), "file_types": ["txt"], "recursive": True}
    )
    changes = await conn.detect_changes(known_hashes={})
    assert len(changes.added) == 2
    assert len(changes.modified) == 0
    assert len(changes.removed_ids) == 0

@pytest.mark.asyncio
async def test_detect_changes_modified_file(tmp_source):
    conn = LocalDirectoryConnector(
        source_id="s1",
        config={"path": str(tmp_source), "file_types": ["txt"], "recursive": True}
    )
    docs = await conn.list_documents()
    hashes = {d.id: d.content_hash for d in docs}
    # Modifier un fichier
    (tmp_source / "doc1.txt").write_text("Modified content", encoding="utf-8")
    changes = await conn.detect_changes(known_hashes=hashes)
    assert len(changes.modified) == 1
    assert len(changes.added) == 0

@pytest.mark.asyncio
async def test_detect_changes_removed_file(tmp_source):
    conn = LocalDirectoryConnector(
        source_id="s1",
        config={"path": str(tmp_source), "file_types": ["txt"], "recursive": True}
    )
    docs = await conn.list_documents()
    hashes = {d.id: d.content_hash for d in docs}
    # Supprimer un fichier
    (tmp_source / "doc1.txt").unlink()
    changes = await conn.detect_changes(known_hashes=hashes)
    assert len(changes.removed_ids) == 1
```

---

## Étape 1.4 — Nouvelles routes API sources

### Fichier : `ragkit/desktop/api/sources.py` (nouveau)

```python
"""API REST pour la gestion des sources multi-types."""

router = APIRouter(prefix="/api/sources", tags=["sources"])

# GET  /api/sources              → liste toutes les sources
# POST /api/sources              → ajoute une source
# GET  /api/sources/{id}         → détails d'une source
# PUT  /api/sources/{id}         → met à jour une source
# DELETE /api/sources/{id}       → supprime une source
# POST /api/sources/{id}/test    → teste la connexion
# POST /api/sources/{id}/sync    → déclenche une sync
# GET  /api/sources/{id}/history → historique de sync
# POST /api/sources/{id}/pause   → met en pause
# POST /api/sources/{id}/resume  → reprend la sync
# GET  /api/sources/types        → types disponibles
```

#### Endpoints détaillés

| Endpoint | Méthode | Corps | Réponse |
|---|---|---|---|
| `/api/sources` | GET | — | `list[SourceEntry]` |
| `/api/sources` | POST | `SourceEntry` (sans `id`, `created_at`) | `SourceEntry` (complet) |
| `/api/sources/{id}` | GET | — | `SourceEntry` |
| `/api/sources/{id}` | PUT | `SourceEntryPatch` | `SourceEntry` |
| `/api/sources/{id}` | DELETE | — | `{"success": true}` |
| `/api/sources/{id}/test` | POST | — | `ConnectorValidationResult` |
| `/api/sources/{id}/sync` | POST | `{"incremental": bool}` | `{"status": "started"}` |
| `/api/sources/types` | GET | — | `list[SourceTypeInfo]` |

### Tests de validation (étape 1.4)

```python
# tests/test_api_sources.py

import pytest
from httpx import AsyncClient, ASGITransport to
from ragkit.desktop.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

@pytest.mark.asyncio
async def test_list_sources_empty(client):
    resp = await client.get("/api/sources")
    assert resp.status_code == 200
    assert resp.json() == []

@pytest.mark.asyncio
async def test_add_source(client, tmp_path):
    payload = {
        "name": "Mes documents",
        "type": "local_directory",
        "config": {"path": str(tmp_path), "file_types": ["txt"]},
        "sync_frequency": "manual",
    }
    resp = await client.post("/api/sources", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Mes documents"
    assert data["type"] == "local_directory"
    assert "id" in data
    assert data["status"] == "active"

@pytest.mark.asyncio
async def test_get_source_by_id(client, tmp_path):
    # Ajouter d'abord
    resp = await client.post("/api/sources", json={
        "name": "Test", "type": "local_directory",
        "config": {"path": str(tmp_path), "file_types": ["txt"]}
    })
    source_id = resp.json()["id"]
    # Récupérer
    resp = await client.get(f"/api/sources/{source_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == source_id

@pytest.mark.asyncio
async def test_delete_source(client, tmp_path):
    resp = await client.post("/api/sources", json={
        "name": "ToDelete", "type": "local_directory",
        "config": {"path": str(tmp_path), "file_types": ["txt"]}
    })
    source_id = resp.json()["id"]
    resp = await client.delete(f"/api/sources/{source_id}")
    assert resp.status_code == 200
    # Vérifier suppression
    resp = await client.get(f"/api/sources/{source_id}")
    assert resp.status_code == 404

@pytest.mark.asyncio
async def test_test_connection(client, tmp_path):
    resp = await client.post("/api/sources", json={
        "name": "Test", "type": "local_directory",
        "config": {"path": str(tmp_path), "file_types": ["txt"]}
    })
    source_id = resp.json()["id"]
    resp = await client.post(f"/api/sources/{source_id}/test")
    assert resp.status_code == 200
    assert resp.json()["valid"] is True

@pytest.mark.asyncio
async def test_list_source_types(client):
    resp = await client.get("/api/sources/types")
    assert resp.status_code == 200
    types = resp.json()
    assert len(types) >= 1
    assert any(t["type"] == "local_directory" for t in types)

@pytest.mark.asyncio
async def test_get_nonexistent_source(client):
    resp = await client.get("/api/sources/nonexistent-id")
    assert resp.status_code == 404
```

---

## Étape 1.5 — Migration de la configuration existante

### Fichier : `ragkit/desktop/migration.py` (nouveau)

Logique de migration automatique de l'ancien format (source unique `path`) vers le nouveau format multi-sources.

```python
def migrate_settings_to_multi_sources(settings: SettingsPayload) -> SettingsPayload:
    """Migre automatiquement l'ancien format source unique vers multi-sources.
    
    Si settings.ingestion.source.path est renseigné ET settings.ingestion.sources
    est vide, crée une SourceEntry de type local_directory à partir de l'ancien format.
    """
    ...
```

### Tests de validation (étape 1.5)

```python
# tests/test_migration.py

def test_migrate_old_format_to_multi_sources():
    """Un ancien settings avec source.path est converti en source local_directory."""
    settings = SettingsPayload(
        ingestion=IngestionConfig(
            source=SourceConfig(
                path="C:/docs", recursive=True,
                file_types=["pdf", "md"], excluded_dirs=[".git"],
                max_file_size_mb=100,
            )
        )
    )
    migrated = migrate_settings_to_multi_sources(settings)
    assert len(migrated.ingestion.sources) == 1
    src = migrated.ingestion.sources[0]
    assert src.type == SourceType.LOCAL_DIRECTORY
    assert src.config["path"] == "C:/docs"
    assert src.config["recursive"] is True
    assert src.config["file_types"] == ["pdf", "md"]
    assert src.name  # nom auto-généré

def test_migrate_already_multi_sources():
    """Un settings déjà en multi-sources n'est pas modifié."""
    settings = SettingsPayload(
        ingestion=IngestionConfig(
            source=SourceConfig(path=""),
            sources=[SourceEntry(name="Existing", type=SourceType.LOCAL_DIRECTORY,
                                config={"path": "C:/docs"})]
        )
    )
    migrated = migrate_settings_to_multi_sources(settings)
    assert len(migrated.ingestion.sources) == 1
    assert migrated.ingestion.sources[0].name == "Existing"

def test_migrate_no_ingestion():
    """Un settings sans ingestion ne crée pas de sources."""
    settings = SettingsPayload()
    migrated = migrate_settings_to_multi_sources(settings)
    assert migrated.ingestion is None or len(migrated.ingestion.sources) == 0

def test_migrate_empty_path():
    """Un source.path vide ne génère pas de source."""
    settings = SettingsPayload(
        ingestion=IngestionConfig(source=SourceConfig(path=""))
    )
    migrated = migrate_settings_to_multi_sources(settings)
    assert len(migrated.ingestion.sources) == 0
```

---

## Étape 1.6 — Adaptation du `IngestionRuntime`

### Fichier : `ragkit/desktop/ingestion_runtime.py`

Modifier la méthode `_run()` pour itérer sur `sources` au lieu de lire `source.path` directement.

#### Changements principaux

1. Au démarrage de `_run()`, résoudre la liste des sources actives
2. Pour chaque source, instancier le connecteur via `create_connector()`
3. Appeler `connector.detect_changes()` au lieu de scanner le filesystem directement
4. Appeler `connector.fetch_document_content()` pour charger le texte
5. Associer `source_id`, `source_type`, `source_name` à chaque `DocumentInfo` / point vectoriel

#### Rétrocompatibilité

Si `sources` est vide mais `source.path` est renseigné, utiliser l'ancien comportement directement (fallback).

### Tests de validation (étape 1.6)

```python
# tests/test_ingestion_runtime_multi_sources.py

@pytest.mark.asyncio
async def test_ingestion_with_single_local_source(tmp_path):
    """L'ingestion fonctionne avec une seule source locale via le nouveau format."""
    (tmp_path / "test.txt").write_text("Test content")
    settings = build_settings_with_sources([
        SourceEntry(name="Local", type=SourceType.LOCAL_DIRECTORY,
                   config={"path": str(tmp_path), "file_types": ["txt"]})
    ])
    # ... lancer l'ingestion et vérifier les résultats

@pytest.mark.asyncio
async def test_ingestion_with_multiple_sources(tmp_path):
    """L'ingestion fonctionne avec plusieurs sources locales."""
    dir1 = tmp_path / "dir1"; dir1.mkdir()
    dir2 = tmp_path / "dir2"; dir2.mkdir()
    (dir1 / "a.txt").write_text("Content A")
    (dir2 / "b.txt").write_text("Content B")
    settings = build_settings_with_sources([
        SourceEntry(name="Dir1", type=SourceType.LOCAL_DIRECTORY,
                   config={"path": str(dir1), "file_types": ["txt"]}),
        SourceEntry(name="Dir2", type=SourceType.LOCAL_DIRECTORY,
                   config={"path": str(dir2), "file_types": ["txt"]}),
    ])
    # ... vérifier que les 2 documents sont ingérés

@pytest.mark.asyncio
async def test_ingestion_backward_compat_old_format(tmp_path):
    """L'ancien format source.path fonctionne toujours."""
    (tmp_path / "old.txt").write_text("Old format content")
    settings = SettingsPayload(
        ingestion=IngestionConfig(
            source=SourceConfig(path=str(tmp_path), file_types=["txt"])
        )
    )
    # ... vérifier que l'ingestion fonctionne identiquement

@pytest.mark.asyncio
async def test_ingestion_skips_disabled_sources(tmp_path):
    """Les sources avec enabled=False sont ignorées."""
    (tmp_path / "test.txt").write_text("Content")
    settings = build_settings_with_sources([
        SourceEntry(name="Disabled", type=SourceType.LOCAL_DIRECTORY,
                   enabled=False,
                   config={"path": str(tmp_path), "file_types": ["txt"]})
    ])
    # ... vérifier que 0 documents sont ingérés

@pytest.mark.asyncio
async def test_ingestion_records_source_metadata(tmp_path):
    """Les documents ingérés portent les métadonnées de leur source."""
    (tmp_path / "test.txt").write_text("Content")
    settings = build_settings_with_sources([
        SourceEntry(id="src-123", name="Ma source", type=SourceType.LOCAL_DIRECTORY,
                   config={"path": str(tmp_path), "file_types": ["txt"]})
    ])
    # ... vérifier que les points vectoriels ont source_id="src-123"
```

---

## Étape 1.7 — Nouveau composant UI `SourceManager`

### Fichiers frontend

| Fichier | Description |
|---|---|
| `desktop/src/components/settings/SourceManager.tsx` | Vue liste des sources + actions |
| `desktop/src/components/settings/SourceAddDialog.tsx` | Dialog d'ajout (choix type + formulaire) |
| `desktop/src/components/settings/SourceCard.tsx` | Carte individuelle d'une source |
| `desktop/src/components/settings/source-forms/LocalDirectoryForm.tsx` | Formulaire local (migration de SourceSettings.tsx) |
| `desktop/src/hooks/useSources.ts` | Hook pour CRUD API sources |

### Tests de validation (étape 1.7)

Tests manuels via le navigateur + tests unitaires React :

```typescript
// desktop/src/components/settings/__tests__/SourceManager.test.tsx

describe("SourceManager", () => {
  it("renders empty state when no sources configured", () => { ... });
  it("renders source cards for each configured source", () => { ... });
  it("opens add dialog when clicking 'Ajouter une source'", () => { ... });
  it("shows source type selection grid in add dialog", () => { ... });
  it("displays status badge on each source card", () => { ... });
  it("allows deleting a source with confirmation", () => { ... });
});

// desktop/src/hooks/__tests__/useSources.test.ts

describe("useSources", () => {
  it("fetches sources list from API", () => { ... });
  it("adds a new source via POST", () => { ... });
  it("deletes a source via DELETE", () => { ... });
  it("triggers sync via POST /sync", () => { ... });
  it("tests connection via POST /test", () => { ... });
});
```

---

## Checklist de validation Phase 1

| # | Critère | Commande / Vérification |
|---|---|---|
| 1 | Les tests unitaires modèles passent | `pytest tests/test_models_multi_sources.py -v` |
| 2 | L'interface BaseConnector est complète | `pytest tests/test_connectors_base.py -v` |
| 3 | Le LocalDirectoryConnector fonctionne | `pytest tests/test_connector_local_directory.py -v` |
| 4 | Les routes API sources répondent | `pytest tests/test_api_sources.py -v` |
| 5 | La migration auto fonctionne | `pytest tests/test_migration.py -v` |
| 6 | L'ingestion avec multi-sources fonctionne | `pytest tests/test_ingestion_runtime_multi_sources.py -v` |
| 7 | L'UI affiche la liste des sources | Vérification manuelle dans l'app |
| 8 | L'ancien format source.path fonctionne | Test de régression avec config existante |
| 9 | Aucune régression sur l'ingestion existante | `pytest tests/ -v --tb=short` (suite complète) |
