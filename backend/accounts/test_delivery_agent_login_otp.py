"""Automated tests for delivery agent email OTP authentication."""

from __future__ import annotations

import hashlib
import hmac
import io
import logging
import re
import secrets
import threading
from datetime import time, timedelta
from unittest import mock

from django.core import mail
from django.db import connection, connections
from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import (
    DeliveryAgentLoginChallenge,
    DeliveryAgentLoginRateLimitEvent,
    PasswordResetOTP,
)
from accounts.rate_limit import RateLimitDecision, RateLimitResult
from accounts.rate_limit_keys import ClientIPResolutionError
from accounts.views.auth import (
    ChallengeSecretConfigurationError,
    compute_challenge_id_digest,
    get_challenge_id_secret,
)
from logistics.models import DeliveryAgent
from shops.models import Shop
from users.models import User


TEST_SETTINGS = {
    "DELIVERY_AGENT_LOGIN_CHALLENGE_ID_SECRET": "dedicated-challenge-id-secret-0123456789-32bytes",
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_SECRET": "current-rate-limit-secret-0123456789",
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_KEY_VERSION": "v2",
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_SECRET": "previous-rate-limit-secret-0123456789",
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_PREVIOUS_HMAC_KEY_VERSION": "v1",
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_SECRET": "stable-advisory-lock-secret-0123456789",
    "DELIVERY_AGENT_LOGIN_TRUSTED_PROXY_CIDRS": [],
    "DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_TIMEOUT_MS": 1000,
    "EMAIL_BACKEND": "django.core.mail.backends.locmem.EmailBackend",
}

REQUEST_OTP_URL = "/api/auth/delivery-agent/request-otp/"
VERIFY_OTP_URL = "/api/auth/delivery-agent/verify-otp/"
VERIFY_EMAIL_REQUEST_URL = "/api/auth/delivery-agent/verify-email/request/"
VERIFY_EMAIL_CONFIRM_URL = "/api/auth/delivery-agent/verify-email/confirm/"
SHOP_ADMIN_REGISTER_AGENT_URL = "/api/shop-admin/delivery-agents/"
CUSTOMER_REGISTER_URL = "/api/register/"
TOKEN_URL = "/api/token/"
TOKEN_REFRESH_URL = "/api/token/refresh/"
FORGOT_PASSWORD_URL = "/api/auth/forgot-password/"
VERIFY_PASSWORD_RESET_OTP_URL = "/api/auth/verify-otp/"
DELIVERY_AGENT_AVAILABILITY_URL = "/api/delivery-agent/availability/"


