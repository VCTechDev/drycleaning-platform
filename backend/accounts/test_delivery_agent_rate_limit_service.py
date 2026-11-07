"""Comprehensive automated tests for PostgreSQL atomic login rate-limit service."""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta, timezone as dt_timezone
from unittest import mock

from django.db import DatabaseError, OperationalError, connection, connections, transaction
from django.http import HttpRequest
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from accounts.models import (
    DeliveryAgentLoginRateLimitEvent,
    PasswordResetOTP,
)
from accounts.rate_limit import (
    IDENTIFIER_15M_LIMIT,
    IDENTIFIER_24H_LIMIT,
    IP_15M_LIMIT,
    RateLimitDecision,
    check_and_record_delivery_agent_login_rate_limit,
)
from accounts.rate_limit_keys import (
    IDENTIFIER_LOCK_NAMESPACE,
    advisory_lock_token,
    canonicalize_identifier,
    identifier_digest_pairs,
    ip_digest_pairs,
)
from logistics.models import DeliveryOTPAuditLog, DeliveryVerificationOTP


TEST_SETTINGS = {
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_SECRET": "current-rate-limit-secret-0123456789",
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_KEY_VERSION": "v2",
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_SECRET": "previous-rate-limit-secret-0123456789",
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_KEY_VERSION": "v1",
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_SECRET": "stable-advisory-lock-secret-0123456789",
    "DELIVERY_AGENT_LOGIN_TRUSTED_PROXY_CIDRS": [],
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_TIMEOUT_MS": 1000,
}


def _make_request(ip: str = "203.0.113.10") -> HttpRequest:
    request = HttpRequest()
    request.META["REMOTE_ADDR"] = ip
    return request


def _seed_event(
    identifier: str,
    ip_address: str,
    created_at: datetime,
    key_version: str = "v2",
    use_previous_digest: bool = False,
) -> DeliveryAgentLoginRateLimitEvent:
    canonical_id = canonicalize_identifier(identifier)
    id_pairs = identifier_digest_pairs(canonical_id)
    ip_pairs = ip_digest_pairs(ip_address)

    pair_idx = 1 if (use_previous_digest and len(id_pairs) > 1) else 0
    return DeliveryAgentLoginRateLimitEvent.objects.create(
        identifier_key_digest=id_pairs[pair_idx].digest,
        ip_key_digest=ip_pairs[pair_idx].digest,
        key_version=key_version,
        created_at=created_at,
    )


# =============================================================================
# Step 2: Core Quota Tests
# =============================================================================

