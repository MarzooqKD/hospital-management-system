import re

from django.core.exceptions import ValidationError

# CLAUDE.md section 4: GHA-XXXXXXXXX-X (9 digits, then a check digit).
GHANA_CARD_RE = re.compile(r"^GHA-\d{9}-\d$")

# Local: 0XX XXX XXXX (10 digits). International: +233 XX XXX XXXX.
_LOCAL_RE = re.compile(r"^0\d{9}$")
_INTL_RE = re.compile(r"^\+233\d{9}$")


def validate_ghana_card_number(value: str) -> None:
    if not GHANA_CARD_RE.match(value):
        raise ValidationError(
            "Ghana Card number must be in the format GHA-XXXXXXXXX-X.",
            code="invalid_ghana_card",
        )


def normalize_ghana_phone(value: str) -> str:
    """Validates a Ghanaian mobile number and normalizes it to E.164
    (CLAUDE.md section 4). Raises django.core.exceptions.ValidationError."""
    digits = re.sub(r"[\s-]", "", value or "")
    if _INTL_RE.match(digits):
        return digits
    if _LOCAL_RE.match(digits):
        return "+233" + digits[1:]
    raise ValidationError(
        "Enter a valid Ghanaian phone number, e.g. 024 123 4567 or +233 24 123 4567.",
        code="invalid_phone",
    )
