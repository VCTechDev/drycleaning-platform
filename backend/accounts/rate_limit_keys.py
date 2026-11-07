"""Key derivation and trusted-client-IP utilities for login rate limiting."""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import re
import unicodedata
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError

from users.phone import normalize_phone_number


IDENTIFIER_LOCK_NAMESPACE = 1
IP_LOCK_NAMESPACE = 2

_AGENT_ID_PATTERN = re.compile(r"\AVC-AGT-\d+\Z", re.IGNORECASE)
_ADVISORY_LOCK_TOKEN_MASK = (1 << 64) - 1
_ADVISORY_LOCK_SIGN_BIT = 1 << 63


class RateLimitKeyConfigurationError(RuntimeError):
    """Raised when required rate-limit key configuration is incomplete."""


class ClientIPResolutionError(RuntimeError):
    """Raised when a trusted client IP cannot be resolved safely."""


@dataclass(frozen=True)
class DigestVersionPair:
    digest: str
    key_version: str


def _normalized_text(value: Any) -> str:
    return unicodedata.normalize("NFKC", str(value)).strip()


def canonicalize_identifier(identifier: Any) -> str:
    """Return a namespaced, deterministic identifier representation."""

    value = _normalized_text(identifier)

    if _AGENT_ID_PATTERN.fullmatch(value):
        return f"identifier:agent:{value.upper()}"

    try:
        normalized_phone = normalize_phone_number(value)
    except (ValidationError, TypeError, ValueError):
        normalized_phone = None

    if normalized_phone is not None:
        return f"identifier:phone:{normalized_phone}"

    return f"identifier:unknown:{value.casefold()}"


def _canonical_ip_object(value: Any) -> str:
    if value is None:
        raise ClientIPResolutionError("Client IP could not be resolved safely.")

    normalized = _normalized_text(value)
    if not normalized:
        raise ClientIPResolutionError("Client IP could not be resolved safely.")

    try:
        parsed = ipaddress.ip_address(normalized)
    except ValueError as exc:
        raise ClientIPResolutionError(
            "Client IP could not be resolved safely."
        ) from exc

    if isinstance(parsed, ipaddress.IPv6Address) and parsed.ipv4_mapped:
        return str(parsed.ipv4_mapped)
    return parsed.compressed


def canonicalize_ip_address(ip_address_value: Any) -> str:
    """Return the canonical IPv4 or IPv6 representation for an IP address."""

    canonical = _canonical_ip_object(ip_address_value)
    version = "4" if "." in canonical else "6"
    return f"ip:{version}:{canonical}"


def _configured_value(name: str, default: Any = "") -> Any:
    return getattr(settings, name, default)


def _configured_text(name: str) -> str:
    value = _configured_value(name, "")
    return "" if value is None else str(value)


def _validate_secret(secret: str, label: str) -> bytes:
    if not secret.strip() or len(secret.encode("utf-8")) < 32:
        raise RateLimitKeyConfigurationError(
            f"{label} must be at least 32 UTF-8 bytes."
        )
    return secret.encode("utf-8")


def _validate_key_version(version: str, label: str) -> str:
    normalized = version.strip()
    if not normalized:
        raise RateLimitKeyConfigurationError(f"{label} must not be empty.")
    if len(normalized) > 32:
        raise RateLimitKeyConfigurationError(
            f"{label} must not exceed 32 characters."
        )
    return normalized


def _key_configuration() -> tuple[bytes, str, bytes | None, str | None]:
    current_secret_value = _configured_text(
        "DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_SECRET"
    )
    current_version_value = _configured_text(
        "DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_KEY_VERSION"
    )
    previous_secret_value = _configured_text(
        "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_SECRET"
    )
    previous_version_value = _configured_text(
        "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_KEY_VERSION"
    )

    if bool(current_secret_value) != bool(current_version_value):
        raise RateLimitKeyConfigurationError(
            "Current rate-limit HMAC secret and key version must be supplied together."
        )
    if not current_secret_value or not current_version_value:
        raise RateLimitKeyConfigurationError(
            "Current rate-limit HMAC configuration is required."
        )
    if bool(previous_secret_value) != bool(previous_version_value):
        raise RateLimitKeyConfigurationError(
            "Previous rate-limit HMAC secret and key version must be supplied together."
        )

    current_secret = _validate_secret(
        current_secret_value,
        "Current rate-limit HMAC secret",
    )
    current_version = _validate_key_version(
        current_version_value,
        "Current rate-limit HMAC key version",
    )

    previous_secret = None
    previous_version = None
    if previous_secret_value and previous_version_value:
        if current_secret_value == previous_secret_value:
            raise RateLimitKeyConfigurationError(
                "Current and previous rate-limit HMAC secrets must differ."
            )
        previous_secret = _validate_secret(
            previous_secret_value,
            "Previous rate-limit HMAC secret",
        )
        previous_version = _validate_key_version(
            previous_version_value,
            "Previous rate-limit HMAC key version",
        )
        if current_version == previous_version:
            raise RateLimitKeyConfigurationError(
                "Current and previous rate-limit HMAC key versions must differ."
            )

    return (
        current_secret,
        str(current_version),
        previous_secret,
        previous_version,
    )


