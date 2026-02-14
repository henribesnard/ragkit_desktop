import json
import os
from pathlib import Path
from ragkit.config.ingestion_schema import IngestionConfig

class ConfigManager:
    def __init__(self):
        self.config_dir = Path.home() / ".ragkit" / "config"
        self.config_file = self.config_dir / "settings.json"
        self.ensure_config_dir()

    def ensure_config_dir(self):
        self.config_dir.mkdir(parents=True, exist_ok=True)

    def save_config(self, config: IngestionConfig):
        with open(self.config_file, "w", encoding="utf-8") as f:
            f.write(config.model_dump_json(indent=2))

    def load_config(self) -> IngestionConfig | None:
        if not self.config_file.exists():
            return None
        
        try:
            with open(self.config_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return IngestionConfig(**data)
        except Exception as e:
            print(f"Error loading config: {e}")
            return None

config_manager = ConfigManager()
