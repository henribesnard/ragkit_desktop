# Phase 4 — Sources collaboratives (Confluence, Notion)

> **Prérequis** : Phase 1 terminée, Phase 3 recommandée (pour `CredentialManager`)  
> **Durée estimée** : 2-3 jours  
> **Objectif** : Permettre l'indexation de contenu depuis les plateformes wiki et de gestion de connaissances.

---

## Étape 4.1 — `ConfluenceConnector`

### Dépendances Python

```
httpx>=0.27  # déjà installé
```

> Aucun extra supplémentaire nécessaire (API REST pure via `httpx`).

### Fichier : `ragkit/connectors/confluence.py`

#### Paramètres `config` attendus

```python
{
    "base_url": "https://mycompany.atlassian.net/wiki",
    "space_keys": ["DEV", "OPS", "HR"],
    "include_attachments": False,
    "include_comments": False,
    "page_limit": 500,
    "label_filter": ["documentation", "howto"],  # vide = pas de filtre
    "exclude_archived": True,
    "expand_macros": True,                         # Tenter d'étendre les macros
}
```

#### Credential attendu

```python
# Confluence Cloud
{"email": "user@company.com", "api_token": "ATATT3x..."}
# Confluence Server
{"username": "admin", "password": "..."}
# ou PAT (Personal Access Token)
{"token": "NjM..."}
```

#### Logique principale

1. **API REST Confluence** :
   - Listing : `GET /rest/api/content?spaceKey=DEV&type=page&expand=body.storage,version`
   - Pagination : via `start` + `limit` (max 100 par requête)
   - Labels : `&label=documentation` si `label_filter` configuré
   - Pièces jointes : `GET /rest/api/content/{id}/child/attachment`
2. **Extraction du contenu** :
   - Le body est en format Confluence Storage (XML/HTML). Nettoyer :
     - Supprimer les `<ac:...>` macros Confluence
     - Supprimer les `<ri:...>` éléments internes
     - Convertir en texte via BeautifulSoup
   - Pour les pièces jointes (PDF, DOCX) : télécharger + parseur existant
3. **Détection de changement** :
   - CQL: `type=page AND space=DEV AND lastModified >= "2026-03-20"`
   - Utiliser `version.number` pour vérifier les modifications
4. **Métadonnées enrichies** :
   - Auteur, labels, espace, date de création/modification
   - URL vers la page Confluence (pour citation dans le chat)

### Tests de validation (étape 4.1)

