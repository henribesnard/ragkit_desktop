# Phase 3 — Cloud storage (Google Drive, OneDrive, Dropbox)

> **Prérequis** : Phase 1 terminée (Phase 2 recommandée)  
> **Durée estimée** : 4-5 jours  
> **Objectif** : Permettre l'indexation de fichiers depuis les principaux services de stockage cloud via OAuth2.

---

## Étape 3.1 — `CredentialManager` (gestion sécurisée des tokens)

### Fichier : `ragkit/connectors/credentials.py`

Ce module gère le stockage et le renouvellement sécurisé des credentials OAuth2 et API keys.

#### Interface

```python
class CredentialManager:
    """Stockage sécurisé des credentials dans le keyring système."""

    KEYRING_SERVICE = "loko-rag"

    def store(self, key: str, data: dict) -> None:
        """Stocke un credential (chiffré via keyring)."""
        import keyring, json
        keyring.set_password(self.KEYRING_SERVICE, key, json.dumps(data))

    def retrieve(self, key: str) -> dict | None:
        """Récupère un credential depuis le keyring."""
        import keyring, json
        raw = keyring.get_password(self.KEYRING_SERVICE, key)
        return json.loads(raw) if raw else None

    def delete(self, key: str) -> None:
        """Supprime un credential."""
        import keyring
        keyring.delete_password(self.KEYRING_SERVICE, key)

    def refresh_oauth2_token(self, key: str, refresh_url: str,
                              client_id: str, client_secret: str) -> dict:
        """Renouvelle un token OAuth2 expiré et le stocke."""
        ...
```

#### Flux OAuth2 via Tauri

1. Le frontend ouvre une fenêtre Tauri `WebviewWindow` pointant vers l'URL d'autorisation OAuth2
2. L'utilisateur s'authentifie et autorise l'application
3. Le callback redirige vers `http://localhost:{port}/oauth/callback`
4. Le backend récupère le code d'autorisation, échange contre un token
5. Le token (access + refresh) est stocké dans le keyring via `CredentialManager`

### Tests de validation (étape 3.1)

```python
# tests/test_credential_manager.py

import pytest
from unittest.mock import patch, MagicMock
from ragkit.connectors.credentials import CredentialManager

@pytest.fixture
def cred_manager():
    return CredentialManager()

def test_store_and_retrieve(cred_manager):
    with patch("keyring.set_password") as mock_set, \
         patch("keyring.get_password", return_value='{"token": "abc123"}'):
        cred_manager.store("test-key", {"token": "abc123"})
        mock_set.assert_called_once()
        result = cred_manager.retrieve("test-key")
        assert result == {"token": "abc123"}

def test_retrieve_nonexistent(cred_manager):
    with patch("keyring.get_password", return_value=None):
        result = cred_manager.retrieve("nonexistent")
        assert result is None

def test_delete(cred_manager):
    with patch("keyring.delete_password") as mock_del:
        cred_manager.delete("test-key")
        mock_del.assert_called_once_with("loko-rag", "test-key")

def test_refresh_oauth2_token(cred_manager):
    """Vérifie le renouvellement d'un token OAuth2 expiré."""
    with patch("httpx.post") as mock_post:
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"access_token": "new-token", "refresh_token": "new-refresh",
                         "expires_in": 3600}
        )
        with patch.object(cred_manager, "store") as mock_store:
            result = cred_manager.refresh_oauth2_token(
                "gd-token", "https://oauth2.googleapis.com/token",
                "client-id", "client-secret"
            )
        assert result["access_token"] == "new-token"
        mock_store.assert_called_once()
```

---

## Étape 3.2 — `GoogleDriveConnector`

### Dépendances Python

```
google-api-python-client>=2.100
google-auth-oauthlib>=1.2
google-auth-httplib2>=0.2
```

> Extra pip : `pip install ragkit[google]`

### Fichier : `ragkit/connectors/google_drive.py`

#### Paramètres `config` attendus

```python
{
    "folder_ids": ["1ABC...", "1DEF..."],      # IDs des dossiers Drive
    "include_shared": False,                    # Fichiers partagés
    "file_types": ["application/pdf",           # Types MIME Google
                   "application/vnd.google-apps.document",
                   "application/vnd.google-apps.spreadsheet"],
    "recursive": True,
    "max_file_size_mb": 50,
}
```

