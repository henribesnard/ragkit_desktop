# Phase 2 — Sources web (URLs et RSS)

> **Prérequis** : Phase 1 terminée  
> **Durée estimée** : 2-3 jours  
> **Objectif** : Permettre l'indexation de pages web et de flux RSS dans la base de connaissances.

---

## Étape 2.1 — `WebUrlConnector`

### Dépendances Python

```
httpx>=0.27
beautifulsoup4>=4.12
lxml>=5.0
```

> Ces dépendances sont ajoutées en extra pip : `pip install ragkit[web]`

### Fichier : `ragkit/connectors/web_url.py`

#### Paramètres `config` attendus

```python
{
    "urls": ["https://example.com/docs", "https://blog.example.com"],
    "crawl_depth": 1,                    # 0 = page seule, 1+ = suit les liens
    "crawl_same_domain_only": True,
    "include_patterns": ["*/docs/*"],     # Glob patterns d'URLs à inclure
    "exclude_patterns": ["*/login*", "*/cgu*"],
    "max_pages": 100,
    "extract_mode": "markdown",           # "text" | "markdown" | "html_clean"
    "respect_robots_txt": True,
    "user_agent": "LOKO-RAG/1.0",
    "request_delay_ms": 500,              # Délai entre requêtes (politesse)
    "timeout_seconds": 30,
}
```

#### Logique principale

1. **Validation** : vérifier que les URLs sont valides (schéma http/https)
2. **Crawl** : parcourir les URLs avec profondeur configurable
   - Utiliser `httpx.AsyncClient` avec timeout et retries
   - Respecter `robots.txt` si activé (via `urllib.robotparser`)
   - Extraire les liens `<a href>` pour le crawl en profondeur
   - Filtrer par `include_patterns` / `exclude_patterns`
   - Limiter à `max_pages`
3. **Extraction** : selon `extract_mode`
   - `text` : extraction texte brut via BeautifulSoup `.get_text()`
   - `markdown` : conversion HTML → Markdown simplifié (titres, listes, liens)
   - `html_clean` : suppression scripts/styles, conservation de la structure
4. **Identification** : chaque page = un `ConnectorDocument` avec `id = sha256(url)`
5. **Détection de changement** : hash du contenu + headers HTTP `ETag` / `Last-Modified`

#### Gestion des erreurs

- Timeout → skip la page, log warning
- HTTP 4xx/5xx → skip la page, log erreur
- Redirect loop → détection et abandon (max 5 redirections)
- Contenu binaire (PDF, image) → skip ou déléguer au parseur existant

### Tests de validation (étape 2.1)

