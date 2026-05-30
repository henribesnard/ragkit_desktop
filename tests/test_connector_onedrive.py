from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

from ragkit.connectors.onedrive import OneDriveConnector


def _run(coro):
    return asyncio.run(coro)


def test_validate_config_valid() -> None:
    conn = OneDriveConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"]},
        credential={"access_token": "test", "refresh_token": "test"},
    )
    result = _run(conn.validate_config())
    assert result.valid is True


def test_validate_config_no_credentials() -> None:
    conn = OneDriveConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"]},
        credential=None,
    )
    result = _run(conn.validate_config())
    assert result.valid is False


def test_list_documents() -> None:
    conn = OneDriveConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"], "file_types": ["pdf"]},
        credential={"access_token": "test"},
    )
    items = [
        {
            "id": "item1",
            "name": "report.pdf",
            "size": 1024,
            "lastModifiedDateTime": "2026-01-01T00:00:00Z",
            "file": {"mimeType": "application/pdf", "hashes": {"quickXorHash": "abc"}},
            "webUrl": "https://example.com/report",
        }
    ]
    conn._list_folder_recursive = AsyncMock(return_value=items)
    docs = _run(conn.list_documents())
    assert len(docs) == 1
    assert docs[0].file_type == "pdf"
    assert docs[0].url == "https://example.com/report"


def test_pagination_follows_next_link() -> None:
    conn = OneDriveConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"], "recursive": False},
        credential={"access_token": "test"},
    )
    page1 = {
        "value": [
            {"id": "item1", "name": "a.pdf", "size": 100, "file": {"mimeType": "application/pdf"}, "lastModifiedDateTime": "2026-01-01T00:00:00Z"},
        ],
        "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/drive/root:/Documents:/children?$skiptoken=abc",
    }
    page2 = {
        "value": [
            {"id": "item2", "name": "b.pdf", "size": 200, "file": {"mimeType": "application/pdf"}, "lastModifiedDateTime": "2026-01-01T00:00:00Z"},
        ],
    }

    call_count = [0]

    async def mock_graph(method, endpoint, params=None):
        if call_count[0] == 0:
            call_count[0] += 1
            return page1
        return page2

    conn._graph_request = mock_graph
    docs = _run(conn.list_documents())
    assert len(docs) == 2


def test_delta_api_change_detection() -> None:
    conn = OneDriveConnector(
        source_id="s1",
        config={"folder_paths": ["/Documents"]},
        credential={"access_token": "test", "delta_link": "https://graph.microsoft.com/delta?token=1"},
    )
    delta_response = {
        "value": [
            {
                "id": "new-item",
                "name": "new.pdf",
                "file": {"hashes": {"quickXorHash": "hash"}},
                "lastModifiedDateTime": "2026-03-01T00:00:00Z",
            },
            {"id": "deleted-item", "deleted": {"state": "deleted"}},
        ],
        "@odata.deltaLink": "https://graph.microsoft.com/delta?token=next",
    }
    conn._graph_request = AsyncMock(return_value=delta_response)
    conn._credential_manager.store = MagicMock()
    changes = _run(conn.detect_changes(known_hashes={}))
    assert len(changes.added) >= 1
    assert len(changes.removed_ids) >= 1