@override_settings(**TEST_SETTINGS)
class DeliveryAgentRateLimitQuotaTests(TransactionTestCase):
    def setUp(self):
        super().setUp()
        DeliveryAgentLoginRateLimitEvent.objects.all().delete()
        self.identifier = "VC-AGT-00001"
        self.ip = "203.0.113.10"

    def test_identifier_15_minute_limit(self):
        """First 3 requests within 15 minutes are allowed; 4th is blocked."""
        req = _make_request(self.ip)

        res1 = check_and_record_delivery_agent_login_rate_limit(req, self.identifier)
        self.assertEqual(res1.decision, RateLimitDecision.ALLOWED)
        self.assertTrue(res1.allowed)
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 1)

        res2 = check_and_record_delivery_agent_login_rate_limit(req, self.identifier)
        self.assertEqual(res2.decision, RateLimitDecision.ALLOWED)
        self.assertTrue(res2.allowed)
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 2)

        res3 = check_and_record_delivery_agent_login_rate_limit(req, self.identifier)
        self.assertEqual(res3.decision, RateLimitDecision.ALLOWED)
        self.assertTrue(res3.allowed)
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 3)

        res4 = check_and_record_delivery_agent_login_rate_limit(req, self.identifier)
        self.assertEqual(res4.decision, RateLimitDecision.BLOCKED)
        self.assertFalse(res4.allowed)
        self.assertEqual(res4.status_reason, "identifier_15m_limit_exceeded")
        # Blocked request must not create an event
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 3)

    def test_identifier_24_hour_limit_with_approved_schedule(self):
        """10 requests across approved schedule are allowed; 11th request is blocked.

        Approved schedule:
            Req 1: 12:00, Req 2: 12:01, Req 3: 12:02
            Req 4: 12:20, Req 5: 12:21, Req 6: 12:22
            Req 7: 12:40, Req 8: 12:41, Req 9: 12:42
            Req 10: 13:00
            Req 11: 13:20 (blocked)
        """
        base_time = datetime(2026, 11, 4, 12, 0, 0, tzinfo=dt_timezone.utc)
        schedule = [
            base_time,                         # Req 1:  12:00
            base_time + timedelta(minutes=1),  # Req 2:  12:01
            base_time + timedelta(minutes=2),  # Req 3:  12:02
            base_time + timedelta(minutes=20), # Req 4:  12:20
            base_time + timedelta(minutes=21), # Req 5:  12:21
            base_time + timedelta(minutes=22), # Req 6:  12:22
            base_time + timedelta(minutes=40), # Req 7:  12:40
            base_time + timedelta(minutes=41), # Req 8:  12:41
            base_time + timedelta(minutes=42), # Req 9:  12:42
            base_time + timedelta(minutes=60), # Req 10: 13:00
            base_time + timedelta(minutes=80), # Req 11: 13:20
        ]

        req = _make_request(self.ip)

        # Requests 1 to 10 must be ALLOWED
        for i in range(10):
            current_time = schedule[i]
            res = check_and_record_delivery_agent_login_rate_limit(
                req,
                self.identifier,
                _db_time_provider=lambda t=current_time: t,
            )
            self.assertEqual(
                res.decision,
                RateLimitDecision.ALLOWED,
                f"Request {i+1} at {current_time} should be ALLOWED",
            )
            self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), i + 1)

        # Request 11 must be BLOCKED by 24h limit (not 15m limit)
        res11 = check_and_record_delivery_agent_login_rate_limit(
            req,
            self.identifier,
            _db_time_provider=lambda: schedule[10],
        )
        self.assertEqual(res11.decision, RateLimitDecision.BLOCKED)
        self.assertFalse(res11.allowed)
        self.assertEqual(res11.status_reason, "identifier_24h_limit_exceeded")
        # Blocked request does not create an event
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 10)

    def test_ip_15_minute_limit(self):
        """10 requests from 10 distinct identifiers from same IP are allowed; 11th is blocked."""
        req = _make_request("203.0.113.55")

        for i in range(10):
            ident = f"agent-distinct-{i+1}"
            res = check_and_record_delivery_agent_login_rate_limit(req, ident)
            self.assertEqual(res.decision, RateLimitDecision.ALLOWED)
            self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), i + 1)

        # 11th request from same IP with an 11th distinct identifier
        res11 = check_and_record_delivery_agent_login_rate_limit(req, "agent-distinct-11")
        self.assertEqual(res11.decision, RateLimitDecision.BLOCKED)
        self.assertFalse(res11.allowed)
        self.assertEqual(res11.status_reason, "ip_15m_limit_exceeded")
        # Event count remains 10
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 10)

    def test_unknown_and_ineligible_identifiers_consume_quota(self):
        """Unknown or invalid identifiers consume quota without needing user accounts."""
        req = _make_request("203.0.113.60")
        unknown_id = "arbitrary_random_string_9999"

        # 1st attempt with unknown identifier
        res1 = check_and_record_delivery_agent_login_rate_limit(req, unknown_id)
        self.assertEqual(res1.decision, RateLimitDecision.ALLOWED)
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 1)

        # 2nd attempt
        res2 = check_and_record_delivery_agent_login_rate_limit(req, unknown_id)
        self.assertEqual(res2.decision, RateLimitDecision.ALLOWED)

        # 3rd attempt
        res3 = check_and_record_delivery_agent_login_rate_limit(req, unknown_id)
        self.assertEqual(res3.decision, RateLimitDecision.ALLOWED)

        # 4th attempt is blocked
        res4 = check_and_record_delivery_agent_login_rate_limit(req, unknown_id)
        self.assertEqual(res4.decision, RateLimitDecision.BLOCKED)
        self.assertEqual(res4.status_reason, "identifier_15m_limit_exceeded")
        # Ensure count remains 3 and lockout is not extended by blocked request
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 3)


# =============================================================================
# Step 3: Rolling-Window Boundary Tests
# =============================================================================