```python
# tests/test_connector_web_url.py

import pytest
import httpx
from unittest.mock import AsyncMock, patch
from ragkit.connectors.web_url import WebUrlConnector

SAMPLE_HTML = """
<html>
<head><title>Test Page</title></head>
<body>
  <h1>Hello World</h1>
  <p>This is test content.</p>
  <a href="/page2">Page 2</a>
  <a href="https://external.com">External</a>
</body>
</html>
"""

@pytest.mark.asyncio
async def test_validate_config_valid():
    conn = WebUrlConnector(
        source_id="s1",
        config={"urls": ["https://example.com"], "crawl_depth": 0}
    )
    result = await conn.validate_config()
    assert result.valid is True

@pytest.mark.asyncio
async def test_validate_config_no_urls():
    conn = WebUrlConnector(source_id="s1", config={"urls": []})
    result = await conn.validate_config()
    assert result.valid is False
    assert any("url" in e.lower() for e in result.errors)

@pytest.mark.asyncio
async def test_validate_config_invalid_url():
    conn = WebUrlConnector(
        source_id="s1", config={"urls": ["not-a-url"]}
    )
    result = await conn.validate_config()
    assert result.valid is False

@pytest.mark.asyncio
async def test_list_documents_single_page():
    """Mock HTTP pour tester l'extraction d'une page unique."""
    conn = WebUrlConnector(
        source_id="s1",
        config={"urls": ["https://example.com"], "crawl_depth": 0,
                "extract_mode": "text"}
    )
    mock_response = httpx.Response(200, text=SAMPLE_HTML,
                                    headers={"content-type": "text/html"})
    with patch.object(conn, "_fetch_url", return_value=mock_response):
        docs = await conn.list_documents()
    assert len(docs) == 1
    assert "Hello World" in docs[0].content
    assert docs[0].url == "https://example.com"

@pytest.mark.asyncio
async def test_crawl_respects_same_domain():
    """Le crawl ne suit pas les liens externes si same_domain_only."""
    conn = WebUrlConnector(
        source_id="s1",
        config={
            "urls": ["https://example.com"],
            "crawl_depth": 1,
            "crawl_same_domain_only": True,
            "extract_mode": "text",
        }
    )
    # Mock: la page initiale contient un lien interne et un externe
    # Seul le lien interne doit être suivi
    with patch.object(conn, "_fetch_url") as mock_fetch:
        mock_fetch.return_value = httpx.Response(
            200, text=SAMPLE_HTML, headers={"content-type": "text/html"}
        )
        docs = await conn.list_documents()
    # Doit avoir appelé fetch pour example.com ET /page2
    # Mais PAS external.com
    called_urls = [call.args[0] for call in mock_fetch.call_args_list]
    assert not any("external.com" in u for u in called_urls)

@pytest.mark.asyncio
async def test_crawl_respects_max_pages():
    conn = WebUrlConnector(
        source_id="s1",
        config={"urls": ["https://example.com"], "crawl_depth": 5,
                "max_pages": 3, "extract_mode": "text"}
    )
    # Vérifier que max 3 pages sont retournées

@pytest.mark.asyncio
async def test_extract_mode_markdown():
    conn = WebUrlConnector(
        source_id="s1",
        config={"urls": ["https://example.com"], "crawl_depth": 0,
                "extract_mode": "markdown"}
    )
    with patch.object(conn, "_fetch_url") as mock_fetch:
        mock_fetch.return_value = httpx.Response(
            200, text=SAMPLE_HTML, headers={"content-type": "text/html"}
        )
        docs = await conn.list_documents()
    assert "# Hello World" in docs[0].content  # H1 → markdown heading

@pytest.mark.asyncio
async def test_detect_changes_content_modified():
    conn = WebUrlConnector(
        source_id="s1",
        config={"urls": ["https://example.com"], "crawl_depth": 0}
    )
    # Simuler un hash connu, puis un contenu modifié
    known_hashes = {"doc-id": "old-hash"}
    with patch.object(conn, "list_documents") as mock_list:
        mock_list.return_value = [
            ConnectorDocument(id="doc-id", source_id="s1", title="Test",
                            content="New content", content_hash="new-hash",
                            url="https://example.com")
        ]
        changes = await conn.detect_changes(known_hashes)
    assert len(changes.modified) == 1

@pytest.mark.asyncio
async def test_handles_http_errors_gracefully():
    conn = WebUrlConnector(
        source_id="s1",
        config={"urls": ["https://example.com/404"], "crawl_depth": 0}
    )
    with patch.object(conn, "_fetch_url") as mock_fetch:
        mock_fetch.return_value = httpx.Response(404, text="Not found")
        docs = await conn.list_documents()
    assert len(docs) == 0  # Page en erreur ignorée

@pytest.mark.asyncio
async def test_handles_timeout_gracefully():
    conn = WebUrlConnector(
        source_id="s1",
        config={"urls": ["https://example.com"], "crawl_depth": 0,
                "timeout_seconds": 1}
    )
    with patch.object(conn, "_fetch_url", side_effect=httpx.TimeoutException("timeout")):
        docs = await conn.list_documents()
    assert len(docs) == 0

@pytest.mark.asyncio
async def test_exclude_patterns():
    conn = WebUrlConnector(
        source_id="s1",
        config={"urls": ["https://example.com"], "crawl_depth": 1,
                "exclude_patterns": ["*/login*"], "extract_mode": "text"}
    )
    # Vérifier que les URLs matchant le pattern sont exclues du crawl
```

---

## Étape 2.2 — `RssFeedConnector`

### Dépendance Python

```
feedparser>=6.0
```

> Ajoutée en extra : `pip install ragkit[web]`

