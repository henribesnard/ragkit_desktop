import json
import os
import logging
from pathlib import Path
from typing import Any

from ragkit.desktop.models import SettingsPayload

logger = logging.getLogger(__name__)

class ConfigManager:
    def __init__(self):
        self.config_dir = Path.home() / ".ragkit" / "config"
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
                return SettingsPayload.model_validate(data)
        except Exception as e:
            logger.error(f"Failed to load configuration: {e}")
            return None

config_manager = ConfigManager()