@override_settings(**TEST_SETTINGS)
class DeliveryAgentRateLimitWindowBoundaryTests(TransactionTestCase):
    def setUp(self):
        super().setUp()
        DeliveryAgentLoginRateLimitEvent.objects.all().delete()
        self.identifier = "VC-AGT-BOUNDARY"
        self.ip = "203.0.113.70"
        self.req = _make_request(self.ip)
        self.db_now = datetime(2026, 11, 4, 12, 15, 0, tzinfo=dt_timezone.utc)

    def test_15m_window_lower_bound_is_inclusive(self):
        """An event exactly at db_now - 15 minutes is included in quota."""
        exact_lower_bound = self.db_now - timedelta(minutes=15)
        # Pre-seed 2 events inside window and 1 exactly at lower bound
        _seed_event(self.identifier, self.ip, exact_lower_bound)
        _seed_event(self.identifier, self.ip, self.db_now - timedelta(minutes=10))
        _seed_event(self.identifier, self.ip, self.db_now - timedelta(minutes=5))

        res = check_and_record_delivery_agent_login_rate_limit(
            self.req,
            self.identifier,
            _db_time_provider=lambda: self.db_now,
        )
        self.assertEqual(res.decision, RateLimitDecision.BLOCKED)
        self.assertEqual(res.status_reason, "identifier_15m_limit_exceeded")

    def test_15m_window_event_before_lower_bound_is_excluded(self):
        """An event immediately before db_now - 15 minutes is excluded from quota."""
        before_lower_bound = self.db_now - timedelta(minutes=15, microseconds=1)
        # Pre-seed 1 event just outside lower bound, and 2 events inside window
        _seed_event(self.identifier, self.ip, before_lower_bound)
        _seed_event(self.identifier, self.ip, self.db_now - timedelta(minutes=10))
        _seed_event(self.identifier, self.ip, self.db_now - timedelta(minutes=5))

        res = check_and_record_delivery_agent_login_rate_limit(
            self.req,
            self.identifier,
            _db_time_provider=lambda: self.db_now,
        )
        # Only 2 events inside window -> 3rd request should be ALLOWED
        self.assertEqual(res.decision, RateLimitDecision.ALLOWED)

    def test_15m_window_upper_bound_is_exclusive(self):
        """An event exactly at db_now is excluded by upper bound [start, db_now)."""
        # Pre-seed 3 events exactly at db_now (e.g. from concurrent transactions)
        _seed_event(self.identifier, self.ip, self.db_now)
        _seed_event(self.identifier, self.ip, self.db_now)
        _seed_event(self.identifier, self.ip, self.db_now)

        res = check_and_record_delivery_agent_login_rate_limit(
            self.req,
            self.identifier,
            _db_time_provider=lambda: self.db_now,
        )
        # created_at < db_now excludes events at db_now -> should be ALLOWED
        self.assertEqual(res.decision, RateLimitDecision.ALLOWED)

    def test_24h_window_lower_bound_is_inclusive(self):
        """An event exactly at db_now - 24 hours is included in quota."""
        ref_time = datetime(2026, 11, 4, 12, 0, 0, tzinfo=dt_timezone.utc)
        exact_24h_lower = ref_time - timedelta(hours=24)

        _seed_event(self.identifier, self.ip, exact_24h_lower)
        for h in range(1, 10):
            _seed_event(self.identifier, self.ip, ref_time - timedelta(hours=h))

        res = check_and_record_delivery_agent_login_rate_limit(
            self.req,
            self.identifier,
            _db_time_provider=lambda: ref_time,
        )
        self.assertEqual(res.decision, RateLimitDecision.BLOCKED)
        self.assertEqual(res.status_reason, "identifier_24h_limit_exceeded")

    def test_24h_window_event_before_lower_bound_is_excluded(self):
        """An event immediately before db_now - 24 hours is excluded from quota."""
        ref_time = datetime(2026, 11, 4, 12, 0, 0, tzinfo=dt_timezone.utc)
        before_24h_lower = ref_time - timedelta(hours=24, microseconds=1)

        _seed_event(self.identifier, self.ip, before_24h_lower)
        for h in range(1, 10):
            _seed_event(self.identifier, self.ip, ref_time - timedelta(hours=h))

        res = check_and_record_delivery_agent_login_rate_limit(
            self.req,
            self.identifier,
            _db_time_provider=lambda: ref_time,
        )
        # Exactly 9 events inside window -> 10th request is ALLOWED
        self.assertEqual(res.decision, RateLimitDecision.ALLOWED)

    def test_db_time_provider_is_invoked_exactly_once(self):
        """The test hook _db_time_provider must be called exactly once per invocation."""
        call_count = 0

        def counting_provider() -> datetime:
            nonlocal call_count
            call_count += 1
            return self.db_now

        res = check_and_record_delivery_agent_login_rate_limit(
            self.req,
            self.identifier,
            _db_time_provider=counting_provider,
        )
        self.assertEqual(res.decision, RateLimitDecision.ALLOWED)
        self.assertEqual(call_count, 1)