```python
# tests/test_connector_confluence.py

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from ragkit.connectors.confluence import ConfluenceConnector

CONFLUENCE_PAGE_RESPONSE = {
    "results": [
        {
            "id": "12345",
            "title": "Guide d'installation",
            "type": "page",
            "body": {"storage": {"value": "<p>Contenu de la page</p>"}},
            "version": {"number": 5},
            "_links": {"webui": "/spaces/DEV/pages/12345"},
            "history": {
                "lastUpdated": {
                    "when": "2026-03-01T10:00:00.000Z",
                    "by": {"displayName": "Jean Dupont"}
                },
                "createdDate": "2025-01-01T00:00:00.000Z"
            },
            "metadata": {"labels": {"results": [{"name": "documentation"}]}}
        }
    ],
    "size": 1,
    "_links": {}
}

@pytest.mark.asyncio
async def test_validate_config_valid():
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki",
                "space_keys": ["DEV"]},
        credential={"email": "test@co.com", "api_token": "token123"}
    )
    result = await conn.validate_config()
    assert result.valid is True

@pytest.mark.asyncio
async def test_validate_config_no_spaces():
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net", "space_keys": []},
        credential={"email": "test@co.com", "api_token": "token"}
    )
    result = await conn.validate_config()
    assert result.valid is False

@pytest.mark.asyncio
async def test_validate_config_no_credentials():
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net", "space_keys": ["DEV"]},
        credential=None
    )
    result = await conn.validate_config()
    assert result.valid is False

@pytest.mark.asyncio
async def test_list_documents():
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki",
                "space_keys": ["DEV"], "page_limit": 100},
        credential={"email": "test@co.com", "api_token": "token"}
    )
    with patch.object(conn, "_api_get", return_value=CONFLUENCE_PAGE_RESPONSE):
        docs = await conn.list_documents()
    assert len(docs) == 1
    assert docs[0].title == "Guide d'installation"
    assert "Contenu de la page" in docs[0].content

@pytest.mark.asyncio
async def test_confluence_storage_cleaning():
    """Vérifie le nettoyage du format Confluence Storage."""
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki", "space_keys": ["DEV"]},
        credential={"email": "t@t.com", "api_token": "t"}
    )
    dirty_html = """
    <p>Normal text</p>
    <ac:structured-macro ac:name="code">
        <ac:plain-text-body>print("hello")</ac:plain-text-body>
    </ac:structured-macro>
    <ri:attachment ri:filename="test.pdf"/>
    <h2>Section</h2>
    """
    clean = conn._clean_confluence_html(dirty_html)
    assert "Normal text" in clean
    assert "ac:structured-macro" not in clean
    assert "ri:attachment" not in clean
    assert "Section" in clean

@pytest.mark.asyncio
async def test_label_filtering():
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki",
                "space_keys": ["DEV"], "label_filter": ["documentation"]},
        credential={"email": "t@t.com", "api_token": "t"}
    )
    with patch.object(conn, "_api_get") as mock_get:
        mock_get.return_value = CONFLUENCE_PAGE_RESPONSE
        docs = await conn.list_documents()
    # Vérifier que la query CQL inclut le filtre label
    call_url = mock_get.call_args[0][0]
    assert "label" in call_url or "label" in str(mock_get.call_args)

@pytest.mark.asyncio
async def test_detect_changes_via_cql():
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki", "space_keys": ["DEV"]},
        credential={"email": "t@t.com", "api_token": "t"}
    )
    known = {"page-id-1": "old-hash"}
    with patch.object(conn, "list_documents") as mock_list:
        mock_list.return_value = [
            MagicMock(id="page-id-1", content_hash="new-hash"),
            MagicMock(id="page-id-2", content_hash="hash2"),
        ]
        changes = await conn.detect_changes(known)
    assert len(changes.modified) == 1
    assert len(changes.added) == 1

@pytest.mark.asyncio
async def test_respects_page_limit():
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki",
                "space_keys": ["DEV"], "page_limit": 1},
        credential={"email": "t@t.com", "api_token": "t"}
    )
    large_response = {"results": CONFLUENCE_PAGE_RESPONSE["results"] * 5,
                      "size": 5, "_links": {}}
    with patch.object(conn, "_api_get", return_value=large_response):
        docs = await conn.list_documents()
    assert len(docs) <= 1

@pytest.mark.asyncio
async def test_exclude_archived():
    """Vérifie que les pages archivées sont exclues si configuré."""
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki",
                "space_keys": ["DEV"], "exclude_archived": True},
        credential={"email": "t@t.com", "api_token": "t"}
    )
    # Vérifier que le paramètre status=current est dans la requête API
```

---

## Étape 4.2 — `NotionConnector`

### Dépendances Python

```
httpx>=0.27  # déjà installé
```

> Aucun extra supplémentaire. L'API Notion est une API REST simple.

### Fichier : `ragkit/connectors/notion.py`

#### Paramètres `config` attendus

```python
{
    "database_ids": ["db-uuid-1", "db-uuid-2"],
    "page_ids": ["page-uuid-1"],
    "include_subpages": True,
    "property_filters": {                          # Filtres Notion natifs
        "Status": {"select": {"equals": "Published"}}
    },
    "max_pages": 200,
}
```

#### Credential attendu

```python
{"token": "secret_abc123..."}  # Internal integration token
```

#### Logique principale

1. **API Notion** (v2022-06-28 ou plus récent) :
   - Bases de données : `POST /databases/{id}/query` avec filtres
   - Pages : `GET /pages/{id}` + `GET /blocks/{id}/children` (récursif)
   - Le contenu est dans les blocs enfants, pas dans la page elle-même
2. **Extraction du contenu** :
   - Itérer sur les blocs enfants récursivement
   - Convertir chaque type de bloc en texte :
     - `paragraph`, `heading_1/2/3`, `bulleted_list_item`, `numbered_list_item`
     - `code` → bloc de code avec langage
     - `table` → markdown
     - `image` → caption uniquement
     - `callout`, `quote`, `toggle` → texte avec indentation
   - Gérer la pagination des blocs (max 100 par requête)
3. **Détection de changement** :
   - `last_edited_time` de chaque page
