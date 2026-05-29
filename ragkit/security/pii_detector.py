"""PII detection using regex patterns."""

from __future__ import annotations

import re
from dataclasses import dataclass

from ragkit.config.security_schema import PIIType, SecurityConfig


@dataclass
class PIIMatch:
    pii_type: PIIType
    value: str  # Masked: "jea***om"
    start: int
    end: int


PII_PATTERNS: dict[PIIType, str] = {
    # --- Original patterns (improved) ---
    PIIType.EMAIL: r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
    # International phone numbers (FR +33, US +1, generic +XX)
    PIIType.PHONE: (
        r"\b(?:"
        r"(?:\+\d{1,3}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4}"
        r")\b"
    ),
    # French social security number
    PIIType.SSN: r"\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b",
    PIIType.CREDIT_CARD: r"\b(?:\d{4}[\s-]?){3}\d{4}\b",
    # International IBAN (alphanumeric after country code)
    PIIType.IBAN: r"\b[A-Z]{2}\d{2}\s?[\dA-Z]{4}\s?(?:[\dA-Z]{4}\s?){2,7}[\dA-Z]{1,4}\b",
    # Addresses: FR + EN keywords
    PIIType.ADDRESS: (
        r"\b\d{1,5}\s(?:rue|avenue|boulevard|place|chemin|impasse"
        r"|street|road|ave|blvd|drive|lane|way)\b"
    ),

    # --- New patterns ---
    # API keys / tokens (common prefixes from major providers)
    PIIType.API_KEY: (
        r"\b(?:sk-|pk_|AKIA|ghp_|gho_|glpat-|xoxb-|xoxp-|sk-ant-)[A-Za-z0-9_\-]{20,}\b"
    ),
    # PEM private keys
    PIIType.PRIVATE_KEY: r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----",
    # IPv4 addresses (exclude common non-PII like 127.0.0.1, 0.0.0.0)
    PIIType.IP_ADDRESS: (
        r"\b(?!127\.0\.0\.1\b)(?!0\.0\.0\.0\b)"
        r"(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
    ),
    # Dates of birth (DD/MM/YYYY or DD-MM-YYYY)
    PIIType.DATE_OF_BIRTH: (
        r"\b(?:0[1-9]|[12]\d|3[01])[/.-](?:0[1-9]|1[0-2])[/.-](?:19|20)\d{2}\b"
    ),
    # French passport numbers
    PIIType.PASSPORT: r"\b\d{2}[A-Z]{2}\d{5}\b",
}


class PIIDetector:
    """Detects personal data in text."""

    def __init__(self, config: SecurityConfig) -> None:
        self.config = config
        self.patterns: dict[PIIType, re.Pattern[str]] = {
            t: re.compile(PII_PATTERNS[t], re.IGNORECASE)
            for t in config.pii_types
            if t in PII_PATTERNS
        }

    def detect(self, text: str) -> list[PIIMatch]:
        """Detect PII in text."""
        if not self.config.pii_detection:
            return []
        matches: list[PIIMatch] = []
        for pii_type, pattern in self.patterns.items():
            for m in pattern.finditer(text):
                matches.append(PIIMatch(
                    pii_type=pii_type,
                    value=self._mask(m.group()),
                    start=m.start(),
                    end=m.end(),
                ))
        return matches

    def anonymize(self, text: str) -> str:
        """Replace PII with [PII] tokens."""
        if not self.config.pii_detection:
            return text
        for _, pattern in self.patterns.items():
            text = pattern.sub("[PII]", text)
        return text

    def _mask(self, value: str) -> str:
        if len(value) <= 4:
            return "***"
        return value[:3] + "***" + value[-2:]