# =============================================================================
# Step 4: HMAC Key-Version Tests
# =============================================================================

@override_settings(**TEST_SETTINGS)
class DeliveryAgentRateLimitHMACKeyVersionTests(TransactionTestCase):
    def setUp(self):
        super().setUp()
        DeliveryAgentLoginRateLimitEvent.objects.all().delete()
        self.identifier = "VC-AGT-KEYVERSION"
        self.ip = "203.0.113.80"
        self.req = _make_request(self.ip)
        self.now = timezone.now()

    def test_current_key_version_matches_existing_events(self):
        """Events under current key version v2 match during quota evaluation."""
        _seed_event(self.identifier, self.ip, self.now - timedelta(minutes=5), key_version="v2")
        _seed_event(self.identifier, self.ip, self.now - timedelta(minutes=3), key_version="v2")
        _seed_event(self.identifier, self.ip, self.now - timedelta(minutes=1), key_version="v2")

        res = check_and_record_delivery_agent_login_rate_limit(self.req, self.identifier)
        self.assertEqual(res.decision, RateLimitDecision.BLOCKED)
        self.assertEqual(res.status_reason, "identifier_15m_limit_exceeded")

    def test_previous_key_version_matches_during_rotation(self):
        """Events created under previous key version v1 match when previous secret is configured."""
        _seed_event(
            self.identifier,
            self.ip,
            self.now - timedelta(minutes=5),
            key_version="v1",
            use_previous_digest=True,
        )
        _seed_event(
            self.identifier,
            self.ip,
            self.now - timedelta(minutes=3),
            key_version="v1",
            use_previous_digest=True,
        )
        _seed_event(
            self.identifier,
            self.ip,
            self.now - timedelta(minutes=1),
            key_version="v1",
            use_previous_digest=True,
        )

        res = check_and_record_delivery_agent_login_rate_limit(self.req, self.identifier)
        self.assertEqual(res.decision, RateLimitDecision.BLOCKED)
        self.assertEqual(res.status_reason, "identifier_15m_limit_exceeded")

    def test_exact_digest_version_pairs_reject_cross_combinations(self):
        """Cross-pair matches (current digest with previous version, etc.) must NOT match."""
        canonical_id = canonicalize_identifier(self.identifier)
        id_pairs = identifier_digest_pairs(canonical_id)
        ip_pairs = ip_digest_pairs(self.ip)

        curr_id_digest, curr_v = id_pairs[0].digest, id_pairs[0].key_version
        prev_id_digest, prev_v = id_pairs[1].digest, id_pairs[1].key_version
        curr_ip_digest = ip_pairs[0].digest

        # Cross-combination 1: current digest with previous version (curr_digest, 'v1')
        DeliveryAgentLoginRateLimitEvent.objects.create(
            identifier_key_digest=curr_id_digest,
            ip_key_digest=curr_ip_digest,
            key_version=prev_v,
            created_at=self.now - timedelta(minutes=5),
        )
        # Cross-combination 2: previous digest with current version (prev_digest, 'v2')
        DeliveryAgentLoginRateLimitEvent.objects.create(
            identifier_key_digest=prev_id_digest,
            ip_key_digest=curr_ip_digest,
            key_version=curr_v,
            created_at=self.now - timedelta(minutes=3),
        )

        res = check_and_record_delivery_agent_login_rate_limit(self.req, self.identifier)
        # Neither cross-pair should match -> quota count is 0 -> ALLOWED
        self.assertEqual(res.decision, RateLimitDecision.ALLOWED)

    def test_new_events_use_current_digest_and_key_version(self):
        """New events inserted by service must use current digest and current key version."""
        res = check_and_record_delivery_agent_login_rate_limit(self.req, self.identifier)
        self.assertEqual(res.decision, RateLimitDecision.ALLOWED)

        event = DeliveryAgentLoginRateLimitEvent.objects.latest("id")
        self.assertEqual(event.key_version, "v2")

        expected_id_digest = identifier_digest_pairs(canonicalize_identifier(self.identifier))[0].digest
        expected_ip_digest = ip_digest_pairs(self.ip)[0].digest
        self.assertEqual(event.identifier_key_digest, expected_id_digest)
        self.assertEqual(event.ip_key_digest, expected_ip_digest)


# =============================================================================
# Step 5: Transaction and Rollback Tests
# =============================================================================