def _digest(canonical_value: str, secret: bytes) -> str:
    return hmac.new(secret, canonical_value.encode("utf-8"), hashlib.sha256).hexdigest()


def _digest_pairs(canonical_value: str) -> tuple[DigestVersionPair, ...]:
    current_secret, current_version, previous_secret, previous_version = (
        _key_configuration()
    )
    pairs = [
        DigestVersionPair(
            digest=_digest(canonical_value, current_secret),
            key_version=current_version,
        )
    ]
    if previous_secret is not None and previous_version is not None:
        pairs.append(
            DigestVersionPair(
                digest=_digest(canonical_value, previous_secret),
                key_version=previous_version,
            )
        )
    return tuple(pairs)


def identifier_digest_pairs(identifier: Any) -> tuple[DigestVersionPair, ...]:
    return _digest_pairs(canonicalize_identifier(identifier))


def ip_digest_pairs(ip_address_value: Any) -> tuple[DigestVersionPair, ...]:
    return _digest_pairs(canonicalize_ip_address(ip_address_value))


def digest_pairs_for_canonical_value(canonical_value: str) -> tuple[DigestVersionPair, ...]:
    """Derive current and previous HMAC digest pairs for an arbitrary canonical value."""
    return _digest_pairs(canonical_value)


def _lock_secret() -> bytes:
    lock_secret_value = _configured_text("DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_SECRET")
    current_secret, _, previous_secret, _ = _key_configuration()

    lock_secret_bytes = _validate_secret(
        lock_secret_value,
        "Rate-limit advisory-lock secret",
    )
    if lock_secret_bytes == current_secret or lock_secret_bytes == previous_secret:
        raise RateLimitKeyConfigurationError(
            "The advisory-lock secret must be separate from HMAC secrets."
        )
    return lock_secret_bytes


def advisory_lock_token(canonical_value: str, namespace: int) -> int:
    """Return a signed 64-bit PostgreSQL advisory-lock token.

    The namespace is included in the HMAC domain and must be 1 for identifier
    locks or 2 for IP locks. The returned value is suitable for PostgreSQL's
    one-argument pg_advisory_xact_lock(bigint) function. The lock secret must
    remain stable across HMAC key rotations and across all application
    instances; changing it requires coordinated maintenance.
    """

    if namespace not in (IDENTIFIER_LOCK_NAMESPACE, IP_LOCK_NAMESPACE):
        raise ValueError("Unsupported advisory-lock namespace.")

    lock_input = f"lock:{namespace}:{canonical_value}"
    digest = hmac.new(
        _lock_secret(),
        lock_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    unsigned_token = int.from_bytes(digest[:8], byteorder="big", signed=False)
    if unsigned_token & _ADVISORY_LOCK_SIGN_BIT:
        return unsigned_token - (_ADVISORY_LOCK_TOKEN_MASK + 1)
    return unsigned_token


def _trusted_proxy_networks() -> tuple[ipaddress.IPv4Network | ipaddress.IPv6Network, ...]:
    configured = _configured_value("DELIVERY_AGENT_LOGIN_TRUSTED_PROXY_CIDRS", [])
    if isinstance(configured, str):
        configured = [part.strip() for part in configured.split(",") if part.strip()]

    networks = []
    for cidr in configured:
        try:
            networks.append(ipaddress.ip_network(str(cidr).strip(), strict=False))
        except ValueError as exc:
            raise ClientIPResolutionError(
                "Trusted proxy configuration is invalid."
            ) from exc
    return tuple(networks)


def resolve_trusted_client_ip(request: Any) -> str:
    """Resolve and canonicalize the client IP using the trusted-proxy policy."""

    meta = getattr(request, "META", None)
    if meta is None:
        raise ClientIPResolutionError("Client IP could not be resolved safely.")

    remote_addr = meta.get("REMOTE_ADDR")
    try:
        remote_ip = ipaddress.ip_address(_normalized_text(remote_addr))
    except (TypeError, ValueError) as exc:
        raise ClientIPResolutionError(
            "Client IP could not be resolved safely."
        ) from exc

    if isinstance(remote_ip, ipaddress.IPv6Address) and remote_ip.ipv4_mapped:
        remote_ip = remote_ip.ipv4_mapped

    trusted_networks = _trusted_proxy_networks()
    if not any(remote_ip in network for network in trusted_networks):
        return _canonical_ip_object(remote_ip)

    forwarded_for = meta.get("HTTP_X_FORWARDED_FOR")
    if not forwarded_for or not str(forwarded_for).strip():
        raise ClientIPResolutionError("Client IP could not be resolved safely.")

    forwarded_addresses = [part.strip() for part in str(forwarded_for).split(",")]
    if not forwarded_addresses or any(not address for address in forwarded_addresses):
        raise ClientIPResolutionError("Client IP could not be resolved safely.")

    try:
        parsed_addresses = [ipaddress.ip_address(address) for address in forwarded_addresses]
    except ValueError as exc:
        raise ClientIPResolutionError(
            "Client IP could not be resolved safely."
        ) from exc

    parsed_addresses = [
        address.ipv4_mapped
        if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped
        else address
        for address in parsed_addresses
    ]

    for address in reversed(parsed_addresses):
        if not any(address in network for network in trusted_networks):
            return _canonical_ip_object(address)

    raise ClientIPResolutionError("Client IP could not be resolved safely.")
