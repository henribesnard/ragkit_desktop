"""Tests for the web URL connector."""

from __future__ import annotations

from unittest.mock import patch, AsyncMock, MagicMock

import pytest

from ragkit.connectors.web_url import WebUrlConnector


def _connector(**overrides) -> WebUrlConnector:
    config = {
        "urls": ["https://example.com"],
        "crawl_depth": 0,
        "max_pages": 10,
        "extract_mode": "text",
        "respect_robots_txt": False,
        "request_delay_ms": 0,
        "timeout_seconds": 5,
    }
    config.update(overrides)
    return WebUrlConnector(source_id="s1", config=config)


# -- validate_config --

@pytest.mark.asyncio
async def test_validate_config_valid() -> None:
    conn = _connector()
    result = await conn.validate_config()
    assert result.valid is True


@pytest.mark.asyncio
async def test_validate_config_no_urls() -> None:
    conn = _connector(urls=[])
    result = await conn.validate_config()
    assert result.valid is False


@pytest.mark.asyncio
async def test_validate_config_invalid_url() -> None:
    conn = _connector(urls=["ftp://bad.com"])
    result = await conn.validate_config()
    assert result.valid is False


# -- URL filtering --

def test_normalize_url() -> None:
    conn = _connector()
    assert conn._normalize_url("https://example.com/page#section") == "https://example.com/page"
    assert conn._normalize_url("  https://example.com  ") == "https://example.com"


def test_is_allowed_url_basic() -> None:
    conn = _connector()
    domains = {"example.com"}
    assert conn._is_allowed_url("https://example.com/page", domains, [], []) is True
    assert conn._is_allowed_url("ftp://example.com", domains, [], []) is False


def test_is_allowed_url_exclude_pattern() -> None:
    conn = _connector()
    domains = {"example.com"}
    assert conn._is_allowed_url("https://example.com/admin/panel", domains, [], ["*/admin/*"]) is False


def test_is_allowed_url_include_pattern() -> None:
    conn = _connector()
    domains = {"example.com"}
    assert conn._is_allowed_url("https://example.com/docs/page", domains, ["*/docs/*"], []) is True
    assert conn._is_allowed_url("https://example.com/other/page", domains, ["*/docs/*"], []) is False


def test_is_allowed_url_same_domain() -> None:
    conn = _connector(crawl_same_domain_only=True)
    domains = {"example.com"}
    assert conn._is_allowed_url("https://other.com/page", domains, [], []) is False


# -- content extraction --

def test_extract_content_text() -> None:
    conn = _connector(extract_mode="text")
    html = "<html><head><title>Test Page</title></head><body><p>Hello world</p><script>x()</script></body></html>"
    title, content = conn._extract_content(html, "https://example.com")
    assert title == "Test Page"
    assert "Hello world" in content
    assert "x()" not in content


def test_extract_content_markdown() -> None:
    conn = _connector(extract_mode="markdown")
    html = "<html><body><h1>Title</h1><p>Paragraph</p><li>Item</li></body></html>"
    title, content = conn._extract_content(html, "https://example.com")
    assert "# Title" in content
    assert "Paragraph" in content
    assert "- Item" in content


def test_extract_content_html_clean() -> None:
    conn = _connector(extract_mode="html_clean")
    html = "<html><body><p>Clean</p><style>.x{}</style></body></html>"
    title, content = conn._extract_content(html, "https://example.com")
    assert "Clean" in content
    assert "<style>" not in content


# -- link extraction --

def test_extract_links() -> None:
    conn = _connector()
    html = '''
    <html><body>
        <a href="/page1">Page 1</a>
        <a href="https://example.com/page2">Page 2</a>
        <a href="mailto:test@example.com">Email</a>
        <a href="tel:123456">Phone</a>
    </body></html>
    '''
    links = list(conn._extract_links(html, "https://example.com"))
    assert "https://example.com/page1" in links
    assert "https://example.com/page2" in links
    assert all("mailto:" not in link for link in links)
    assert all("tel:" not in link for link in links)


# -- content type --

def test_content_type() -> None:
    assert _connector(extract_mode="text")._content_type() == "text"
    assert _connector(extract_mode="markdown")._content_type() == "markdown"
    assert _connector(extract_mode="html_clean")._content_type() == "html"


# -- HTTP date parsing --

def test_parse_http_date() -> None:
    conn = _connector()
    result = conn._parse_http_date("Sat, 01 Mar 2026 10:00:00 GMT")
    assert result is not None
    assert "2026-03-01" in result

    assert conn._parse_http_date("not-a-date") is None


# -- list_documents with mock --

@pytest.mark.asyncio
async def test_list_documents_returns_docs() -> None:
    conn = _connector(urls=["https://example.com"], crawl_depth=0)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = "<html><head><title>Example</title></head><body><p>Content here</p></body></html>"
    mock_response.content = mock_response.text.encode()
    mock_response.headers = {"content-type": "text/html; charset=utf-8"}

    with patch.object(conn, "_fetch_url", new_callable=AsyncMock, return_value=mock_response):
        docs = await conn.list_documents()

    assert len(docs) == 1
    assert docs[0].title == "Example"
    assert "Content here" in docs[0].content


@pytest.mark.asyncio
async def test_list_documents_skip_non_html() -> None:
    conn = _connector(urls=["https://example.com/file.pdf"])

    with patch.object(conn, "_fetch_url", new_callable=AsyncMock, return_value=None):
        docs = await conn.list_documents()

    assert len(docs) == 0


# -- detect_changes --

@pytest.mark.asyncio
async def test_detect_changes() -> None:
    conn = _connector()

    with patch.object(conn, "_fetch_url", new_callable=AsyncMock) as mock_fetch:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "<html><head><title>Page</title></head><body>New content</body></html>"
        mock_resp.content = mock_resp.text.encode()
        mock_resp.headers = {"content-type": "text/html"}
        mock_fetch.return_value = mock_resp

        changes = await conn.detect_changes({})

    assert len(changes.added) == 1
    assert len(changes.removed_ids) == 0


# -- P2: sitemap parsing --

@pytest.mark.asyncio
async def test_parse_sitemap_xml() -> None:
    conn = _connector(use_sitemap=True)

    sitemap_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/page1</loc></url>
        <url><loc>https://example.com/page2</loc></url>
    </urlset>"""

    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = sitemap_xml

    async def mock_get(url):
        return mock_resp

    mock_client.get = mock_get
    urls = await conn._parse_sitemaps(mock_client, ["https://example.com"])
    assert len(urls) == 2
    assert "https://example.com/page1" in urls
    assert "https://example.com/page2" in urls


def test_concurrency_config() -> None:
    conn = _connector(concurrency=3)
    assert conn._concurrency() == 3


def test_use_sitemap_config() -> None:
    conn = _connector(use_sitemap=True)
    assert conn._use_sitemap() is True