@override_settings(**TEST_SETTINGS)
class DeliveryAgentRateLimitTransactionRollbackTests(TransactionTestCase):
    def setUp(self):
        super().setUp()
        DeliveryAgentLoginRateLimitEvent.objects.all().delete()
        self.identifier = "VC-AGT-TXTEST"
        self.ip = "203.0.113.90"
        self.req = _make_request(self.ip)

    def test_blocked_request_rolls_back_and_inserts_no_event(self):
        """When quota is exceeded, transaction is rolled back and no row is inserted."""
        now = timezone.now()
        _seed_event(self.identifier, self.ip, now - timedelta(minutes=5))
        _seed_event(self.identifier, self.ip, now - timedelta(minutes=3))
        _seed_event(self.identifier, self.ip, now - timedelta(minutes=1))

        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 3)
        res = check_and_record_delivery_agent_login_rate_limit(self.req, self.identifier)

        self.assertEqual(res.decision, RateLimitDecision.BLOCKED)
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 3)

    def test_allowed_request_persists_exactly_one_event_on_commit(self):
        """Allowed request commits and persists exactly one new event."""
        initial_count = DeliveryAgentLoginRateLimitEvent.objects.count()
        res = check_and_record_delivery_agent_login_rate_limit(self.req, self.identifier)

        self.assertEqual(res.decision, RateLimitDecision.ALLOWED)
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), initial_count + 1)

    def test_insertion_failure_rolls_back_and_fails_closed(self):
        """Database error during event insertion rolls back and returns INTERNAL_FAILURE."""
        with mock.patch.object(
            DeliveryAgentLoginRateLimitEvent.objects,
            "using",
            side_effect=DatabaseError("Simulated disk error"),
        ):
            res = check_and_record_delivery_agent_login_rate_limit(self.req, self.identifier)
            self.assertEqual(res.decision, RateLimitDecision.INTERNAL_FAILURE)
            self.assertFalse(res.allowed)
            self.assertEqual(res.status_reason, "database_failure")

        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 0)

    def test_invocation_inside_existing_transaction_fails_closed(self):
        """Service requires outermost transaction; calling inside atomic fails closed."""
        with transaction.atomic():
            res = check_and_record_delivery_agent_login_rate_limit(self.req, self.identifier)
            self.assertEqual(res.decision, RateLimitDecision.INTERNAL_FAILURE)
            self.assertFalse(res.allowed)
            self.assertEqual(res.status_reason, "outermost_transaction_required")

        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 0)

    def test_non_postgresql_vendor_fails_closed(self):
        """Non-PostgreSQL database vendor is rejected immediately."""
        with mock.patch.object(connections["default"], "vendor", "sqlite"):
            res = check_and_record_delivery_agent_login_rate_limit(self.req, self.identifier)
            self.assertEqual(res.decision, RateLimitDecision.INTERNAL_FAILURE)
            self.assertEqual(res.status_reason, "unsupported_database_vendor")


# =============================================================================
# Step 6: Concurrency Tests (Real PostgreSQL Connections)
# =============================================================================

