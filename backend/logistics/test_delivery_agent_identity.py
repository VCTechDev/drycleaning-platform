import re
import threading
from datetime import time

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import close_old_connections, connection
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.exceptions import IrreversibleError
from django.test import TransactionTestCase
from django.test.utils import skipUnless
from rest_framework.test import APIClient, APITransactionTestCase, APITestCase

from logistics.models import DeliveryAgent
from shops.models import Shop
from users.models import User
from users.phone import normalize_phone_number


class DeliveryAgentIdentityTests(APITestCase):
    def setUp(self):
        self.password = "StrongPassword123!"
        self.shop_admin = User.objects.create_user(
            username="identity_shop_admin",
            email="identity-admin@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.shop = Shop.objects.create(
            shop_admin=self.shop_admin,
            shop_name="Identity Test Cleaners",
            contact_number="9876543210",
            address_line="100 Identity Road",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
        )
        self.client.force_authenticate(user=self.shop_admin)

    def register_agent(self, username, phone_number, email=None):
        payload = {
            "username": username,
            "password": self.password,
            "password_confirm": self.password,
            "phone_number": phone_number,
            "shift_starts_at": "09:00:00",
            "shift_ends_at": "18:00:00",
        }
        if email is not None:
            payload["email"] = email

        return self.client.post(
            "/api/shop-admin/delivery-agents/",
            payload,
            format="json",
        )

    def create_agent(
        self,
        username="identity_agent",
        phone_number="+919876543210",
        email=None,
    ):
        email = email or f"{username}@example.com"
        user = User.objects.create_user(
            username=username,
            email=email,
            password=self.password,
            role="delivery_agent",
            phone_number=phone_number,
        )
        return DeliveryAgent.objects.create(
            user=user,
            shop=self.shop,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
        )

    def test_agent_id_is_generated_in_the_public_format_and_is_stable(self):
        agent = self.create_agent()
        original_agent_id = agent.agent_id

        self.assertRegex(original_agent_id, r"^VC-AGT-\d{5,}$")

        agent.shift_ends_at = time(19)
        agent.save()
        agent.refresh_from_db()

        self.assertEqual(agent.agent_id, original_agent_id)

    def test_deleted_agent_id_is_not_reused(self):
        first = self.create_agent(username="deleted_identity_agent")
        first_agent_id = first.agent_id
        first.delete()

        second = self.create_agent(
            username="replacement_identity_agent",
            phone_number="+919876543216",
        )

        self.assertNotEqual(second.agent_id, first_agent_id)

    def test_new_agents_receive_unique_agent_ids(self):
        first = self.create_agent(username="identity_agent_one")
        second = self.create_agent(
            username="identity_agent_two",
            phone_number="+919876543211",
        )

        self.assertNotEqual(first.agent_id, second.agent_id)

    def test_migrated_agents_have_public_agent_ids(self):
        agent = self.create_agent()

        self.assertEqual(
            DeliveryAgent.objects.filter(
                agent_id__regex=r"^VC-AGT-\d{5,}$"
            ).count(),
            DeliveryAgent.objects.count(),
        )
        self.assertTrue(agent.agent_id.startswith("VC-AGT-"))

    def test_phone_is_required_and_normalized_for_registration(self):
        missing_phone = self.client.post(
            "/api/shop-admin/delivery-agents/",
            {
                "username": "missing_phone_agent",
                "email": "missing-phone@example.com",
                "password": self.password,
                "password_confirm": self.password,
                "shift_starts_at": "09:00:00",
                "shift_ends_at": "18:00:00",
            },
            format="json",
        )
        normalized = self.register_agent(
            "normalized_phone_agent",
            "+91 98765-43212",
            "normalized@example.com",
        )

        self.assertEqual(missing_phone.status_code, 400)
        self.assertIn("phone_number", missing_phone.data)
        self.assertEqual(normalized.status_code, 201, normalized.data)
        agent = DeliveryAgent.objects.get(user__username="normalized_phone_agent")
        self.assertEqual(agent.user.phone_number, "+919876543212")

    def test_duplicate_agent_phone_is_rejected_but_other_roles_can_share_it(self):
        first = self.register_agent(
            "first_phone_agent",
            "+919876543213",
            "first-phone@example.com",
        )
        duplicate = self.register_agent(
            "duplicate_phone_agent",
            "9876543213",
            "duplicate-phone@example.com",
        )
        customer = User.objects.create_user(
            username="same_phone_customer",
            email="same-phone-customer@example.com",
            password=self.password,
            role="customer",
            phone_number="+919876543213",
        )

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(duplicate.status_code, 400)
        self.assertIsNotNone(customer.pk)

    def test_updating_agent_with_existing_phone_is_allowed(self):
        agent = self.create_agent(phone_number="+919876543217")

        response = self.client.patch(
            f"/api/shop-admin/delivery-agents/{agent.pk}/",
            {"phone_number": "+91 98765-43217"},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        agent.user.refresh_from_db()
        self.assertEqual(agent.user.phone_number, "+919876543217")

    def test_updating_agent_to_another_agents_phone_is_rejected(self):
        first = self.create_agent(
            username="existing_phone_owner",
            phone_number="+919876543218",
        )
        second = self.create_agent(
            username="phone_update_target",
            phone_number="+919876543219",
        )

        response = self.client.patch(
            f"/api/shop-admin/delivery-agents/{second.pk}/",
            {"phone_number": first.user.phone_number},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("phone_number", response.data)
        second.user.refresh_from_db()
        self.assertEqual(second.user.phone_number, "+919876543219")

    def test_verification_defaults_false_and_contact_changes_reset_status(self):
        agent = self.create_agent(email="verification@example.com")
        self.assertFalse(agent.phone_verified)
        self.assertFalse(agent.email_verified)

        agent.phone_verified = True
        agent.email_verified = True
        agent.save()

        agent.user.phone_number = "+919876543214"
        agent.user.email = "verification-updated@example.com"
        agent.user.save(update_fields=["phone_number", "email"])
        agent.refresh_from_db()

        self.assertFalse(agent.phone_verified)
        self.assertFalse(agent.email_verified)

    def test_email_is_mandatory_and_email_verification_defaults_false(self):
        # Missing email is rejected
        missing_email_response = self.register_agent(
            "missing_email_agent",
            "+919876543215",
        )
        self.assertEqual(missing_email_response.status_code, 400)
        self.assertIn("email", missing_email_response.data)

        # Successful registration with email defaults email_verified to False
        response = self.register_agent(
            "mandatory_email_agent",
            "+919876543215",
            email="mandatory-email@example.com",
        )
        self.assertEqual(response.status_code, 201, response.data)
        agent = DeliveryAgent.objects.get(user__username="mandatory_email_agent")
        self.assertEqual(agent.user.email, "mandatory-email@example.com")
        self.assertFalse(agent.email_verified)

    def test_removing_email_resets_email_verification(self):
        agent = self.create_agent(email="remove-email@example.com")
        agent.email_verified = True
        agent.save()

        agent.user.email = None
        agent.user.save(update_fields=["email"])
        agent.refresh_from_db()

        self.assertFalse(agent.email_verified)

    def test_phone_policy_is_explicitly_india_first_and_internationally_extensible(self):
        self.assertEqual(
            normalize_phone_number("98765 43220"),
            "+919876543220",
        )
        self.assertEqual(
            normalize_phone_number("+44 20 1234 5678"),
            "+442012345678",
        )
        self.assertEqual(
            normalize_phone_number("0044-20-1234-5678"),
            "+442012345678",
        )

        for value in ("1234567890", "+", "+999", "not-a-phone"):
            with self.assertRaises(DjangoValidationError):
                normalize_phone_number(value)

    def test_platform_admin_linked_profile_cannot_qualify_as_delivery_agent(self):
        platform_admin = User.objects.create_user(
            username="identity_platform_admin",
            email="identity-platform-admin@example.com",
            password=self.password,
            role="platform_admin",
            phone_number="+919876543221",
        )
        # bulk_create intentionally simulates the legacy inconsistent row that
        # model.full_clean() would reject, without changing the production data.
        DeliveryAgent.objects.bulk_create([
            DeliveryAgent(
                agent_id="VC-AGT-99991",
                user=platform_admin,
                shop=self.shop,
                shift_starts_at=time(9),
                shift_ends_at=time(18),
                is_active=True,
            )
        ])

        self.client.force_authenticate(user=platform_admin)
        response = self.client.get("/api/delivery-agent/availability/")

        self.assertEqual(response.status_code, 403)

    def test_identity_and_verification_fields_are_read_only_to_updates(self):
        agent = self.create_agent()

        response = self.client.patch(
            f"/api/shop-admin/delivery-agents/{agent.pk}/",
            {
                "agent_id": "VC-AGT-99999",
                "phone_verified": True,
                "email_verified": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertRegex(response.data["agent_id"][0], re.escape("immutable"))
        self.assertRegex(response.data["phone_verified"][0], re.escape("immutable"))
        self.assertRegex(response.data["email_verified"][0], re.escape("immutable"))

        self.client.force_authenticate(user=agent.user)
        availability_response = self.client.patch(
            "/api/delivery-agent/availability/",
            {
                "is_online": False,
                "phone_verified": True,
                "email_verified": True,
            },
            format="json",
        )

        self.assertEqual(availability_response.status_code, 400)
        self.assertIn("phone_verified", availability_response.data)
        self.assertIn("email_verified", availability_response.data)


class DeliveryAgentMigrationLifecycleTests(TransactionTestCase):
    def test_public_id_migration_refuses_destructive_rollback(self):
        executor = MigrationExecutor(connection)

        with self.assertRaises(IrreversibleError):
            executor.migrate([
                ("logistics", "0005_deliverytask_failure_reason_deliveryotpauditlog_and_more")
            ])


@skipUnless(
    connection.vendor == "postgresql",
    "Concurrent phone update tests require PostgreSQL.",
)
class DeliveryAgentPhoneConcurrencyTests(APITransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.password = "StrongPassword123!"
        self.shop_admin = User.objects.create_user(
            username="phone_concurrency_admin",
            email="phone-concurrency-admin@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.shop = Shop.objects.create(
            shop_admin=self.shop_admin,
            shop_name="Phone Concurrency Cleaners",
            contact_number="9876543220",
            address_line="300 Concurrency Road",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
        )
        self.first = self.create_agent("concurrent_phone_first", "+919876543222")
        self.second = self.create_agent("concurrent_phone_second", "+919876543223")

    def create_agent(self, username, phone_number):
        user = User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password=self.password,
            role="delivery_agent",
            phone_number=phone_number,
        )
        return DeliveryAgent.objects.create(
            user=user,
            shop=self.shop,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
        )

    def test_concurrent_updates_to_same_phone_return_one_success_and_one_validation_error(self):
        target_phone = "+919876543224"
        barrier = threading.Barrier(2)
        results = {}

        def update_agent(key, agent_id):
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(user=self.shop_admin)
                barrier.wait(timeout=10)
                response = client.patch(
                    f"/api/shop-admin/delivery-agents/{agent_id}/",
                    {"phone_number": target_phone},
                    format="json",
                )
                results[key] = response.status_code
                results[f"{key}_data"] = response.data
            except Exception as error:
                results[f"{key}_error"] = repr(error)
            finally:
                close_old_connections()

        first_thread = threading.Thread(
            target=update_agent,
            args=("first", self.first.pk),
        )
        second_thread = threading.Thread(
            target=update_agent,
            args=("second", self.second.pk),
        )
        first_thread.start()
        second_thread.start()
        first_thread.join(timeout=15)
        second_thread.join(timeout=15)

        self.assertNotIn("first_error", results)
        self.assertNotIn("second_error", results)
        statuses = [results.get("first"), results.get("second")]
        self.assertEqual(statuses.count(200), 1, results)
        self.assertEqual(statuses.count(400), 1, results)
