from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

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
        {"type": "heading_1", "heading_1": {"rich_text": [{"plain_text": "Introduction"}]}},
        {"type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "Ceci est le contenu principal."}]}},
        {"type": "bulleted_list_item", "bulleted_list_item": {"rich_text": [{"plain_text": "Point 1"}]}},
        {"type": "code", "code": {"rich_text": [{"plain_text": "print('hello')"}], "language": "python"}},
    ],
    "has_more": False,
}


@pytest.mark.asyncio
async def test_validate_config_valid() -> None:
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": ["db-1"], "page_ids": []},
        credential={"token": "secret_test"},
    )
    result = await conn.validate_config()
    assert result.valid is True


@pytest.mark.asyncio
async def test_validate_config_no_ids() -> None:
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": [], "page_ids": []},
        credential={"token": "secret_test"},
    )
    result = await conn.validate_config()
    assert result.valid is False


@pytest.mark.asyncio
async def test_validate_config_no_token() -> None:
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": ["db-1"]},
        credential=None,
    )
    result = await conn.validate_config()
    assert result.valid is False


@pytest.mark.asyncio
async def test_list_documents_from_database() -> None:
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": ["db-1"], "page_ids": [], "max_pages": 100},
        credential={"token": "secret_test"},
    )
    with patch.object(conn, "_query_database", new=AsyncMock(return_value=[NOTION_PAGE_RESPONSE])) as _mock_query:
        with patch.object(conn, "_get_page_blocks", new=AsyncMock(return_value=NOTION_BLOCKS_RESPONSE)):
            docs = await conn.list_documents()
    assert len(docs) == 1
    assert docs[0].title == "Guide utilisateur"


@pytest.mark.asyncio
async def test_block_extraction() -> None:
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": ["db-1"]},
        credential={"token": "t"},
    )
    text = conn._blocks_to_text(NOTION_BLOCKS_RESPONSE["results"])
    assert "Introduction" in text
    assert "Ceci est le contenu principal" in text
    assert "Point 1" in text
    assert "print('hello')" in text


@pytest.mark.asyncio
async def test_block_extraction_heading_levels() -> None:
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": ["db-1"]},
        credential={"token": "t"},
    )
    blocks = [
        {"type": "heading_1", "heading_1": {"rich_text": [{"plain_text": "H1"}]}},
        {"type": "heading_2", "heading_2": {"rich_text": [{"plain_text": "H2"}]}},
        {"type": "heading_3", "heading_3": {"rich_text": [{"plain_text": "H3"}]}},
    ]
    text = conn._blocks_to_text(blocks)
    assert "H1" in text and "H2" in text and "H3" in text


@pytest.mark.asyncio
async def test_property_filters() -> None:
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": ["db-1"], "property_filters": {"Status": {"select": {"equals": "Published"}}}},
        credential={"token": "t"},
    )
    with patch.object(conn, "_api_post", new=AsyncMock(return_value={"results": [], "has_more": False})) as mock_post:
        await conn.list_documents()
    call_body = mock_post.call_args[1].get("json") or mock_post.call_args[0][1]
    assert "filter" in str(call_body)


@pytest.mark.asyncio
async def test_detect_changes_by_last_edited() -> None:
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": ["db-1"]},
        credential={"token": "t"},
    )
    known = {"doc-id-1": "old-hash"}
    with patch.object(conn, "list_documents") as mock_list:
        mock_list.return_value = [
            MagicMock(id="doc-id-1", content_hash="new-hash"),
        ]
        changes = await conn.detect_changes(known)
    assert len(changes.modified) == 1


@pytest.mark.asyncio
async def test_subpages_inclusion() -> None:
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": [], "page_ids": ["parent-page"], "include_subpages": True},
        credential={"token": "t"},
    )
    # Placeholder: ensure the connector can be instantiated with include_subpages.
    assert conn._include_subpages() is True


@pytest.mark.asyncio
async def test_max_pages_limit() -> None:
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": ["db-1"], "max_pages": 2},
        credential={"token": "t"},
    )
    with patch.object(conn, "_query_database", new=AsyncMock(return_value=[NOTION_PAGE_RESPONSE] * 5)):
        with patch.object(conn, "_get_page_blocks", new=AsyncMock(return_value=NOTION_BLOCKS_RESPONSE)):
            docs = await conn.list_documents()
    assert len(docs) <= 2


# -- P2: Recursive sub-pages --

@pytest.mark.asyncio
async def test_fetch_subpages_discovers_children() -> None:
    conn = NotionConnector(
        source_id="s1",
        config={"database_ids": [], "page_ids": ["parent"], "include_subpages": True},
        credential={"token": "t"},
    )

    child_blocks = {
        "results": [
            {"type": "child_page", "id": "child-1", "child_page": {"title": "Child Page"}},
            {"type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "text"}]}},
        ],
        "has_more": False,
    }
    child_page = {
        "id": "child-1",
        "properties": {"Name": {"title": [{"plain_text": "Child Page"}]}},
        "last_edited_time": "2026-03-01T10:00:00.000Z",
    }
    child_content_blocks = {
        "results": [{"type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "Child content"}]}}],
        "has_more": False,
    }

    async def mock_get_page_blocks(page_id):
        if page_id == "parent":
            return child_blocks
        if page_id == "child-1":
            return child_content_blocks
        return {"results": [], "has_more": False}

    with patch.object(conn, "_get_page", new=AsyncMock(side_effect=lambda pid: child_page if pid == "child-1" else NOTION_PAGE_RESPONSE)):
        with patch.object(conn, "_get_page_blocks", new=AsyncMock(side_effect=mock_get_page_blocks)):
            docs = await conn.list_documents()

    assert len(docs) == 2
    titles = {d.title for d in docs}
    assert "Child Page" in titles


# -- P2: Enhanced block formatting --

def test_format_block_to_do() -> None:
    conn = NotionConnector(source_id="s1", config={"database_ids": ["db-1"]}, credential={"token": "t"})
    blocks = [
        {"type": "to_do", "to_do": {"rich_text": [{"plain_text": "Buy milk"}], "checked": False}},
        {"type": "to_do", "to_do": {"rich_text": [{"plain_text": "Done task"}], "checked": True}},
    ]
    text = conn._blocks_to_text(blocks)
    assert "- [ ] Buy milk" in text
    assert "- [x] Done task" in text


def test_format_block_divider() -> None:
    conn = NotionConnector(source_id="s1", config={"database_ids": ["db-1"]}, credential={"token": "t"})
    blocks = [{"type": "divider", "divider": {}}]
    text = conn._blocks_to_text(blocks)
    assert "---" in text


def test_format_block_image() -> None:
    conn = NotionConnector(source_id="s1", config={"database_ids": ["db-1"]}, credential={"token": "t"})
    blocks = [
        {"type": "image", "image": {"file": {"url": "https://img.com/a.png"}, "caption": [{"plain_text": "Photo"}]}},
    ]
    text = conn._blocks_to_text(blocks)
    assert "![Photo](https://img.com/a.png)" in text