@override_settings(**TEST_SETTINGS)
class DeliveryAgentRateLimitConcurrencyTests(TransactionTestCase):
    """Concurrency tests using independent PostgreSQL database connections and thread barriers."""

    def setUp(self):
        super().setUp()
        DeliveryAgentLoginRateLimitEvent.objects.all().delete()

    def _execute_concurrently(
        self,
        task1,
        task2,
        provider_barrier: threading.Barrier | None = None,
    ):
        start_barrier = threading.Barrier(2)
        errors = []
        results = [None, None]

        def _abort_barriers():
            """Abort barriers to release any threads waiting at them.

            Note: Aborting a barrier causes waiting threads to raise BrokenBarrierError,
            releasing them immediately. It does not terminate a worker actively executing
            code or database operations outside of a barrier wait.
            """
            try:
                start_barrier.abort()
            except Exception:
                pass
            if provider_barrier is not None:
                try:
                    provider_barrier.abort()
                except Exception:
                    pass

        def worker1():
            try:
                start_barrier.wait(timeout=5)
                results[0] = task1()
            except Exception as exc:
                errors.append(exc)
                _abort_barriers()
            finally:
                connections.close_all()

        def worker2():
            try:
                start_barrier.wait(timeout=5)
                results[1] = task2()
            except Exception as exc:
                errors.append(exc)
                _abort_barriers()
            finally:
                connections.close_all()

        t1 = threading.Thread(target=worker1, name="ConcurrentWorker1")
        t2 = threading.Thread(target=worker2, name="ConcurrentWorker2")

        try:
            t1.start()
            t2.start()

            # Initial bounded join
            t1.join(timeout=5)
            t2.join(timeout=5)

            # If either worker is still alive, abort barriers to release any waiting worker
            if t1.is_alive() or t2.is_alive():
                _abort_barriers()
                # Second bounded join opportunity after barrier abort
                t1.join(timeout=5)
                t2.join(timeout=5)

            alive_workers = [t.name for t in (t1, t2) if t.is_alive()]
            if alive_workers:
                self.fail(
                    f"Worker thread(s) {', '.join(alive_workers)} failed to terminate "
                    f"after barrier abort and bounded cleanup."
                )
        finally:
            _abort_barriers()

        if errors:
            raise AssertionError(
                f"Worker thread encountered an exception: {errors[0]}"
            ) from errors[0]

        self.assertIsNotNone(
            results[0],
            "Worker thread 1 terminated without returning a result.",
        )
        self.assertIsNotNone(
            results[1],
            "Worker thread 2 terminated without returning a result.",
        )

        return results[0], results[1]

    def test_concurrency_scenario_a_same_identifier_same_ip(self):
        """Scenario A: Same ID, same IP - both locks serialize requests; exactly one allowed."""
        ident = "VC-AGT-CONCUR-A"
        ip = "203.0.113.101"
        now = timezone.now()

        # Pre-seed 2 events (limit is 3)
        _seed_event(ident, ip, now - timedelta(minutes=5))
        _seed_event(ident, ip, now - timedelta(minutes=3))
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 2)

        req1 = _make_request(ip)
        req2 = _make_request(ip)

        res1, res2 = self._execute_concurrently(
            lambda: check_and_record_delivery_agent_login_rate_limit(req1, ident),
            lambda: check_and_record_delivery_agent_login_rate_limit(req2, ident),
        )

        decisions = sorted([res1.decision, res2.decision])
        self.assertEqual(decisions, [RateLimitDecision.ALLOWED, RateLimitDecision.BLOCKED])
        # Exactly 3 events exist (the blocked request inserted no event)
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 3)

    def test_concurrency_scenario_b_same_identifier_different_ips(self):
        """Scenario B: Same ID, different IPs - identifier lock serializes; exactly one allowed."""
        ident = "VC-AGT-CONCUR-B"
        ip1 = "203.0.113.102"
        ip2 = "203.0.113.103"
        now = timezone.now()

        # Pre-seed 2 events for this identifier across different IPs (limit is 3)
        _seed_event(ident, ip1, now - timedelta(minutes=5))
        _seed_event(ident, ip2, now - timedelta(minutes=3))
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 2)

        req1 = _make_request(ip1)
        req2 = _make_request(ip2)

        res1, res2 = self._execute_concurrently(
            lambda: check_and_record_delivery_agent_login_rate_limit(req1, ident),
            lambda: check_and_record_delivery_agent_login_rate_limit(req2, ident),
        )

        decisions = sorted([res1.decision, res2.decision])
        self.assertEqual(decisions, [RateLimitDecision.ALLOWED, RateLimitDecision.BLOCKED])
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 3)

    def test_concurrency_scenario_c_different_identifiers_same_ip(self):
        """Scenario C: Different IDs, same IP - IP lock serializes; exactly one allowed."""
        ip = "203.0.113.104"
        ident1 = "VC-AGT-CONCUR-C1"
        ident2 = "VC-AGT-CONCUR-C2"
        now = timezone.now()

        # Pre-seed 9 events from this IP (limit is 10)
        for i in range(9):
            _seed_event(f"agent-pre-c-{i}", ip, now - timedelta(minutes=i + 1))
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 9)

        req1 = _make_request(ip)
        req2 = _make_request(ip)

        res1, res2 = self._execute_concurrently(
            lambda: check_and_record_delivery_agent_login_rate_limit(req1, ident1),
            lambda: check_and_record_delivery_agent_login_rate_limit(req2, ident2),
        )

        decisions = sorted([res1.decision, res2.decision])
        self.assertEqual(decisions, [RateLimitDecision.ALLOWED, RateLimitDecision.BLOCKED])
        # Exactly 10 events exist
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 10)

    def test_concurrency_scenario_d_different_identifiers_different_ips(self):
        """Scenario D: Different IDs, different IPs - disjoint locks held simultaneously."""
        ident1 = "VC-AGT-CONCUR-D1"
        ip1 = "203.0.113.105"
        ident2 = "VC-AGT-CONCUR-D2"
        ip2 = "203.0.113.106"

        req1 = _make_request(ip1)
        req2 = _make_request(ip2)

        # Provider barrier synchronizes threads inside their transactions AFTER acquiring locks
        provider_barrier = threading.Barrier(2)
        ref_time = timezone.now()

        def provider1() -> datetime:
            provider_barrier.wait(timeout=5)
            return ref_time

        def provider2() -> datetime:
            provider_barrier.wait(timeout=5)
            return ref_time

        res1, res2 = self._execute_concurrently(
            lambda: check_and_record_delivery_agent_login_rate_limit(
                req1, ident1, _db_time_provider=provider1
            ),
            lambda: check_and_record_delivery_agent_login_rate_limit(
                req2, ident2, _db_time_provider=provider2
            ),
            provider_barrier=provider_barrier,
        )

        self.assertEqual(res1.decision, RateLimitDecision.ALLOWED)
        self.assertTrue(res1.allowed)
        self.assertEqual(res2.decision, RateLimitDecision.ALLOWED)
        self.assertTrue(res2.allowed)
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 2)