@override_settings(**TEST_SETTINGS)
class DeliveryAgentLoginOTPTests(TransactionTestCase):
    """Comprehensive tests for delivery agent email OTP authentication flow."""

    def setUp(self):
        super().setUp()
        mail.outbox = []
        DeliveryAgentLoginRateLimitEvent.objects.all().delete()
        DeliveryAgentLoginChallenge.objects.all().delete()

        self.client = APIClient()

        self.shop_admin = User.objects.create_user(
            username="shop_admin_main",
            email="shop_admin@example.com",
            password="AdminPassword123!",
            role="shop_admin",
        )
        self.shop = Shop.objects.create(
            shop_admin=self.shop_admin,
            shop_name="Express Cleaners",
            contact_number="9876543200",
            address_line="100 Market St",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(8, 0),
            closing_time=time(20, 0),
            is_approved=True,
        )

        self.agent_password = "AgentSecurePassword123!"
        self.agent_user = User.objects.create_user(
            username="agent_rohit",
            email="rohit.agent@example.com",
            password=self.agent_password,
            role="delivery_agent",
            phone_number="+919876543210",
        )
        self.agent = DeliveryAgent.objects.create(
            user=self.agent_user,
            shop=self.shop,
            shift_starts_at=time(9, 0),
            shift_ends_at=time(18, 0),
            phone_verified=True,
            email_verified=True,
            is_active=True,
        )

        self.customer_password = "CustomerPassword123!"
        self.customer_user = User.objects.create_user(
            username="customer_sneha",
            email="sneha@example.com",
            password=self.customer_password,
            role="customer",
        )

    def _extract_otp_from_email(self) -> str:
        self.assertGreaterEqual(len(mail.outbox), 1, "No email was sent")
        email_body = mail.outbox[-1].body
        match = re.search(r"\b\d{6}\b", email_body)
        self.assertIsNotNone(match, "6-digit OTP not found in email body")
        return match.group(0)

    # -------------------------------------------------------------------------
    # 1. Eligible agent requests OTP
    # -------------------------------------------------------------------------
    def test_01_eligible_agent_requests_otp(self):
        """Eligible delivery agent successfully requests OTP; email is sent and challenge created."""
        response = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("challenge_id", response.data)
        self.assertIn("message", response.data)
        self.assertEqual(response.data["resend_cooldown_seconds"], 60)
        self.assertEqual(response.data["expires_in_seconds"], 300)

        # Confirm email was sent
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.agent_user.email])

        # Confirm challenge record
        challenge = DeliveryAgentLoginChallenge.objects.get(delivery_agent=self.agent)
        self.assertEqual(challenge.email_status, DeliveryAgentLoginChallenge.STATUS_SUCCEEDED)
        self.assertIsNone(challenge.used_at)
        self.assertIsNone(challenge.invalidated_at)
        self.assertEqual(challenge.incorrect_attempts, 0)

    # -------------------------------------------------------------------------
    # 2. Phone identifier works
    # -------------------------------------------------------------------------
    def test_02_phone_identifier_works(self):
        """Ten-digit Indian mobile number resolves eligible agent and sends OTP."""
        response = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": "9876543210"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("challenge_id", response.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.agent_user.email])

    # -------------------------------------------------------------------------
    # 3. Agent ID identifier works
    # -------------------------------------------------------------------------
    def test_03_agent_id_identifier_works(self):
        """Agent ID (case-insensitive) resolves eligible agent and sends OTP."""
        response = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id.lower()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("challenge_id", response.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.agent_user.email])

    # -------------------------------------------------------------------------
    # 4. Unverified phone is rejected
    # -------------------------------------------------------------------------
    def test_04_unverified_phone_is_rejected(self):
        """Agent with unverified phone number receives generic response without OTP email."""
        self.agent.phone_verified = False
        self.agent.save(update_fields=["phone_verified"])

        response = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(DeliveryAgentLoginChallenge.objects.count(), 0)

    # -------------------------------------------------------------------------
    # 5. Missing email is rejected
    # -------------------------------------------------------------------------
    def test_05_missing_email_is_rejected(self):
        """Agent without an email address receives generic response without OTP email."""
        self.agent_user.email = ""
        self.agent_user.save(update_fields=["email"])

        response = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(DeliveryAgentLoginChallenge.objects.count(), 0)

    # -------------------------------------------------------------------------
    # 6. Unverified email is rejected
    # -------------------------------------------------------------------------
    def test_06_unverified_email_is_rejected(self):
        """Agent with unverified email receives generic response without OTP email."""
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        response = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(DeliveryAgentLoginChallenge.objects.count(), 0)

    # -------------------------------------------------------------------------
    # 7. Inactive user is rejected
    # -------------------------------------------------------------------------
    def test_07_inactive_user_is_rejected(self):
        """Inactive user account receives generic response without OTP email."""
        self.agent_user.is_active = False
        self.agent_user.save(update_fields=["is_active"])

        response = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(DeliveryAgentLoginChallenge.objects.count(), 0)

    # -------------------------------------------------------------------------
    # 8. Deactivated profile is rejected
    # -------------------------------------------------------------------------
    def test_08_deactivated_profile_is_rejected(self):
        """Deactivated delivery agent profile receives generic response without OTP email."""
        self.agent.is_active = False
        self.agent.save(update_fields=["is_active"])

        response = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(DeliveryAgentLoginChallenge.objects.count(), 0)

    # -------------------------------------------------------------------------
    # 9. Unknown identifier gets generic response
    # -------------------------------------------------------------------------
    def test_09_unknown_identifier_gets_generic_response(self):
        """Unknown identifier receives generic response without account enumeration."""
        response = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": "VC-AGT-99999"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(DeliveryAgentLoginChallenge.objects.count(), 0)

        # Rate limit event was nonetheless recorded (preventing timing attacks)
        self.assertEqual(DeliveryAgentLoginRateLimitEvent.objects.count(), 1)

    # -------------------------------------------------------------------------
    # 10. OTP is not exposed in response or logs
    # -------------------------------------------------------------------------
    def test_10_otp_is_not_exposed_in_response_or_logs(self):
        """OTP is never leaked in API response body, headers, or server logs."""
        logger = logging.getLogger("accounts.auth")
        with self.assertLogs(logger, level="INFO") as log_capture:
            response = self.client.post(
                REQUEST_OTP_URL,
                {"identifier": self.agent.agent_id},
                format="json",
            )
            raw_otp = self._extract_otp_from_email()

            # Verify OTP is not in response
            response_text = str(response.data) + str(response.headers)
            self.assertNotIn(raw_otp, response_text)

            # Verify OTP is not in logs
            for entry in log_capture.output:
                self.assertNotIn(raw_otp, entry)

    # -------------------------------------------------------------------------
    # 11. OTP expiry
    # -------------------------------------------------------------------------
    def test_11_otp_expiry(self):
        """Expired OTP is rejected and challenge is marked invalidated."""
        res_req = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        challenge_id = res_req.data["challenge_id"]
        raw_otp = self._extract_otp_from_email()

        challenge = DeliveryAgentLoginChallenge.objects.get(delivery_agent=self.agent)
        challenge.expires_at = timezone.now() - timedelta(seconds=1)
        challenge.save(update_fields=["expires_at"])

        res_verify = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": raw_otp},
            format="json",
        )
        self.assertEqual(res_verify.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired", res_verify.data["detail"].lower())

        challenge.refresh_from_db()
        self.assertIsNotNone(challenge.invalidated_at)
        self.assertIsNone(challenge.used_at)

    # -------------------------------------------------------------------------
    # 12. Incorrect attempt counting
    # -------------------------------------------------------------------------
    def test_12_incorrect_attempt_counting(self):
        """Incorrect attempts increment attempt counter and return remaining attempts."""
        res_req = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        challenge_id = res_req.data["challenge_id"]

        # Attempt 1 (wrong)
        res1 = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": "000000"},
            format="json",
        )
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("4 attempt(s) remaining", res1.data["detail"])

        challenge = DeliveryAgentLoginChallenge.objects.get(delivery_agent=self.agent)
        self.assertEqual(challenge.incorrect_attempts, 1)

        # Attempt 2 (wrong)
        res2 = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": "111111"},
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("3 attempt(s) remaining", res2.data["detail"])

        challenge.refresh_from_db()
        self.assertEqual(challenge.incorrect_attempts, 2)

    # -------------------------------------------------------------------------
    # 13. Fifth incorrect attempt invalidates challenge
    # -------------------------------------------------------------------------
    def test_13_fifth_incorrect_attempt_invalidates_challenge(self):
        """Fifth incorrect attempt invalidates challenge; subsequent valid attempt is rejected."""
        res_req = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        challenge_id = res_req.data["challenge_id"]
        raw_otp = self._extract_otp_from_email()

        for i in range(4):
            res = self.client.post(
                VERIFY_OTP_URL,
                {"challenge_id": challenge_id, "otp": f"{i:06d}"},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # 5th attempt
        res5 = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": "999999"},
            format="json",
        )
        self.assertEqual(res5.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("invalidated", res5.data["detail"].lower())

        challenge = DeliveryAgentLoginChallenge.objects.get(delivery_agent=self.agent)
        self.assertEqual(challenge.incorrect_attempts, 5)
        self.assertIsNotNone(challenge.invalidated_at)

        # 6th attempt with CORRECT OTP fails
        res6 = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": raw_otp},
            format="json",
        )
        self.assertEqual(res6.status_code, status.HTTP_400_BAD_REQUEST)

    # -------------------------------------------------------------------------
    # 14. Successful OTP verification issues JWT
    # -------------------------------------------------------------------------
    def test_14_successful_otp_verification_issues_jwt(self):
        """Correct OTP verification issues SimpleJWT access and refresh tokens."""
        res_req = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        challenge_id = res_req.data["challenge_id"]
        raw_otp = self._extract_otp_from_email()

        res_verify = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": raw_otp},
            format="json",
        )
        self.assertEqual(res_verify.status_code, status.HTTP_200_OK)
        self.assertIn("access", res_verify.data)
        self.assertIn("refresh", res_verify.data)
        self.assertEqual(res_verify.data["role"], "delivery_agent")
        self.assertEqual(res_verify.data["user"]["id"], self.agent_user.pk)
        self.assertEqual(res_verify.data["user"]["agent_id"], self.agent.agent_id)

        challenge = DeliveryAgentLoginChallenge.objects.get(delivery_agent=self.agent)
        self.assertIsNotNone(challenge.used_at)
        self.assertIsNotNone(challenge.verified_at)
        self.assertIsNone(challenge.invalidated_at)

    # -------------------------------------------------------------------------
    # 15. OTP cannot be reused
    # -------------------------------------------------------------------------
    def test_15_otp_cannot_be_reused(self):
        """Once used, the challenge cannot be verified a second time."""
        res_req = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        challenge_id = res_req.data["challenge_id"]
        raw_otp = self._extract_otp_from_email()

        res1 = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": raw_otp},
            format="json",
        )
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Second attempt with same challenge_id and OTP
        res2 = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": raw_otp},
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("invalid or expired", res2.data["detail"].lower())

    # -------------------------------------------------------------------------
    # 16. Resend cooldown
    # -------------------------------------------------------------------------
    def test_16_resend_cooldown(self):
        """Requesting another OTP within 60 seconds returns 429 Too Many Requests."""
        res1 = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

        # Immediate resend attempt within 60 seconds
        res2 = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("wait", res2.data["detail"].lower())
        self.assertEqual(len(mail.outbox), 1)  # No second email sent

    # -------------------------------------------------------------------------
    # 17. New challenge invalidates previous challenge
    # -------------------------------------------------------------------------
    def test_17_new_challenge_invalidates_previous_challenge(self):
        """After cooldown, requesting a new OTP invalidates the previous challenge."""
        res1 = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        challenge_id_1 = res1.data["challenge_id"]
        otp_1 = self._extract_otp_from_email()

        # Advance time past 60-second cooldown
        challenge_1 = DeliveryAgentLoginChallenge.objects.get(delivery_agent=self.agent)
        challenge_1.resend_available_at = timezone.now() - timedelta(seconds=1)
        challenge_1.save(update_fields=["resend_available_at"])

        res2 = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        challenge_id_2 = res2.data["challenge_id"]
        otp_2 = self._extract_otp_from_email()

        # Old challenge must be invalidated
        challenge_1.refresh_from_db()
        self.assertIsNotNone(challenge_1.invalidated_at)

        # Attempting to verify old challenge fails
        res_old = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id_1, "otp": otp_1},
            format="json",
        )
        self.assertEqual(res_old.status_code, status.HTTP_400_BAD_REQUEST)

        # Verifying new challenge succeeds
        res_new = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id_2, "otp": otp_2},
            format="json",
        )
        self.assertEqual(res_new.status_code, status.HTTP_200_OK)

    # -------------------------------------------------------------------------
    # 18. Email failure invalidates challenge
    # -------------------------------------------------------------------------
    def test_18_email_failure_invalidates_challenge(self):
        """If email delivery fails, the newly created challenge is invalidated immediately."""
        with mock.patch("accounts.views.auth.send_mail", side_effect=Exception("SMTP Connection Error")):
            response = self.client.post(
                REQUEST_OTP_URL,
                {"identifier": self.agent.agent_id},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

        challenge = DeliveryAgentLoginChallenge.objects.get(delivery_agent=self.agent)
        self.assertIsNotNone(challenge.invalidated_at)
        self.assertEqual(challenge.email_status, DeliveryAgentLoginChallenge.STATUS_FAILED)

    # -------------------------------------------------------------------------
    # 19. Concurrent resend safety
    # -------------------------------------------------------------------------
    def test_19_concurrent_resend_safety(self):
        """Concurrent requests for OTP: exactly one succeeds; the other is blocked by cooldown."""
        start_barrier = threading.Barrier(2)
        results = [None, None]
        errors = []

        def worker1():
            try:
                start_barrier.wait(timeout=5)
                client = APIClient()
                results[0] = client.post(
                    REQUEST_OTP_URL,
                    {"identifier": self.agent.agent_id},
                    format="json",
                )
            except Exception as exc:
                errors.append(exc)
            finally:
                connections.close_all()

        def worker2():
            try:
                start_barrier.wait(timeout=5)
                client = APIClient()
                results[1] = client.post(
                    REQUEST_OTP_URL,
                    {"identifier": self.agent.agent_id},
                    format="json",
                )
            except Exception as exc:
                errors.append(exc)
            finally:
                connections.close_all()

        t1 = threading.Thread(target=worker1, name="ResendWorker1")
        t2 = threading.Thread(target=worker2, name="ResendWorker2")
        t1.start()
        t2.start()
        t1.join(timeout=5)
        t2.join(timeout=5)

        self.assertFalse(t1.is_alive(), "Worker 1 did not terminate within timeout.")
        self.assertFalse(t2.is_alive(), "Worker 2 did not terminate within timeout.")

        if errors:
            raise AssertionError(f"Worker encountered exception: {errors[0]}") from errors[0]

        statuses = sorted([results[0].status_code, results[1].status_code])
        self.assertEqual(statuses, [status.HTTP_200_OK, status.HTTP_429_TOO_MANY_REQUESTS])
        self.assertEqual(len(mail.outbox), 1)

    # -------------------------------------------------------------------------
    # 20. Concurrent verification safety
    # -------------------------------------------------------------------------
    def test_20_concurrent_verification_safety(self):
        """Concurrent submissions of the same OTP: exactly one receives JWT; the other is rejected."""
        res_req = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        challenge_id = res_req.data["challenge_id"]
        raw_otp = self._extract_otp_from_email()

        start_barrier = threading.Barrier(2)
        results = [None, None]
        errors = []

        def worker1():
            try:
                start_barrier.wait(timeout=5)
                client = APIClient()
                results[0] = client.post(
                    VERIFY_OTP_URL,
                    {"challenge_id": challenge_id, "otp": raw_otp},
                    format="json",
                )
            except Exception as exc:
                errors.append(exc)
            finally:
                connections.close_all()

        def worker2():
            try:
                start_barrier.wait(timeout=5)
                client = APIClient()
                results[1] = client.post(
                    VERIFY_OTP_URL,
                    {"challenge_id": challenge_id, "otp": raw_otp},
                    format="json",
                )
            except Exception as exc:
                errors.append(exc)
            finally:
                connections.close_all()

        t1 = threading.Thread(target=worker1, name="VerifyWorker1")
        t2 = threading.Thread(target=worker2, name="VerifyWorker2")
        t1.start()
        t2.start()
        t1.join(timeout=5)
        t2.join(timeout=5)

        self.assertFalse(t1.is_alive(), "Worker 1 did not terminate within timeout.")
        self.assertFalse(t2.is_alive(), "Worker 2 did not terminate within timeout.")

        if errors:
            raise AssertionError(f"Worker encountered exception: {errors[0]}") from errors[0]

        statuses = sorted([results[0].status_code, results[1].status_code])
        self.assertEqual(statuses, [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST])

    # -------------------------------------------------------------------------
    # 21. Delivery agent password login is rejected
    # -------------------------------------------------------------------------
    def test_21_delivery_agent_password_login_is_rejected(self):
        """Delivery agents cannot authenticate using password through /api/token/."""
        response = self.client.post(
            TOKEN_URL,
            {
                "username": self.agent_user.username,
                "password": self.agent_password,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("otp", response.data["detail"].lower())

    # -------------------------------------------------------------------------
    # 22. Other-role password login still works
    # -------------------------------------------------------------------------
    def test_22_other_role_password_login_still_works(self):
        """Customer and shop admin continue to authenticate via /api/token/ using password."""
        response = self.client.post(
            TOKEN_URL,
            {
                "username": self.customer_user.username,
                "password": self.customer_password,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["role"], "customer")

    # -------------------------------------------------------------------------
    # 23. Inactive agent refresh is rejected
    # -------------------------------------------------------------------------
    def test_23_inactive_agent_refresh_is_rejected(self):
        """Refreshing access token for a deactivated delivery agent is rejected with 401."""
        res_req = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        challenge_id = res_req.data["challenge_id"]
        raw_otp = self._extract_otp_from_email()

        res_verify = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": raw_otp},
            format="json",
        )
        refresh_token = res_verify.data["refresh"]

        # Deactivate delivery agent profile
        self.agent.is_active = False
        self.agent.save(update_fields=["is_active"])

        res_refresh = self.client.post(
            TOKEN_REFRESH_URL,
            {"refresh": refresh_token},
            format="json",
        )
        self.assertEqual(res_refresh.status_code, status.HTTP_401_UNAUTHORIZED)

    # -------------------------------------------------------------------------
    # 24. Other-role refresh behavior remains unchanged
    # -------------------------------------------------------------------------
    def test_24_other_role_refresh_behavior_remains_unchanged(self):
        """Customer refresh token successfully issues new access token."""
        res_login = self.client.post(
            TOKEN_URL,
            {
                "username": self.customer_user.username,
                "password": self.customer_password,
            },
            format="json",
        )
        customer_refresh = res_login.data["refresh"]

        res_refresh = self.client.post(
            TOKEN_REFRESH_URL,
            {"refresh": customer_refresh},
            format="json",
        )
        self.assertEqual(res_refresh.status_code, status.HTTP_200_OK)
        self.assertIn("access", res_refresh.data)

    # -------------------------------------------------------------------------
    # 25. Rate-limit integration and failure handling
    # -------------------------------------------------------------------------
    def test_25_rate_limit_exceeded_blocks_fourth_request(self):
        """Fourth OTP request within rolling window is blocked by rate-limit service."""
        ident = "VC-AGT-RLTEST"

        for i in range(3):
            res = self.client.post(
                REQUEST_OTP_URL,
                {"identifier": ident},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_200_OK)

        # 4th request must be blocked by rate limiting (HTTP 429)
        res4 = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": ident},
            format="json",
        )
        self.assertEqual(res4.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_26_rate_limit_internal_failure_fails_closed(self):
        """Internal failure in rate-limit service fails closed with HTTP 500."""
        with mock.patch(
            "accounts.views.auth.check_and_record_delivery_agent_login_rate_limit",
            return_value=RateLimitResult(
                decision=RateLimitDecision.INTERNAL_FAILURE,
                allowed=False,
                status_reason="database_failure",
            ),
        ):
            res = self.client.post(
                REQUEST_OTP_URL,
                {"identifier": self.agent.agent_id},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

    # -------------------------------------------------------------------------
    # 27-33. Registration tests: Mandatory email, uniqueness, concurrency
    # -------------------------------------------------------------------------
    def test_27_registration_missing_email_is_rejected(self):
        """Registering delivery agent without email field is rejected with 400."""
        self.client.force_authenticate(user=self.shop_admin)
        payload = {
            "username": "agent_no_email",
            "password": "Password123!",
            "password_confirm": "Password123!",
            "phone_number": "+919876543291",
            "shift_starts_at": "09:00:00",
            "shift_ends_at": "18:00:00",
        }
        res = self.client.post(SHOP_ADMIN_REGISTER_AGENT_URL, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", res.data)

    def test_28_registration_null_email_is_rejected(self):
        """Registering delivery agent with null email is rejected with 400."""
        self.client.force_authenticate(user=self.shop_admin)
        payload = {
            "username": "agent_null_email",
            "email": None,
            "password": "Password123!",
            "password_confirm": "Password123!",
            "phone_number": "+919876543292",
            "shift_starts_at": "09:00:00",
            "shift_ends_at": "18:00:00",
        }
        res = self.client.post(SHOP_ADMIN_REGISTER_AGENT_URL, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", res.data)

    def test_29_registration_blank_email_is_rejected(self):
        """Registering delivery agent with blank email is rejected with 400."""
        self.client.force_authenticate(user=self.shop_admin)
        payload = {
            "username": "agent_blank_email",
            "email": "   ",
            "password": "Password123!",
            "password_confirm": "Password123!",
            "phone_number": "+919876543293",
            "shift_starts_at": "09:00:00",
            "shift_ends_at": "18:00:00",
        }
        res = self.client.post(SHOP_ADMIN_REGISTER_AGENT_URL, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", res.data)

    def test_30_registration_duplicate_delivery_agent_email_is_rejected(self):
        """Registering delivery agent with existing email is rejected with 400."""
        self.client.force_authenticate(user=self.shop_admin)
        payload = {
            "username": "agent_dup_email",
            "email": self.agent_user.email,
            "password": "Password123!",
            "password_confirm": "Password123!",
            "phone_number": "+919876543294",
            "shift_starts_at": "09:00:00",
            "shift_ends_at": "18:00:00",
        }
        res = self.client.post(SHOP_ADMIN_REGISTER_AGENT_URL, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", res.data)

    def test_31_registration_case_insensitive_duplicate_email_is_rejected(self):
        """Registering delivery agent with case-variant duplicate email is rejected."""
        self.client.force_authenticate(user=self.shop_admin)
        payload = {
            "username": "agent_case_email",
            "email": self.agent_user.email.upper(),
            "password": "Password123!",
            "password_confirm": "Password123!",
            "phone_number": "+919876543295",
            "shift_starts_at": "09:00:00",
            "shift_ends_at": "18:00:00",
        }
        res = self.client.post(SHOP_ADMIN_REGISTER_AGENT_URL, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", res.data)

    def test_32_registration_email_uniqueness_enforced_under_concurrency(self):
        """Concurrent registrations with identical email: exactly one succeeds; second is rejected."""
        dup_email = "concurrent.agent@example.com"
        start_barrier = threading.Barrier(2)
        results = [None, None]
        errors = []

        def worker1():
            try:
                start_barrier.wait(timeout=5)
                client = APIClient()
                client.force_authenticate(user=self.shop_admin)
                results[0] = client.post(
                    SHOP_ADMIN_REGISTER_AGENT_URL,
                    {
                        "username": "conc_agent_1",
                        "email": dup_email,
                        "password": "Password123!",
                        "password_confirm": "Password123!",
                        "phone_number": "+919876543281",
                        "shift_starts_at": "09:00:00",
                        "shift_ends_at": "18:00:00",
                    },
                    format="json",
                )
            except Exception as exc:
                errors.append(exc)
            finally:
                connections.close_all()

        def worker2():
            try:
                start_barrier.wait(timeout=5)
                client = APIClient()
                client.force_authenticate(user=self.shop_admin)
                results[1] = client.post(
                    SHOP_ADMIN_REGISTER_AGENT_URL,
                    {
                        "username": "conc_agent_2",
                        "email": dup_email,
                        "password": "Password123!",
                        "password_confirm": "Password123!",
                        "phone_number": "+919876543282",
                        "shift_starts_at": "09:00:00",
                        "shift_ends_at": "18:00:00",
                    },
                    format="json",
                )
            except Exception as exc:
                errors.append(exc)
            finally:
                connections.close_all()

        t1 = threading.Thread(target=worker1, name="RegWorker1")
        t2 = threading.Thread(target=worker2, name="RegWorker2")
        t1.start()
        t2.start()
        t1.join(timeout=5)
        t2.join(timeout=5)

        self.assertFalse(t1.is_alive(), "Worker 1 did not terminate within timeout.")
        self.assertFalse(t2.is_alive(), "Worker 2 did not terminate within timeout.")

        if errors:
            raise AssertionError(f"Worker encountered exception: {errors[0]}") from errors[0]

        statuses = sorted([results[0].status_code, results[1].status_code])
        self.assertEqual(statuses, [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST])

    def test_33_other_user_roles_registration_remains_unchanged(self):
        """Customer registration via /api/register/ remains functional."""
        payload = {
            "username": "new_customer_test",
            "email": "customer.test@example.com",
            "password": "CustomerPassword123!",
            "password_confirm": "CustomerPassword123!",
            "phone_number": "+919876543283",
        }
        res = self.client.post(CUSTOMER_REGISTER_URL, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="new_customer_test")
        self.assertEqual(user.role, "customer")
        self.assertEqual(user.email, "customer.test@example.com")

    # -------------------------------------------------------------------------
    # 34-43. Email Verification Tests
    # -------------------------------------------------------------------------
    def test_34_email_verification_valid_flow_succeeds(self):
        """Newly registered agent verifies email without requiring authenticated session."""
        agent_user = User.objects.create_user(
            username="unverified_agent_1",
            email="unverified1@example.com",
            password="Password123!",
            role="delivery_agent",
            phone_number="+919876543271",
        )
        agent = DeliveryAgent.objects.create(
            user=agent_user,
            shop=self.shop,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
            phone_verified=True,
            email_verified=False,
            is_active=True,
        )

        # 1. Request verification OTP (unauthenticated)
        res_req = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": agent.agent_id},
            format="json",
        )
        self.assertEqual(res_req.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [agent_user.email])
        otp = self._extract_otp_from_email()

        # 2. Confirm verification
        res_confirm = self.client.post(
            VERIFY_EMAIL_CONFIRM_URL,
            {"identifier": agent.agent_id, "otp": otp},
            format="json",
        )
        self.assertEqual(res_confirm.status_code, status.HTTP_200_OK)
        agent.refresh_from_db()
        self.assertTrue(agent.email_verified)

    def test_35_email_verification_invalid_otp_fails(self):
        """Submitting invalid OTP fails with 400 and leaves email unverified."""
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        res_confirm = self.client.post(
            VERIFY_EMAIL_CONFIRM_URL,
            {"identifier": self.agent.agent_id, "otp": "999999"},
            format="json",
        )
        self.assertEqual(res_confirm.status_code, status.HTTP_400_BAD_REQUEST)
        self.agent.refresh_from_db()
        self.assertFalse(self.agent.email_verified)

    def test_36_email_verification_expired_challenge_fails(self):
        """Expired verification code fails with 400."""
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        otp = self._extract_otp_from_email()

        record = PasswordResetOTP.objects.get(
            user=self.agent_user,
            purpose="delivery_agent_email_verify",
            used_at__isnull=True,
        )
        record.expires_at = timezone.now() - timedelta(seconds=1)
        record.save(update_fields=["expires_at"])

        res_confirm = self.client.post(
            VERIFY_EMAIL_CONFIRM_URL,
            {"identifier": self.agent.agent_id, "otp": otp},
            format="json",
        )
        self.assertEqual(res_confirm.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired", res_confirm.data["detail"].lower())

    def test_37_email_verification_reused_challenge_fails(self):
        """Reusing an already verified code fails with 400."""
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        otp = self._extract_otp_from_email()

        # First verification succeeds
        res1 = self.client.post(
            VERIFY_EMAIL_CONFIRM_URL,
            {"identifier": self.agent.agent_id, "otp": otp},
            format="json",
        )
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Reset email_verified to test re-use
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        # Second verification with same OTP must fail
        res2 = self.client.post(
            VERIFY_EMAIL_CONFIRM_URL,
            {"identifier": self.agent.agent_id, "otp": otp},
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_38_email_verification_resend_cooldown_works(self):
        """Requesting email verification during 60s cooldown returns 200 without sending email or exposing cooldown."""
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        res1 = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

        res2 = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data, res1.data)
        # Suppressed by cooldown: no second email sent
        self.assertEqual(len(mail.outbox), 1)

    def test_39_email_verification_previous_challenge_becomes_invalid_after_resend(self):
        """When resend occurs after cooldown, previous challenge is invalidated."""
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        otp1 = self._extract_otp_from_email()

        # Fast forward past 60s cooldown
        record1 = PasswordResetOTP.objects.get(
            user=self.agent_user,
            purpose="delivery_agent_email_verify",
            used_at__isnull=True,
        )
        record1.created_at = timezone.now() - timedelta(seconds=65)
        record1.save(update_fields=["created_at"])

        # Resend code
        res2 = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        otp2 = self._extract_otp_from_email()

        # Challenge 1 must now be marked used/invalidated
        record1.refresh_from_db()
        self.assertIsNotNone(record1.used_at)

        # Verifying with otp1 must fail
        res_old = self.client.post(
            VERIFY_EMAIL_CONFIRM_URL,
            {"identifier": self.agent.agent_id, "otp": otp1},
            format="json",
        )
        self.assertEqual(res_old.status_code, status.HTTP_400_BAD_REQUEST)

        # Verifying with otp2 succeeds
        res_new = self.client.post(
            VERIFY_EMAIL_CONFIRM_URL,
            {"identifier": self.agent.agent_id, "otp": otp2},
            format="json",
        )
        self.assertEqual(res_new.status_code, status.HTTP_200_OK)

    def test_40_email_verification_sent_only_to_registered_address(self):
        """Verification email is dispatched exclusively to agent's registered email address."""
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        res = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.agent_user.email])

    def test_41_email_changes_reset_verification_and_unverified_cannot_login(self):
        """Changing email resets email_verified to False and blocks login OTP requests."""
        self.assertTrue(self.agent.email_verified)

        # Update email on user
        self.agent_user.email = "rohit.newemail@example.com"
        self.agent_user.save(update_fields=["email"])

        self.agent.refresh_from_db()
        self.assertFalse(self.agent.email_verified)

        # Unverified agent cannot receive login OTP
        res = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(
            DeliveryAgentLoginChallenge.objects.filter(delivery_agent=self.agent).count(),
            0,
        )

    def test_42_concurrent_email_verification_resend(self):
        """Concurrent requests for email verification: both get 200 externally, exactly one OTP emailed."""
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        start_barrier = threading.Barrier(2)
        results = [None, None]
        errors = []

        def worker1():
            try:
                start_barrier.wait(timeout=5)
                client = APIClient()
                results[0] = client.post(
                    VERIFY_EMAIL_REQUEST_URL,
                    {"identifier": self.agent.agent_id},
                    format="json",
                )
            except Exception as exc:
                errors.append(exc)
            finally:
                connections.close_all()

        def worker2():
            try:
                start_barrier.wait(timeout=5)
                client = APIClient()
                results[1] = client.post(
                    VERIFY_EMAIL_REQUEST_URL,
                    {"identifier": self.agent.agent_id},
                    format="json",
                )
            except Exception as exc:
                errors.append(exc)
            finally:
                connections.close_all()

        t1 = threading.Thread(target=worker1, name="EVResendWorker1")
        t2 = threading.Thread(target=worker2, name="EVResendWorker2")
        t1.start()
        t2.start()
        t1.join(timeout=5)
        t2.join(timeout=5)

        self.assertFalse(t1.is_alive(), "Worker 1 did not terminate within timeout.")
        self.assertFalse(t2.is_alive(), "Worker 2 did not terminate within timeout.")

        if errors:
            raise AssertionError(f"Worker encountered exception: {errors[0]}") from errors[0]

        self.assertEqual(results[0].status_code, status.HTTP_200_OK)
        self.assertEqual(results[1].status_code, status.HTTP_200_OK)
        self.assertEqual(results[0].data, results[1].data)
        self.assertEqual(len(mail.outbox), 1)

    def test_43_concurrent_email_verification_confirm(self):
        """Concurrent submissions of the same email verification OTP: exactly one succeeds."""
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        otp = self._extract_otp_from_email()

        start_barrier = threading.Barrier(2)
        results = [None, None]
        errors = []

        def worker1():
            try:
                start_barrier.wait(timeout=5)
                client = APIClient()
                results[0] = client.post(
                    VERIFY_EMAIL_CONFIRM_URL,
                    {"identifier": self.agent.agent_id, "otp": otp},
                    format="json",
                )
            except Exception as exc:
                errors.append(exc)
            finally:
                connections.close_all()

        def worker2():
            try:
                start_barrier.wait(timeout=5)
                client = APIClient()
                results[1] = client.post(
                    VERIFY_EMAIL_CONFIRM_URL,
                    {"identifier": self.agent.agent_id, "otp": otp},
                    format="json",
                )
            except Exception as exc:
                errors.append(exc)
            finally:
                connections.close_all()

        t1 = threading.Thread(target=worker1, name="EVConfirmWorker1")
        t2 = threading.Thread(target=worker2, name="EVConfirmWorker2")
        t1.start()
        t2.start()
        t1.join(timeout=5)
        t2.join(timeout=5)

        self.assertFalse(t1.is_alive(), "Worker 1 did not terminate within timeout.")
        self.assertFalse(t2.is_alive(), "Worker 2 did not terminate within timeout.")

        if errors:
            raise AssertionError(f"Worker encountered exception: {errors[0]}") from errors[0]

        statuses = sorted([results[0].status_code, results[1].status_code])
        self.assertEqual(statuses, [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST])
        self.agent.refresh_from_db()
        self.assertTrue(self.agent.email_verified)

    # -------------------------------------------------------------------------
    # 44-50. Login Challenge & Dedicated Secret Tests
    # -------------------------------------------------------------------------
    def test_44_missing_dedicated_challenge_id_secret_fails_closed(self):
        """Missing dedicated challenge-ID secret fails closed with HTTP 500."""
        with override_settings(DELIVERY_AGENT_LOGIN_CHALLENGE_ID_SECRET=""):
            res_req = self.client.post(
                REQUEST_OTP_URL,
                {"identifier": self.agent.agent_id},
                format="json",
            )
            self.assertEqual(res_req.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

            res_ver = self.client.post(
                VERIFY_OTP_URL,
                {"challenge_id": "test_challenge_id", "otp": "123456"},
                format="json",
            )
            self.assertEqual(res_ver.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

    def test_45_invalid_dedicated_challenge_id_secret_fails_closed(self):
        """Dedicated secret shorter than 32 bytes or reused secrets fail closed."""
        # 1. Shorter than 32 bytes
        with override_settings(DELIVERY_AGENT_LOGIN_CHALLENGE_ID_SECRET="short-secret-only"):
            res = self.client.post(REQUEST_OTP_URL, {"identifier": self.agent.agent_id}, format="json")
            self.assertEqual(res.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 2. Equal to SECRET_KEY
        with override_settings(DELIVERY_AGENT_LOGIN_CHALLENGE_ID_SECRET=TEST_SETTINGS.get("SECRET_KEY", "insecure-secret-key")):
            res = self.client.post(REQUEST_OTP_URL, {"identifier": self.agent.agent_id}, format="json")
            self.assertEqual(res.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 3. Reusing rate limit HMAC secret
        with override_settings(DELIVERY_AGENT_LOGIN_CHALLENGE_ID_SECRET=TEST_SETTINGS["DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_SECRET"]):
            res = self.client.post(REQUEST_OTP_URL, {"identifier": self.agent.agent_id}, format="json")
            self.assertEqual(res.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 4. Reusing advisory lock secret
        with override_settings(DELIVERY_AGENT_LOGIN_CHALLENGE_ID_SECRET=TEST_SETTINGS["DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_SECRET"]):
            res = self.client.post(REQUEST_OTP_URL, {"identifier": self.agent.agent_id}, format="json")
            self.assertEqual(res.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

    def test_46_challenge_id_uses_dedicated_secret(self):
        """Challenge ID digest is verified to be derived from the dedicated secret."""
        res = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        raw_challenge_id = res.data["challenge_id"]

        challenge = DeliveryAgentLoginChallenge.objects.get(delivery_agent=self.agent)
        expected_digest = hmac.new(
            TEST_SETTINGS["DELIVERY_AGENT_LOGIN_CHALLENGE_ID_SECRET"].encode("utf-8"),
            raw_challenge_id.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        self.assertEqual(challenge.challenge_id_digest, expected_digest)

    def test_47_pending_email_status_cannot_verify_login_otp(self):
        """Challenge with email_status='pending' cannot be verified."""
        res_req = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        challenge_id = res_req.data["challenge_id"]
        otp = self._extract_otp_from_email()

        challenge = DeliveryAgentLoginChallenge.objects.get(delivery_agent=self.agent)
        challenge.email_status = DeliveryAgentLoginChallenge.STATUS_PENDING
        challenge.save(update_fields=["email_status"])

        res_ver = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": otp},
            format="json",
        )
        self.assertEqual(res_ver.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not confirmed or failed", res_ver.data["detail"].lower())

    def test_48_failed_email_status_cannot_verify_login_otp(self):
        """Challenge with email_status='failed' cannot be verified."""
        res_req = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        challenge_id = res_req.data["challenge_id"]
        otp = self._extract_otp_from_email()

        challenge = DeliveryAgentLoginChallenge.objects.get(delivery_agent=self.agent)
        challenge.email_status = DeliveryAgentLoginChallenge.STATUS_FAILED
        challenge.save(update_fields=["email_status"])

        res_ver = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": otp},
            format="json",
        )
        self.assertEqual(res_ver.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not confirmed or failed", res_ver.data["detail"].lower())

    def test_49_not_available_email_status_cannot_verify_login_otp(self):
        """Challenge with email_status='not_available' cannot be verified."""
        res_req = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        challenge_id = res_req.data["challenge_id"]
        otp = self._extract_otp_from_email()

        challenge = DeliveryAgentLoginChallenge.objects.get(delivery_agent=self.agent)
        challenge.email_status = DeliveryAgentLoginChallenge.STATUS_NOT_AVAILABLE
        challenge.save(update_fields=["email_status"])

        res_ver = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": otp},
            format="json",
        )
        self.assertEqual(res_ver.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not confirmed or failed", res_ver.data["detail"].lower())

    def test_50_succeeded_email_status_allows_normal_verification(self):
        """Challenge with email_status='succeeded' verifies normally."""
        res_req = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        challenge_id = res_req.data["challenge_id"]
        otp = self._extract_otp_from_email()

        challenge = DeliveryAgentLoginChallenge.objects.get(delivery_agent=self.agent)
        self.assertEqual(challenge.email_status, DeliveryAgentLoginChallenge.STATUS_SUCCEEDED)

        res_ver = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": otp},
            format="json",
        )
        self.assertEqual(res_ver.status_code, status.HTTP_200_OK)
        self.assertIn("access", res_ver.data)
        self.assertIn("refresh", res_ver.data)

    # -------------------------------------------------------------------------
    # 51-56. Refresh Eligibility Tests
    # -------------------------------------------------------------------------
    def _obtain_delivery_agent_tokens(self) -> tuple[str, str]:
        res_req = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        challenge_id = res_req.data["challenge_id"]
        otp = self._extract_otp_from_email()
        res_ver = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": otp},
            format="json",
        )
        return res_ver.data["refresh"], res_ver.data["access"]

    def test_51_refresh_inactive_user_rejected(self):
        """Refresh fails if User.is_active is False."""
        refresh, _ = self._obtain_delivery_agent_tokens()
        self.agent_user.is_active = False
        self.agent_user.save(update_fields=["is_active"])

        res = self.client.post(TOKEN_REFRESH_URL, {"refresh": refresh}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_52_refresh_unverified_phone_rejected(self):
        """Refresh fails if DeliveryAgent.phone_verified is False."""
        refresh, _ = self._obtain_delivery_agent_tokens()
        self.agent.phone_verified = False
        self.agent.save(update_fields=["phone_verified"])

        res = self.client.post(TOKEN_REFRESH_URL, {"refresh": refresh}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_53_refresh_unverified_email_rejected(self):
        """Refresh fails if DeliveryAgent.email_verified is False."""
        refresh, _ = self._obtain_delivery_agent_tokens()
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        res = self.client.post(TOKEN_REFRESH_URL, {"refresh": refresh}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_54_refresh_missing_email_rejected(self):
        """Refresh fails if delivery agent User.email is missing/empty."""
        refresh, _ = self._obtain_delivery_agent_tokens()
        self.agent_user.email = None
        self.agent_user.save(update_fields=["email"])

        res = self.client.post(TOKEN_REFRESH_URL, {"refresh": refresh}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_55_refresh_missing_phone_rejected(self):
        """Refresh fails if delivery agent User.phone_number is missing/empty."""
        refresh, _ = self._obtain_delivery_agent_tokens()
        with mock.patch.object(User, "phone_number", new_callable=mock.PropertyMock, return_value=None):
            res = self.client.post(TOKEN_REFRESH_URL, {"refresh": refresh}, format="json")
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_56_refresh_shop_admin_role_retains_existing_behavior(self):
        """Shop Admin refresh token succeeds without delivery-agent checks."""
        res_login = self.client.post(
            TOKEN_URL,
            {
                "username": self.shop_admin.username,
                "password": "AdminPassword123!",
            },
            format="json",
        )
        refresh = res_login.data["refresh"]

        res_refresh = self.client.post(TOKEN_REFRESH_URL, {"refresh": refresh}, format="json")
        self.assertEqual(res_refresh.status_code, status.HTTP_200_OK)
        self.assertIn("access", res_refresh.data)

    # -------------------------------------------------------------------------
    # 57-68. Email Verification Rate Limiting, Enumeration & Security Tests
    # -------------------------------------------------------------------------
    def test_57_email_verify_unknown_identifier_consumes_rate_limit_quota(self):
        """Unknown identifier consumes rate-limit quota and blocks after limit."""
        unknown_id = "VC-AGT-99999"
        for _ in range(3):
            res = self.client.post(
                VERIFY_EMAIL_REQUEST_URL,
                {"identifier": unknown_id},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_200_OK)

        # 4th request within 15 min exceeds quota (3 / 15m)
        res_blocked = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": unknown_id},
            format="json",
        )
        self.assertEqual(res_blocked.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_58_email_verify_known_identifier_consumes_rate_limit_quota(self):
        """Known identifier consumes rate-limit quota and blocks after limit."""
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        for _ in range(3):
            res = self.client.post(
                VERIFY_EMAIL_REQUEST_URL,
                {"identifier": self.agent.agent_id},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_200_OK)

        res_blocked = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res_blocked.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_59_email_verify_identifier_quota_enforcement(self):
        """Identifier quota: 3 requests per 15 min window enforced accurately."""
        unknown_id = "VC-AGT-88888"
        for _ in range(3):
            res = self.client.post(
                VERIFY_EMAIL_REQUEST_URL,
                {"identifier": unknown_id},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_200_OK)

        res_4 = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": unknown_id},
            format="json",
        )
        self.assertEqual(res_4.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_60_email_verify_ip_quota_enforcement(self):
        """IP quota: 10 requests per 15 min from same IP enforced across distinct identifiers."""
        # 10 different identifiers from same client IP (REMOTE_ADDR default 127.0.0.1)
        for i in range(10):
            res = self.client.post(
                VERIFY_EMAIL_REQUEST_URL,
                {"identifier": f"VC-AGT-7000{i}"},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_200_OK)

        # 11th request from same IP is blocked
        res_11 = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": "VC-AGT-79999"},
            format="json",
        )
        self.assertEqual(res_11.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_61_email_verify_rate_limiting_occurs_before_account_lookup(self):
        """When rate limit is exceeded, account lookup does not occur."""
        ident = "VC-AGT-66666"
        for _ in range(3):
            self.client.post(
                VERIFY_EMAIL_REQUEST_URL,
                {"identifier": ident},
                format="json",
            )

        with mock.patch(
            "accounts.views.auth.find_delivery_agent_for_email_verification"
        ) as mock_lookup:
            res = self.client.post(
                VERIFY_EMAIL_REQUEST_URL,
                {"identifier": ident},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
            mock_lookup.assert_not_called()

    def test_62_email_verify_unknown_and_eligible_identifiers_receive_indistinguishable_responses(self):
        """Unknown and eligible identifiers receive identical HTTP status and payload."""
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        res_eligible = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res_eligible.status_code, status.HTTP_200_OK)

        res_unknown = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": "VC-AGT-55555"},
            format="json",
        )
        self.assertEqual(res_unknown.status_code, status.HTTP_200_OK)
        self.assertEqual(res_eligible.data, res_unknown.data)

    def test_63_email_verify_already_verified_and_inactive_agents_receive_indistinguishable_responses(self):
        """Already verified, inactive agent, and inactive user receive indistinguishable responses without sending email."""
        # 1. Already verified agent
        self.agent.email_verified = True
        self.agent.save(update_fields=["email_verified"])
        res_verified = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res_verified.status_code, status.HTTP_200_OK)

        # 2. Inactive agent
        self.agent.is_active = False
        self.agent.save(update_fields=["is_active"])
        res_inactive = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res_inactive.status_code, status.HTTP_200_OK)

        # 3. Inactive user
        self.agent_user.is_active = False
        self.agent_user.save(update_fields=["is_active"])
        res_user_inactive = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res_user_inactive.status_code, status.HTTP_200_OK)

        # All payloads must match
        self.assertEqual(res_verified.data, res_inactive.data)
        self.assertEqual(res_inactive.data, res_user_inactive.data)
        # None of them must send an email
        self.assertEqual(len(mail.outbox), 0)

    def test_64_email_verify_cooldown_does_not_reveal_account_existence(self):
        """Resend during cooldown returns same 200 payload and does not return 429."""
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        res1 = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

        res2 = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data, res2.data)
        # Exactly one email dispatched across both calls
        self.assertEqual(len(mail.outbox), 1)

    def test_65_email_verify_infrastructure_failure_fails_closed(self):
        """Failure in IP resolution or database fails closed with HTTP 500."""
        with mock.patch(
            "accounts.rate_limit.resolve_trusted_client_ip",
            side_effect=ClientIPResolutionError("Resolution failed"),
        ):
            res = self.client.post(
                VERIFY_EMAIL_REQUEST_URL,
                {"identifier": self.agent.agent_id},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

    def test_66_email_verify_email_changed_after_otp_issuance_old_otp_cannot_verify(self):
        """Old OTP sent to previous email cannot verify a newly registered email."""
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        # 1. Request verification OTP for current email (rohit.agent@example.com)
        res_req = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res_req.status_code, status.HTTP_200_OK)
        otp = self._extract_otp_from_email()

        # 2. Email changes on agent account
        self.agent_user.email = "rohit.newemail@example.com"
        self.agent_user.save(update_fields=["email"])

        # 3. Old OTP submitted against agent ID cannot verify the new email
        res_confirm = self.client.post(
            VERIFY_EMAIL_CONFIRM_URL,
            {"identifier": self.agent.agent_id, "otp": otp},
            format="json",
        )
        self.assertEqual(res_confirm.status_code, status.HTTP_400_BAD_REQUEST)
        self.agent.refresh_from_db()
        self.assertFalse(self.agent.email_verified)

    def test_67_email_verify_separate_from_login_rate_limiting(self):
        """Email-verification attempts do not consume login rate-limit quota and vice versa."""
        # Exhaust email-verification quota for identifier (3 requests)
        ident = "VC-AGT-44444"
        for _ in range(3):
            res_ev = self.client.post(
                VERIFY_EMAIL_REQUEST_URL,
                {"identifier": ident},
                format="json",
            )
            self.assertEqual(res_ev.status_code, status.HTTP_200_OK)

        # 4th email verify request is blocked
        res_ev_4 = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": ident},
            format="json",
        )
        self.assertEqual(res_ev_4.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        # Login OTP request for the same identifier MUST NOT be blocked!
        # Quotas are completely separated.
        res_login = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": ident},
            format="json",
        )
        # Login rate limiter should ALLOW and return 200 generic response
        self.assertEqual(res_login.status_code, status.HTTP_200_OK)

    def test_68_existing_password_reset_otp_behavior_remains_unchanged(self):
        """Standard customer/user password reset flow remains fully functional."""
        res_req = self.client.post(
            FORGOT_PASSWORD_URL,
            {"identifier": self.shop_admin.email},
            format="json",
        )
        self.assertEqual(res_req.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

        # Extract OTP from email
        match = re.search(r"\b(\d{6})\b", mail.outbox[0].body)
        self.assertIsNotNone(match)
        reset_otp = match.group(1)

        # Verify OTP
        res_ver = self.client.post(
            VERIFY_PASSWORD_RESET_OTP_URL,
            {"identifier": self.shop_admin.email, "otp": reset_otp},
            format="json",
        )
        self.assertEqual(res_ver.status_code, status.HTTP_200_OK)
        self.assertIn("reset_token", res_ver.data)

    def test_69_email_verification_confirm_refreshes_agent_under_lock(self):
        """Confirming OTP re-fetches agent under lock; if agent was deactivated, confirmation rejects."""
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        res_req = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        self.assertEqual(res_req.status_code, status.HTTP_200_OK)
        otp = self._extract_otp_from_email()

        # Simulate agent deactivation in database before confirmation executes
        DeliveryAgent.objects.filter(pk=self.agent.pk).update(is_active=False)

        res_confirm = self.client.post(
            VERIFY_EMAIL_CONFIRM_URL,
            {"identifier": self.agent.agent_id, "otp": otp},
            format="json",
        )
        self.assertEqual(res_confirm.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("invalid or expired", res_confirm.data["detail"].lower())

        self.agent.refresh_from_db()
        self.assertFalse(self.agent.email_verified)

    def test_70_email_delivery_failure_returns_indistinguishable_response(self):
        """When email delivery fails, public response is indistinguishable from unknown accounts."""
        self.agent.email_verified = False
        self.agent.save(update_fields=["email_verified"])

        # Unknown account response baseline
        res_unknown = self.client.post(
            VERIFY_EMAIL_REQUEST_URL,
            {"identifier": "VC-AGT-98765"},
            format="json",
        )
        self.assertEqual(res_unknown.status_code, status.HTTP_200_OK)

        # Existing account with email delivery failure
        with mock.patch("accounts.views.auth.send_mail", side_effect=RuntimeError("SMTP connection dropped")):
            res_fail = self.client.post(
                VERIFY_EMAIL_REQUEST_URL,
                {"identifier": self.agent.agent_id},
                format="json",
            )
            self.assertEqual(res_fail.status_code, status.HTTP_200_OK)
            self.assertEqual(res_fail.data, res_unknown.data)

        # Challenge was invalidated so no undelivered code remains usable
        failed_record = (
            PasswordResetOTP.objects.filter(
                user=self.agent_user,
                purpose="delivery_agent_email_verify",
            )
            .order_by("-created_at")
            .first()
        )
        self.assertIsNotNone(failed_record)
        self.assertIsNotNone(failed_record.used_at)

    # -------------------------------------------------------------------------
    # 71. Successful Delivery Agent token refresh (P0)
    # -------------------------------------------------------------------------
    def test_71_successful_delivery_agent_token_refresh(self):
        """Active, fully verified delivery agent successfully refreshes tokens."""
        # 1-4. Preconditions: active agent, active user, verified contact details
        self.assertTrue(self.agent.is_active)
        self.assertTrue(self.agent_user.is_active)
        self.assertTrue(self.agent.phone_verified)
        self.assertTrue(self.agent.email_verified)
        self.assertTrue(bool(self.agent_user.phone_number))
        self.assertTrue(bool(self.agent_user.email))

        # 5. Obtain valid tokens through real OTP login flow
        refresh, initial_access = self._obtain_delivery_agent_tokens()
        self.assertTrue(bool(refresh))
        self.assertTrue(bool(initial_access))

        # 6. Submit returned refresh token to real refresh endpoint
        res_refresh = self.client.post(
            TOKEN_REFRESH_URL,
            {"refresh": refresh},
            format="json",
        )

        # 7-8. Endpoint returns HTTP 200 and a new valid access token
        self.assertEqual(res_refresh.status_code, status.HTTP_200_OK)
        self.assertIn("access", res_refresh.data)
        new_access = res_refresh.data["access"]
        self.assertTrue(bool(new_access))

        # 9. Returned token can authenticate an authorized Delivery Agent request
        res_auth = self.client.get(
            DELIVERY_AGENT_AVAILABILITY_URL,
            HTTP_AUTHORIZATION=f"Bearer {new_access}",
        )
        self.assertEqual(res_auth.status_code, status.HTTP_200_OK)
        self.assertEqual(res_auth.data["agent_id"], self.agent.id)
        self.assertEqual(res_auth.data["public_agent_id"], self.agent.agent_id)

    # -------------------------------------------------------------------------
    # 72. Wrong-role OTP request (P1)
    # -------------------------------------------------------------------------
    def test_72_wrong_role_otp_request_rejected_without_email(self):
        """Customer or Shop Admin identifier receives generic 200 but no OTP or challenge."""
        # 1. Existing customer has a registered phone number
        customer_phone = "+919876543299"
        self.customer_user.phone_number = customer_phone
        self.customer_user.save(update_fields=["phone_number"])
        self.assertEqual(self.customer_user.role, "customer")

        mail.outbox.clear()
        initial_challenges_count = DeliveryAgentLoginChallenge.objects.count()

        # 2. Submit customer phone to delivery agent request-otp endpoint
        res = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": customer_phone},
            format="json",
        )

        # 3. Generic anti-enumeration response contract
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(
            res.data.get("message"),
            "If an eligible account matches the submitted identifier, a verification code has been sent.",
        )
        self.assertIn("challenge_id", res.data)
        self.assertEqual(res.data.get("resend_cooldown_seconds"), 60)
        self.assertEqual(res.data.get("expires_in_seconds"), 300)

        # 4. No login OTP email is dispatched
        self.assertEqual(len(mail.outbox), 0)

        # 5. No Delivery Agent login challenge is created for that account
        self.assertEqual(
            DeliveryAgentLoginChallenge.objects.count(),
            initial_challenges_count,
        )
        self.assertFalse(
            DeliveryAgentLoginChallenge.objects.filter(
                delivery_agent__user=self.customer_user
            ).exists()
        )

        # Also test with existing shop admin phone number
        admin_phone = "+919876543298"
        self.shop_admin.phone_number = admin_phone
        self.shop_admin.save(update_fields=["phone_number"])
        self.assertEqual(self.shop_admin.role, "shop_admin")

        res_admin = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": admin_phone},
            format="json",
        )
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(
            DeliveryAgentLoginChallenge.objects.count(),
            initial_challenges_count,
        )

    # -------------------------------------------------------------------------
    # 73. Actual JWT Bearer authentication (P1)
    # -------------------------------------------------------------------------
    def test_73_actual_jwt_bearer_authentication_pipeline(self):
        """Exercise the real HTTP authentication pipeline using Authorization: Bearer <token>."""
        # 1. Valid access token issued through real Delivery Agent OTP login
        refresh, access_token = self._obtain_delivery_agent_tokens()

        res_valid = self.client.get(
            DELIVERY_AGENT_AVAILABILITY_URL,
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
        )
        self.assertEqual(res_valid.status_code, status.HTTP_200_OK)
        self.assertEqual(res_valid.data["agent_id"], self.agent.id)
        self.assertEqual(res_valid.data["public_agent_id"], self.agent.agent_id)

        # 2. Malformed or tampered token is rejected with HTTP 401
        res_malformed = self.client.get(
            DELIVERY_AGENT_AVAILABILITY_URL,
            HTTP_AUTHORIZATION="Bearer malformed.or.invalid.token.payload",
        )
        self.assertEqual(res_malformed.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res_malformed.data.get("code"), "token_not_valid")

        tampered_token = access_token[:-10] + "tampered00"
        res_tampered = self.client.get(
            DELIVERY_AGENT_AVAILABILITY_URL,
            HTTP_AUTHORIZATION=f"Bearer {tampered_token}",
        )
        self.assertEqual(res_tampered.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res_tampered.data.get("code"), "token_not_valid")

        # 3. Expired token is rejected with HTTP 401
        expired_token = AccessToken.for_user(self.agent_user)
        expired_token["role"] = self.agent_user.role
        expired_token.set_exp(lifetime=-timedelta(minutes=5))
        res_expired = self.client.get(
            DELIVERY_AGENT_AVAILABILITY_URL,
            HTTP_AUTHORIZATION=f"Bearer {str(expired_token)}",
        )
        self.assertEqual(res_expired.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res_expired.data.get("code"), "token_not_valid")

        # 4. Missing credentials are rejected with HTTP 401
        res_missing = self.client.get(DELIVERY_AGENT_AVAILABILITY_URL)
        self.assertEqual(res_missing.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("detail", res_missing.data)

    # -------------------------------------------------------------------------
    # Development-only Console OTP Delivery Tests
    # -------------------------------------------------------------------------
    def _extract_otp_from_console(self, console_output: str) -> str:
        match = re.search(r"code is:?\s*(\d{6})\b", console_output)
        if not match:
            match = re.search(r"\b\d{6}\b", console_output)
        self.assertIsNotNone(match, "6-digit OTP not found in console output")
        return match.group(1) if match.lastindex else match.group(0)

    @override_settings(DEBUG=True, DELIVERY_AGENT_OTP_CONSOLE_FALLBACK=True)
    def test_74_console_otp_delivery_enabled_in_development(self):
        """When DEBUG and console fallback are active, agent without email receives console OTP and can log in."""
        self.agent_user.email = ""
        self.agent_user.save(update_fields=["email"])

        with mock.patch("sys.stdout", new_callable=io.StringIO) as fake_stdout:
            response = self.client.post(
                REQUEST_OTP_URL,
                {"identifier": self.agent.agent_id},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn("challenge_id", response.data)
            self.assertIn("message", response.data)
            # Normal email outbox must not have received anything
            self.assertEqual(len(mail.outbox), 0)

            console_output = fake_stdout.getvalue()
            self.assertIn("[DEVELOPMENT ONLY - CONSOLE OTP DELIVERY]", console_output)
            self.assertIn(self.agent.agent_id, console_output)
            raw_otp = self._extract_otp_from_console(console_output)

            # Challenge record in DB has STATUS_SUCCEEDED
            challenge = DeliveryAgentLoginChallenge.objects.get(delivery_agent=self.agent)
            self.assertEqual(challenge.email_status, DeliveryAgentLoginChallenge.STATUS_SUCCEEDED)

            # Verify OTP succeeds and yields JWT tokens
            verify_res = self.client.post(
                VERIFY_OTP_URL,
                {
                    "challenge_id": response.data["challenge_id"],
                    "otp": raw_otp,
                },
                format="json",
            )
            self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
            self.assertIn("access", verify_res.data)
            self.assertIn("refresh", verify_res.data)

            # Token refresh also succeeds under console fallback
            refresh_token = verify_res.data["refresh"]
            refresh_res = self.client.post(
                TOKEN_REFRESH_URL,
                {"refresh": refresh_token},
                format="json",
            )
            self.assertEqual(refresh_res.status_code, status.HTTP_200_OK)
            self.assertIn("access", refresh_res.data)

    @override_settings(DEBUG=False, DELIVERY_AGENT_OTP_CONSOLE_FALLBACK=True)
    def test_75_console_fallback_disabled_when_debug_is_false(self):
        """When DEBUG=False, console fallback is rejected even if flag is True."""
        self.agent_user.email = ""
        self.agent_user.save(update_fields=["email"])

        with mock.patch("sys.stdout", new_callable=io.StringIO) as fake_stdout:
            response = self.client.post(
                REQUEST_OTP_URL,
                {"identifier": self.agent.agent_id},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn("message", response.data)
            # Anti-enumeration response: no challenge created, no email, no console output
            self.assertEqual(DeliveryAgentLoginChallenge.objects.count(), 0)
            self.assertEqual(len(mail.outbox), 0)
            self.assertNotIn("[DEVELOPMENT ONLY - CONSOLE OTP DELIVERY]", fake_stdout.getvalue())

    @override_settings(DEBUG=True, DELIVERY_AGENT_OTP_CONSOLE_FALLBACK=False)
    def test_76_console_fallback_disabled_when_flag_is_false(self):
        """When DELIVERY_AGENT_OTP_CONSOLE_FALLBACK=False, agent without email is rejected."""
        self.agent_user.email = ""
        self.agent_user.save(update_fields=["email"])

        with mock.patch("sys.stdout", new_callable=io.StringIO) as fake_stdout:
            response = self.client.post(
                REQUEST_OTP_URL,
                {"identifier": self.agent.agent_id},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(DeliveryAgentLoginChallenge.objects.count(), 0)
            self.assertEqual(len(mail.outbox), 0)
            self.assertNotIn("[DEVELOPMENT ONLY - CONSOLE OTP DELIVERY]", fake_stdout.getvalue())

    @override_settings(DEBUG=True, DELIVERY_AGENT_OTP_CONSOLE_FALLBACK=True)
    def test_77_existing_verified_email_accounts_still_use_email_delivery(self):
        """Accounts with verified email continue using email delivery, not console fallback."""
        self.assertTrue(self.agent.email_verified)
        self.assertTrue(bool(self.agent_user.email))

        with mock.patch("sys.stdout", new_callable=io.StringIO) as fake_stdout:
            response = self.client.post(
                REQUEST_OTP_URL,
                {"identifier": self.agent.agent_id},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            # Email delivery used
            self.assertEqual(len(mail.outbox), 1)
            self.assertEqual(mail.outbox[0].to, [self.agent_user.email])
            # Console output not used
            self.assertNotIn("[DEVELOPMENT ONLY - CONSOLE OTP DELIVERY]", fake_stdout.getvalue())

    @override_settings(DEBUG=True, DELIVERY_AGENT_OTP_CONSOLE_FALLBACK=True)
    def test_78_otp_never_appears_in_http_response(self):
        """OTP is never exposed in response body under either console or email delivery."""
        # 1. Console fallback path
        self.agent_user.email = ""
        self.agent_user.save(update_fields=["email"])

        with mock.patch("sys.stdout", new_callable=io.StringIO) as fake_stdout:
            res_console = self.client.post(
                REQUEST_OTP_URL,
                {"identifier": self.agent.agent_id},
                format="json",
            )
            otp_console = self._extract_otp_from_console(fake_stdout.getvalue())
            self.assertNotIn(otp_console, str(res_console.data))
            self.assertNotIn(otp_console, res_console.content.decode("utf-8"))
            self.assertNotIn("otp", res_console.data)

        # 2. Email delivery path
        self.agent_user.email = "rohit.agent@example.com"
        self.agent_user.save(update_fields=["email"])
        self.agent.email_verified = True
        self.agent.save(update_fields=["email_verified"])
        DeliveryAgentLoginChallenge.objects.all().delete()

        res_email = self.client.post(
            REQUEST_OTP_URL,
            {"identifier": self.agent.agent_id},
            format="json",
        )
        otp_email = self._extract_otp_from_email()
        self.assertNotIn(otp_email, str(res_email.data))
        self.assertNotIn(otp_email, res_email.content.decode("utf-8"))
        self.assertNotIn("otp", res_email.data)

    @override_settings(DEBUG=True, DELIVERY_AGENT_OTP_CONSOLE_FALLBACK=True)
    def test_79_console_fallback_expiration_and_attempt_limits_preserved(self):
        """Under console fallback, attempt limits and expiry are strictly enforced."""
        self.agent_user.email = ""
        self.agent_user.save(update_fields=["email"])

        with mock.patch("sys.stdout", new_callable=io.StringIO) as fake_stdout:
            res = self.client.post(REQUEST_OTP_URL, {"identifier": self.agent.agent_id}, format="json")
            challenge_id = res.data["challenge_id"]
            raw_otp = self._extract_otp_from_console(fake_stdout.getvalue())

        challenge = DeliveryAgentLoginChallenge.objects.get(delivery_agent=self.agent)

        # 1. Wrong attempts increment counter
        for attempt in range(1, 5):
            res_wrong = self.client.post(
                VERIFY_OTP_URL,
                {"challenge_id": challenge_id, "otp": "000000"},
                format="json",
            )
            self.assertEqual(res_wrong.status_code, status.HTTP_400_BAD_REQUEST)
            remaining = 5 - attempt
            self.assertIn(f"{remaining} attempt(s) remaining", res_wrong.data["detail"])

        # 2. 5th wrong attempt invalidates challenge
        res_5th = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": "000000"},
            format="json",
        )
        self.assertEqual(res_5th.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Maximum attempts exceeded", res_5th.data["detail"])
        challenge.refresh_from_db()
        self.assertIsNotNone(challenge.invalidated_at)

        # 3. Subsequent attempt with correct OTP is rejected
        res_after = self.client.post(
            VERIFY_OTP_URL,
            {"challenge_id": challenge_id, "otp": raw_otp},
            format="json",
        )
        self.assertEqual(res_after.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(DEBUG=True, DELIVERY_AGENT_OTP_CONSOLE_FALLBACK=True)
    def test_80_console_fallback_for_unverified_email_and_unverified_phone(self):
        """Under development fallback, agent with unverified phone and unverified email receives console OTP and logs in."""
        self.agent.phone_verified = False
        self.agent.email_verified = False
        self.agent.save(update_fields=["phone_verified", "email_verified"])
        # Agent has populated email
        self.assertTrue(bool(self.agent_user.email))

        with mock.patch("sys.stdout", new_callable=io.StringIO) as fake_stdout:
            response = self.client.post(
                REQUEST_OTP_URL,
                {"identifier": self.agent.agent_id},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["message"], "Verification code printed to development console.")
            self.assertEqual(len(mail.outbox), 0)

            console_output = fake_stdout.getvalue()
            self.assertIn("[DEVELOPMENT ONLY - CONSOLE OTP DELIVERY]", console_output)
            self.assertIn(self.agent.agent_id, console_output)
            raw_otp = self._extract_otp_from_console(console_output)

            # Verification succeeds
            verify_res = self.client.post(
                VERIFY_OTP_URL,
                {"challenge_id": response.data["challenge_id"], "otp": raw_otp},
                format="json",
            )
            self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
            self.assertIn("access", verify_res.data)
            self.assertIn("refresh", verify_res.data)

            # Token refresh also succeeds
            refresh_res = self.client.post(
                TOKEN_REFRESH_URL,
                {"refresh": verify_res.data["refresh"]},
                format="json",
            )
            self.assertEqual(refresh_res.status_code, status.HTTP_200_OK)
            self.assertIn("access", refresh_res.data)

        # But when DEBUG=False, unverified phone/email is strictly rejected
        with override_settings(DEBUG=False, DELIVERY_AGENT_OTP_CONSOLE_FALLBACK=True):
            DeliveryAgentLoginChallenge.objects.all().delete()
            res_prod = self.client.post(
                REQUEST_OTP_URL,
                {"identifier": self.agent.agent_id},
                format="json",
            )
            self.assertEqual(res_prod.status_code, status.HTTP_200_OK)
            self.assertEqual(DeliveryAgentLoginChallenge.objects.count(), 0)


