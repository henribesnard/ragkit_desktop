from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from ragkit.connectors.s3_bucket import S3BucketConnector


@pytest.mark.asyncio
async def test_validate_config_valid() -> None:
    conn = S3BucketConnector(
        source_id="s1",
        config={"bucket": "my-bucket", "prefix": "docs/", "region": "eu-west-1"},
        credential={"aws_access_key_id": "AKIA", "aws_secret_access_key": "secret"},
    )
    result = await conn.validate_config()
    assert result.valid is True


@pytest.mark.asyncio
async def test_validate_config_no_bucket() -> None:
    conn = S3BucketConnector(
        source_id="s1",
        config={"prefix": "docs/", "region": "eu-west-1"},
        credential={"aws_access_key_id": "AKIA", "aws_secret_access_key": "s"},
    )
    result = await conn.validate_config()
    assert result.valid is False


@pytest.mark.asyncio
async def test_list_documents_filters_by_extension() -> None:
    conn = S3BucketConnector(
        source_id="s1",
        config={"bucket": "b", "prefix": "", "file_types": ["pdf"], "region": "us-east-1"},
        credential={"aws_access_key_id": "A", "aws_secret_access_key": "s"},
    )
    mock_objects = [
        {"Key": "doc.pdf", "Size": 1024, "LastModified": "2026-01-01T00:00:00Z", "ETag": '"abc123"'},
        {"Key": "image.png", "Size": 2048, "LastModified": "2026-01-01T00:00:00Z", "ETag": '"def456"'},
    ]
    with patch.object(conn, "_list_objects", return_value=mock_objects):
        docs = await conn.list_documents()
    assert len(docs) == 1
    assert docs[0].file_type == "pdf"


@pytest.mark.asyncio
async def test_detect_changes_via_etag() -> None:
    conn = S3BucketConnector(
        source_id="s1",
        config={"bucket": "b", "prefix": "", "file_types": ["pdf"], "region": "us-east-1"},
        credential={"aws_access_key_id": "A", "aws_secret_access_key": "s"},
    )
    known = {"doc-id": "old-etag"}
    with patch.object(conn, "list_documents") as mock_list:
        mock_list.return_value = [
            MagicMock(id="doc-id", content_hash="new-etag"),
        ]
        changes = await conn.detect_changes(known)
    assert len(changes.modified) == 1


def test_parse_binary_text_file() -> None:
    conn = S3BucketConnector(
        source_id="s1",
        config={"bucket": "b", "prefix": "", "region": "us-east-1"},
        credential={"aws_access_key_id": "A", "aws_secret_access_key": "s"},
    )
    result = conn._parse_binary(b"Hello world", "readme.txt")
    assert result == "Hello world"


def test_parse_binary_markdown_file() -> None:
    conn = S3BucketConnector(
        source_id="s1",
        config={"bucket": "b", "prefix": "", "region": "us-east-1"},
        credential={"aws_access_key_id": "A", "aws_secret_access_key": "s"},
    )
    result = conn._parse_binary(b"# Title\nContent", "doc.md")
    assert "Title" in result
    assert "Content" in result
