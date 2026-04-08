"""Abstract base interface for all knowledge source connectors."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ConnectorDocument:
    """Unified document produced by any connector.

    This is the common format that all connectors must produce.
    The ingestion pipeline consumes these to feed the existing
    preprocessing → chunking → embedding → vector-store chain.
    """

    id: str
    """Unique identifier (typically ``sha256(source_id + ":" + relative_path_or_url)``)."""

    source_id: str
    """ID of the parent :class:`~ragkit.desktop.models.SourceEntry`."""

    title: str
    """Human-readable title (filename stem, page title, …)."""

    content: str
    """Extracted text ready for chunking.  May be empty when only listing."""

    content_type: str = "text"
    """``"text"``, ``"html"`` or ``"markdown"``."""

    url: str | None = None
    """Original URL if applicable (web page, Drive link, …)."""

    file_path: str | None = None
    """Relative path inside the source (local dir, S3 prefix, …)."""

    file_type: str | None = None
    """Normalised file extension **without** leading dot, e.g. ``"pdf"``."""

    file_size_bytes: int = 0

    last_modified: str = ""
    """ISO-8601 timestamp of the last modification known to the source."""

    metadata: dict[str, Any] = field(default_factory=dict)
    """Connector-specific metadata (labels, author, …)."""

    content_hash: str = ""
    """SHA-256 hex-digest of the content – used for change detection."""


@dataclass
class ConnectorValidationResult:
    """Result of :meth:`BaseConnector.validate_config` /
    :meth:`BaseConnector.test_connection`."""

    valid: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class ConnectorChangeDetection:
    """Delta returned by :meth:`BaseConnector.detect_changes`."""

    added: list[ConnectorDocument] = field(default_factory=list)
    modified: list[ConnectorDocument] = field(default_factory=list)
    removed_ids: list[str] = field(default_factory=list)


class BaseConnector(ABC):
    """Interface that every source connector must implement.

    Parameters
    ----------
    source_id:
        UUID of the :class:`~ragkit.desktop.models.SourceEntry`.
    config:
        Type-specific configuration dict (``SourceEntry.config``).
    credential:
        Secrets retrieved from the system keyring, or ``None``.
    """

    def __init__(
        self,
        source_id: str,
        config: dict[str, Any],
        credential: dict[str, Any] | None = None,
    ) -> None:
        self.source_id = source_id
        self.config = config
        self.credential = credential

    # ------------------------------------------------------------------
    # Abstract interface
    # ------------------------------------------------------------------

    @abstractmethod
    async def validate_config(self) -> ConnectorValidationResult:
        """Check that *config* values are coherent (paths exist, URLs
        are well-formed, required fields present, …).

        This does **not** perform any network I/O – see
        :meth:`test_connection` for that.
        """

    @abstractmethod
    async def test_connection(self) -> ConnectorValidationResult:
        """Actually reach the remote source (stat a directory, HTTP HEAD
        a URL, call an API health-check) and report the result."""

    @abstractmethod
    async def list_documents(self) -> list[ConnectorDocument]:
        """Return every document available in the source.

        The ``content`` field may be left empty at this stage; it will
        be fetched on demand via :meth:`fetch_document_content`.
        """

    @abstractmethod
    async def fetch_document_content(self, doc_id: str) -> str:
        """Return the full extracted text for a single document."""

    @abstractmethod
    async def detect_changes(
        self,
        known_hashes: dict[str, str],
    ) -> ConnectorChangeDetection:
        """Compare the current source state against *known_hashes*
        (mapping ``doc_id → content_hash``) and return the delta.
        """

    # ------------------------------------------------------------------
    # Optional overrides
    # ------------------------------------------------------------------

    def supported_file_types(self) -> list[str]:
        """File extensions this connector can handle (informational)."""
        return []
