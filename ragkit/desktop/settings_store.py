"""Persistence utilities for desktop configuration and document metadata."""

from __future__ import annotations

import json
from pathlib import Path

from .models import DocumentInfo, SettingsPayload


def get_data_root() -> Path:
    return Path.home() / ".ragkit"


def get_config_dir() -> Path:
    return get_data_root() / "config"


def get_data_dir() -> Path:
    return get_data_root() / "data"


def get_settings_path() -> Path:
    return get_config_dir() / "settings.json"


def get_documents_path() -> Path:
    return get_data_dir() / "documents.json"


def ensure_storage_dirs() -> None:
    get_config_dir().mkdir(parents=True, exist_ok=True)
    get_data_dir().mkdir(parents=True, exist_ok=True)


def load_settings() -> SettingsPayload:
    ensure_storage_dirs()
    settings_path = get_settings_path()
    if not settings_path.exists():
        return SettingsPayload()

    try:
        payload = json.loads(settings_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return SettingsPayload()
    return SettingsPayload.model_validate(payload)


def save_settings(settings: SettingsPayload) -> None:
    ensure_storage_dirs()
    settings_path = get_settings_path()
    settings_path.write_text(
        json.dumps(settings.model_dump(mode="json"), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def load_documents() -> list[DocumentInfo]:
    ensure_storage_dirs()
    documents_path = get_documents_path()
    if not documents_path.exists():
        return []

    try:
        payload = json.loads(documents_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []

    if not isinstance(payload, list):
        return []
    documents: list[DocumentInfo] = []
    for item in payload:
        try:
            documents.append(DocumentInfo.model_validate(item))
        except Exception:
            continue
    return documents


def save_documents(documents: list[DocumentInfo]) -> None:
    ensure_storage_dirs()
    documents_path = get_documents_path()
    documents_path.write_text(
        json.dumps([document.model_dump(mode="json") for document in documents], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
