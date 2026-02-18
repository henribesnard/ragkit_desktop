"""Shared agents settings helpers for desktop APIs."""

from __future__ import annotations

from typing import Any

from ragkit.config.agents_schema import AgentsConfig
from ragkit.desktop.profiles import build_full_config
from ragkit.desktop.settings_store import load_settings, save_settings


def _profile_agents_payload() -> dict[str, Any]:
    settings = load_settings()
    profile_name = settings.profile or "general"
    full_config = build_full_config(profile_name, settings.calibration_answers)
    payload = full_config.get("agents", {})
    return payload if isinstance(payload, dict) else {}


def default_agents_config() -> AgentsConfig:
    return AgentsConfig.model_validate(_profile_agents_payload())


def get_agents_config() -> AgentsConfig:
    settings = load_settings()
    payload = settings.agents if isinstance(settings.agents, dict) else {}
    return AgentsConfig.model_validate(payload) if payload else default_agents_config()


def save_agents_config(config: AgentsConfig) -> AgentsConfig:
    settings = load_settings()
    settings.agents = config.model_dump(mode="json")
    save_settings(settings)
    return config
