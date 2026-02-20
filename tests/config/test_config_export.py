"""Tests for config export/import."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from ragkit.config.config_export import ConfigExporter, ConfigImporter
from ragkit.desktop.models import SettingsPayload
from ragkit.desktop.settings_store import save_settings, load_settings, get_settings_path, ensure_storage_dirs


@pytest.fixture(autouse=True)
def _use_tmp_settings(monkeypatch, tmp_path):
    """Redirect settings storage to a temp directory."""
    config_dir = tmp_path / "config"
    data_dir = tmp_path / "data"
    config_dir.mkdir()
    data_dir.mkdir()

    monkeypatch.setattr("ragkit.desktop.settings_store.get_config_dir", lambda: config_dir)
    monkeypatch.setattr("ragkit.desktop.settings_store.get_data_dir", lambda: data_dir)
    monkeypatch.setattr("ragkit.desktop.settings_store.get_settings_path", lambda: config_dir / "settings.json")
    monkeypatch.setattr("ragkit.desktop.settings_store.get_data_root", lambda: tmp_path)

    # Monkey-patch the import side too
    monkeypatch.setattr("ragkit.config.config_export.load_settings", load_settings)
    monkeypatch.setattr("ragkit.config.config_export.save_settings", save_settings)


def test_export_creates_file(tmp_path) -> None:
    # Save initial settings
    settings = SettingsPayload(profile="general", setup_completed=True)
    save_settings(settings)

    output = str(tmp_path / "export.ragkit-config")
    exporter = ConfigExporter()
    result = exporter.export(output)

    assert Path(result).exists()

    with open(result, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "ragkit_version" in data
    assert "config" in data
    assert "export_date" in data
    assert data["profile"] == "general"


def test_export_strips_api_keys(tmp_path) -> None:
    settings = SettingsPayload(
        embedding={"provider": "openai", "api_key": "sk-secret"},
        llm={"provider": "openai", "api_key": "sk-llm-secret"},
    )
    save_settings(settings)

    output = str(tmp_path / "export.ragkit-config")
    ConfigExporter().export(output)

    with open(output, "r", encoding="utf-8") as f:
        data = json.load(f)

    embedding = data["config"].get("embedding", {})
    assert "api_key" not in embedding
    assert embedding.get("api_key_set") is False

    llm = data["config"].get("llm", {})
    assert "api_key" not in llm


def test_importer_validate(tmp_path) -> None:
    export_data = {
        "ragkit_version": "12.0.0",
        "export_date": "2026-02-18T14:30:00Z",
        "profile": "technical_documentation",
        "config": {"profile": "technical_documentation"},
        "metadata": {"documents_count": 10},
    }
    path = str(tmp_path / "test.ragkit-config")
    with open(path, "w") as f:
        json.dump(export_data, f)

    importer = ConfigImporter()
    preview = importer.validate(path)
    assert preview["version"] == "12.0.0"
    assert preview["profile"] == "technical_documentation"


def test_importer_validate_invalid(tmp_path) -> None:
    path = str(tmp_path / "invalid.ragkit-config")
    with open(path, "w") as f:
        json.dump({"foo": "bar"}, f)

    with pytest.raises(ValueError, match="Invalid"):
        ConfigImporter().validate(path)


def test_import_replace(tmp_path) -> None:
    # Save initial
    save_settings(SettingsPayload(profile="general"))

    # Create import file
    export_data = {
        "ragkit_version": "12.0.0",
        "config": {"profile": "technical_documentation", "setup_completed": True},
    }
    path = str(tmp_path / "import.ragkit-config")
    with open(path, "w") as f:
        json.dump(export_data, f)

    ConfigImporter().import_replace(path)
    loaded = load_settings()
    assert loaded.profile == "technical_documentation"
    assert loaded.setup_completed is True


def test_import_merge(tmp_path) -> None:
    # Save initial with some existing config
    save_settings(SettingsPayload(
        profile="general",
        chunking={"strategy": "recursive"},
    ))

    # Create import file with only embedding
    export_data = {
        "ragkit_version": "12.0.0",
        "config": {"embedding": {"provider": "openai"}},
    }
    path = str(tmp_path / "merge.ragkit-config")
    with open(path, "w") as f:
        json.dump(export_data, f)

    ConfigImporter().import_merge(path)
    loaded = load_settings()
    # Embedding should be updated
    assert loaded.embedding.get("provider") == "openai"
    # Chunking should be preserved
    assert loaded.chunking.get("strategy") == "recursive"
