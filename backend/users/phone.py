import re

from django.core.exceptions import ValidationError


DEFAULT_COUNTRY_CODE = "+91"
_E164_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")
_INDIAN_LOCAL_PATTERN = re.compile(r"^[6-9]\d{9}$")


def normalize_phone_number(value):
    """Return the canonical international form used for delivery agents.

    VeeCleen is India-first: an unprefixed ten-digit mobile number is accepted
    only when it matches the Indian mobile pattern and is normalized to +91.
    Numbers from other countries must include an international country code
    (for example, +44 or 001-44). This keeps the launch policy explicit while
    allowing correctly formatted international numbers.
    """

    if value is None:
        raise ValidationError("Phone number is required.")

    compact = re.sub(r"[\s().-]+", "", str(value).strip())
    if not compact:
        raise ValidationError("Phone number is required.")

    if compact.startswith("00"):
        compact = f"+{compact[2:]}"
    elif _INDIAN_LOCAL_PATTERN.fullmatch(compact):
        compact = f"{DEFAULT_COUNTRY_CODE}{compact}"
    elif not compact.startswith("+"):
        raise ValidationError(
            "Use a ten-digit Indian mobile number or an international number "
            "with a country code."
        )

    if not _E164_PATTERN.fullmatch(compact):
        raise ValidationError(
            "Enter a valid phone number in international format."
        )

    return compact