4. **Métadonnées** :
   - Propriétés de la base de données (Title, Status, Tags, etc.)
   - URL Notion pour citation

### Tests de validation (étape 4.2)

```python
# tests/test_connector_notion.py

import pytest
from unittest.mock import patch, MagicMock
from ragkit.connectors.notion import NotionConnector

NOTION_PAGE_RESPONSE = {
    "id": "page-uuid-1",
    "properties": {
        "Name": {"title": [{"plain_text": "Guide utilisateur"}]},
        "Status": {"select": {"name": "Published"}},
        "Tags": {"multi_select": [{"name": "doc"}, {"name": "guide"}]},
    },
    "last_edited_time": "2026-03-01T10:00:00.000Z",
    "url": "https://www.notion.so/Guide-utilisateur-abc123",
}

NOTION_BLOCKS_RESPONSE = {
    "results": [
        {"type": "heading_1", "heading_1": {
            "rich_text": [{"plain_text": "Introduction"}]}},
        {"type": "paragraph", "paragraph": {
            "rich_text": [{"plain_text": "Ceci est le contenu principal."}]}},
        {"type": "bulleted_list_item", "bulleted_list_item": {
            "rich_text": [{"plain_text": "Point 1"}]}},
        {"type": "code", "code": {
            "rich_text": [{"plain_text": "print('hello')"}],
            "language": "python"}},
    ],
    "has_more": False,
}

@pytest.mark.asyncio
async def test_validate_config_valid():
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": ["db-1"], "page_ids": []},
        credential={"token": "secret_test"}
    )
    result = await conn.validate_config()
    assert result.valid is True

@pytest.mark.asyncio
async def test_validate_config_no_ids():
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": [], "page_ids": []},
        credential={"token": "secret_test"}
    )
    result = await conn.validate_config()
    assert result.valid is False

@pytest.mark.asyncio
async def test_validate_config_no_token():
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": ["db-1"]},
        credential=None
    )
    result = await conn.validate_config()
    assert result.valid is False

@pytest.mark.asyncio
async def test_list_documents_from_database():
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": ["db-1"], "page_ids": [], "max_pages": 100},
        credential={"token": "secret_test"}
    )
    with patch.object(conn, "_query_database", return_value=[NOTION_PAGE_RESPONSE]), \
         patch.object(conn, "_get_page_blocks", return_value=NOTION_BLOCKS_RESPONSE):
        docs = await conn.list_documents()
    assert len(docs) == 1
    assert docs[0].title == "Guide utilisateur"

@pytest.mark.asyncio
async def test_block_extraction():
    conn = NotionConnector(
        source_id="s1", config={"database_ids": ["db-1"]},
        credential={"token": "t"}
    )
    text = conn._blocks_to_text(NOTION_BLOCKS_RESPONSE["results"])
    assert "Introduction" in text
    assert "Ceci est le contenu principal" in text
    assert "Point 1" in text
    assert "print('hello')" in text

@pytest.mark.asyncio
async def test_block_extraction_heading_levels():
    conn = NotionConnector(
        source_id="s1", config={"database_ids": ["db-1"]},
        credential={"token": "t"}
    )
    blocks = [
        {"type": "heading_1", "heading_1": {"rich_text": [{"plain_text": "H1"}]}},
        {"type": "heading_2", "heading_2": {"rich_text": [{"plain_text": "H2"}]}},
        {"type": "heading_3", "heading_3": {"rich_text": [{"plain_text": "H3"}]}},
    ]
    text = conn._blocks_to_text(blocks)
    assert "H1" in text and "H2" in text and "H3" in text

@pytest.mark.asyncio
async def test_property_filters():
    conn = NotionConnector(
        source_id="s1",
        config={
            "database_ids": ["db-1"],
            "property_filters": {"Status": {"select": {"equals": "Published"}}}
        },
        credential={"token": "t"}
    )
    with patch.object(conn, "_api_post") as mock_post:
        mock_post.return_value = {"results": [], "has_more": False}
        await conn.list_documents()
    # Vérifier que le filtre est passé dans le body de la requête
    call_body = mock_post.call_args[1].get("json") or mock_post.call_args[0][1]
    assert "filter" in str(call_body)

@pytest.mark.asyncio
async def test_detect_changes_by_last_edited():
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": ["db-1"]},
        credential={"token": "t"}
    )
    known = {"doc-id-1": "old-hash"}
    with patch.object(conn, "list_documents") as mock_list:
        mock_list.return_value = [
            MagicMock(id="doc-id-1", content_hash="new-hash"),
        ]
        changes = await conn.detect_changes(known)
    assert len(changes.modified) == 1

@pytest.mark.asyncio
async def test_subpages_inclusion():
    """Si include_subpages=True, les sous-pages sont aussi indexées."""
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": [], "page_ids": ["parent-page"],
                "include_subpages": True},
        credential={"token": "t"}
    )
    # Vérifier que les blocs child_page sont suivis récursivement

@pytest.mark.asyncio
async def test_max_pages_limit():
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": ["db-1"], "max_pages": 2},
        credential={"token": "t"}
    )
    with patch.object(conn, "_query_database") as mock_query:
        mock_query.return_value = [NOTION_PAGE_RESPONSE] * 5
        with patch.object(conn, "_get_page_blocks", return_value=NOTION_BLOCKS_RESPONSE):
            docs = await conn.list_documents()
    assert len(docs) <= 2
```