# =============================================================================
# Step 7: Lock Timeout and Database Failure Tests
# =============================================================================

@override_settings(**TEST_SETTINGS)
class DeliveryAgentRateLimitFailureAndTimeoutTests(TransactionTestCase):
    def setUp(self):
        super().setUp()
        DeliveryAgentLoginRateLimitEvent.objects.all().delete()
        self.identifier = "VC-AGT-TIMEOUT"
        self.ip = "203.0.113.110"
        self.req = _make_request(self.ip)

    def test_advisory_lock_timeout_fails_closed(self):
        """When another connection holds advisory lock, service times out and fails closed."""
        canonical_id = canonicalize_identifier(self.identifier)
        token = advisory_lock_token(canonical_id, IDENTIFIER_LOCK_NAMESPACE)

        aux_conn = connections["default"]
        lock_acquired = False
        try:
            with aux_conn.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_lock(%s)", [token])
            lock_acquired = True

            results = []
            worker_errors = []

            def call_service():
                try:
                    with override_settings(DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_TIMEOUT_MS=200):
                        results.append(
                            check_and_record_delivery_agent_login_rate_limit(self.req, self.identifier)
                        )
                except Exception as exc:
                    worker_errors.append(exc)
                finally:
                    connections.close_all()

            thread = threading.Thread(target=call_service, name="TimeoutWorker")
            thread.start()
            thread.join(timeout=5)

            if thread.is_alive():
                # Worker is still waiting or executing; release advisory lock to remove contention
                if lock_acquired:
                    try:
                        with aux_conn.cursor() as cursor:
                            cursor.execute("SELECT pg_advisory_unlock(%s)", [token])
                    except Exception:
                        pass
                    lock_acquired = False

                # Second bounded join opportunity
                thread.join(timeout=5)

                if thread.is_alive():
                    self.fail(
                        "Timeout worker thread failed to terminate after advisory lock release "
                        "and bounded cleanup."
                    )

            if worker_errors:
                raise AssertionError(
                    f"Timeout worker thread failed with exception: {worker_errors[0]}"
                ) from worker_errors[0]

            self.assertEqual(len(results), 1)
            res = results[0]
            self.assertEqual(res.decision, RateLimitDecision.INTERNAL_FAILURE)
            self.assertEqual(res.status_reason, "lock_timeout")
            self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 0)
        finally:
            if lock_acquired:
                try:
                    with aux_conn.cursor() as cursor:
                        cursor.execute("SELECT pg_advisory_unlock(%s)", [token])
                except Exception:
                    pass
                lock_acquired = False
            aux_conn.close()

        # Confirm the auxiliary connection is closed cleanly
        self.assertIsNone(aux_conn.connection, "Auxiliary connection should be cleanly closed.")

    def test_database_error_during_quota_query_fails_closed(self):
        """Database error during count queries fails closed with database_failure."""
        with mock.patch(
            "accounts.models.DeliveryAgentLoginRateLimitEvent.objects.using"
        ) as mock_using:
            mock_using.return_value.filter.return_value.count.side_effect = DatabaseError("Query syntax error")
            res = check_and_record_delivery_agent_login_rate_limit(self.req, self.identifier)
            self.assertEqual(res.decision, RateLimitDecision.INTERNAL_FAILURE)
            self.assertEqual(res.status_reason, "database_failure")

    def test_database_error_during_event_insertion_fails_closed(self):
        """OperationalError during event insertion fails closed and leaves no event."""
        with mock.patch(
            "accounts.models.DeliveryAgentLoginRateLimitEvent.objects.using"
        ) as mock_using:
            mock_using.return_value.filter.return_value.count.return_value = 0
            mock_using.return_value.create.side_effect = OperationalError("Disk full")
            res = check_and_record_delivery_agent_login_rate_limit(self.req, self.identifier)
            self.assertEqual(res.decision, RateLimitDecision.INTERNAL_FAILURE)
            self.assertEqual(res.status_reason, "database_failure")

    def test_unconfirmed_commit_fails_closed(self):
        """If on_commit hook does not fire (ambiguous commit), service fails closed."""
        with mock.patch("django.db.transaction.on_commit") as mock_on_commit:
            mock_on_commit.return_value = None
            res = check_and_record_delivery_agent_login_rate_limit(self.req, self.identifier)
            self.assertEqual(res.decision, RateLimitDecision.INTERNAL_FAILURE)
            self.assertEqual(res.status_reason, "commit_unconfirmed")