#### Logique principale

1. **Authentification** : token OAuth2 depuis `CredentialManager`
2. **Listing** : `files().list()` avec query `parents in '...'`
3. **Export** :
   - Google Docs → `export_media(mimeType='text/plain')`
   - Google Sheets → `export_media(mimeType='text/csv')`
   - Google Slides → `export_media(mimeType='text/plain')`
   - PDF/DOCX → `get_media()` + parseur existant
4. **Détection de changement** : `modifiedTime` de l'API + `changes.list()` si startPageToken est stocké
5. **Pagination** : `pageToken` dans `files().list()`

#### Gestion spécifique

- Auto-refresh du token si expiré (code 401)
- Respect des quotas Google API (100 queries/100s par défaut)
- Retry sur erreurs 429 avec backoff exponentiel
- Gestion des fichiers Google natifs (Docs, Sheets) vs fichiers uploadés

### Tests de validation (étape 3.2)

```python
# tests/test_connector_google_drive.py

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from ragkit.connectors.google_drive import GoogleDriveConnector

@pytest.fixture
def mock_credential():
    return {"access_token": "ya29.test", "refresh_token": "refresh_test",
            "client_id": "test-id", "client_secret": "test-secret"}

@pytest.mark.asyncio
async def test_validate_config_valid(mock_credential):
    conn = GoogleDriveConnector(
        source_id="s1",
        config={"folder_ids": ["folder123"]},
        credential=mock_credential
    )
    with patch.object(conn, "_build_service", return_value=MagicMock()):
        result = await conn.validate_config()
    assert result.valid is True

@pytest.mark.asyncio
async def test_validate_config_no_folders():
    conn = GoogleDriveConnector(
        source_id="s1", config={"folder_ids": []}, credential={}
    )
    result = await conn.validate_config()
    assert result.valid is False

@pytest.mark.asyncio
async def test_validate_config_no_credentials():
    conn = GoogleDriveConnector(
        source_id="s1", config={"folder_ids": ["f1"]}, credential=None
    )
    result = await conn.validate_config()
    assert result.valid is False
    assert any("authentification" in e.lower() or "credential" in e.lower()
               for e in result.errors)

@pytest.mark.asyncio
async def test_list_documents_from_folder(mock_credential):
    conn = GoogleDriveConnector(
        source_id="s1",
        config={"folder_ids": ["folder123"], "recursive": False},
        credential=mock_credential
    )
    mock_files = [
        {"id": "file1", "name": "doc.pdf", "mimeType": "application/pdf",
         "size": "1024", "modifiedTime": "2026-01-01T00:00:00Z"},
        {"id": "file2", "name": "notes", "mimeType": "application/vnd.google-apps.document",
         "modifiedTime": "2026-01-02T00:00:00Z"},
    ]
    with patch.object(conn, "_list_files_in_folder", return_value=mock_files):
        docs = await conn.list_documents()
    assert len(docs) == 2

@pytest.mark.asyncio
async def test_export_google_doc(mock_credential):
    conn = GoogleDriveConnector(
        source_id="s1",
        config={"folder_ids": ["f1"]},
        credential=mock_credential
    )
    with patch.object(conn, "_export_google_doc", return_value="Document content here"):
        content = await conn.fetch_document_content("file2")
    assert "Document content" in content

@pytest.mark.asyncio
async def test_detect_changes_modified_file(mock_credential):
    conn = GoogleDriveConnector(
        source_id="s1",
        config={"folder_ids": ["f1"]},
        credential=mock_credential
    )
    known = {"file1": "old-hash"}
    with patch.object(conn, "list_documents") as mock_list:
        mock_list.return_value = [
            MagicMock(id="file1", content_hash="new-hash"),
            MagicMock(id="file3", content_hash="hash3"),
        ]
        changes = await conn.detect_changes(known)
    assert len(changes.modified) == 1
    assert len(changes.added) == 1
    assert "file1" not in [d.id for d in changes.added]

@pytest.mark.asyncio
async def test_handles_token_refresh(mock_credential):
    """Quand le token est expiré (401), le connecteur le renouvelle."""
    conn = GoogleDriveConnector(
        source_id="s1",
        config={"folder_ids": ["f1"]},
        credential=mock_credential
    )
    # Simuler un 401 puis un succès
    with patch.object(conn, "_build_service") as mock_svc:
        mock_svc.side_effect = [
            Exception("HttpError 401"),  # Premier appel: expiré
            MagicMock(),                 # Après refresh: OK
        ]
        with patch.object(conn, "_refresh_token"):
            result = await conn.test_connection()
    # Doit avoir tenté un refresh

@pytest.mark.asyncio
async def test_respects_max_file_size(mock_credential):
    conn = GoogleDriveConnector(
        source_id="s1",
        config={"folder_ids": ["f1"], "max_file_size_mb": 1},
        credential=mock_credential
    )
    mock_files = [
        {"id": "f1", "name": "small.pdf", "mimeType": "application/pdf",
         "size": "500000", "modifiedTime": "2026-01-01T00:00:00Z"},
        {"id": "f2", "name": "huge.pdf", "mimeType": "application/pdf",
         "size": "50000000", "modifiedTime": "2026-01-01T00:00:00Z"},
    ]
    with patch.object(conn, "_list_files_in_folder", return_value=mock_files):
        docs = await conn.list_documents()
    assert len(docs) == 1  # huge.pdf filtré
```