### Fichier : `ragkit/connectors/rss_feed.py`

#### Paramètres `config` attendus

```python
{
    "feed_urls": ["https://blog.example.com/rss", "https://news.example.com/atom.xml"],
    "max_articles": 50,                # Par flux
    "fetch_full_content": True,        # Récupérer l'article complet via la page web
    "content_selectors": ["article", ".post-content", "#main-content"],
    "max_age_days": 90,                # Ignorer les articles > 90 jours
}
```

#### Logique principale

1. **Parsing** : utiliser `feedparser.parse(url)` pour chaque flux
2. **Articles** : itérer sur `feed.entries`, récupérer `title`, `summary`, `link`, `published`
3. **Contenu complet** (optionnel) :
   - Si `fetch_full_content=True`, charger la page via `httpx`
   - Extraire le contenu via les `content_selectors` (CSS selectors avec BeautifulSoup)
   - Fallback sur `entry.summary` si échec
4. **Détection de changement** : par `guid` ou `id` de l'entry, + `updated` / `published`
5. **Déduplication** : par `guid` RSS, pas de doublon entre syncs

### Tests de validation (étape 2.2)

```python
# tests/test_connector_rss_feed.py

import pytest
from unittest.mock import patch, AsyncMock
from ragkit.connectors.rss_feed import RssFeedConnector

SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Test Blog</title>
  <item>
    <title>Article 1</title>
    <link>https://blog.example.com/article-1</link>
    <description>Summary of article 1</description>
    <guid>article-1</guid>
    <pubDate>Mon, 01 Jan 2026 12:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Article 2</title>
    <link>https://blog.example.com/article-2</link>
    <description>Summary of article 2</description>
    <guid>article-2</guid>
    <pubDate>Tue, 02 Jan 2026 12:00:00 GMT</pubDate>
  </item>
</channel>
</rss>"""

@pytest.mark.asyncio
async def test_validate_config_valid():
    conn = RssFeedConnector(
        source_id="s1",
        config={"feed_urls": ["https://blog.example.com/rss"]}
    )
    result = await conn.validate_config()
    assert result.valid is True

@pytest.mark.asyncio
async def test_validate_config_no_feeds():
    conn = RssFeedConnector(source_id="s1", config={"feed_urls": []})
    result = await conn.validate_config()
    assert result.valid is False

@pytest.mark.asyncio
async def test_list_documents_parses_rss():
    conn = RssFeedConnector(
        source_id="s1",
        config={"feed_urls": ["https://blog.example.com/rss"],
                "fetch_full_content": False, "max_articles": 50}
    )
    with patch("feedparser.parse") as mock_parse:
        mock_parse.return_value = _parse_sample_rss()
        docs = await conn.list_documents()
    assert len(docs) == 2
    assert docs[0].title == "Article 1"
    assert docs[0].url == "https://blog.example.com/article-1"

@pytest.mark.asyncio
async def test_respects_max_articles():
    conn = RssFeedConnector(
        source_id="s1",
        config={"feed_urls": ["https://blog.example.com/rss"],
                "max_articles": 1, "fetch_full_content": False}
    )
    with patch("feedparser.parse") as mock_parse:
        mock_parse.return_value = _parse_sample_rss()
        docs = await conn.list_documents()
    assert len(docs) == 1

@pytest.mark.asyncio
async def test_fetch_full_content():
    conn = RssFeedConnector(
        source_id="s1",
        config={"feed_urls": ["https://blog.example.com/rss"],
                "fetch_full_content": True,
                "content_selectors": ["article"]}
    )
    full_page = "<html><body><article>Full article content here.</article></body></html>"
    with patch("feedparser.parse") as mock_parse, \
         patch.object(conn, "_fetch_page", return_value=full_page):
        mock_parse.return_value = _parse_sample_rss()
        docs = await conn.list_documents()
    assert "Full article content" in docs[0].content

@pytest.mark.asyncio
async def test_falls_back_to_summary_on_fetch_failure():
    conn = RssFeedConnector(
        source_id="s1",
        config={"feed_urls": ["https://blog.example.com/rss"],
                "fetch_full_content": True}
    )
    with patch("feedparser.parse") as mock_parse, \
         patch.object(conn, "_fetch_page", side_effect=Exception("Network error")):
        mock_parse.return_value = _parse_sample_rss()
        docs = await conn.list_documents()
    assert "Summary of article 1" in docs[0].content

@pytest.mark.asyncio
async def test_detect_changes_new_articles():
    conn = RssFeedConnector(
        source_id="s1",
        config={"feed_urls": ["https://blog.example.com/rss"],
                "fetch_full_content": False}
    )
    with patch("feedparser.parse") as mock_parse:
        mock_parse.return_value = _parse_sample_rss()
        changes = await conn.detect_changes(known_hashes={})
    assert len(changes.added) == 2

@pytest.mark.asyncio
async def test_max_age_filter():
    conn = RssFeedConnector(
        source_id="s1",
        config={"feed_urls": ["https://blog.example.com/rss"],
                "max_age_days": 1, "fetch_full_content": False}
    )
    # Les articles datant de janvier 2026 doivent être filtrés si > 1 jour

def _parse_sample_rss():
    import feedparser
    return feedparser.parse(SAMPLE_RSS)
```

