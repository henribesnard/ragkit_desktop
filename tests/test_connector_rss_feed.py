"""Tests for the RSS feed connector."""

from __future__ import annotations

from unittest.mock import patch, MagicMock

import pytest

import ragkit.connectors.rss_feed as _mod
from ragkit.connectors.rss_feed import RssFeedConnector

# Ensure the feedparser check in validate_config() passes even when not installed.
_FP_STUB = MagicMock()


@pytest.fixture(autouse=True)
def _patch_feedparser():
    original = _mod.feedparser
    if original is None:
        _mod.feedparser = _FP_STUB
    yield
    _mod.feedparser = original


def _connector(**overrides) -> RssFeedConnector:
    config = {"feed_urls": ["https://example.com/feed.xml"], "max_articles": 10, "fetch_full_content": False}
    config.update(overrides)
    return RssFeedConnector(source_id="s1", config=config)


# -- validate_config --

@pytest.mark.asyncio
async def test_validate_config_valid() -> None:
    conn = _connector()
    result = await conn.validate_config()
    assert result.valid is True


@pytest.mark.asyncio
async def test_validate_config_no_urls() -> None:
    conn = _connector(feed_urls=[])
    result = await conn.validate_config()
    assert result.valid is False


@pytest.mark.asyncio
async def test_validate_config_invalid_url() -> None:
    conn = _connector(feed_urls=["ftp://bad"])
    result = await conn.validate_config()
    assert result.valid is False


# -- entry datetime parsing --

def test_entry_datetime_valid() -> None:
    conn = _connector()
    entry = MagicMock()
    entry.get.side_effect = lambda key, default=None: (2026, 3, 1, 10, 0, 0, 5, 60, 0) if key == "published_parsed" else None
    result = conn._entry_datetime(entry)
    assert result is not None
    assert "2026-03-01" in result


def test_entry_datetime_none() -> None:
    conn = _connector()
    entry = MagicMock()
    entry.get.return_value = None
    result = conn._entry_datetime(entry)
    assert result is None


# -- age filtering --

def test_is_too_old_no_max() -> None:
    conn = _connector()
    assert conn._is_too_old("2020-01-01T00:00:00+00:00") is False


def test_is_too_old_old_article() -> None:
    conn = _connector(max_age_days=7)
    assert conn._is_too_old("2020-01-01T00:00:00+00:00") is True


def test_is_too_old_recent_article() -> None:
    from datetime import datetime, timezone
    conn = _connector(max_age_days=7)
    recent = datetime.now(timezone.utc).isoformat()
    assert conn._is_too_old(recent) is False


# -- list_documents with mock feed --

@pytest.mark.asyncio
async def test_list_documents_parses_feed() -> None:
    conn = _connector()

    mock_feed = MagicMock()
    mock_entry = MagicMock()
    mock_entry.get.side_effect = lambda key, default=None: {
        "title": "Article 1",
        "link": "https://example.com/article1",
        "id": "entry-1",
        "summary": "Summary of article 1",
        "published_parsed": (2026, 3, 1, 10, 0, 0, 5, 60, 0),
        "updated_parsed": None,
        "description": None,
    }.get(key, default)
    mock_feed.entries = [mock_entry]

    with patch("ragkit.connectors.rss_feed.feedparser") as mock_fp:
        mock_fp.parse.return_value = mock_feed
        docs = await conn.list_documents()

    assert len(docs) == 1
    assert docs[0].title == "Article 1"
    assert "Summary" in docs[0].content


@pytest.mark.asyncio
async def test_list_documents_respects_max() -> None:
    conn = _connector(max_articles=2)

    mock_feed = MagicMock()
    entries = []
    for i in range(5):
        entry = MagicMock()
        entry.get.side_effect = lambda key, default=None, i=i: {
            "title": f"Article {i}",
            "link": f"https://example.com/art{i}",
            "id": f"e-{i}",
            "summary": f"Summary {i}",
            "published_parsed": None,
            "updated_parsed": None,
            "description": None,
        }.get(key, default)
        entries.append(entry)
    mock_feed.entries = entries

    with patch("ragkit.connectors.rss_feed.feedparser") as mock_fp:
        mock_fp.parse.return_value = mock_feed
        docs = await conn.list_documents()

    assert len(docs) == 2


# -- detect_changes --

@pytest.mark.asyncio
async def test_detect_changes_new_entry() -> None:
    conn = _connector()

    mock_feed = MagicMock()
    mock_entry = MagicMock()
    mock_entry.get.side_effect = lambda key, default=None: {
        "title": "New", "link": "https://example.com/new", "id": "new-1",
        "summary": "New article", "published_parsed": None, "updated_parsed": None, "description": None,
    }.get(key, default)
    mock_feed.entries = [mock_entry]

    with patch("ragkit.connectors.rss_feed.feedparser") as mock_fp:
        mock_fp.parse.return_value = mock_feed
        changes = await conn.detect_changes({})

    assert len(changes.added) == 1
    assert len(changes.removed_ids) == 0
