"""Pydantic schemas for security configuration."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class PIIAction(str, Enum):
    WARN = "warn"
    ANONYMIZE = "anonymize"
    EXCLUDE = "exclude"


class PIIType(str, Enum):
    EMAIL = "email"
    PHONE = "phone"
    SSN = "ssn"
    ADDRESS = "address"
    CREDIT_CARD = "credit_card"
    IBAN = "iban"


class ExpertiseLevel(str, Enum):
    SIMPLE = "simple"
    INTERMEDIATE = "intermediate"
    EXPERT = "expert"


class SecurityConfig(BaseModel):
    """Security & privacy configuration."""

    # Log encryption
    encrypt_logs: bool = False

    # PII detection
    pii_detection: bool = False
    pii_types: list[PIIType] = Field(default_factory=lambda: [
        PIIType.EMAIL, PIIType.PHONE, PIIType.SSN,
        PIIType.ADDRESS, PIIType.CREDIT_CARD, PIIType.IBAN,
    ])
    pii_action: PIIAction = PIIAction.WARN

    # Retention
    log_retention_days: int = Field(default=30, ge=1, le=365)
    auto_purge: bool = True


class APIKeyStatus(BaseModel):
    """Status of a single API key."""

    provider: str
    configured: bool = False
    last_modified: str | None = None
    age_days: int | None = None
