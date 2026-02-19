"""Shared monitoring settings and logger helpers for desktop APIs."""

from __future__ import annotations

from typing import Any

from ragkit.config.monitoring_schema import MonitoringConfig
from ragkit.desktop.profiles import build_full_config
from ragkit.desktop.settings_store import get_data_root, load_settings, save_settings
from ragkit.monitoring.query_logger import QueryLogger

_QUERY_LOGGER: QueryLogger | None = None


def _profile_monitoring_payload() -> dict[str, Any]:
    settings = load_settings()
    profile_name = settings.profile or "general"
    full_config = build_full_config(profile_name, settings.calibration_answers)
    payload = full_config.get("monitoring", {})
    return payload if isinstance(payload, dict) else {}


def default_monitoring_config() -> MonitoringConfig:
    payload = _profile_monitoring_payload()
    return MonitoringConfig.model_validate(payload) if payload else MonitoringConfig()


def get_monitoring_config() -> MonitoringConfig:
    settings = load_settings()
    payload = settings.monitoring if isinstance(settings.monitoring, dict) else {}
    return MonitoringConfig.model_validate(payload) if payload else default_monitoring_config()


def save_monitoring_config(config: MonitoringConfig) -> MonitoringConfig:
    settings = load_settings()
    settings.monitoring = config.model_dump(mode="json")
    save_settings(settings)
    if _QUERY_LOGGER is not None:
        _QUERY_LOGGER.set_config(config)
    return config


def reset_monitoring_config() -> MonitoringConfig:
    return save_monitoring_config(default_monitoring_config())


def get_query_logger() -> QueryLogger:
    global _QUERY_LOGGER
    config = get_monitoring_config()
    expected_path = get_data_root() / "logs" / "queries.db"
    if _QUERY_LOGGER is None or _QUERY_LOGGER.db_path != expected_path:
        _QUERY_LOGGER = QueryLogger(config=config)
    else:
        _QUERY_LOGGER.set_config(config)
    return _QUERY_LOGGER