---

## Étape 3.3 — `OneDriveConnector`

### Dépendances Python

```
msal>=1.28
httpx>=0.27  # déjà installé pour web
```

> Extra pip : `pip install ragkit[microsoft]`

### Fichier : `ragkit/connectors/onedrive.py`

#### Paramètres `config` attendus

```python
{
    "drive_id": None,                  # None = OneDrive personnel
    "folder_paths": ["/Documents/Projet", "/Shared"],
    "site_id": None,                   # Pour SharePoint
    "file_types": ["pdf", "docx", "xlsx", "pptx", "txt", "md"],
    "recursive": True,
    "max_file_size_mb": 50,
}
```

#### Logique principale

1. **Authentification** : MSAL (Microsoft Authentication Library) + token dans keyring
2. **API Microsoft Graph** :
   - Listing : `GET /me/drive/root:/{path}:/children`
   - Contenu : `GET /me/drive/items/{id}/content`
   - Delta : `GET /me/drive/root/delta` pour détection incrémentale
3. **Export Office** :
   - `.docx` → parseur existant
   - `.xlsx` → conversion CSV simple
   - `.pptx` → extraction texte des slides
4. **Détection de changement** : Delta API Microsoft Graph (très efficace)

### Tests de validation (étape 3.3)

```python
# tests/test_connector_onedrive.py

@pytest.mark.asyncio
async def test_validate_config_valid():
    conn = OneDriveConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"]},
        credential={"access_token": "test", "refresh_token": "test"}
    )
    result = await conn.validate_config()
    assert result.valid is True

@pytest.mark.asyncio
async def test_validate_config_no_credentials():
    conn = OneDriveConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"]},
        credential=None
    )
    result = await conn.validate_config()
    assert result.valid is False

@pytest.mark.asyncio
async def test_list_documents():
    """Mock Microsoft Graph API pour tester le listing."""
    conn = OneDriveConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"], "file_types": ["pdf"]},
        credential={"access_token": "test"}
    )
    mock_response = {
        "value": [
            {"id": "item1", "name": "report.pdf", "size": 1024,
             "lastModifiedDateTime": "2026-01-01T00:00:00Z",
             "file": {"mimeType": "application/pdf"}},
        ]
    }
    with patch.object(conn, "_graph_request", return_value=mock_response):
        docs = await conn.list_documents()
    assert len(docs) == 1
    assert docs[0].file_type == "pdf"

@pytest.mark.asyncio
async def test_delta_api_change_detection():
    """Vérifie l'utilisation de l'API delta pour les changements."""
    conn = OneDriveConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"]},
        credential={"access_token": "test"}
    )
    # Simuler une réponse delta avec un fichier ajouté et un supprimé
    delta_response = {
        "value": [
            {"id": "new-item", "name": "new.pdf", "file": {},
             "lastModifiedDateTime": "2026-03-01T00:00:00Z"},
            {"id": "deleted-item", "deleted": {"state": "deleted"}},
        ],
        "@odata.deltaLink": "https://graph.microsoft.com/delta?token=next"
    }
    with patch.object(conn, "_graph_request", return_value=delta_response):
        changes = await conn.detect_changes(known_hashes={})
    assert len(changes.added) >= 1
    assert len(changes.removed_ids) >= 1
```

