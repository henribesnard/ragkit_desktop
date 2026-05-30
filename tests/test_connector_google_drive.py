from __future__ import annotations

import asyncio
from unittest.mock import MagicMock, patch

from ragkit.connectors.google_drive import GoogleDriveConnector


def _run(coro):
    return asyncio.run(coro)


def test_validate_config_valid() -> None:
    conn = GoogleDriveConnector(
        source_id="s1",
        config={"folder_ids": ["folder123"]},
        credential={"access_token": "token"},
    )
    result = _run(conn.validate_config())
    assert result.valid is True


def test_validate_config_no_folders() -> None:
    conn = GoogleDriveConnector(
        source_id="s1",
        config={"folder_ids": []},
        credential={"access_token": "token"},
    )
    result = _run(conn.validate_config())
    assert result.valid is False


def test_validate_config_no_credentials() -> None:
    conn = GoogleDriveConnector(
        source_id="s1",
        config={"folder_ids": ["folder"]},
        credential=None,
    )
    result = _run(conn.validate_config())
    assert result.valid is False


def test_list_documents_from_folder() -> None:
    conn = GoogleDriveConnector(
        source_id="s1",
        config={"folder_ids": ["folder123"], "recursive": False},
        credential={"access_token": "token"},
    )
    mock_files = [
        {
            "id": "file1",
            "name": "doc.pdf",
            "mimeType": "application/pdf",
            "size": "1024",
            "modifiedTime": "2026-01-01T00:00:00Z",
        },
        {
            "id": "file2",
            "name": "notes",
            "mimeType": "application/vnd.google-apps.document",
            "modifiedTime": "2026-01-02T00:00:00Z",
        },
    ]
    with patch.object(conn, "_build_service", return_value=MagicMock()):
        with patch.object(conn, "_list_files_recursive", return_value=mock_files):
            docs = _run(conn.list_documents())
    assert len(docs) == 2


def test_export_google_doc() -> None:
    conn = GoogleDriveConnector(
        source_id="s1",
        config={"folder_ids": ["f1"]},
        credential={"access_token": "token"},
    )
    conn._doc_cache["file2"] = {
        "id": "file2",
        "name": "notes",
        "mimeType": "application/vnd.google-apps.document",
    }
    with patch.object(conn, "_build_service", return_value=MagicMock()):
        with patch.object(conn, "_export_google_doc", return_value="Document content here"):
            content = _run(conn.fetch_document_content("file2"))
    assert "Document content" in content


def test_detect_changes_modified_file() -> None:
    conn = GoogleDriveConnector(
        source_id="s1",
        config={"folder_ids": ["f1"]},
        credential={"access_token": "token"},
    )
    known = {"file1": "old-hash"}
    with patch.object(conn, "list_documents") as mock_list:
        mock_list.return_value = [
            MagicMock(id="file1", content_hash="new-hash"),
            MagicMock(id="file3", content_hash="hash3"),
        ]
        changes = _run(conn.detect_changes(known))
    assert len(changes.modified) == 1
    assert len(changes.added) == 1
    assert "file1" not in [d.id for d in changes.added]


def test_changes_api_incremental_detection() -> None:
    conn = GoogleDriveConnector(
        source_id="s1",
        config={"folder_ids": ["folder1"], "_changes_start_page_token": "token123"},
        credential={"access_token": "token"},
    )

    changes_response = {
        "changes": [
            {
                "fileId": "new-file",
                "file": {
                    "id": "new-file",
                    "name": "new.pdf",
                    "mimeType": "application/pdf",
                    "size": "1000",
                    "modifiedTime": "2026-03-01T00:00:00Z",
                    "parents": ["folder1"],
                },
            },
            {
                "fileId": "deleted-file",
                "removed": True,
            },
        ],
        "newStartPageToken": "token456",
    }

    mock_service = MagicMock()
    mock_service.changes.return_value.list.return_value.execute.return_value = changes_response

    with patch.object(conn, "_build_service", return_value=mock_service):
        with patch.object(conn, "_ensure_access_token", return_value=conn.credential):
            known = {"deleted-file": "hash"}
            changes = _run(conn.detect_changes(known))

    assert len(changes.added) == 1
    assert changes.added[0].title == "new.pdf"
    assert "deleted-file" in changes.removed_ids
    assert conn.config["_changes_start_page_token"] == "token456"


def test_respects_max_file_size() -> None:
    conn = GoogleDriveConnector(
        source_id="s1",
        config={"folder_ids": ["f1"], "max_file_size_mb": 1},
        credential={"access_token": "token"},
    )
    mock_files = [
        {
            "id": "f1",
            "name": "small.pdf",
            "mimeType": "application/pdf",
            "size": "500000",
            "modifiedTime": "2026-01-01T00:00:00Z",
        },
        {
            "id": "f2",
            "name": "huge.pdf",
            "mimeType": "application/pdf",
            "size": "50000000",
            "modifiedTime": "2026-01-01T00:00:00Z",
        },
    ]
    with patch.object(conn, "_build_service", return_value=MagicMock()):
        with patch.object(conn, "_list_files_recursive", return_value=mock_files):
            docs = _run(conn.list_documents())
    assert len(docs) == 1