---

## Étape 2.3 — Formulaires UI pour Web et RSS

### Fichiers frontend

| Fichier | Description |
|---|---|
| `desktop/src/components/settings/source-forms/WebUrlForm.tsx` | Formulaire ajout/édition source web |
| `desktop/src/components/settings/source-forms/RssFeedForm.tsx` | Formulaire ajout/édition source RSS |

#### `WebUrlForm.tsx` — Champs

- **URLs** : champ multi-ligne ou liste dynamique (+ / -)
- **Profondeur de crawl** : slider 0-3 avec labels (« Page seule », « Liens directs », etc.)
- **Même domaine uniquement** : checkbox
- **Patterns d'exclusion** : liste dynamique
- **Pages maximum** : input numérique
- **Mode d'extraction** : select (Texte / Markdown / HTML nettoyé)
- **Respecter robots.txt** : checkbox
- **Bouton "Tester"** : appelle POST `/api/sources/{id}/test`

#### `RssFeedForm.tsx` — Champs

- **URLs des flux** : liste dynamique
- **Articles maximum par flux** : input numérique
- **Récupérer le contenu complet** : checkbox (avec avertissement sur la lenteur)
- **Sélecteurs CSS** : liste dynamique (affiché si contenu complet activé)
- **Ancienneté max (jours)** : input numérique
- **Bouton "Tester le flux"** : parse le flux et affiche nombre d'articles trouvés

### Tests de validation (étape 2.3)

```typescript
// desktop/src/components/settings/source-forms/__tests__/WebUrlForm.test.tsx

describe("WebUrlForm", () => {
  it("renders URL input fields", () => { ... });
  it("validates URL format before submit", () => { ... });
  it("adds and removes URL entries dynamically", () => { ... });
  it("shows crawl depth slider with labels", () => { ... });
  it("disables test button when no URLs entered", () => { ... });
  it("calls onSubmit with correct config shape", () => { ... });
});

// desktop/src/components/settings/source-forms/__tests__/RssFeedForm.test.tsx

describe("RssFeedForm", () => {
  it("renders feed URL input fields", () => { ... });
  it("shows CSS selectors only when fetch_full_content is checked", () => { ... });
  it("validates feed URLs", () => { ... });
  it("calls onSubmit with correct config shape", () => { ... });
});
```

---

## Étape 2.4 — Intégration `SyncScheduler` (synchronisation planifiée)

### Fichier : `ragkit/desktop/sync_scheduler.py`

Le scheduler gère les synchronisations planifiées de toutes les sources.