---

## Étape 3.4 — `DropboxConnector`

### Dépendance Python

```
dropbox>=12.0
```

> Extra pip : `pip install ragkit[dropbox]`

### Fichier : `ragkit/connectors/dropbox.py`

#### Paramètres `config` attendus

```python
{
    "folder_paths": ["/Documents", "/Shared/Project"],
    "file_types": ["pdf", "docx", "md", "txt"],
    "recursive": True,
    "max_file_size_mb": 50,
}
```

#### Logique principale

1. **API Dropbox** :
   - Listing : `files_list_folder()` avec cursor pour pagination
   - Contenu : `files_download()` → parseur existant
   - Changements : `files_list_folder/continue` avec cursor stocké
2. **Détection de changement** : cursor Dropbox (natif, extrêmement efficace)

### Tests de validation (étape 3.4)

```python
# tests/test_connector_dropbox.py

@pytest.mark.asyncio
async def test_validate_config_valid():
    conn = DropboxConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"], "file_types": ["pdf"]},
        credential={"access_token": "test-token"}
    )
    result = await conn.validate_config()
    assert result.valid is True

@pytest.mark.asyncio
async def test_list_documents():
    conn = DropboxConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"], "file_types": ["pdf"]},
        credential={"access_token": "test"}
    )
    mock_entries = [
        MagicMock(name="report.pdf", path_lower="/documents/report.pdf",
                 size=2048, server_modified="2026-01-01T00:00:00Z",
                 content_hash="abc123"),
    ]
    with patch.object(conn, "_list_folder", return_value=mock_entries):
        docs = await conn.list_documents()
    assert len(docs) == 1

@pytest.mark.asyncio
async def test_cursor_based_change_detection():
    """Vérifie que le cursor Dropbox est utilisé pour la détection incrémentale."""
    conn = DropboxConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"]},
        credential={"access_token": "test"}
    )
    # Simuler list_folder/continue avec cursor
    with patch.object(conn, "_list_folder_continue") as mock_continue:
        mock_continue.return_value = ([], "new-cursor")
        changes = await conn.detect_changes(known_hashes={})
    mock_continue.assert_called_once()
```

---

## Étape 3.5 — UI OAuth2 (fenêtre d'authentification cloud)

### Fichiers frontend

| Fichier | Description |
|---|---|
| `desktop/src/components/settings/source-forms/GoogleDriveForm.tsx` | Config Google Drive |
| `desktop/src/components/settings/source-forms/OneDriveForm.tsx` | Config OneDrive |
| `desktop/src/components/settings/source-forms/DropboxForm.tsx` | Config Dropbox |
| `desktop/src/components/settings/OAuthButton.tsx` | Bouton réutilisable "Se connecter" |
| `desktop/src/components/settings/CloudFolderPicker.tsx` | Sélecteur de dossiers cloud |

#### Flux OAuth2 depuis l'UI

1. L'utilisateur clique sur `<OAuthButton provider="google" />`
2. Le frontend appelle `POST /api/sources/{id}/oauth/start`
3. Le backend retourne l'URL d'autorisation
4. Le frontend ouvre une `WebviewWindow` Tauri avec cette URL
5. Après autorisation, le callback arrive sur le backend
6. Le backend échange le code contre un token, le stocke dans le keyring
7. Le frontend est notifié via SSE et affiche "Connecté ✓"
8. Le `CloudFolderPicker` s'active pour lister les dossiers disponibles

#### `CloudFolderPicker` — UX

- Arborescence navigable des dossiers cloud
- Checkboxes pour sélectionner les dossiers à indexer
- Indicateur nombre de fichiers / taille estimée par dossier

### Tests de validation (étape 3.5)

