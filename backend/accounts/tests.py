import re
from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.contrib.auth.hashers import make_password
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import PasswordResetOTP
from users.models import User


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AuthenticationTests(APITestCase):
    def setUp(self):
        self.password = "StrongPassword123!"
        self.user = User.objects.create_user(
            username="eco_thread",
            email="owner@example.com",
            password=self.password,
            role="customer",
        )

    def login(self, identifier="eco_thread", password=None):
        return self.client.post(
            "/api/token/",
            {
                "username": identifier,
                "password": password or self.password,
            },
            format="json",
        )

    def request_otp(self):
        response = self.client.post(
            "/api/auth/forgot-password/",
            {"identifier": self.user.username},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(mail.outbox), 1)
        return re.search(r"\b\d{6}\b", mail.outbox[-1].body).group()

    def verify_otp(self, otp):
        return self.client.post(
            "/api/auth/verify-otp/",
            {"identifier": self.user.username, "otp": otp},
            format="json",
        )

    def test_login_accepts_username_and_email(self):
        username_response = self.login()
        email_response = self.login(identifier="owner@example.com")

        self.assertEqual(username_response.status_code, 200)
        self.assertEqual(email_response.status_code, 200)
        self.assertIn("access", username_response.data)
        self.assertIn("refresh", username_response.data)
        self.assertEqual(username_response.data["role"], "customer")

    def test_login_rejects_invalid_credentials_without_account_leak(self):
        wrong_password = self.login(password="WrongPassword123!")
        unknown_identifier = self.login(identifier="unknown@example.com")

        self.assertEqual(wrong_password.status_code, 401)
        self.assertEqual(unknown_identifier.status_code, 401)
        self.assertEqual(
            wrong_password.data["detail"],
            unknown_identifier.data["detail"],
        )

    def test_registration_requires_email_and_forces_customer_role(self):
        response = self.client.post(
            "/api/register/",
            {
                "username": "new_customer",
                "password": "AnotherStrong123!",
                "password_confirm": "AnotherStrong123!",
                "role": "platform_admin",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

        response = self.client.post(
            "/api/register/",
            {
                "username": "new_customer",
                "email": "new@example.com",
                "password": "AnotherStrong123!",
                "password_confirm": "AnotherStrong123!",
                "role": "platform_admin",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            User.objects.get(username="new_customer").role,
            "customer",
        )

    def test_registration_rejects_duplicate_username_and_email(self):
        duplicate_username = self.client.post(
            "/api/register/",
            {
                "username": self.user.username,
                "email": "different@example.com",
                "password": "AnotherStrong123!",
                "password_confirm": "AnotherStrong123!",
            },
            format="json",
        )
        duplicate_email = self.client.post(
            "/api/register/",
            {
                "username": "different_user",
                "email": self.user.email,
                "password": "AnotherStrong123!",
                "password_confirm": "AnotherStrong123!",
            },
            format="json",
        )

        self.assertEqual(duplicate_username.status_code, 400)
        self.assertEqual(duplicate_email.status_code, 400)

    def test_forgot_password_creates_hashed_otp(self):
        otp = self.request_otp()
        record = PasswordResetOTP.objects.get(user=self.user)

        self.assertNotEqual(record.code_hash, otp)
        self.assertEqual(self.verify_otp(otp).status_code, 200)

    def test_forgot_password_accepts_email_identifier(self):
        response = self.client.post(
            "/api/auth/forgot-password/",
            {"identifier": self.user.email},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(mail.outbox[-1].to, [self.user.email])
        self.assertTrue(
            PasswordResetOTP.objects.filter(user=self.user).exists()
        )

    def test_forgot_password_does_not_reveal_unknown_identifiers(self):
        for identifier in ("unknown_user", "unknown@example.com"):
            with self.subTest(identifier=identifier):
                response = self.client.post(
                    "/api/auth/forgot-password/",
                    {"identifier": identifier},
                    format="json",
                )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response.data,
                    {
                        "message": "If an account matches the submitted identifier, a verification code has been sent."
                    },
                )

        self.assertEqual(len(mail.outbox), 0)
        self.assertFalse(PasswordResetOTP.objects.exists())

    def test_forgot_password_does_not_send_for_legacy_user_without_email(self):
        legacy_user = User.objects.create_user(
            username="legacy_user",
            email=None,
            password=self.password,
            role="customer",
        )

        response = self.client.post(
            "/api/auth/forgot-password/",
            {"username": legacy_user.username},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            {
                "message": "If an account matches the submitted identifier, a verification code has been sent."
            },
        )
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(DEBUG=True)
    @patch("accounts.views.auth.send_mail", side_effect=RuntimeError("SMTP failure"))
    @patch("builtins.print")
    def test_email_exception_cleans_up_otp_and_does_not_print(
        self,
        mock_print,
        mock_send_mail,
    ):
        response = self.client.post(
            "/api/auth/forgot-password/",
            {"identifier": self.user.username},
            format="json",
        )

        self.assertEqual(response.status_code, 503)
        mock_send_mail.assert_called_once()
        mock_print.assert_not_called()
        self.assertFalse(
            PasswordResetOTP.objects.filter(user=self.user).exists()
        )

    @patch("accounts.views.auth.send_mail", return_value=0)
    def test_zero_message_email_send_cleans_up_otp(self, mock_send_mail):
        response = self.client.post(
            "/api/auth/forgot-password/",
            {"identifier": self.user.username},
            format="json",
        )

        self.assertEqual(response.status_code, 503)
        mock_send_mail.assert_called_once()
        self.assertFalse(
            PasswordResetOTP.objects.filter(user=self.user).exists()
        )

    @override_settings(DEBUG=True)
    @patch("builtins.print")
    def test_debug_true_prints_sent_otp(self, mock_print):
        otp = self.request_otp()

        mock_print.assert_called_once()
        printed = " ".join(str(arg) for arg in mock_print.call_args.args)
        self.assertIn(otp, printed)

    @override_settings(DEBUG=False)
    @patch("builtins.print")
    def test_debug_false_does_not_print_otp(self, mock_print):
        self.request_otp()

        mock_print.assert_not_called()

    def test_expired_otp_is_rejected(self):
        self.request_otp()
        record = PasswordResetOTP.objects.get(user=self.user)
        record.expires_at = timezone.now() - timedelta(minutes=1)
        record.save(update_fields=["expires_at"])

        response = self.verify_otp("000000")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(record.refresh_from_db(), None)
        self.assertIsNotNone(record.used_at)

    def test_invalid_otp_is_limited_and_cannot_be_reused(self):
        otp = self.request_otp()

        for _ in range(5):
            response = self.verify_otp("000000")
            self.assertEqual(response.status_code, 400)

        record = PasswordResetOTP.objects.get(user=self.user)
        self.assertEqual(record.attempts, 5)
        self.assertIsNotNone(record.used_at)

        fresh_otp = self.request_otp()
        verified = self.verify_otp(fresh_otp)
        reused = self.verify_otp(fresh_otp)
        self.assertEqual(verified.status_code, 200)
        self.assertEqual(reused.status_code, 400)

    def test_reset_password_requires_verified_otp_and_is_one_time(self):
        unverified = self.client.post(
            "/api/auth/reset-password/",
            {
                "identifier": self.user.username,
                "reset_token": "not-valid",
                "new_password": "NewStrongPassword123!",
                "password_confirm": "NewStrongPassword123!",
            },
            format="json",
        )
        self.assertEqual(unverified.status_code, 400)

        otp = self.request_otp()
        verification = self.verify_otp(otp)
        reset = self.client.post(
            "/api/auth/reset-password/",
            {
                "identifier": self.user.username,
                "reset_token": verification.data["reset_token"],
                "new_password": "NewStrongPassword123!",
                "password_confirm": "NewStrongPassword123!",
            },
            format="json",
        )
        reused = self.client.post(
            "/api/auth/reset-password/",
            {
                "identifier": self.user.username,
                "reset_token": verification.data["reset_token"],
                "new_password": "AnotherNewPassword123!",
                "password_confirm": "AnotherNewPassword123!",
            },
            format="json",
        )

        self.assertEqual(reset.status_code, 200)
        self.assertEqual(reused.status_code, 400)
        self.assertEqual(
            self.login(password="NewStrongPassword123!").status_code,
            200,
        )

    def test_invalid_reset_token_is_rejected_after_otp_verification(self):
        otp = self.request_otp()
        verification = self.verify_otp(otp)

        response = self.client.post(
            "/api/auth/reset-password/",
            {
                "identifier": self.user.username,
                "reset_token": "not-valid",
                "new_password": "NewStrongPassword123!",
                "password_confirm": "NewStrongPassword123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.password))
        record = PasswordResetOTP.objects.get(user=self.user)
        self.assertIsNotNone(record.verified_at)
        self.assertIsNone(record.used_at)

    def test_reset_password_rejects_mismatch_and_invalid_password(self):
        otp = self.request_otp()
        verification = self.verify_otp(otp)

        mismatch = self.client.post(
            "/api/auth/reset-password/",
            {
                "identifier": self.user.username,
                "reset_token": verification.data["reset_token"],
                "new_password": "NewStrongPassword123!",
                "password_confirm": "DifferentPassword123!",
            },
            format="json",
        )

        self.assertEqual(mismatch.status_code, 400)

        invalid_password = self.client.post(
            "/api/auth/reset-password/",
            {
                "identifier": self.user.username,
                "reset_token": verification.data["reset_token"],
                "new_password": "password",
                "password_confirm": "password",
            },
            format="json",
        )

        self.assertEqual(invalid_password.status_code, 400)

    def test_change_password_requires_current_password(self):
        access = self.login().data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        wrong_current = self.client.post(
            "/api/auth/change-password/",
            {
                "current_password": "WrongPassword123!",
                "new_password": "NewStrongPassword123!",
                "password_confirm": "NewStrongPassword123!",
            },
            format="json",
        )
        success = self.client.post(
            "/api/auth/change-password/",
            {
                "current_password": self.password,
                "new_password": "NewStrongPassword123!",
                "password_confirm": "NewStrongPassword123!",
            },
            format="json",
        )

        self.assertEqual(wrong_current.status_code, 400)
        self.assertEqual(success.status_code, 200)

    def test_username_change_is_authenticated_and_unique(self):
        other_user = User.objects.create_user(
            username="other_user",
            email="other@example.com",
            password=self.password,
            role="customer",
        )
        access = self.login().data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        duplicate = self.client.patch(
            "/api/profile/",
            {"username": other_user.username},
            format="json",
        )
        changed = self.client.patch(
            "/api/profile/",
            {"username": "renamed_customer"},
            format="json",
        )

        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(
            duplicate.data["username"][0],
            "Username already taken.",
        )
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(User.objects.get(pk=self.user.pk).username, "renamed_customer")
        self.assertEqual(User.objects.get(pk=other_user.pk).username, "other_user")

    def test_legacy_user_with_null_email_is_preserved(self):
        legacy_user = User.objects.create(
            username="legacy_null_email",
            email=None,
            password=make_password(self.password),
            role="customer",
        )

        legacy_user.refresh_from_db()
        self.assertIsNone(legacy_user.email)


class CustomerRoleAuthorizationTests(APITestCase):
    customer_endpoints = ("/api/profile/", "/api/orders/")

    def setUp(self):
        password = "StrongPassword123!"
        self.customer = User.objects.create_user(
            username="customer_user",
            email="customer@example.com",
            password=password,
            role="customer",
        )
        self.non_customer_users = {
            role: User.objects.create_user(
                username=f"{role}_user",
                email=f"{role}@example.com",
                password=password,
                role=role,
            )
            for role in ("shop_admin", "delivery_agent", "platform_admin")
        }

    def test_customer_can_access_customer_endpoints(self):
        self.client.force_authenticate(user=self.customer)

        for endpoint in self.customer_endpoints:
            with self.subTest(endpoint=endpoint):
                self.assertEqual(self.client.get(endpoint).status_code, 200)

    def test_non_customer_roles_are_denied_customer_endpoints(self):
        for role, user in self.non_customer_users.items():
            self.client.force_authenticate(user=user)

            for endpoint in self.customer_endpoints:
                with self.subTest(role=role, endpoint=endpoint):
                    self.assertEqual(self.client.get(endpoint).status_code, 403)

    def test_unauthenticated_users_are_denied_customer_endpoints(self):
        self.client.force_authenticate(user=None)

        for endpoint in self.customer_endpoints:
            with self.subTest(endpoint=endpoint):
                self.assertEqual(self.client.get(endpoint).status_code, 401)
