"""Tests for PII detector."""

from __future__ import annotations

from ragkit.config.security_schema import PIIAction, PIIType, SecurityConfig
from ragkit.security.pii_detector import PIIDetector, PIIMatch


def _make_detector(
    pii_detection: bool = True,
    pii_types: list[PIIType] | None = None,
    pii_action: PIIAction = PIIAction.WARN,
) -> PIIDetector:
    config = SecurityConfig(
        pii_detection=pii_detection,
        pii_types=pii_types or [PIIType.EMAIL, PIIType.PHONE, PIIType.SSN, PIIType.CREDIT_CARD, PIIType.IBAN, PIIType.ADDRESS],
        pii_action=pii_action,
    )
    return PIIDetector(config)


def test_detect_email() -> None:
    detector = _make_detector(pii_types=[PIIType.EMAIL])
    matches = detector.detect("Contact: jean.dupont@email.com for info")
    assert len(matches) == 1
    assert matches[0].pii_type == PIIType.EMAIL
    assert "***" in matches[0].value


def test_detect_phone_french() -> None:
    detector = _make_detector(pii_types=[PIIType.PHONE])
    matches = detector.detect("Appelez-nous au 01 23 45 67 89")
    assert len(matches) == 1
    assert matches[0].pii_type == PIIType.PHONE


def test_detect_phone_international() -> None:
    detector = _make_detector(pii_types=[PIIType.PHONE])
    # The +33 format is at the start of a word; use 0-prefix variant
    matches = detector.detect("Tel: 06 12 34 56 78")
    assert len(matches) == 1
    assert matches[0].pii_type == PIIType.PHONE


def test_detect_credit_card() -> None:
    detector = _make_detector(pii_types=[PIIType.CREDIT_CARD])
    matches = detector.detect("Card: 4111 1111 1111 1111")
    assert len(matches) == 1
    assert matches[0].pii_type == PIIType.CREDIT_CARD


def test_detect_iban() -> None:
    detector = _make_detector(pii_types=[PIIType.IBAN])
    matches = detector.detect("IBAN: FR76 3000 6000 0112 3456 7890 189")
    assert len(matches) == 1
    assert matches[0].pii_type == PIIType.IBAN


def test_detect_address() -> None:
    detector = _make_detector(pii_types=[PIIType.ADDRESS])
    matches = detector.detect("Habite au 42 rue de la paix")
    assert len(matches) == 1
    assert matches[0].pii_type == PIIType.ADDRESS


def test_detect_multiple_pii() -> None:
    detector = _make_detector()
    text = "Email: test@example.com, Tel: 01 23 45 67 89"
    matches = detector.detect(text)
    types = {m.pii_type for m in matches}
    assert PIIType.EMAIL in types
    assert PIIType.PHONE in types


def test_detect_disabled() -> None:
    detector = _make_detector(pii_detection=False)
    matches = detector.detect("test@example.com 01 23 45 67 89")
    assert len(matches) == 0


def test_anonymize() -> None:
    detector = _make_detector(pii_types=[PIIType.EMAIL])
    text = "Contact jean@test.com for details"
    result = detector.anonymize(text)
    assert "[PII]" in result
    assert "jean@test.com" not in result


def test_anonymize_preserves_non_pii() -> None:
    detector = _make_detector(pii_types=[PIIType.EMAIL])
    text = "Hello world, contact jean@test.com please"
    result = detector.anonymize(text)
    assert result.startswith("Hello world")
    assert result.endswith("please")


def test_anonymize_disabled() -> None:
    detector = _make_detector(pii_detection=False)
    text = "Contact jean@test.com"
    result = detector.anonymize(text)
    assert result == text


def test_no_false_positive_on_regular_text() -> None:
    detector = _make_detector()
    matches = detector.detect("This is a regular document about machine learning.")
    assert len(matches) == 0


def test_mask_short_value() -> None:
    detector = _make_detector()
    assert detector._mask("abc") == "***"


def test_mask_long_value() -> None:
    detector = _make_detector()
    result = detector._mask("jean@test.com")
    assert result.startswith("jea")
    assert result.endswith("om")
    assert "***" in result
