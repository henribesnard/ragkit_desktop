"""Tests for SecurityConfig Pydantic schema."""

from __future__ import annotations

import pytest

from ragkit.config.security_schema import (
    APIKeyStatus,
    ExpertiseLevel,
    PIIAction,
    PIIType,
    SecurityConfig,
)


def test_security_config_defaults() -> None:
    config = SecurityConfig.model_validate({})
    assert config.encrypt_logs is False
    assert config.pii_detection is False
    assert config.pii_action == PIIAction.WARN
    assert config.log_retention_days == 30
    assert config.auto_purge is True
    assert len(config.pii_types) == 6


def test_security_config_all_pii_types() -> None:
    config = SecurityConfig.model_validate({})
    expected = {PIIType.EMAIL, PIIType.PHONE, PIIType.SSN, PIIType.ADDRESS, PIIType.CREDIT_CARD, PIIType.IBAN}
    assert set(config.pii_types) == expected


def test_security_config_custom_values() -> None:
    config = SecurityConfig.model_validate({
        "encrypt_logs": True,
        "pii_detection": True,
        "pii_types": ["email", "phone"],
        "pii_action": "anonymize",
        "log_retention_days": 90,
        "auto_purge": False,
    })
    assert config.encrypt_logs is True
    assert config.pii_detection is True
    assert config.pii_types == [PIIType.EMAIL, PIIType.PHONE]
    assert config.pii_action == PIIAction.ANONYMIZE
    assert config.log_retention_days == 90
    assert config.auto_purge is False


def test_security_config_validates_retention_bounds() -> None:
    with pytest.raises(Exception):
        SecurityConfig.model_validate({"log_retention_days": 0})
    with pytest.raises(Exception):
        SecurityConfig.model_validate({"log_retention_days": 400})


def test_security_config_validates_pii_action() -> None:
    with pytest.raises(Exception):
        SecurityConfig.model_validate({"pii_action": "delete"})


def test_expertise_level_values() -> None:
    assert ExpertiseLevel.SIMPLE == "simple"
    assert ExpertiseLevel.INTERMEDIATE == "intermediate"
    assert ExpertiseLevel.EXPERT == "expert"


def test_api_key_status_model() -> None:
    status = APIKeyStatus(provider="openai", configured=True, age_days=30)
    assert status.provider == "openai"
    assert status.configured is True
    assert status.age_days == 30


def test_api_key_status_defaults() -> None:
    status = APIKeyStatus(provider="cohere")
    assert status.configured is False
    assert status.last_modified is None
    assert status.age_days is None


def test_security_config_serialization() -> None:
    config = SecurityConfig(
        encrypt_logs=True,
        pii_detection=True,
        pii_types=[PIIType.EMAIL],
        pii_action=PIIAction.EXCLUDE,
    )
    data = config.model_dump(mode="json")
    assert data["encrypt_logs"] is True
    assert data["pii_types"] == ["email"]
    assert data["pii_action"] == "exclude"
    # Round-trip
    restored = SecurityConfig.model_validate(data)
    assert restored == config
