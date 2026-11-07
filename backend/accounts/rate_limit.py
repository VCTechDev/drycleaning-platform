"""PostgreSQL atomic rate-limit service for delivery-agent login challenges."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable

from django.conf import settings
from django.db import DatabaseError, OperationalError, connections, transaction
from django.db.models import Q
from django.http import HttpRequest
from django.utils import timezone

from accounts.models import DeliveryAgentLoginRateLimitEvent
from accounts.rate_limit_keys import (
    IDENTIFIER_LOCK_NAMESPACE,
    IP_LOCK_NAMESPACE,
    ClientIPResolutionError,
    DigestVersionPair,
    RateLimitKeyConfigurationError,
    advisory_lock_token,
    canonicalize_identifier,
    digest_pairs_for_canonical_value,
    identifier_digest_pairs,
    ip_digest_pairs,
    resolve_trusted_client_ip,
)


logger = logging.getLogger("accounts.rate_limit")

IDENTIFIER_15M_LIMIT = 3
IDENTIFIER_24H_LIMIT = 10
IP_15M_LIMIT = 10

IDENTIFIER_15M_WINDOW = timedelta(minutes=15)
IDENTIFIER_24H_WINDOW = timedelta(hours=24)
IP_15M_WINDOW = timedelta(minutes=15)

EMAIL_VERIFY_IDENTIFIER_15M_LIMIT = 3
EMAIL_VERIFY_IDENTIFIER_24H_LIMIT = 10
EMAIL_VERIFY_IP_15M_LIMIT = 10

EMAIL_VERIFY_IDENTIFIER_15M_WINDOW = timedelta(minutes=15)
EMAIL_VERIFY_IDENTIFIER_24H_WINDOW = timedelta(hours=24)
EMAIL_VERIFY_IP_15M_WINDOW = timedelta(minutes=15)

DEFAULT_LOCK_TIMEOUT_MS = 1000
MIN_LOCK_TIMEOUT_MS = 100
MAX_LOCK_TIMEOUT_MS = 5000

_CONFIG_ABSENT = object()


class RateLimitDecision(str, Enum):
    ALLOWED = "ALLOWED"
    BLOCKED = "BLOCKED"
    INTERNAL_FAILURE = "INTERNAL_FAILURE"


@dataclass(frozen=True)
class RateLimitResult:
    decision: RateLimitDecision
    allowed: bool
    status_reason: str
    retry_after_seconds: int | None = None


def _get_lock_timeout_ms() -> int:
    """Retrieve and strictly validate the transaction-local advisory lock timeout.

    Accepts actual integers (excluding booleans) and valid integer strings.
    Rejects floats, booleans, empty strings, decimal strings, and non-integer types.
    Enforces the inclusive range 100–5000 ms.
    Preserves default of 1000 ms when the setting is absent.
    """
    raw = getattr(
        settings,
        "DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_TIMEOUT_MS",
        _CONFIG_ABSENT,
    )
    if raw is _CONFIG_ABSENT:
        return DEFAULT_LOCK_TIMEOUT_MS

    if isinstance(raw, bool):
        raise RateLimitKeyConfigurationError(
            "DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_TIMEOUT_MS cannot be a boolean."
        )

    if isinstance(raw, int):
        val = raw
    elif isinstance(raw, str):
        cleaned = raw.strip()
        if not re.fullmatch(r"[-+]?\d+", cleaned):
            raise RateLimitKeyConfigurationError(
                "DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_TIMEOUT_MS must be a valid integer string."
            )
        val = int(cleaned)
    else:
        raise RateLimitKeyConfigurationError(
            "DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_TIMEOUT_MS must be an integer."
        )

    if not (MIN_LOCK_TIMEOUT_MS <= val <= MAX_LOCK_TIMEOUT_MS):
        raise RateLimitKeyConfigurationError(
            f"DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_TIMEOUT_MS must be between "
            f"{MIN_LOCK_TIMEOUT_MS} and {MAX_LOCK_TIMEOUT_MS} ms."
        )
    return val


def _build_exact_pairs_filter(
    field_prefix: str,
    pairs: tuple[DigestVersionPair, ...],
) -> Q:
    """Construct a Q filter that matches exact (digest, key_version) tuples."""
    digest_field = f"{field_prefix}_key_digest"
    query = Q()
    for pair in pairs:
        query |= Q(**{digest_field: pair.digest, "key_version": pair.key_version})
    return query


def _is_lock_timeout(exc: BaseException) -> bool:
    """Check whether a database exception was caused by a lock timeout."""
    candidates = [exc]
    if hasattr(exc, "__cause__") and exc.__cause__ is not None:
        candidates.append(exc.__cause__)
    if hasattr(exc, "__context__") and exc.__context__ is not None:
        candidates.append(exc.__context__)

    for item in candidates:
        if getattr(item, "pgcode", None) == "55P03":
            return True
        diag = getattr(item, "diag", None)
        if diag is not None and getattr(diag, "sqlstate", None) == "55P03":
            return True
        if "lock timeout" in str(item).lower():
            return True
    return False


def _check_and_record_rate_limit_core(
    request: HttpRequest,
    identifier: Any,
    *,
    purpose: str,
    using: str = "default",
    ident_15m_limit: int = IDENTIFIER_15M_LIMIT,
    ident_24h_limit: int = IDENTIFIER_24H_LIMIT,
    ip_15m_limit: int = IP_15M_LIMIT,
    _db_time_provider: Callable[[], datetime] | None = None,
) -> RateLimitResult:
    """Core outermost atomic transaction service enforcing rate-limit quotas."""
    # -------------------------------------------------------------------------
    # Pre-transaction Phase: Validation and Setup (Protected)
    # -------------------------------------------------------------------------

    # 1. Validate test hook contract if provided
    if _db_time_provider is not None and not callable(_db_time_provider):
        logger.error("Rate-limit database time provider must be a callable")
        return RateLimitResult(
            decision=RateLimitDecision.INTERNAL_FAILURE,
            allowed=False,
            status_reason="configuration_failure",
        )

    # 2. Validate lock timeout configuration
    try:
        timeout_ms = _get_lock_timeout_ms()
    except RateLimitKeyConfigurationError:
        logger.error("Rate-limit lock timeout configuration failure")
        return RateLimitResult(
            decision=RateLimitDecision.INTERNAL_FAILURE,
            allowed=False,
            status_reason="configuration_failure",
        )
    except Exception as exc:
        logger.error(
            "Rate-limit unexpected timeout validation failure: %s",
            exc.__class__.__name__,
        )
        return RateLimitResult(
            decision=RateLimitDecision.INTERNAL_FAILURE,
            allowed=False,
            status_reason="configuration_failure",
        )

    # 3. Resolve trusted client IP
    try:
        canonical_ip = resolve_trusted_client_ip(request)
    except ClientIPResolutionError:
        logger.warning("Rate-limit client IP resolution failed")
        return RateLimitResult(
            decision=RateLimitDecision.INTERNAL_FAILURE,
            allowed=False,
            status_reason="ip_resolution_failed",
        )
    except Exception as exc:
        logger.error(
            "Rate-limit unexpected IP resolution failure: %s",
            exc.__class__.__name__,
        )
        return RateLimitResult(
            decision=RateLimitDecision.INTERNAL_FAILURE,
            allowed=False,
            status_reason="ip_resolution_failed",
        )

    # 4. Canonicalize identifier and derive HMAC pairs and lock tokens
    try:
        canonical_id = canonicalize_identifier(identifier)
        if purpose == "login":
            ident_pairs = identifier_digest_pairs(canonical_id)
            ip_pairs = ip_digest_pairs(canonical_ip)
            ident_token = advisory_lock_token(canonical_id, IDENTIFIER_LOCK_NAMESPACE)
            ip_token = advisory_lock_token(canonical_ip, IP_LOCK_NAMESPACE)
        elif purpose == "email_verify":
            ident_key = f"email_verify:{canonical_id}"
            ip_key = f"email_verify:{canonical_ip}"
            ident_pairs = digest_pairs_for_canonical_value(ident_key)
            ip_pairs = digest_pairs_for_canonical_value(ip_key)
            ident_token = advisory_lock_token(ident_key, IDENTIFIER_LOCK_NAMESPACE)
            ip_token = advisory_lock_token(ip_key, IP_LOCK_NAMESPACE)
        else:
            raise ValueError(f"Unsupported rate limit purpose: {purpose}")

        if not ident_pairs or not ip_pairs:
            raise RateLimitKeyConfigurationError("Missing digest version pairs.")
        current_ident_pair = ident_pairs[0]
        current_ip_pair = ip_pairs[0]
        lock_tokens = sorted(set([ident_token, ip_token]))
    except RateLimitKeyConfigurationError:
        logger.error("Rate-limit HMAC key configuration failure")
        return RateLimitResult(
            decision=RateLimitDecision.INTERNAL_FAILURE,
            allowed=False,
            status_reason="configuration_failure",
        )
    except Exception as exc:
        logger.error(
            "Rate-limit unexpected key derivation failure: %s",
            exc.__class__.__name__,
        )
        return RateLimitResult(
            decision=RateLimitDecision.INTERNAL_FAILURE,
            allowed=False,
            status_reason="configuration_failure",
        )

    # 5. Database connection and outermost transaction preconditions
    try:
        conn = connections[using]
        if conn.vendor != "postgresql":
            logger.error(
                "Rate-limit service requires PostgreSQL; found vendor: %s",
                conn.vendor,
            )
            return RateLimitResult(
                decision=RateLimitDecision.INTERNAL_FAILURE,
                allowed=False,
                status_reason="unsupported_database_vendor",
            )

        if conn.in_atomic_block or not conn.get_autocommit():
            logger.error("Rate-limit service invoked inside existing transaction")
            return RateLimitResult(
                decision=RateLimitDecision.INTERNAL_FAILURE,
                allowed=False,
                status_reason="outermost_transaction_required",
            )
    except DatabaseError as exc:
        logger.error(
            "Rate-limit connection inspection failure: %s",
            exc.__class__.__name__,
        )
        return RateLimitResult(
            decision=RateLimitDecision.INTERNAL_FAILURE,
            allowed=False,
            status_reason="database_failure",
        )
    except Exception as exc:
        logger.error(
            "Rate-limit unexpected setup failure: %s",
            exc.__class__.__name__,
        )
        return RateLimitResult(
            decision=RateLimitDecision.INTERNAL_FAILURE,
            allowed=False,
            status_reason="internal_failure",
        )

    # -------------------------------------------------------------------------
    # Transaction Phase: Execution within outermost transaction.atomic
    # -------------------------------------------------------------------------
    decision = RateLimitDecision.INTERNAL_FAILURE
    status_reason = "internal_failure"
    commit_confirmed = False

    def _on_commit_hook() -> None:
        nonlocal commit_confirmed
        commit_confirmed = True

    try:
        with transaction.atomic(using=using, durable=True):
            with conn.cursor() as cursor:
                # 6a. Guarantee READ COMMITTED isolation level
                cursor.execute("SET TRANSACTION ISOLATION LEVEL READ COMMITTED")
                cursor.execute("SHOW transaction_isolation")
                iso = cursor.fetchone()[0]
                if str(iso).strip().lower() != "read committed":
                    raise RuntimeError(f"Unexpected isolation level: {iso}")

                # 6b. Apply transaction-local lock timeout
                cursor.execute(
                    "SELECT set_config('lock_timeout', %s, true)",
                    [f"{timeout_ms}ms"],
                )

                # 6c. Acquire advisory locks in deterministic sorted order
                for token in lock_tokens:
                    cursor.execute("SELECT pg_advisory_xact_lock(%s)", [token])

                # 6d. Obtain single database clock timestamp
                if _db_time_provider is not None:
                    db_now = _db_time_provider()
                else:
                    cursor.execute("SELECT clock_timestamp()")
                    db_now = cursor.fetchone()[0]

                if not isinstance(db_now, datetime) or not timezone.is_aware(db_now):
                    raise ValueError(
                        "Database timestamp must be a timezone-aware datetime."
                    )

                # 6e. Build matched exact pairs queries
                ident_filter = _build_exact_pairs_filter("identifier", ident_pairs)
                ip_filter = _build_exact_pairs_filter("ip", ip_pairs)

                # Query 1: Identifier 15-minute window
                ident_15m_count = (
                    DeliveryAgentLoginRateLimitEvent.objects.using(using)
                    .filter(
                        ident_filter,
                        created_at__gte=db_now - IDENTIFIER_15M_WINDOW,
                        created_at__lt=db_now,
                    )
                    .count()
                )

                # Query 2: Identifier 24-hour window
                ident_24h_count = (
                    DeliveryAgentLoginRateLimitEvent.objects.using(using)
                    .filter(
                        ident_filter,
                        created_at__gte=db_now - IDENTIFIER_24H_WINDOW,
                        created_at__lt=db_now,
                    )
                    .count()
                )

                # Query 3: IP 15-minute window
                ip_15m_count = (
                    DeliveryAgentLoginRateLimitEvent.objects.using(using)
                    .filter(
                        ip_filter,
                        created_at__gte=db_now - IP_15M_WINDOW,
                        created_at__lt=db_now,
                    )
                    .count()
                )

                # 6f. Quota evaluation
                if ident_15m_count >= ident_15m_limit:
                    decision = RateLimitDecision.BLOCKED
                    status_reason = "identifier_15m_limit_exceeded"
                    transaction.set_rollback(True, using=using)
                elif ident_24h_count >= ident_24h_limit:
                    decision = RateLimitDecision.BLOCKED
                    status_reason = "identifier_24h_limit_exceeded"
                    transaction.set_rollback(True, using=using)
                elif ip_15m_count >= ip_15m_limit:
                    decision = RateLimitDecision.BLOCKED
                    status_reason = "ip_15m_limit_exceeded"
                    transaction.set_rollback(True, using=using)
                else:
                    # 6g. Insert event only when all limits pass
                    DeliveryAgentLoginRateLimitEvent.objects.using(using).create(
                        identifier_key_digest=current_ident_pair.digest,
                        ip_key_digest=current_ip_pair.digest,
                        key_version=current_ident_pair.key_version,
                        created_at=db_now,
                    )
                    transaction.on_commit(_on_commit_hook, using=using)
                    decision = RateLimitDecision.ALLOWED
                    status_reason = "quota_available"

    except RateLimitKeyConfigurationError:
        logger.error("Rate-limit configuration failure inside transaction")
        return RateLimitResult(
            decision=RateLimitDecision.INTERNAL_FAILURE,
            allowed=False,
            status_reason="configuration_failure",
        )
    except OperationalError as exc:
        if _is_lock_timeout(exc):
            logger.error(
                "Rate-limit advisory lock acquisition timed out after configured threshold"
            )
            return RateLimitResult(
                decision=RateLimitDecision.INTERNAL_FAILURE,
                allowed=False,
                status_reason="lock_timeout",
            )
        logger.error("Rate-limit database operational error: %s", exc.__class__.__name__)
        return RateLimitResult(
            decision=RateLimitDecision.INTERNAL_FAILURE,
            allowed=False,
            status_reason="database_failure",
        )
    except DatabaseError as exc:
        logger.error("Rate-limit database failure: %s", exc.__class__.__name__)
        return RateLimitResult(
            decision=RateLimitDecision.INTERNAL_FAILURE,
            allowed=False,
            status_reason="database_failure",
        )
    except RuntimeError as exc:
        logger.error("Rate-limit transaction runtime failure: %s", exc.__class__.__name__)
        return RateLimitResult(
            decision=RateLimitDecision.INTERNAL_FAILURE,
            allowed=False,
            status_reason="transaction_error",
        )
    except Exception as exc:
        logger.error("Rate-limit unexpected failure: %s", exc.__class__.__name__)
        return RateLimitResult(
            decision=RateLimitDecision.INTERNAL_FAILURE,
            allowed=False,
            status_reason="internal_failure",
        )

    # -------------------------------------------------------------------------
    # Post-transaction Phase: Outside the atomic block
    # -------------------------------------------------------------------------
    if decision == RateLimitDecision.BLOCKED:
        logger.warning("Delivery agent rate limit blocked: %s", status_reason)
        return RateLimitResult(
            decision=RateLimitDecision.BLOCKED,
            allowed=False,
            status_reason=status_reason,
        )

    if decision == RateLimitDecision.ALLOWED:
        if not commit_confirmed:
            logger.error("Rate-limit transaction exited without confirmed commit")
            return RateLimitResult(
                decision=RateLimitDecision.INTERNAL_FAILURE,
                allowed=False,
                status_reason="commit_unconfirmed",
            )
        logger.info(
            "Delivery agent rate limit allowed: key_version=%s",
            current_ident_pair.key_version,
        )
        return RateLimitResult(
            decision=RateLimitDecision.ALLOWED,
            allowed=True,
            status_reason=status_reason,
        )

    return RateLimitResult(
        decision=RateLimitDecision.INTERNAL_FAILURE,
        allowed=False,
        status_reason="unexpected_flow_state",
    )


def check_and_record_delivery_agent_login_rate_limit(
    request: HttpRequest,
    identifier: Any,
    *,
    using: str = "default",
    _db_time_provider: Callable[[], datetime] | None = None,
) -> RateLimitResult:
    """Outermost atomic transaction service enforcing delivery-agent login quotas.

    Parameters:
        request: HTTP request used to resolve trusted client IP.
        identifier: Agent ID, phone number, or raw input string.
        using: Django database alias (must be PostgreSQL).
        _db_time_provider: Optional zero-argument callable returning a timezone-aware
                           datetime (Callable[[], datetime]). Used exclusively in tests
                           to provide deterministic clock progression after advisory
                           locks are acquired. In production, this must be None, which
                           executes a single PostgreSQL SELECT clock_timestamp().

    Returns:
        RateLimitResult with decision ALLOWED, BLOCKED, or INTERNAL_FAILURE.
    """
    return _check_and_record_rate_limit_core(
        request=request,
        identifier=identifier,
        purpose="login",
        using=using,
        ident_15m_limit=IDENTIFIER_15M_LIMIT,
        ident_24h_limit=IDENTIFIER_24H_LIMIT,
        ip_15m_limit=IP_15M_LIMIT,
        _db_time_provider=_db_time_provider,
    )


def check_and_record_delivery_agent_email_verify_rate_limit(
    request: HttpRequest,
    identifier: Any,
    *,
    using: str = "default",
    _db_time_provider: Callable[[], datetime] | None = None,
) -> RateLimitResult:
    """Outermost atomic transaction service enforcing delivery-agent email verification quotas.

    Parameters:
        request: HTTP request used to resolve trusted client IP.
        identifier: Agent ID, phone number, email, or raw input string.
        using: Django database alias (must be PostgreSQL).
        _db_time_provider: Optional zero-argument callable returning a timezone-aware
                           datetime (Callable[[], datetime]). Used exclusively in tests
                           to provide deterministic clock progression after advisory
                           locks are acquired. In production, this must be None, which
                           executes a single PostgreSQL SELECT clock_timestamp().

    Returns:
        RateLimitResult with decision ALLOWED, BLOCKED, or INTERNAL_FAILURE.
    """
    return _check_and_record_rate_limit_core(
        request=request,
        identifier=identifier,
        purpose="email_verify",
        using=using,
        ident_15m_limit=EMAIL_VERIFY_IDENTIFIER_15M_LIMIT,
        ident_24h_limit=EMAIL_VERIFY_IDENTIFIER_24H_LIMIT,
        ip_15m_limit=EMAIL_VERIFY_IP_15M_LIMIT,
        _db_time_provider=_db_time_provider,
    )
