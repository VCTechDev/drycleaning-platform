import hashlib

from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.test import TestCase
from django.utils import timezone

from accounts.models import (
    DeliveryAgentLoginRateLimitEvent,
    PasswordResetOTP,
)
from logistics.models import DeliveryOTPAuditLog, DeliveryVerificationOTP


class DeliveryAgentLoginRateLimitEventTests(TestCase):
    identifier_value = "agent-arjun"
    ip_value = "203.0.113.10"

    def setUp(self):
        self.identifier_digest = hashlib.sha256(
            self.identifier_value.encode("utf-8")
        ).hexdigest()
        self.ip_digest = hashlib.sha256(self.ip_value.encode("utf-8")).hexdigest()
        self.created_at = timezone.now().replace(microsecond=123456)

    def create_event(self, **overrides):
        values = {
            "identifier_key_digest": self.identifier_digest,
            "ip_key_digest": self.ip_digest,
            "key_version": "v1",
            "created_at": self.created_at,
        }
        values.update(overrides)
        return DeliveryAgentLoginRateLimitEvent.objects.create(**values)

    def test_model_creation_and_exact_timestamp(self):
        event = self.create_event()

        self.assertEqual(event.identifier_key_digest, self.identifier_digest)
        self.assertEqual(event.ip_key_digest, self.ip_digest)
        self.assertEqual(event.key_version, "v1")
        self.assertEqual(event.created_at, self.created_at)

        event.refresh_from_db()
        self.assertEqual(event.created_at, self.created_at)

    def test_missing_created_at_is_rejected(self):
        event = DeliveryAgentLoginRateLimitEvent(
            identifier_key_digest=self.identifier_digest,
            ip_key_digest=self.ip_digest,
            key_version="v1",
        )

        with self.assertRaises(ValidationError):
            event.full_clean()

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                DeliveryAgentLoginRateLimitEvent.objects.create(
                    identifier_key_digest=self.identifier_digest,
                    ip_key_digest=self.ip_digest,
                    key_version="v1",
                )

    def test_raw_identifier_and_ip_values_fail_digest_validation(self):
        event = DeliveryAgentLoginRateLimitEvent(
            identifier_key_digest=self.identifier_value,
            ip_key_digest=self.ip_value,
            key_version="v1",
            created_at=self.created_at,
        )

        with self.assertRaises(ValidationError) as context:
            event.full_clean()

        self.assertIn("identifier_key_digest", context.exception.message_dict)
        self.assertIn("ip_key_digest", context.exception.message_dict)

    def test_expected_indexes_exist_with_correct_order(self):
        expected_indexes = {
            "acct_rl_ident_time_idx": [
                "identifier_key_digest",
                "key_version",
                "created_at",
            ],
            "acct_rl_ip_time_idx": [
                "ip_key_digest",
                "key_version",
                "created_at",
            ],
            "acct_rl_created_idx": ["created_at"],
        }

        with connection.cursor() as cursor:
            constraints = connection.introspection.get_constraints(
                cursor,
                DeliveryAgentLoginRateLimitEvent._meta.db_table,
            )

        for index_name, expected_columns in expected_indexes.items():
            self.assertIn(index_name, constraints)
            self.assertEqual(constraints[index_name]["columns"], expected_columns)
            self.assertTrue(constraints[index_name]["index"])
            self.assertFalse(constraints[index_name]["unique"])

    def test_model_has_no_uniqueness_constraint_or_relationships(self):
        model = DeliveryAgentLoginRateLimitEvent

        self.assertEqual(model._meta.constraints, [])
        self.assertFalse(
            any(
                field.unique
                for field in model._meta.local_fields
                if field.name != model._meta.pk.name
            )
        )
        self.assertFalse(any(field.is_relation for field in model._meta.get_fields()))

        with connection.cursor() as cursor:
            constraints = connection.introspection.get_constraints(
                cursor,
                model._meta.db_table,
            )

        non_primary_unique_constraints = [
            constraint
            for constraint in constraints.values()
            if constraint["unique"] and constraint["columns"] != ["id"]
        ]
        self.assertEqual(non_primary_unique_constraints, [])

    def test_model_is_independent_of_existing_otp_models(self):
        existing_models = (
            PasswordResetOTP,
            DeliveryVerificationOTP,
            DeliveryOTPAuditLog,
        )

        for existing_model in existing_models:
            related_models = {
                field.related_model
                for field in existing_model._meta.get_fields()
                if field.is_relation and hasattr(field, "related_model")
            }
            self.assertNotIn(DeliveryAgentLoginRateLimitEvent, related_models)

        self.assertEqual(
            {
                field.name for field in DeliveryAgentLoginRateLimitEvent._meta.fields
            },
            {
                "id",
                "identifier_key_digest",
                "ip_key_digest",
                "key_version",
                "created_at",
            },
        )

    def test_event_timestamp_is_not_auto_managed(self):
        field = DeliveryAgentLoginRateLimitEvent._meta.get_field("created_at")

        self.assertFalse(field.auto_now)
        self.assertFalse(field.auto_now_add)
        self.assertFalse(field.has_default())
        self.assertFalse(field.has_db_default())
