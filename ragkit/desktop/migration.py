from __future__ import annotations
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING
from ragkit.desktop.models import SourceType, SourceEntry, SyncFrequency, SourceStatus

if TYPE_CHECKING:
    from ragkit.desktop.models import IngestionConfig

def compute_legacy_source_id(path: str) -> str:
    """Derive a stable ID for the legacy single-source config."""
    normalized = Path(path).expanduser().as_posix()
    if os.name == "nt":
        normalized = normalized.lower()
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"local_directory:{normalized}"))

def migrate_settings_to_multi_sources(config: IngestionConfig) -> IngestionConfig:
    """Migre automatiquement l'ancien format source unique vers multi-sources.
    
    Si config.source.path est renseigné ET config.sources est vide, 
    crée une SourceEntry de type local_directory à partir de l'ancien format.
    """
    if not config.sources and config.source and config.source.path:
        # Création de l'entrée à partir de l'ancien format
        legacy = config.source
        source_id = compute_legacy_source_id(legacy.path) if legacy.path else str(uuid.uuid4())
        new_source = SourceEntry(
            id=source_id,
            name="Local Directory",
            type=SourceType.LOCAL_DIRECTORY,
            enabled=True,
            sync_frequency=SyncFrequency.MANUAL,
            status=SourceStatus.ACTIVE,
            created_at=datetime.now(timezone.utc).isoformat(),
            config={
                "path": legacy.path,
                "recursive": legacy.recursive,
                "file_types": legacy.file_types,
                "excluded_dirs": legacy.excluded_dirs,
                "exclusion_patterns": legacy.exclusion_patterns,
                "metadata_overrides": legacy.metadata_overrides,
                "max_file_size_mb": legacy.max_file_size_mb,
            }
        )
        config.sources = [new_source]
        
    return config
