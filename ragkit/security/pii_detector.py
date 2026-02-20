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
    PIIType.EMAIL: r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
    PIIType.PHONE: r"\b(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}\b",
    PIIType.SSN: r"\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b",
    PIIType.CREDIT_CARD: r"\b(?:\d{4}[\s-]?){3}\d{4}\b",
    PIIType.IBAN: r"\b[A-Z]{2}\d{2}\s?(?:\d{4}\s?){4,7}\d{1,4}\b",
    PIIType.ADDRESS: r"\b\d{1,4}\s(?:rue|avenue|boulevard|place|chemin|impasse)\b",
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
