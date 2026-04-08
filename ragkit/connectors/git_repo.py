"""Connector for Git repositories."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from ragkit.connectors.base import (
    BaseConnector,
    ConnectorChangeDetection,
    ConnectorDocument,
    ConnectorValidationResult,
)
from ragkit.connectors.registry import register_connector
from ragkit.desktop import documents
from ragkit.desktop.models import SourceType


logger = logging.getLogger(__name__)


@register_connector(SourceType.GIT_REPO)
class GitRepoConnector(BaseConnector):
    """Clone and index files from a Git repository."""

    def __init__(self, source_id: str, config: dict[str, Any], credential: dict[str, Any] | None = None) -> None:
        super().__init__(source_id, config, credential)
        self._doc_cache: dict[str, ConnectorDocument] = {}

    # ------------------------------------------------------------------
    # Config helpers
    # ------------------------------------------------------------------

    def _repo_url(self) -> str:
        return str(self.config.get("repo_url", "")).strip()

    def _branch(self) -> str:
        return str(self.config.get("branch", "main")).strip() or "main"

    def _file_types(self) -> list[str]:
        return [str(ext).strip().lower().lstrip(".") for ext in self.config.get("file_types", []) if str(ext).strip()]

    def _excluded_dirs(self) -> list[str]:
        return [str(d).strip() for d in self.config.get("excluded_dirs", []) if str(d).strip()]

    def _include_readme_only(self) -> bool:
        return bool(self.config.get("include_readme_only", False))

    def _max_file_size_mb(self) -> int:
        return int(self.config.get("max_file_size_mb", 5))

    def _clone_depth(self) -> int:
        return max(1, int(self.config.get("clone_depth", 1)))

    # ------------------------------------------------------------------
    # BaseConnector implementation
    # ------------------------------------------------------------------

    async def validate_config(self) -> ConnectorValidationResult:
        errors: list[str] = []
        repo_url = self._repo_url()
        if not repo_url:
            errors.append("repo_url est requis.")
        elif not self._is_valid_repo_url(repo_url):
            errors.append("repo_url invalide.")
        if not self._file_types():
            errors.append("Au moins un type de fichier doit etre fourni.")
        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors)

    async def test_connection(self) -> ConnectorValidationResult:
        validation = await self.validate_config()
        return validation

    async def list_documents(self) -> list[ConnectorDocument]:
        validation = await self.validate_config()
        if not validation.valid:
            if validation.errors:
                logger.warning("GitRepoConnector validation failed: %s", validation.errors)
            return []

        repo_path = await asyncio.to_thread(self._clone_or_pull)
        documents_list = await asyncio.to_thread(self._collect_documents, repo_path)
        self._doc_cache = {doc.id: doc for doc in documents_list}
        return documents_list

    async def fetch_document_content(self, doc_id: str) -> str:
        cached = self._doc_cache.get(doc_id)
        if cached is not None:
            return cached.content
        docs = await self.list_documents()
        for doc in docs:
            if doc.id == doc_id:
                return doc.content
        raise FileNotFoundError(f"Document ID {doc_id} not found in Git source.")

    async def detect_changes(self, known_hashes: dict[str, str]) -> ConnectorChangeDetection:
        repo_path = await asyncio.to_thread(self._clone_or_pull)
        changed_files = await asyncio.to_thread(self._get_changed_files, repo_path)
        docs = await asyncio.to_thread(self._collect_documents, repo_path)

        if changed_files:
            filtered = []
            for doc in docs:
                if doc.file_path and any(doc.file_path.endswith(path) or doc.file_path == path for path in changed_files):
                    filtered.append(doc)
            docs = filtered

        current_by_id = {doc.id: doc for doc in docs}
        added = [doc for doc in docs if doc.id not in known_hashes]
        modified = [doc for doc in docs if doc.id in known_hashes and doc.content_hash != known_hashes[doc.id]]
        removed_ids = [doc_id for doc_id in known_hashes if doc_id not in current_by_id]
        return ConnectorChangeDetection(added=added, modified=modified, removed_ids=removed_ids)

    def supported_file_types(self) -> list[str]:
        return list(self._file_types())

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _is_valid_repo_url(self, repo_url: str) -> bool:
        if Path(repo_url).exists():
            return True
        if repo_url.startswith("git@"):
            return True
        parsed = urlparse(repo_url)
        return parsed.scheme in {"http", "https", "ssh", "git"} and bool(parsed.netloc)

    def _clone_or_pull(self) -> Path:
        repo_url = self._repo_url()
        if Path(repo_url).exists():
            return Path(repo_url)

        cache_root = Path(tempfile.gettempdir()) / "ragkit_git"
        cache_root.mkdir(parents=True, exist_ok=True)
        repo_hash = hashlib.sha256(repo_url.encode("utf-8")).hexdigest()[:12]
        repo_dir = cache_root / f"repo_{repo_hash}"

        if repo_dir.exists():
            self._run_git(["-C", str(repo_dir), "fetch", "--depth", str(self._clone_depth())])
            self._run_git(["-C", str(repo_dir), "checkout", self._branch()])
            self._run_git(["-C", str(repo_dir), "pull"])
            return repo_dir

        self._run_git(
            [
                "clone",
                "--depth",
                str(self._clone_depth()),
                "--branch",
                self._branch(),
                repo_url,
                str(repo_dir),
            ]
        )
        return repo_dir

    def _collect_documents(self, repo_path: Path) -> list[ConnectorDocument]:
        allowed_exts = set(self._file_types())
        excluded_dirs = self._excluded_dirs()
        include_readme_only = self._include_readme_only()
        max_size_mb = self._max_file_size_mb()

        docs: list[ConnectorDocument] = []
        readme_names = {"README", "README.md", "README.rst", "README.txt", "CONTRIBUTING.md", "CHANGELOG.md"}

        for file_path in documents._iter_files(
            repo_path,
            recursive=True,
            excluded_dirs=excluded_dirs,
            exclusion_patterns=[],
            max_file_size_mb=max_size_mb,
        ):
            rel_path = file_path.relative_to(repo_path).as_posix()
            name = file_path.name
            ext = documents._normalize_extension(file_path.suffix)
            if allowed_exts and ext not in allowed_exts:
                continue
            if include_readme_only and name not in readme_names:
                continue
            try:
                content = file_path.read_text(encoding="utf-8")
            except Exception:
                content = file_path.read_text(encoding="utf-8", errors="ignore")

            doc_id = hashlib.sha256(f"{self.source_id}:{rel_path}".encode("utf-8")).hexdigest()
            content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
            stat = file_path.stat()
            last_modified = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()

            doc = ConnectorDocument(
                id=doc_id,
                source_id=self.source_id,
                title=name,
                content=content,
                content_type="text",
                url=None,
                file_path=rel_path,
                file_type=ext,
                file_size_bytes=stat.st_size,
                last_modified=last_modified,
                metadata={"repo_url": self._repo_url(), "branch": self._branch()},
                content_hash=content_hash,
            )
            docs.append(doc)

        return docs

    def _get_changed_files(self, repo_path: Path) -> list[str]:
        try:
            result = self._run_git(
                ["-C", str(repo_path), "diff", "--name-only", "HEAD@{1}..HEAD"],
                check=False,
            )
            output = result.stdout.decode("utf-8", errors="ignore") if result.stdout else ""
            return [line.strip() for line in output.splitlines() if line.strip()]
        except Exception:
            return []

    def _run_git(self, args: list[str], check: bool = True) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["git", *args],
            check=check,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
        )
