from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

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
                    "by": {"displayName": "Jean Dupont"},
                },
                "createdDate": "2025-01-01T00:00:00.000Z",
            },
            "metadata": {"labels": {"results": [{"name": "documentation"}]}},
        }
    ],
    "size": 1,
    "_links": {},
}


@pytest.mark.asyncio
async def test_validate_config_valid() -> None:
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki", "space_keys": ["DEV"]},
        credential={"email": "test@co.com", "api_token": "token123"},
    )
    result = await conn.validate_config()
    assert result.valid is True


@pytest.mark.asyncio
async def test_validate_config_no_spaces() -> None:
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net", "space_keys": []},
        credential={"email": "test@co.com", "api_token": "token"},
    )
    result = await conn.validate_config()
    assert result.valid is False


@pytest.mark.asyncio
async def test_validate_config_no_credentials() -> None:
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net", "space_keys": ["DEV"]},
        credential=None,
    )
    result = await conn.validate_config()
    assert result.valid is False


@pytest.mark.asyncio
async def test_list_documents() -> None:
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki", "space_keys": ["DEV"], "page_limit": 100},
        credential={"email": "test@co.com", "api_token": "token"},
    )
    with patch.object(conn, "_api_get", new=AsyncMock(return_value=CONFLUENCE_PAGE_RESPONSE)):
        docs = await conn.list_documents()
    assert len(docs) == 1
    assert docs[0].title == "Guide d'installation"
    assert "Contenu de la page" in docs[0].content


@pytest.mark.asyncio
async def test_confluence_storage_cleaning() -> None:
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki", "space_keys": ["DEV"]},
        credential={"email": "t@t.com", "api_token": "t"},
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
async def test_label_filtering() -> None:
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki", "space_keys": ["DEV"], "label_filter": ["documentation"]},
        credential={"email": "t@t.com", "api_token": "t"},
    )
    with patch.object(conn, "_api_get", new=AsyncMock(return_value=CONFLUENCE_PAGE_RESPONSE)) as mock_get:
        await conn.list_documents()
    call_url = mock_get.call_args[0][0]
    assert "label" in call_url or "label" in str(mock_get.call_args)


@pytest.mark.asyncio
async def test_detect_changes_via_cql() -> None:
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki", "space_keys": ["DEV"]},
        credential={"email": "t@t.com", "api_token": "t"},
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
async def test_respects_page_limit() -> None:
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki", "space_keys": ["DEV"], "page_limit": 1},
        credential={"email": "t@t.com", "api_token": "t"},
    )
    large_response = {"results": CONFLUENCE_PAGE_RESPONSE["results"] * 5, "size": 5, "_links": {}}
    with patch.object(conn, "_api_get", new=AsyncMock(return_value=large_response)):
        docs = await conn.list_documents()
    assert len(docs) <= 1


@pytest.mark.asyncio
async def test_fetch_comments() -> None:
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki", "space_keys": ["DEV"], "include_comments": True},
        credential={"email": "t@t.com", "api_token": "t"},
    )
    comments_response = {
        "results": [
            {
                "body": {"storage": {"value": "<p>Great work!</p>"}},
                "history": {"createdBy": {"displayName": "Alice"}},
            },
        ],
    }

    async def mock_api_get(url):
        if "child/comment" in url:
            return comments_response
        return CONFLUENCE_PAGE_RESPONSE

    with patch.object(conn, "_api_get", new=AsyncMock(side_effect=mock_api_get)):
        docs = await conn.list_documents()
    assert len(docs) == 1
    assert "Great work" in docs[0].content
    assert "Commentaires" in docs[0].content


@pytest.mark.asyncio
async def test_fetch_attachments() -> None:
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki", "space_keys": ["DEV"], "include_attachments": True},
        credential={"email": "t@t.com", "api_token": "t"},
    )
    attachments_response = {
        "results": [
            {
                "id": "att-1",
                "title": "report.pdf",
                "_links": {"download": "/download/attachments/report.pdf"},
                "extensions": {"fileSize": 2048},
                "version": {"when": "2026-03-01T10:00:00Z"},
            },
            {
                "id": "att-2",
                "title": "logo.png",
                "_links": {"download": "/download/attachments/logo.png"},
                "extensions": {"fileSize": 1024},
                "version": {"when": "2026-03-01T10:00:00Z"},
            },
        ],
    }

    async def mock_api_get(url):
        if "child/attachment" in url:
            return attachments_response
        return CONFLUENCE_PAGE_RESPONSE

    with patch.object(conn, "_api_get", new=AsyncMock(side_effect=mock_api_get)):
        docs = await conn.list_documents()
    # Should have 1 page + 1 pdf attachment (png is filtered out)
    assert len(docs) == 2
    attachment_docs = [d for d in docs if d.file_type == "pdf"]
    assert len(attachment_docs) == 1
    assert "[Attachment]" in attachment_docs[0].title


@pytest.mark.asyncio
async def test_exclude_archived() -> None:
    conn = ConfluenceConnector(
        source_id="s1",
        config={"base_url": "https://myco.atlassian.net/wiki", "space_keys": ["DEV"], "exclude_archived": True},
        credential={"email": "t@t.com", "api_token": "t"},
    )
    with patch.object(conn, "_api_get", new=AsyncMock(return_value=CONFLUENCE_PAGE_RESPONSE)) as mock_get:
        await conn.list_documents()
    call_url = mock_get.call_args[0][0]
    assert "status=current" in call_url or "status=current" in str(mock_get.call_args)