```python
class SyncScheduler:
    """Planificateur de synchronisation asynchrone."""

    def __init__(self, runtime: IngestionRuntime):
        self._runtime = runtime
        self._tasks: dict[str, asyncio.Task] = {}
        self._running = False

    async def start(self) -> None:
        """Démarre le scheduler, programme toutes les sources actives."""
        self._running = True
        settings = settings_store.load_settings()
        if settings.ingestion:
            for source in settings.ingestion.sources:
                if source.enabled and source.sync_frequency != SyncFrequency.MANUAL:
                    await self.schedule_source(source)

    async def stop(self) -> None:
        """Arrête tous les tasks planifiés."""
        self._running = False
        for task in self._tasks.values():
            task.cancel()
        self._tasks.clear()

    async def schedule_source(self, source: SourceEntry) -> None:
        """Programme la sync récurrente d'une source."""
        if source.id in self._tasks:
            self._tasks[source.id].cancel()
        interval = self._frequency_to_seconds(source.sync_frequency)
        if interval is None:
            return
        self._tasks[source.id] = asyncio.create_task(
            self._sync_loop(source.id, interval)
        )

    async def trigger_now(self, source_id: str) -> None:
        """Déclenche une sync immédiate pour une source."""
        ...

    async def _sync_loop(self, source_id: str, interval: int) -> None:
        while self._running:
            await asyncio.sleep(interval)
            await self._run_sync(source_id)

    async def _run_sync(self, source_id: str) -> None:
        """Exécute la sync d'une source spécifique."""
        ...

    @staticmethod
    def _frequency_to_seconds(freq: SyncFrequency) -> int | None:
        return {
            SyncFrequency.MANUAL: None,
            SyncFrequency.EVERY_15_MIN: 900,
            SyncFrequency.HOURLY: 3600,
            SyncFrequency.EVERY_6H: 21600,
            SyncFrequency.DAILY: 86400,
            SyncFrequency.WEEKLY: 604800,
        }.get(freq)
```

### Tests de validation (étape 2.4)

```python
# tests/test_sync_scheduler.py

@pytest.mark.asyncio
async def test_frequency_to_seconds():
    assert SyncScheduler._frequency_to_seconds(SyncFrequency.MANUAL) is None
    assert SyncScheduler._frequency_to_seconds(SyncFrequency.HOURLY) == 3600
    assert SyncScheduler._frequency_to_seconds(SyncFrequency.DAILY) == 86400

@pytest.mark.asyncio
async def test_schedule_and_cancel():
    scheduler = SyncScheduler(runtime=MockRuntime())
    source = SourceEntry(name="Test", type=SourceType.WEB_URL,
                        sync_frequency=SyncFrequency.HOURLY, config={})
    await scheduler.schedule_source(source)
    assert source.id in scheduler._tasks
    await scheduler.stop()
    assert len(scheduler._tasks) == 0

@pytest.mark.asyncio
async def test_manual_source_not_scheduled():
    scheduler = SyncScheduler(runtime=MockRuntime())
    source = SourceEntry(name="Test", type=SourceType.WEB_URL,
                        sync_frequency=SyncFrequency.MANUAL, config={})
    await scheduler.schedule_source(source)
    assert source.id not in scheduler._tasks

@pytest.mark.asyncio
async def test_trigger_now():
    scheduler = SyncScheduler(runtime=MockRuntime())
    # Vérifier que trigger_now appelle _run_sync immédiatement
```

---

## Checklist de validation Phase 2

| # | Critère | Commande / Vérification |
|---|---|---|
| 1 | WebUrlConnector — validation config | `pytest tests/test_connector_web_url.py -k validate -v` |
| 2 | WebUrlConnector — crawl et extraction | `pytest tests/test_connector_web_url.py -v` |
| 3 | RssFeedConnector — parsing flux | `pytest tests/test_connector_rss_feed.py -v` |
| 4 | RssFeedConnector — détection changements | `pytest tests/test_connector_rss_feed.py -k changes -v` |
| 5 | SyncScheduler — planification | `pytest tests/test_sync_scheduler.py -v` |
| 6 | UI WebUrlForm — rendu et validation | Test React + vérification manuelle |
| 7 | UI RssFeedForm — rendu et validation | Test React + vérification manuelle |
| 8 | Ingestion end-to-end avec source web | Test manuel : ajouter un site, sync, vérifier le chat |
| 9 | Ingestion end-to-end avec source RSS | Test manuel : ajouter un flux, sync, vérifier les documents |
| 10 | Pas de régression sur sources locales | `pytest tests/ -v --tb=short` |