# =============================================================================
# Step 8: Security and Isolation Tests
# =============================================================================

@override_settings(**TEST_SETTINGS)
class DeliveryAgentRateLimitSecurityAndIsolationTests(TransactionTestCase):
    def setUp(self):
        super().setUp()
        DeliveryAgentLoginRateLimitEvent.objects.all().delete()
        self.raw_identifier = "+919876543210"
        self.raw_ip = "203.0.113.120"
        self.req = _make_request(self.raw_ip)

    def test_raw_identifiers_and_ips_are_not_persisted(self):
        """Event rows must only contain HMAC digests, key version, and created_at."""
        res = check_and_record_delivery_agent_login_rate_limit(self.req, self.raw_identifier)
        self.assertEqual(res.decision, RateLimitDecision.ALLOWED)

        event = DeliveryAgentLoginRateLimitEvent.objects.latest("id")
        self.assertRegex(event.identifier_key_digest, r"\A[0-9a-f]{64}\Z")
        self.assertRegex(event.ip_key_digest, r"\A[0-9a-f]{64}\Z")
        self.assertEqual(event.key_version, "v2")

        # Raw values must NOT appear in the database columns
        self.assertNotIn(self.raw_identifier, event.identifier_key_digest)
        self.assertNotIn(self.raw_ip, event.ip_key_digest)

    def test_service_does_not_query_user_or_delivery_agent_tables(self):
        """The rate-limit service must be independent of user and delivery_agent tables."""
        res = check_and_record_delivery_agent_login_rate_limit(self.req, self.raw_identifier)
        self.assertEqual(res.decision, RateLimitDecision.ALLOWED)

        for query_info in connection.queries:
            sql = query_info["sql"].lower()
            self.assertNotIn("users_user", sql)
            self.assertNotIn("logistics_deliveryagent", sql)

    def test_safe_logging_never_emits_sensitive_data(self):
        """Log messages must never leak raw identifiers, raw IPs, secrets, or HMAC digests."""
        logger = logging.getLogger("accounts.rate_limit")
        with self.assertLogs(logger, level="INFO") as cm:
            # Allowed call
            check_and_record_delivery_agent_login_rate_limit(self.req, self.raw_identifier)

            # Pre-seed to trigger Blocked call
            now = timezone.now()
            _seed_event(self.raw_identifier, self.raw_ip, now - timedelta(minutes=5))
            _seed_event(self.raw_identifier, self.raw_ip, now - timedelta(minutes=3))
            check_and_record_delivery_agent_login_rate_limit(self.req, self.raw_identifier)

        id_digest = identifier_digest_pairs(canonicalize_identifier(self.raw_identifier))[0].digest
        ip_digest = ip_digest_pairs(self.raw_ip)[0].digest

        for log_entry in cm.output:
            self.assertNotIn(self.raw_identifier, log_entry)
            self.assertNotIn(self.raw_ip, log_entry)
            self.assertNotIn(id_digest, log_entry)
            self.assertNotIn(ip_digest, log_entry)
            self.assertNotIn("current-rate-limit-secret-0123456789", log_entry)
            self.assertNotIn("stable-advisory-lock-secret-0123456789", log_entry)

    def test_existing_otp_models_remain_isolated_and_unaffected(self):
        """Existing password reset and delivery verification models are unaffected."""
        existing_models = (
            PasswordResetOTP,
            DeliveryVerificationOTP,
            DeliveryOTPAuditLog,
        )
        for model in existing_models:
            related_models = {
                field.related_model
                for field in model._meta.get_fields()
                if field.is_relation and hasattr(field, "related_model")
            }
            self.assertNotIn(DeliveryAgentLoginRateLimitEvent, related_models)
