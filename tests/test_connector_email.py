"""Tests for the IMAP email connector."""

from __future__ import annotations

from unittest.mock import patch, MagicMock, AsyncMock

import pytest

import ragkit.connectors.email_imap as _mod
from ragkit.connectors.email_imap import EmailImapConnector

# Ensure the aioimaplib check in validate_config() passes even when not installed.
_AIOIMAPLIB_STUB = MagicMock()


@pytest.fixture(autouse=True)
def _patch_aioimaplib():
    original = _mod.aioimaplib
    _mod.aioimaplib = _AIOIMAPLIB_STUB
    yield
    _mod.aioimaplib = original


def _connector(**overrides) -> EmailImapConnector:
    config = {"server": "imap.test.com", "port": 993, "use_ssl": True, "folders": ["INBOX"], "max_emails": 10}
    config.update(overrides)
    return EmailImapConnector(
        source_id="s1",
        config=config,
        credential={"username": "user@test.com", "password": "pass"},
    )


# -- validate_config --

@pytest.mark.asyncio
async def test_validate_config_valid() -> None:
    conn = _connector()
    result = await conn.validate_config()
    assert result.valid is True


@pytest.mark.asyncio
async def test_validate_config_no_server() -> None:
    conn = EmailImapConnector(source_id="s1", config={"folders": ["INBOX"]})
    result = await conn.validate_config()
    assert result.valid is False
    assert any("serveur" in e.lower() or "server" in e.lower() for e in result.errors)


@pytest.mark.asyncio
async def test_validate_config_no_folders() -> None:
    conn = EmailImapConnector(
        source_id="s1",
        config={"server": "imap.test.com", "folders": []},
        credential={"username": "u", "password": "p"},
    )
    result = await conn.validate_config()
    assert result.valid is False


@pytest.mark.asyncio
async def test_validate_config_no_credentials() -> None:
    conn = EmailImapConnector(
        source_id="s1",
        config={"server": "imap.test.com", "folders": ["INBOX"]},
    )
    result = await conn.validate_config()
    assert result.valid is False


# -- list_documents --

@pytest.mark.asyncio
async def test_list_documents_extracts_emails() -> None:
    conn = _connector()
    with patch.object(conn, "_fetch_emails") as mock_fetch:
        mock_fetch.return_value = [
            {
                "uid": "1",
                "subject": "Meeting notes",
                "from": "boss@co.com",
                "to": "team@co.com",
                "date": "2026-03-01T10:00:00+00:00",
                "body": "Notes de la reunion...",
                "folder": "INBOX",
            },
        ]
        docs = await conn.list_documents()
    assert len(docs) == 1
    assert docs[0].title == "Meeting notes"
    assert docs[0].content == "Notes de la reunion..."
    assert docs[0].metadata["from"] == "boss@co.com"
    assert docs[0].metadata["folder"] == "INBOX"


@pytest.mark.asyncio
async def test_list_documents_respects_max() -> None:
    conn = _connector(max_emails=2)
    with patch.object(conn, "_fetch_emails") as mock_fetch:
        mock_fetch.return_value = [
            {"uid": str(i), "subject": f"Mail {i}", "from": "a@b.com", "date": "2026-01-01T00:00:00Z", "body": f"body {i}"}
            for i in range(10)
        ]
        docs = await conn.list_documents()
    assert len(docs) == 2


# -- detect_changes --

@pytest.mark.asyncio
async def test_detect_changes_added() -> None:
    conn = _connector()
    with patch.object(conn, "_fetch_emails") as mock_fetch:
        mock_fetch.return_value = [
            {"uid": "1", "subject": "New", "from": "a@b.com", "date": "2026-01-01T00:00:00Z", "body": "content"},
        ]
        changes = await conn.detect_changes({})
    assert len(changes.added) == 1
    assert len(changes.modified) == 0
    assert len(changes.removed_ids) == 0


# -- MIME parsing helpers --

def test_html_to_text() -> None:
    conn = _connector()
    html = "<html><body><p>Hello <b>world</b></p><script>evil()</script></body></html>"
    text = conn._html_to_text(html)
    assert "Hello" in text
    assert "world" in text
    assert "evil" not in text


def test_decode_header_value_plain() -> None:
    conn = _connector()
    assert conn._decode_header_value("Simple subject") == "Simple subject"
    assert conn._decode_header_value(None) == ""


def test_parse_email_date_valid() -> None:
    conn = _connector()
    iso = conn._parse_email_date("Sat, 01 Mar 2026 10:00:00 +0000")
    assert "2026-03-01" in iso


def test_parse_email_date_invalid() -> None:
    conn = _connector()
    iso = conn._parse_email_date("not a date")
    # Should return a valid ISO date (fallback to now)
    assert "T" in iso


# -- search criteria --

def test_build_search_criteria_all() -> None:
    conn = _connector()
    criteria = conn._build_search_criteria()
    assert criteria == "ALL"


def test_build_search_criteria_with_date() -> None:
    conn = _connector(date_from="2026-01-15")
    criteria = conn._build_search_criteria()
    assert "SINCE" in criteria


def test_build_search_criteria_with_subject() -> None:
    conn = _connector(subject_filter="urgent")
    criteria = conn._build_search_criteria()
    assert 'SUBJECT "urgent"' in criteria


def test_build_search_criteria_with_senders() -> None:
    conn = _connector(sender_filter=["alice@co.com", "bob@co.com"])
    criteria = conn._build_search_criteria()
    assert "FROM" in criteria
    assert "OR" in criteria


# -- body extraction --

def test_extract_body_plain_text() -> None:
    import email
    msg = email.message_from_string("Content-Type: text/plain\n\nHello world")
    conn = _connector()
    body = conn._extract_body(msg)
    assert "Hello world" in body


# -- folder list parsing --

def test_parse_folder_list() -> None:
    conn = _connector()
    data = [
        b'(\\HasNoChildren) "/" "INBOX"',
        b'(\\HasChildren) "/" "Work"',
        b'(\\HasNoChildren) "/" "Drafts"',
    ]
    folders = conn._parse_folder_list(data)
    assert "INBOX" in folders
    assert "Work" in folders
    assert "Drafts" in folders
