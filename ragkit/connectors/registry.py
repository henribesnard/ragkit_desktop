"""Connector registry – factory that maps a SourceType to its connector class."""

from __future__ import annotations

import logging
from typing import Any

from ragkit.connectors.base import BaseConnector
from ragkit.desktop.models import SourceType

logger = logging.getLogger(__name__)

_CONNECTOR_CLASSES: dict[SourceType, type[BaseConnector]] = {}


def register_connector(source_type: SourceType):
    """Class decorator that registers a connector for *source_type*.

    Usage::

        @register_connector(SourceType.LOCAL_DIRECTORY)
        class LocalDirectoryConnector(BaseConnector):
            ...
    """

    def decorator(cls: type[BaseConnector]) -> type[BaseConnector]:
        _CONNECTOR_CLASSES[source_type] = cls
        logger.debug("Registered connector %s for %s", cls.__name__, source_type.value)
        return cls

    return decorator


def create_connector(
    source_type: SourceType,
    source_id: str,
    config: dict[str, Any],
    credential: dict[str, Any] | None = None,
) -> BaseConnector:
    """Instantiate the right connector for *source_type*.

    Raises :class:`ValueError` if no connector is registered.
    """
    cls = _CONNECTOR_CLASSES.get(source_type)
    if cls is None:
        available = ", ".join(sorted(t.value for t in _CONNECTOR_CLASSES))
        raise ValueError(
            f"No connector registered for source type '{source_type.value}'. "
            f"Available types: {available or '(none)'}"
        )
    return cls(source_id=source_id, config=config, credential=credential)


def available_source_types() -> list[dict[str, Any]]:
    """Return metadata for every declared :class:`SourceType`.

    Each entry contains ``type`` (str value) and ``registered`` (bool).
    """
    return [
        {"type": st.value, "registered": st in _CONNECTOR_CLASSES}
        for st in SourceType
    ]
