"""Export and import full RAGKIT configuration."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ragkit.desktop.settings_store import load_settings, save_settings


class ConfigExporter:
    """Exports the full configuration to a .ragkit-config file."""

    def export(self, output_path: str) -> str:
        settings = load_settings()
        config = settings.model_dump(mode="json")

        # Strip API keys from sections that may contain them
        for section in ("embedding", "llm", "rerank"):
            if section in config and isinstance(config[section], dict):
                config[section].pop("api_key", None)
                config[section]["api_key_set"] = False

        export_data = {
            "ragkit_version": config.get("version", "1.0.0"),
            "export_date": datetime.now(timezone.utc).isoformat(),
            "profile": config.get("profile", "general"),
            "config": config,
            "metadata": {
                "source_path": (
                    config.get("ingestion", {}).get("source", {}).get("path")
                    if config.get("ingestion")
                    else None
                ),
            },
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)

        return output_path


class ConfigImporter:
    """Imports configuration from a .ragkit-config file."""

    def validate(self, path: str) -> dict[str, Any]:
        """Validate and return import preview."""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if "ragkit_version" not in data or "config" not in data:
            raise ValueError("Invalid .ragkit-config file")

        return {
            "version": data["ragkit_version"],
            "export_date": data.get("export_date"),
            "profile": data.get("profile"),
            "metadata": data.get("metadata", {}),
        }

    def import_replace(self, path: str) -> None:
        """Replace current config with imported one, keeping API keys."""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if "config" not in data:
            raise ValueError("Invalid .ragkit-config file")

        from ragkit.desktop.models import SettingsPayload

        imported = data["config"]
        # Strip api_key_set flags
        for section in ("embedding", "llm", "rerank"):
            if section in imported and isinstance(imported[section], dict):
                imported[section].pop("api_key_set", None)

        new_settings = SettingsPayload.model_validate(imported)
        save_settings(new_settings)

    def import_merge(self, path: str) -> None:
        """Merge imported config with current one."""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if "config" not in data:
            raise ValueError("Invalid .ragkit-config file")

        current = load_settings()
        current_dict = current.model_dump(mode="json")
        imported = data["config"]

        # Strip api_key_set flags
        for section in ("embedding", "llm", "rerank"):
            if section in imported and isinstance(imported[section], dict):
                imported[section].pop("api_key_set", None)

        # Deep merge: only replace non-None sections
        for key, value in imported.items():
            if value is not None:
                if isinstance(value, dict) and isinstance(current_dict.get(key), dict):
                    current_dict[key] = {**current_dict[key], **value}
                else:
                    current_dict[key] = value

        from ragkit.desktop.models import SettingsPayload

        merged = SettingsPayload.model_validate(current_dict)
        save_settings(merged)