```typescript
// Tests React pour les composants cloud

describe("OAuthButton", () => {
  it("renders 'Se connecter' initially", () => { ... });
  it("shows 'Connecté ✓' after successful auth", () => { ... });
  it("shows 'Déconnexion' option when connected", () => { ... });
  it("calls /oauth/start on click", () => { ... });
});

describe("CloudFolderPicker", () => {
  it("renders loading state initially", () => { ... });
  it("displays folder tree from API", () => { ... });
  it("allows selecting multiple folders", () => { ... });
  it("shows file count and size per folder", () => { ... });
  it("is disabled when not authenticated", () => { ... });
});

describe("GoogleDriveForm", () => {
  it("shows OAuthButton before folder picker", () => { ... });
  it("enables folder picker after auth", () => { ... });
  it("passes selected folder IDs to onSubmit", () => { ... });
});
```

---

## Étape 3.6 — Routes API OAuth2

### Fichier : `ragkit/desktop/api/sources.py` (ajout)

```python
@router.post("/{source_id}/oauth/start")
async def start_oauth(source_id: str, provider: str):
    """Génère l'URL d'autorisation OAuth2 pour le provider donné."""
    # Retourne {"auth_url": "https://accounts.google.com/o/oauth2/..."}

@router.get("/oauth/callback")
async def oauth_callback(code: str, state: str):
    """Reçoit le callback OAuth2, échange le code contre un token."""
    # Stocke le token dans le keyring, notifie le frontend

@router.post("/{source_id}/oauth/revoke")
async def revoke_oauth(source_id: str):
    """Révoque les tokens OAuth2 et supprime les credentials."""
```

### Tests de validation (étape 3.6)

```python
# tests/test_api_oauth.py

@pytest.mark.asyncio
async def test_oauth_start_returns_auth_url(client):
    # Créer une source Google Drive d'abord
    resp = await client.post("/api/sources", json={
        "name": "Drive", "type": "google_drive", "config": {"folder_ids": []}
    })
    source_id = resp.json()["id"]
    resp = await client.post(f"/api/sources/{source_id}/oauth/start",
                             params={"provider": "google"})
    assert resp.status_code == 200
    assert "auth_url" in resp.json()
    assert "accounts.google.com" in resp.json()["auth_url"]

@pytest.mark.asyncio
async def test_oauth_callback_stores_token(client):
    with patch("ragkit.connectors.credentials.CredentialManager.store") as mock_store:
        resp = await client.get("/api/sources/oauth/callback",
                               params={"code": "test-code", "state": "source-id"})
    assert resp.status_code == 200
    mock_store.assert_called_once()

@pytest.mark.asyncio
async def test_oauth_revoke_deletes_credentials(client):
    with patch("ragkit.connectors.credentials.CredentialManager.delete") as mock_del:
        resp = await client.post("/api/sources/source-id/oauth/revoke")
    assert resp.status_code == 200
    mock_del.assert_called_once()
```

---

## Checklist de validation Phase 3

| # | Critère | Commande / Vérification |
|---|---|---|
| 1 | CredentialManager — store/retrieve/delete | `pytest tests/test_credential_manager.py -v` |
| 2 | CredentialManager — refresh OAuth2 | `pytest tests/test_credential_manager.py -k refresh -v` |
| 3 | GoogleDriveConnector — config et listing | `pytest tests/test_connector_google_drive.py -v` |
| 4 | GoogleDriveConnector — export Google Docs | `pytest tests/test_connector_google_drive.py -k export -v` |
| 5 | OneDriveConnector — listing et delta | `pytest tests/test_connector_onedrive.py -v` |
| 6 | DropboxConnector — listing et cursor | `pytest tests/test_connector_dropbox.py -v` |
| 7 | API OAuth — start/callback/revoke | `pytest tests/test_api_oauth.py -v` |
| 8 | UI OAuth — flux connexion Google | Test manuel via l'app Tauri |
| 9 | UI CloudFolderPicker — sélection dossiers | Test manuel |
| 10 | Ingestion end-to-end Google Drive | Test manuel avec compte Google (sandbox) |
| 11 | Pas de régression sources locales/web | `pytest tests/ -v --tb=short` |