---

## Étape 4.3 — Formulaires UI Confluence et Notion

### Fichiers frontend

| Fichier | Description |
|---|---|
| `desktop/src/components/settings/source-forms/ConfluenceForm.tsx` | Formulaire Confluence |
| `desktop/src/components/settings/source-forms/NotionForm.tsx` | Formulaire Notion |

#### `ConfluenceForm.tsx` — Champs

- **URL de base** : champ texte (avec validation URL)
- **Type d'authentification** : radio (API Token / Personal Access Token)
- **Email + API Token** ou **PAT** : champs masqués
- **Espaces** : liste dynamique de clés d'espace (avec auto-complétion si possible)
- **Filtres labels** : liste dynamique
- **Inclure pièces jointes** : checkbox
- **Inclure commentaires** : checkbox
- **Exclure les pages archivées** : checkbox
- **Pages maximum** : input numérique
- **Bouton "Tester"** : test connexion + affiche nombre d'espaces/pages trouvés

#### `NotionForm.tsx` — Champs

- **Token d'intégration** : champ texte masqué
- **IDs de bases de données** : liste dynamique
- **IDs de pages** : liste dynamique
- **Inclure les sous-pages** : checkbox
- **Pages maximum** : input numérique
- **Bouton "Tester"** : teste le token et affiche les bases accessibles

### Tests de validation (étape 4.3)

```typescript
// Tests React

describe("ConfluenceForm", () => {
  it("renders all configuration fields", () => { ... });
  it("toggles auth fields based on auth type", () => { ... });
  it("validates base URL format", () => { ... });
  it("requires at least one space key", () => { ... });
  it("masks API token field", () => { ... });
  it("calls onSubmit with correct config shape", () => { ... });
});

describe("NotionForm", () => {
  it("renders token and IDs fields", () => { ... });
  it("requires at least one database or page ID", () => { ... });
  it("masks integration token", () => { ... });
  it("shows subpages option", () => { ... });
  it("calls onSubmit with correct config shape", () => { ... });
});
```

---

## Checklist de validation Phase 4

| # | Critère | Commande / Vérification |
|---|---|---|
| 1 | ConfluenceConnector — validation | `pytest tests/test_connector_confluence.py -k validate -v` |
| 2 | ConfluenceConnector — listing pages | `pytest tests/test_connector_confluence.py -k list -v` |
| 3 | ConfluenceConnector — nettoyage HTML | `pytest tests/test_connector_confluence.py -k clean -v` |
| 4 | ConfluenceConnector — détection changes | `pytest tests/test_connector_confluence.py -k changes -v` |
| 5 | NotionConnector — validation | `pytest tests/test_connector_notion.py -k validate -v` |
| 6 | NotionConnector — extraction blocs | `pytest tests/test_connector_notion.py -k block -v` |
| 7 | NotionConnector — listing depuis DB | `pytest tests/test_connector_notion.py -k list -v` |
| 8 | UI ConfluenceForm — rendu | Test React + vérification manuelle |
| 9 | UI NotionForm — rendu | Test React + vérification manuelle |
| 10 | Intégration end-to-end Confluence | Test manuel avec instance Confluence Cloud |
| 11 | Intégration end-to-end Notion | Test manuel avec workspace Notion |
| 12 | Pas de régression | `pytest tests/ -v --tb=short` |
