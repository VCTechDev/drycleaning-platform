import hashlib
import hmac
from datetime import time, timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, connection, transaction
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.test.utils import skipUnless
from django.utils import timezone

from accounts.models import DeliveryAgentLoginChallenge, PasswordResetOTP
from logistics.models import (
    DeliveryAgent,
    DeliveryOTPAuditLog,
    DeliveryVerificationOTP,
)
from shops.models import Shop
from users.models import User


class DeliveryAgentLoginChallengeTests(TestCase):
    def setUp(self):
        self.password = "StrongPassword123!"
        self.shop_admin = User.objects.create_user(
            username="login_challenge_shop_admin",
            email="login-challenge-admin@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.shop = Shop.objects.create(
            shop_admin=self.shop_admin,
            shop_name="Login Challenge Cleaners",
            contact_number="9876543220",
            address_line="Login Challenge Road",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
        )
        self.agent_user = User.objects.create_user(
            username="login_challenge_agent",
            email="login-challenge-agent@example.com",
            password=self.password,
            role="delivery_agent",
            phone_number="+919876543224",
        )
        self.agent = DeliveryAgent.objects.create(
            user=self.agent_user,
            shop=self.shop,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
        )

    def create_challenge(self, **overrides):
        now = timezone.now()
        values = {
            "delivery_agent": self.agent,
            "challenge_id_digest": "a" * 64,
            "otp_hash": make_password("123456"),
            "expires_at": now + timedelta(minutes=5),
            "resend_available_at": now + timedelta(seconds=60),
        }
        values.update(overrides)
        return DeliveryAgentLoginChallenge.objects.create(**values)

    def create_second_agent(self):
        second_agent_user = User.objects.create_user(
            username="login_challenge_agent_two",
            email="login-challenge-agent-two@example.com",
            password=self.password,
            role="delivery_agent",
            phone_number="+919876543225",
        )
        return DeliveryAgent.objects.create(
            user=second_agent_user,
            shop=self.shop,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
        )

    def test_model_creation_defaults_and_relationship(self):
        challenge = self.create_challenge()

        self.assertEqual(challenge.delivery_agent, self.agent)
        self.assertEqual(challenge.incorrect_attempts, 0)
        self.assertEqual(
            challenge.sms_status,
            DeliveryAgentLoginChallenge.STATUS_PENDING,
        )
        self.assertEqual(
            challenge.email_status,
            DeliveryAgentLoginChallenge.STATUS_NOT_AVAILABLE,
        )
        self.assertIsNone(challenge.used_at)
        self.assertIsNone(challenge.invalidated_at)
        self.assertIsNone(challenge.verified_at)
        self.assertIsNotNone(challenge.created_at)

    def test_otp_is_stored_as_a_hash(self):
        raw_otp = "123456"
        challenge = self.create_challenge(otp_hash=make_password(raw_otp))

        self.assertNotEqual(challenge.otp_hash, raw_otp)
        self.assertTrue(check_password(raw_otp, challenge.otp_hash))

    def test_challenge_id_digest_is_stored_without_raw_identifier(self):
        raw_challenge_id = "opaque-challenge-id"
        digest = hmac.new(
            b"test-login-secret",
            raw_challenge_id.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        challenge = self.create_challenge(challenge_id_digest=digest)

        self.assertEqual(challenge.challenge_id_digest, digest)
        self.assertEqual(len(challenge.challenge_id_digest), 64)
        self.assertNotEqual(challenge.challenge_id_digest, raw_challenge_id)

    @skipUnless(
        connection.vendor == "postgresql",
        "Database check constraint test requires PostgreSQL.",
    )
    def test_negative_attempt_count_is_rejected_by_database_constraint(self):
        challenge = self.create_challenge()
        challenge.incorrect_attempts = -1

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                challenge.save(update_fields=["incorrect_attempts"])

    @skipUnless(
        connection.vendor == "postgresql",
        "Partial unique constraint test requires PostgreSQL.",
    )
    def test_two_active_challenges_for_one_agent_are_rejected(self):
        self.create_challenge()

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self.create_challenge(challenge_id_digest="b" * 64)

    def test_used_challenge_does_not_block_new_active_challenge(self):
        self.create_challenge(
            used_at=timezone.now(),
            challenge_id_digest="c" * 64,
        )

        challenge = self.create_challenge(challenge_id_digest="d" * 64)

        self.assertIsNone(challenge.used_at)
        self.assertIsNone(challenge.invalidated_at)

    def test_invalidated_challenge_does_not_block_new_active_challenge(self):
        self.create_challenge(
            invalidated_at=timezone.now(),
            challenge_id_digest="e" * 64,
        )

        challenge = self.create_challenge(challenge_id_digest="f" * 64)

        self.assertIsNone(challenge.used_at)
        self.assertIsNone(challenge.invalidated_at)

    def test_different_agent_can_have_an_active_challenge(self):
        second_agent = self.create_second_agent()
        self.create_challenge()

        challenge = self.create_challenge(
            delivery_agent=second_agent,
            challenge_id_digest="b" * 64,
        )

        self.assertEqual(challenge.delivery_agent, second_agent)

    @skipUnless(
        connection.vendor == "postgresql",
        "Unique constraint test requires PostgreSQL.",
    )
    def test_duplicate_challenge_digest_is_rejected(self):
        self.create_challenge(used_at=timezone.now())

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self.create_challenge(
                    challenge_id_digest="a" * 64,
                )

    @skipUnless(
        connection.vendor == "postgresql",
        "PostgreSQL constraint introspection test requires PostgreSQL.",
    )
    def test_expected_postgresql_indexes_and_constraints_exist(self):
        table_name = DeliveryAgentLoginChallenge._meta.db_table

        with connection.cursor() as cursor:
            constraints = connection.introspection.get_constraints(
                cursor,
                table_name,
            )

        active_constraint = constraints[
            "accounts_delivery_agent_login_active_unique"
        ]
        self.assertTrue(active_constraint["unique"])
        self.assertEqual(active_constraint["columns"], ["delivery_agent_id"])
        self.assertTrue(
            constraints["accounts_login_attempts_non_negative"]["check"]
        )

        digest_constraints = [
            constraint
            for constraint in constraints.values()
            if constraint["unique"]
            and constraint["columns"] == ["challenge_id_digest"]
        ]
        self.assertEqual(len(digest_constraints), 1)

        expected_indexes = {
            tuple(
                DeliveryAgentLoginChallenge._meta.get_field(field_name).column
                for field_name in index.fields
            )
            for index in DeliveryAgentLoginChallenge._meta.indexes
        }
        database_indexes = {
            tuple(constraint["columns"])
            for constraint in constraints.values()
            if constraint["index"] and not constraint["unique"]
        }
        self.assertTrue(expected_indexes.issubset(database_indexes))

    def test_deleting_agent_cascades_to_login_challenges(self):
        challenge = self.create_challenge()
        challenge_id = challenge.pk

        self.agent.delete()

        self.assertFalse(
            DeliveryAgentLoginChallenge.objects.filter(pk=challenge_id).exists()
        )

    def test_channel_status_choices_are_enforced_by_model_validation(self):
        challenge = self.create_challenge(
            sms_status=DeliveryAgentLoginChallenge.STATUS_SUCCEEDED,
            email_status=DeliveryAgentLoginChallenge.STATUS_FAILED,
        )
        challenge.full_clean()

        challenge.sms_status = "delivered"
        with self.assertRaises(ValidationError):
            challenge.full_clean()

    def test_existing_password_reset_and_handover_otp_models_remain_separate(self):
        password_reset_fields = {
            field.name for field in PasswordResetOTP._meta.get_fields()
        }
        handover_fields = {
            field.name for field in DeliveryVerificationOTP._meta.get_fields()
        }
        audit_fields = {
            field.name for field in DeliveryOTPAuditLog._meta.get_fields()
        }

        self.assertIn("code_hash", password_reset_fields)
        self.assertIn("verification_token_hash", password_reset_fields)
        self.assertIn("task", handover_fields)
        self.assertIn("consecutive_failed_attempts", handover_fields)
        self.assertIn("delivery_agent", audit_fields)
        self.assertNotIn("login_challenges", password_reset_fields)
        self.assertNotIn("login_challenges", handover_fields)

        password_reset = PasswordResetOTP.objects.create(
            user=self.agent_user,
            code_hash=make_password("123456"),
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        self.assertIsNotNone(password_reset.pk)
        self.assertEqual(DeliveryAgentLoginChallenge.objects.count(), 0)

    def test_channel_status_choices_include_all_approved_states(self):
        values = {
            value
            for value, _label in DeliveryAgentLoginChallenge.CHANNEL_STATUS_CHOICES
        }

        self.assertEqual(
            values,
            {
                DeliveryAgentLoginChallenge.STATUS_PENDING,
                DeliveryAgentLoginChallenge.STATUS_SUCCEEDED,
                DeliveryAgentLoginChallenge.STATUS_FAILED,
                DeliveryAgentLoginChallenge.STATUS_NOT_AVAILABLE,
            },
        )
