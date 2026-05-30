from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest

from ragkit.connectors.git_repo import GitRepoConnector


@pytest.mark.asyncio
async def test_validate_config_valid(tmp_path: Path) -> None:
    conn = GitRepoConnector(
        source_id="s1",
        config={"repo_url": str(tmp_path), "branch": "main", "file_types": ["md", "txt"]},
    )
    result = await conn.validate_config()
    assert result.valid is True


@pytest.mark.asyncio
async def test_validate_config_invalid_url() -> None:
    conn = GitRepoConnector(
        source_id="s1",
        config={"repo_url": "not-a-url", "branch": "main", "file_types": ["md"]},
    )
    result = await conn.validate_config()
    assert result.valid is False


@pytest.mark.asyncio
async def test_list_documents_from_local_repo(tmp_path: Path) -> None:
    subprocess.run(["git", "init"], cwd=tmp_path, capture_output=True, check=True)
    (tmp_path / "README.md").write_text("# Hello\nDoc content", encoding="utf-8")
    (tmp_path / "code.py").write_text("print('hello')", encoding="utf-8")
    (tmp_path / "image.png").write_bytes(b"\x89PNG")
    subprocess.run(["git", "add", "."], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(
        ["git", "commit", "-m", "init"],
        cwd=tmp_path,
        capture_output=True,
        check=True,
        env={
            **{
                "GIT_AUTHOR_NAME": "Test",
                "GIT_AUTHOR_EMAIL": "t@t.com",
                "GIT_COMMITTER_NAME": "Test",
                "GIT_COMMITTER_EMAIL": "t@t.com",
            }
        },
    )

    conn = GitRepoConnector(
        source_id="s1",
        config={"repo_url": str(tmp_path), "branch": "master", "file_types": ["md", "py"]},
    )
    with patch.object(conn, "_clone_or_pull", return_value=tmp_path):
        docs = await conn.list_documents()
    assert len(docs) == 2


@pytest.mark.asyncio
async def test_include_readme_only(tmp_path: Path) -> None:
    (tmp_path / "README.md").write_text("# Hello", encoding="utf-8")
    (tmp_path / "docs.md").write_text("Docs", encoding="utf-8")

    conn = GitRepoConnector(
        source_id="s1",
        config={"repo_url": str(tmp_path), "branch": "main", "file_types": ["md"], "include_readme_only": True},
    )
    with patch.object(conn, "_clone_or_pull", return_value=tmp_path):
        docs = await conn.list_documents()
    assert len(docs) == 1
    assert docs[0].title == "README.md"


@pytest.mark.asyncio
async def test_excluded_dirs(tmp_path: Path) -> None:
    (tmp_path / "__pycache__").mkdir()
    (tmp_path / "__pycache__" / "a.py").write_text("print('x')", encoding="utf-8")
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("print('ok')", encoding="utf-8")

    conn = GitRepoConnector(
        source_id="s1",
        config={
            "repo_url": str(tmp_path),
            "branch": "main",
            "file_types": ["py"],
            "excluded_dirs": ["__pycache__"],
        },
    )
    with patch.object(conn, "_clone_or_pull", return_value=tmp_path):
        docs = await conn.list_documents()
    assert len(docs) == 1
    assert docs[0].file_path == "src/main.py"


@pytest.mark.asyncio
async def test_cleanup_removes_clone(tmp_path: Path) -> None:
    clone_dir = tmp_path / "repo_abc123"
    clone_dir.mkdir()
    (clone_dir / "README.md").write_text("Hello")

    conn = GitRepoConnector(
        source_id="s1",
        config={"repo_url": "https://github.com/user/repo.git", "branch": "main", "file_types": ["md"]},
    )
    with patch.object(conn, "_repo_dir", return_value=clone_dir):
        await conn.cleanup()
    assert not clone_dir.exists()


@pytest.mark.asyncio
async def test_cleanup_skips_local_path(tmp_path: Path) -> None:
    conn = GitRepoConnector(
        source_id="s1",
        config={"repo_url": str(tmp_path), "branch": "main", "file_types": ["md"]},
    )
    await conn.cleanup()
    assert tmp_path.exists()


def test_sparse_checkout_config() -> None:
    conn = GitRepoConnector(
        source_id="s1",
        config={"repo_url": "https://github.com/user/repo.git", "branch": "main", "file_types": ["md"], "sparse_checkout": True},
    )
    assert conn._use_sparse_checkout() is True


@pytest.mark.asyncio
async def test_detect_changes_via_git_diff(tmp_path: Path) -> None:
    (tmp_path / "docs").mkdir()
    (tmp_path / "docs" / "new.md").write_text("new", encoding="utf-8")

    conn = GitRepoConnector(
        source_id="s1",
        config={"repo_url": str(tmp_path), "branch": "main", "file_types": ["md"]},
    )
    with patch.object(conn, "_clone_or_pull", return_value=tmp_path):
        with patch.object(conn, "_get_changed_files", return_value=["docs/new.md"]):
            changes = await conn.detect_changes(known_hashes={})
    assert len(changes.added) >= 1
