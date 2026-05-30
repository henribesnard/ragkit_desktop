from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock

from ragkit.connectors.dropbox import DropboxConnector
import ragkit.connectors.dropbox as dropbox_module


def _run(coro):
    return asyncio.run(coro)


class DummyFileMetadata:
    def __init__(
        self,
        name: str,
        path_lower: str,
        size: int,
        server_modified: datetime,
        content_hash: str,
        file_id: str = "id1",
    ) -> None:
        self.name = name
        self.path_lower = path_lower
        self.path_display = path_lower
        self.size = size
        self.server_modified = server_modified
        self.content_hash = content_hash
        self.id = file_id
        self.rev = "rev1"


class DummyDeletedMetadata:
    def __init__(self, file_id: str) -> None:
        self.id = file_id


class DummyFolderMetadata:
    pass


def _patch_dropbox_types() -> None:
    dropbox_module.dropbox = object()
    dropbox_module.FileMetadata = DummyFileMetadata
    dropbox_module.DeletedMetadata = DummyDeletedMetadata
    dropbox_module.FolderMetadata = DummyFolderMetadata


def test_validate_config_valid() -> None:
    _patch_dropbox_types()
    conn = DropboxConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"], "file_types": ["pdf"]},
        credential={"access_token": "test-token"},
    )
    result = _run(conn.validate_config())
    assert result.valid is True


def test_list_documents() -> None:
    _patch_dropbox_types()
    conn = DropboxConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"], "file_types": ["pdf"]},
        credential={"access_token": "test-token"},
    )
    entry = DummyFileMetadata(
        name="report.pdf",
        path_lower="/documents/report.pdf",
        size=2048,
        server_modified=datetime(2026, 1, 1, tzinfo=timezone.utc),
        content_hash="abc123",
    )
    conn._list_folder = lambda client, path: [entry]
    conn._client = lambda: object()
    docs = _run(conn.list_documents())
    assert len(docs) == 1
    assert docs[0].file_type == "pdf"


def test_list_documents_includes_paper() -> None:
    _patch_dropbox_types()
    conn = DropboxConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"], "include_paper": True},
        credential={"access_token": "test-token"},
    )
    paper_entry = DummyFileMetadata(
        name="notes.paper",
        path_lower="/documents/notes.paper",
        size=512,
        server_modified=datetime(2026, 1, 1, tzinfo=timezone.utc),
        content_hash="paper123",
        file_id="paper-id",
    )
    conn._list_folder = lambda client, path: [paper_entry]
    conn._client = lambda: object()
    docs = _run(conn.list_documents())
    assert len(docs) == 1
    assert docs[0].file_type == "paper"
    assert docs[0].content_type == "markdown"
    assert docs[0].metadata["is_paper"] is True


def test_list_documents_excludes_paper_when_disabled() -> None:
    _patch_dropbox_types()
    conn = DropboxConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"], "file_types": ["pdf"], "include_paper": False},
        credential={"access_token": "test-token"},
    )
    paper_entry = DummyFileMetadata(
        name="notes.paper",
        path_lower="/documents/notes.paper",
        size=512,
        server_modified=datetime(2026, 1, 1, tzinfo=timezone.utc),
        content_hash="paper123",
        file_id="paper-id",
    )
    conn._list_folder = lambda client, path: [paper_entry]
    conn._client = lambda: object()
    docs = _run(conn.list_documents())
    assert len(docs) == 0


def test_cursor_based_change_detection() -> None:
    _patch_dropbox_types()
    conn = DropboxConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"]},
        credential={"access_token": "test", "cursor": "cur1"},
    )
    conn._detect_changes_with_cursor = AsyncMock()
    _run(conn.detect_changes(known_hashes={}))
    conn._detect_changes_with_cursor.assert_awaited_once()
