"""Connector for local directories (migration of existing behaviour)."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path

from ragkit.connectors.base import (
    BaseConnector,
    ConnectorChangeDetection,
    ConnectorDocument,
    ConnectorValidationResult,
)
from ragkit.connectors.registry import register_connector
from ragkit.desktop import documents
from ragkit.desktop.models import SourceType


@register_connector(SourceType.LOCAL_DIRECTORY)
class LocalDirectoryConnector(BaseConnector):
    """Scans and extracts text from a local file system directory."""

    @property
    def _root(self) -> Path:
        return Path(self.config.get("path", "")).expanduser()

    @property
    def _recursive(self) -> bool:
        return bool(self.config.get("recursive", True))

    @property
    def _file_types(self) -> list[str]:
        # Default to common textual formats if not provided.
        return self.config.get("file_types", ["pdf", "docx", "md", "txt"])

    @property
    def _excluded_dirs(self) -> list[str]:
        return self.config.get("excluded_dirs", [])

    @property
    def _exclusion_patterns(self) -> list[str]:
        return self.config.get("exclusion_patterns", [])

    @property
    def _max_file_size_mb(self) -> int:
        return int(self.config.get("max_file_size_mb", 50))

    # ------------------------------------------------------------------
    # BaseConnector implementation
    # ------------------------------------------------------------------

    async def validate_config(self) -> ConnectorValidationResult:
        errors = []
        path_str = self.config.get("path")
        if not path_str:
            errors.append("Le chemin source est requis.")
        else:
            root = self._root
            if not root.exists():
                errors.append(f"Le répertoire '{root}' n'existe pas.")
            elif not root.is_dir():
                errors.append(f"'{root}' n'est pas un répertoire.")

        if not self._file_types:
            errors.append("Au moins un type de fichier doit être sélectionné.")

        return ConnectorValidationResult(valid=len(errors) == 0, errors=errors)

    async def test_connection(self) -> ConnectorValidationResult:
        # For a local folder, config validation covers access checks
        return await self.validate_config()

    async def list_documents(self) -> list[ConnectorDocument]:
        root = self._root
        if not root.exists() or not root.is_dir():
            return []

        selected_extensions = {documents._normalize_extension(ext) for ext in self._file_types}
        result = []

        for file_path in documents._iter_files(
            root,
            recursive=self._recursive,
            excluded_dirs=self._excluded_dirs,
            exclusion_patterns=self._exclusion_patterns,
            max_file_size_mb=self._max_file_size_mb,
        ):
            ext = documents._normalize_extension(file_path.suffix)
            if ext not in selected_extensions:
                continue

            rel_path = file_path.relative_to(root).as_posix()
            stat = file_path.stat()
            # We use an empty content string here, it will be fetched on demand.
            # The hash is based on the file contents exactly as `detect_changes` did previously.
            content_hash = hashlib.sha256(file_path.read_bytes()).hexdigest()

            doc_id = hashlib.sha256(f"{self.source_id}:{rel_path}".encode("utf-8")).hexdigest()

            result.append(
                ConnectorDocument(
                    id=doc_id,
                    source_id=self.source_id,
                    title=file_path.stem,
                    content="",
                    content_type="text",
                    file_path=rel_path,
                    file_type=ext,
                    file_size_bytes=stat.st_size,
                    last_modified=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    content_hash=content_hash,
                )
            )

        return result

    async def fetch_document_content(self, doc_id: str) -> str:
        # Given a doc_id, we need to find the corresponding file.
        # Since list_documents reads all files anyway (to compute hashes),
        # we can just call it to resolve the path.
        docs = await self.list_documents()
        for doc in docs:
            if doc.id == doc_id and doc.file_path:
                file_path = self._root / doc.file_path
                parsed = documents._extract_content(file_path)
                return parsed.text

        raise FileNotFoundError(f"Document ID {doc_id} not found in source.")

    async def detect_changes(
        self,
        known_hashes: dict[str, str],
    ) -> ConnectorChangeDetection:
        current_docs = await self.list_documents()
        current_by_id = {doc.id: doc for doc in current_docs}

        added = []
        modified = []

        for doc in current_docs:
            if doc.id not in known_hashes:
                added.append(doc)
            elif doc.content_hash != known_hashes[doc.id]:
                modified.append(doc)

        removed_ids = [doc_id for doc_id in known_hashes if doc_id not in current_by_id]

        return ConnectorChangeDetection(
            added=added,
            modified=modified,
            removed_ids=removed_ids,
        )

    def supported_file_types(self) -> list[str]:
        return list(documents.SUPPORTED_FILE_TYPES)
