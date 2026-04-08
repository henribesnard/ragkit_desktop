import json
import logging
from pathlib import Path

from ragkit.desktop.migration import compute_legacy_source_id

from ragkit.desktop.models import SettingsPayload

logger = logging.getLogger(__name__)

class ConfigManager:
    def __init__(self):
        self.config_dir = Path.home() / ".loko" / "config"
        self.config_file = self.config_dir / "settings.json"
        self._ensure_config_dir()

    def _ensure_config_dir(self):
        self.config_dir.mkdir(parents=True, exist_ok=True)

    def save_config(self, config: SettingsPayload):
        try:
            with open(self.config_file, "w", encoding="utf-8") as f:
                f.write(config.model_dump_json(indent=2))
            logger.info(f"Configuration saved to {self.config_file}")
        except Exception as e:
            logger.error(f"Failed to save configuration: {e}")
            raise

    def load_config(self) -> SettingsPayload | None:
        if not self.config_file.exists():
            return None
        
        try:
            with open(self.config_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                
                # Auto-migration: if we have a legacy `source.path` but no `sources` list yet
                if "ingestion" in data and "source" in data["ingestion"]:
                    legacy_source = data["ingestion"]["source"]
                    sources = data["ingestion"].get("sources", [])
                    
                    if not sources and legacy_source.get("path"):
                        # Create the default local directory source entry
                        legacy_path = legacy_source.get("path", "")
                        default_source = {
                            "id": compute_legacy_source_id(legacy_path),
                            "name": "Dossier Local Principal",
                            "type": "local_directory",
                            "enabled": True,
                            "sync_frequency": "manual",
                            "status": "active",
                            "config": {
                                "path": legacy_path,
                                "recursive": legacy_source.get("recursive", True),
                                "excluded_dirs": legacy_source.get("excluded_dirs", []),
                                "exclusion_patterns": legacy_source.get("exclusion_patterns", []),
                                "metadata_overrides": legacy_source.get("metadata_overrides", {}),
                                "file_types": legacy_source.get("file_types", ["pdf", "docx", "md", "txt", "html", "csv", "rst", "xml", "json", "yaml"]),
                                "max_file_size_mb": legacy_source.get("max_file_size_mb", 50),
                            }
                        }
                        data["ingestion"]["sources"] = [default_source]
                        # We don't save immediately, it will be saved on next user action
                
                return SettingsPayload.model_validate(data)
        except Exception as e:
            logger.error(f"Failed to load configuration: {e}")
            return None

config_manager = ConfigManager()
