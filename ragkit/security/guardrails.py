"""Input/output guardrails for the RAG pipeline.

Guards run before the query enters the pipeline (input) and after the
response is generated (output) to enforce security policies.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from ragkit.config.security_schema import SecurityConfig
from ragkit.security.pii_detector import PIIDetector

logger = logging.getLogger(__name__)

# Maximum query length (characters) to prevent abuse
MAX_QUERY_LENGTH = 10_000

# Patterns that suggest prompt injection attempts
_INJECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.IGNORECASE),
    re.compile(r"ignore\s+(all\s+)?above\s+instructions", re.IGNORECASE),
    re.compile(r"disregard\s+(all\s+)?previous", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(a|an)\s+", re.IGNORECASE),
    re.compile(r"new\s+instructions?:", re.IGNORECASE),
    re.compile(r"system\s*prompt\s*:", re.IGNORECASE),
    re.compile(r"<\s*/?\s*system\s*>", re.IGNORECASE),
    re.compile(r"ADMIN\s*OVERRIDE", re.IGNORECASE),
    re.compile(r"reveal\s+(your|the)\s+(system\s+)?prompt", re.IGNORECASE),
]


@dataclass
class GuardrailResult:
    """Result of a guardrail check."""

    allowed: bool
    reason: str = ""
    sanitized_text: str | None = None


class InputGuard:
    """Validates and sanitizes user queries before they enter the RAG pipeline."""

    def __init__(self, security_config: SecurityConfig | None = None) -> None:
        self._pii_detector: PIIDetector | None = None
        if security_config and security_config.pii_detection:
            self._pii_detector = PIIDetector(security_config)

    def check(self, query: str) -> GuardrailResult:
        # 1. Length check
        if len(query) > MAX_QUERY_LENGTH:
            return GuardrailResult(
                allowed=False,
                reason=f"Query too long ({len(query)} chars, max {MAX_QUERY_LENGTH})",
            )

        # 2. Injection detection (warn, don't block — users may legitimately
        #    discuss prompt injection in their documents)
        for pattern in _INJECTION_PATTERNS:
            if pattern.search(query):
                logger.warning("Potential prompt injection detected in query: %s", pattern.pattern)
                break

        # 3. PII anonymization (if enabled)
        sanitized = query
        if self._pii_detector:
            pii_matches = self._pii_detector.detect(query)
            if pii_matches:
                sanitized = self._pii_detector.anonymize(query)
                logger.info(
                    "PII detected in query (%d matches), anonymized before LLM call",
                    len(pii_matches),
                )

        return GuardrailResult(allowed=True, sanitized_text=sanitized)


class OutputGuard:
    """Validates LLM responses before they are sent to the user."""

    def __init__(self, security_config: SecurityConfig | None = None) -> None:
        self._pii_detector: PIIDetector | None = None
        if security_config and security_config.pii_detection:
            self._pii_detector = PIIDetector(security_config)

    def check(self, response: str, sources: list[dict] | None = None) -> GuardrailResult:
        sanitized = response

        # 1. PII check on response
        if self._pii_detector:
            pii_matches = self._pii_detector.detect(response)
            if pii_matches:
                sanitized = self._pii_detector.anonymize(response)
                logger.info(
                    "PII detected in LLM response (%d matches), anonymized",
                    len(pii_matches),
                )

        return GuardrailResult(allowed=True, sanitized_text=sanitized)
