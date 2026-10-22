from datetime import time, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.hashers import check_password
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APITestCase

from logistics.models import DeliveryAgent, DeliveryTask
from orders.models import Order
from shops.models import Shop
from users.models import User


class ShopAdminDeliveryAgentManagementTests(APITestCase):

    def setUp(self):
        self.password = "StrongPassword123!"

        # Shop 1 Admin and approved Shop 1
        self.shop_admin_1 = User.objects.create_user(
            username="shop1_admin",
            email="shop1_admin@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.shop_1 = Shop.objects.create(
            shop_admin=self.shop_admin_1,
            shop_name="Primary Cleaners",
            contact_number="9876543210",
            address_line="123 Main Road",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
        )

        # Shop 2 Admin and approved Shop 2
        self.shop_admin_2 = User.objects.create_user(
            username="shop2_admin",
            email="shop2_admin@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.shop_2 = Shop.objects.create(
            shop_admin=self.shop_admin_2,
            shop_name="Secondary Cleaners",
            contact_number="9876543211",
            address_line="456 Cross Street",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
        )

        # Unapproved shop admin
        self.unapproved_shop_admin = User.objects.create_user(
            username="unapproved_admin",
            email="unapproved@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.unapproved_shop = Shop.objects.create(
            shop_admin=self.unapproved_shop_admin,
            shop_name="Pending Cleaners",
            contact_number="9876543212",
            address_line="789 Pending Ave",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=False,
        )

        # Unlinked shop admin
        self.unlinked_shop_admin = User.objects.create_user(
            username="unlinked_admin",
            email="unlinked@example.com",
            password=self.password,
            role="shop_admin",
        )

        # Other roles
        self.customer = User.objects.create_user(
            username="customer_user",
            email="customer@example.com",
            password=self.password,
            role="customer",
        )
        self.platform_admin = User.objects.create_user(
            username="platform_admin_user",
            email="platform@example.com",
            password=self.password,
            role="platform_admin",
        )

        # Existing Delivery Agent on Shop 1
        self.existing_agent_user = User.objects.create_user(
            username="agent_existing",
            email="existing_agent@example.com",
            password=self.password,
            role="delivery_agent",
            first_name="Existing",
            last_name="Agent",
            phone_number="9876543200",
        )
        self.existing_agent = DeliveryAgent.objects.create(
            user=self.existing_agent_user,
            shop=self.shop_1,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
            is_active=True,
            is_online=False,
        )

    # 1. Successful registration creates the User and DeliveryAgent profile
    def test_successful_registration_creates_user_and_agent_profile(self):
        self.client.force_authenticate(user=self.shop_admin_1)

        payload = {
            "username": "agent_arun",
            "email": "arun@example.com",
            "password": "SecurePassword123!",
            "password_confirm": "SecurePassword123!",
            "first_name": "Arun",
            "last_name": "Kumar",
            "phone_number": "9876543299",
            "shift_starts_at": "08:30:00",
            "shift_ends_at": "17:30:00",
            "is_active": True,
        }

        res = self.client.post("/api/shop-admin/delivery-agents/", payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["user"]["username"], "agent_arun")
        self.assertEqual(res.data["user"]["email"], "arun@example.com")
        self.assertEqual(res.data["user"]["first_name"], "Arun")
        self.assertEqual(res.data["user"]["last_name"], "Kumar")
        self.assertEqual(res.data["user"]["phone_number"], "9876543299")
        self.assertEqual(res.data["shift_starts_at"], "08:30:00")
        self.assertEqual(res.data["shift_ends_at"], "17:30:00")
        self.assertTrue(res.data["is_active"])
        self.assertFalse(res.data["is_online"])
        self.assertEqual(res.data["shop"], self.shop_1.id)

        # Verify DB records
        user = User.objects.get(username="agent_arun")
        self.assertEqual(user.email, "arun@example.com")
        self.assertEqual(user.role, "delivery_agent")

        agent = DeliveryAgent.objects.get(user=user)
        self.assertEqual(agent.shop, self.shop_1)
        self.assertEqual(agent.shift_starts_at, time(8, 30))
        self.assertEqual(agent.shift_ends_at, time(17, 30))
        self.assertTrue(agent.is_active)
        self.assertFalse(agent.is_online)

    # 2. The new user's role is strictly delivery_agent
    def test_new_user_role_is_strictly_delivery_agent(self):
        self.client.force_authenticate(user=self.shop_admin_1)

        payload = {
            "username": "tampered_role_agent",
            "email": "tampered@example.com",
            "password": "SecurePassword123!",
            "role": "platform_admin",  # Tampered role
            "shift_starts_at": "09:00:00",
            "shift_ends_at": "18:00:00",
        }

        res = self.client.post("/api/shop-admin/delivery-agents/", payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["user"]["role"], "delivery_agent")

        user = User.objects.get(username="tampered_role_agent")
        self.assertEqual(user.role, "delivery_agent")

    # 3. Passwords are hashed correctly and never exposed
    def test_passwords_are_hashed_correctly_and_not_exposed(self):
        self.client.force_authenticate(user=self.shop_admin_1)
        raw_password = "MySecurePassword123!"

        payload = {
            "username": "hashed_pass_agent",
            "email": "hashed@example.com",
            "password": raw_password,
            "shift_starts_at": "09:00:00",
            "shift_ends_at": "18:00:00",
        }

        res = self.client.post("/api/shop-admin/delivery-agents/", payload, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertNotIn("password", res.data)
        self.assertNotIn("password_hash", res.data)

        user = User.objects.get(username="hashed_pass_agent")
        self.assertNotEqual(user.password, raw_password)
        self.assertTrue(check_password(raw_password, user.password))

    # 4. Invalid registration data is rejected
    def test_invalid_registration_data_rejected(self):
        self.client.force_authenticate(user=self.shop_admin_1)

        # Mismatched passwords
        res_mismatch = self.client.post(
            "/api/shop-admin/delivery-agents/",
            {
                "username": "agent_invalid_1",
                "email": "invalid1@example.com",
                "password": "StrongPassword123!",
                "password_confirm": "DifferentPassword123!",
                "shift_starts_at": "09:00:00",
                "shift_ends_at": "18:00:00",
            },
            format="json",
        )
        self.assertEqual(res_mismatch.status_code, 400)
        self.assertIn("password_confirm", res_mismatch.data)

        # Weak/short password
        res_weak = self.client.post(
            "/api/shop-admin/delivery-agents/",
            {
                "username": "agent_invalid_2",
                "email": "invalid2@example.com",
                "password": "123",
                "shift_starts_at": "09:00:00",
                "shift_ends_at": "18:00:00",
            },
            format="json",
        )
        self.assertEqual(res_weak.status_code, 400)
        self.assertIn("password", res_weak.data)

        # Identical shift start and end times
        res_times = self.client.post(
            "/api/shop-admin/delivery-agents/",
            {
                "username": "agent_invalid_3",
                "email": "invalid3@example.com",
                "password": "StrongPassword123!",
                "shift_starts_at": "09:00:00",
                "shift_ends_at": "09:00:00",
            },
            format="json",
        )
        self.assertEqual(res_times.status_code, 400)
        self.assertIn("shift_ends_at", res_times.data)

    # 5. Duplicate usernames and emails are handled safely
    def test_duplicate_username_and_email_rejected(self):
        self.client.force_authenticate(user=self.shop_admin_1)

        # Username collision
        res_user_dup = self.client.post(
            "/api/shop-admin/delivery-agents/",
            {
                "username": self.existing_agent_user.username,
                "email": "different_email@example.com",
                "password": "StrongPassword123!",
                "shift_starts_at": "09:00:00",
                "shift_ends_at": "18:00:00",
            },
            format="json",
        )
        self.assertEqual(res_user_dup.status_code, 400)
        self.assertIn("username", res_user_dup.data)

        # Email collision (case-insensitive)
        res_email_dup = self.client.post(
            "/api/shop-admin/delivery-agents/",
            {
                "username": "brand_new_agent_username",
                "email": self.existing_agent_user.email.upper(),
                "password": "StrongPassword123!",
                "shift_starts_at": "09:00:00",
                "shift_ends_at": "18:00:00",
            },
            format="json",
        )
        self.assertEqual(res_email_dup.status_code, 400)
        self.assertIn("email", res_email_dup.data)

    # 6. Failed profile creation rolls back user creation
    def test_failed_profile_creation_rolls_back_user_creation(self):
        self.client.force_authenticate(user=self.shop_admin_1)

        payload = {
            "username": "rollback_agent",
            "email": "rollback@example.com",
            "password": "StrongPassword123!",
            "shift_starts_at": "09:00:00",
            "shift_ends_at": "18:00:00",
        }

        # Mock DeliveryAgent.objects.create to raise an unexpected runtime error
        with patch.object(DeliveryAgent.objects, "create", side_effect=RuntimeError("Simulated DB error")):
            with self.assertRaises(RuntimeError):
                self.client.post("/api/shop-admin/delivery-agents/", payload, format="json")

        # Confirm User was rolled back and does not exist in DB
        self.assertFalse(User.objects.filter(username="rollback_agent").exists())
        self.assertFalse(User.objects.filter(email="rollback@example.com").exists())

    # 7. Shop Admin can list only agents belonging to their shop
    def test_shop_admin_can_list_and_filter_only_own_shop_agents(self):
        # Create an agent for Shop 2
        agent_user_2 = User.objects.create_user(
            username="shop2_delivery_agent",
            email="shop2_agent@example.com",
            password=self.password,
            role="delivery_agent",
        )
        DeliveryAgent.objects.create(
            user=agent_user_2,
            shop=self.shop_2,
            shift_starts_at=time(10),
            shift_ends_at=time(19),
            is_active=True,
        )

        # Create another agent for Shop 1 (inactive)
        agent_user_inactive = User.objects.create_user(
            username="shop1_inactive_agent",
            email="shop1_inactive@example.com",
            password=self.password,
            role="delivery_agent",
            first_name="InactiveName",
        )
        DeliveryAgent.objects.create(
            user=agent_user_inactive,
            shop=self.shop_1,
            shift_starts_at=time(8),
            shift_ends_at=time(16),
            is_active=False,
        )

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.get("/api/shop-admin/delivery-agents/")
        self.assertEqual(res.status_code, 200)

        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 2)
        agent_ids = [a["id"] for a in results]
        self.assertIn(self.existing_agent.id, agent_ids)

        # Filter by active status
        res_active = self.client.get("/api/shop-admin/delivery-agents/?is_active=true")
        active_results = res_active.data.get("results", res_active.data)
        self.assertEqual(len(active_results), 1)
        self.assertEqual(active_results[0]["id"], self.existing_agent.id)

        res_inactive = self.client.get("/api/shop-admin/delivery-agents/?is_active=false")
        inactive_results = res_inactive.data.get("results", res_inactive.data)
        self.assertEqual(len(inactive_results), 1)
        self.assertFalse(inactive_results[0]["is_active"])

        # Search filter
        res_search = self.client.get("/api/shop-admin/delivery-agents/?search=InactiveName")
        search_results = res_search.data.get("results", res_search.data)
        self.assertEqual(len(search_results), 1)
        self.assertEqual(search_results[0]["user"]["first_name"], "InactiveName")

    # 8. Shop Admin cannot access or modify another shop's agents
    def test_shop_admin_cannot_access_or_modify_another_shops_agent(self):
        agent_user_2 = User.objects.create_user(
            username="other_shop_agent",
            email="other_shop_agent@example.com",
            password=self.password,
            role="delivery_agent",
        )
        agent_2 = DeliveryAgent.objects.create(
            user=agent_user_2,
            shop=self.shop_2,
            shift_starts_at=time(10),
            shift_ends_at=time(19),
            is_active=True,
        )

        self.client.force_authenticate(user=self.shop_admin_1)

        # GET detail returns 404
        res_get = self.client.get(f"/api/shop-admin/delivery-agents/{agent_2.id}/")
        self.assertEqual(res_get.status_code, 404)

        # PATCH update returns 404
        res_patch = self.client.patch(
            f"/api/shop-admin/delivery-agents/{agent_2.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(res_patch.status_code, 404)

        agent_2.refresh_from_db()
        self.assertTrue(agent_2.is_active)

    # 9. Client-supplied shop_id cannot override authenticated shop
    def test_client_supplied_shop_id_cannot_override_authenticated_shop(self):
        self.client.force_authenticate(user=self.shop_admin_1)

        payload = {
            "username": "hijack_shop_agent",
            "email": "hijack@example.com",
            "password": "StrongPassword123!",
            "shop_id": self.shop_2.id,  # Attempting to assign to Shop 2
            "shop": self.shop_2.id,
            "shift_starts_at": "09:00:00",
            "shift_ends_at": "18:00:00",
        }

        res = self.client.post("/api/shop-admin/delivery-agents/", payload, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["shop"], self.shop_1.id)

        agent = DeliveryAgent.objects.get(user__username="hijack_shop_agent")
        self.assertEqual(agent.shop, self.shop_1)

    # 10. Unauthorized roles cannot register or manage agents
    def test_unauthorized_roles_cannot_register_or_manage_agents(self):
        # 1. Unauthenticated
        res_unauth = self.client.get("/api/shop-admin/delivery-agents/")
        self.assertEqual(res_unauth.status_code, 401)

        # 2. Customer
        self.client.force_authenticate(user=self.customer)
        res_cust = self.client.get("/api/shop-admin/delivery-agents/")
        self.assertEqual(res_cust.status_code, 403)

        # 3. Delivery Agent
        self.client.force_authenticate(user=self.existing_agent_user)
        res_agent = self.client.get("/api/shop-admin/delivery-agents/")
        self.assertEqual(res_agent.status_code, 403)

        # 4. Platform Admin
        self.client.force_authenticate(user=self.platform_admin)
        res_plat = self.client.get("/api/shop-admin/delivery-agents/")
        self.assertEqual(res_plat.status_code, 403)

        # 5. Unapproved Shop Admin
        self.client.force_authenticate(user=self.unapproved_shop_admin)
        res_unapp = self.client.get("/api/shop-admin/delivery-agents/")
        self.assertEqual(res_unapp.status_code, 403)

        # 6. Unlinked Shop Admin
        self.client.force_authenticate(user=self.unlinked_shop_admin)
        res_unlinked = self.client.get("/api/shop-admin/delivery-agents/")
        self.assertEqual(res_unlinked.status_code, 403)

    # 11. Agents cannot modify admin-controlled fields or shop association (rejected with 400)
    def test_agents_cannot_modify_admin_controlled_fields_or_shop_association(self):
        self.client.force_authenticate(user=self.existing_agent_user)

        # Calling availability endpoint with admin fields returns 400
        res = self.client.patch(
            "/api/delivery-agent/availability/",
            {
                "is_online": True,
                "is_active": False,
                "shop_id": self.shop_2.id,
                "shift_starts_at": "00:00:00",
                "role": "platform_admin",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("is_active", res.data)
        self.assertIn("shop_id", res.data)
        self.assertIn("shift_starts_at", res.data)
        self.assertIn("role", res.data)

        # Confirm database state was NOT modified
        self.existing_agent.refresh_from_db()
        self.assertFalse(self.existing_agent.is_online)
        self.assertTrue(self.existing_agent.is_active)
        self.assertEqual(self.existing_agent.shop, self.shop_1)
        self.assertEqual(self.existing_agent.shift_starts_at, time(9))

        # Ordinary valid request succeeds
        res_valid = self.client.patch(
            "/api/delivery-agent/availability/",
            {"is_online": True},
            format="json",
        )
        self.assertEqual(res_valid.status_code, 200, res_valid.data)
        self.existing_agent.refresh_from_db()
        self.assertTrue(self.existing_agent.is_online)

    # 12. Deactivated agents cannot switch themselves online
    def test_deactivated_agents_cannot_switch_themselves_online(self):
        # Admin deactivates the agent
        self.client.force_authenticate(user=self.shop_admin_1)
        res_deact = self.client.patch(
            f"/api/shop-admin/delivery-agents/{self.existing_agent.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(res_deact.status_code, 200)
        self.assertFalse(res_deact.data["is_active"])
        self.assertFalse(res_deact.data["is_online"])

        # Agent tries to switch online via availability endpoint
        self.existing_agent_user.refresh_from_db()
        self.client.force_authenticate(user=self.existing_agent_user)
        res_online = self.client.patch(
            "/api/delivery-agent/availability/",
            {"is_online": True},
            format="json",
        )
        self.assertEqual(res_online.status_code, 403)

        self.existing_agent.refresh_from_db()
        self.assertFalse(self.existing_agent.is_online)

        # Direct model clean validation test
        self.existing_agent.is_online = True
        with self.assertRaises(ValidationError) as ctx:
            self.existing_agent.clean()
        self.assertIn("inactive", str(ctx.exception).lower())

    # 13. Existing logistics and order behavior remains intact
    def test_existing_logistics_and_order_behavior_remains_intact(self):
        # 1. Customer places order
        order = Order.objects.create(
            customer=self.customer,
            shop=self.shop_1,
            pickup_address_line="123 Customer St",
            pickup_city="Kochi",
            pickup_district="Ernakulam",
            pickup_state="Kerala",
            pickup_pincode="682001",
            total_amount=Decimal("200.00"),
            order_status="placed",
            payment_status="pending",
        )

        # 2. Make agent online
        self.existing_agent.is_online = True
        self.existing_agent.save()

        # 3. Shop admin accepts order -> auto-creates pickup task assigned to online agent
        self.client.force_authenticate(user=self.shop_admin_1)
        res_accept = self.client.post(f"/api/shop-admin/orders/{order.id}/accept/")
        self.assertEqual(res_accept.status_code, 200)

        tasks = DeliveryTask.objects.filter(order=order, task_type="pickup")
        self.assertEqual(tasks.count(), 1)
        pickup_task = tasks.first()
        self.assertEqual(pickup_task.status, "assigned")
        self.assertEqual(pickup_task.delivery_agent, self.existing_agent)

    # 14. Fix 1: DeliveryAgent deactivation invariant with update_fields
    def test_delivery_agent_deactivation_invariant_with_update_fields(self):
        # 1. Create an active, online agent
        user = User.objects.create_user(
            username="online_agent_test",
            email="online_agent@example.com",
            password=self.password,
            role="delivery_agent",
        )
        agent = DeliveryAgent.objects.create(
            user=user,
            shop=self.shop_1,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
            is_active=True,
            is_online=True,
        )
        self.assertTrue(agent.is_online)
        self.assertTrue(agent.is_active)

        # 2. Set is_active=False
        agent.is_active = False

        # 3. Call save(update_fields=[...]) without is_online
        agent.save(update_fields=["is_active", "updated_at"])

        # 4. Reload from database
        agent.refresh_from_db()

        # 5. Confirm is_active=False and is_online=False
        self.assertFalse(agent.is_active)
        self.assertFalse(agent.is_online)

    # 15. Fix 2: Shop Admin cannot update immutable fields (rejected with 400)
    def test_shop_admin_cannot_update_immutable_fields(self):
        self.client.force_authenticate(user=self.shop_admin_1)

        res = self.client.patch(
            f"/api/shop-admin/delivery-agents/{self.existing_agent.id}/",
            {
                "shop": self.shop_2.id,
                "shop_id": self.shop_2.id,
                "is_online": True,
                "role": "platform_admin",
                "user": 999,
                "user_id": 999,
                "username": "hacked_user",
                "email": "hacked@example.com",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        for field in ["shop", "shop_id", "is_online", "role", "user", "user_id", "username", "email"]:
            self.assertIn(field, res.data)

        # Confirm DB is untouched
        self.existing_agent.refresh_from_db()
        self.assertEqual(self.existing_agent.shop, self.shop_1)
        self.assertFalse(self.existing_agent.is_online)
        self.existing_agent_user.refresh_from_db()
        self.assertEqual(self.existing_agent_user.role, "delivery_agent")
        self.assertEqual(self.existing_agent_user.username, "agent_existing")
        self.assertEqual(self.existing_agent_user.email, "existing_agent@example.com")

    # 16. Fix 3: Inactive User with active DeliveryAgent profile is denied access (403)
    def test_inactive_user_with_active_agent_profile_denied_access(self):
        # Deactivate user at User model level while DeliveryAgent remains is_active=True
        self.existing_agent_user.is_active = False
        self.existing_agent_user.save(update_fields=["is_active"])

        self.existing_agent.refresh_from_db()
        self.assertTrue(self.existing_agent.is_active)

        self.client.force_authenticate(user=self.existing_agent_user)
        res = self.client.get("/api/delivery-agent/availability/")
        self.assertEqual(res.status_code, 403)

        res_patch = self.client.patch(
            "/api/delivery-agent/availability/",
            {"is_online": True},
            format="json",
        )
        self.assertEqual(res_patch.status_code, 403)

    # 17. Fix 4: Updating first name, last name, and phone number persists to User
    def test_shop_admin_update_user_fields_persists(self):
        self.client.force_authenticate(user=self.shop_admin_1)

        payload = {
            "first_name": "UpdatedFirst",
            "last_name": "UpdatedLast",
            "phone_number": "9123456789",
        }
        res = self.client.patch(
            f"/api/shop-admin/delivery-agents/{self.existing_agent.id}/",
            payload,
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["user"]["first_name"], "UpdatedFirst")
        self.assertEqual(res.data["user"]["last_name"], "UpdatedLast")
        self.assertEqual(res.data["user"]["phone_number"], "9123456789")

        # Verify persisted on User model in DB
        self.existing_agent_user.refresh_from_db()
        self.assertEqual(self.existing_agent_user.first_name, "UpdatedFirst")
        self.assertEqual(self.existing_agent_user.last_name, "UpdatedLast")
        self.assertEqual(self.existing_agent_user.phone_number, "9123456789")

    # 18. Fix 4: Valid partial shift-hour update
    def test_shop_admin_valid_partial_shift_hour_update(self):
        self.client.force_authenticate(user=self.shop_admin_1)

        # Update shift_starts_at only to 10:00
        res_start = self.client.patch(
            f"/api/shop-admin/delivery-agents/{self.existing_agent.id}/",
            {"shift_starts_at": "10:00:00"},
            format="json",
        )
        self.assertEqual(res_start.status_code, 200, res_start.data)
        self.assertEqual(res_start.data["shift_starts_at"], "10:00:00")
        self.assertEqual(res_start.data["shift_ends_at"], "18:00:00")

        self.existing_agent.refresh_from_db()
        self.assertEqual(self.existing_agent.shift_starts_at, time(10))
        self.assertEqual(self.existing_agent.shift_ends_at, time(18))

        # Update shift_ends_at only to 19:00
        res_end = self.client.patch(
            f"/api/shop-admin/delivery-agents/{self.existing_agent.id}/",
            {"shift_ends_at": "19:00:00"},
            format="json",
        )
        self.assertEqual(res_end.status_code, 200, res_end.data)
        self.assertEqual(res_end.data["shift_starts_at"], "10:00:00")
        self.assertEqual(res_end.data["shift_ends_at"], "19:00:00")

        self.existing_agent.refresh_from_db()
        self.assertEqual(self.existing_agent.shift_starts_at, time(10))
        self.assertEqual(self.existing_agent.shift_ends_at, time(19))

    # 19. Fix 4: Invalid partial shift-hour update (start and end become identical)
    def test_shop_admin_invalid_partial_shift_boundary_collision_rejected(self):
        self.client.force_authenticate(user=self.shop_admin_1)

        # Attempt to set shift_starts_at to 18:00:00 (matching existing shift_ends_at)
        res_collision = self.client.patch(
            f"/api/shop-admin/delivery-agents/{self.existing_agent.id}/",
            {"shift_starts_at": "18:00:00"},
            format="json",
        )
        self.assertEqual(res_collision.status_code, 400)
        self.assertIn("shift_ends_at", res_collision.data)

        # Attempt to set shift_ends_at to 09:00:00 (matching existing shift_starts_at)
        res_collision_2 = self.client.patch(
            f"/api/shop-admin/delivery-agents/{self.existing_agent.id}/",
            {"shift_ends_at": "09:00:00"},
            format="json",
        )
        self.assertEqual(res_collision_2.status_code, 400)
        self.assertIn("shift_ends_at", res_collision_2.data)

        self.existing_agent.refresh_from_db()
        self.assertEqual(self.existing_agent.shift_starts_at, time(9))
        self.assertEqual(self.existing_agent.shift_ends_at, time(18))

    # 20. Fix 4: Successful GET /api/delivery-agent/availability/
    def test_delivery_agent_get_availability_success(self):
        self.client.force_authenticate(user=self.existing_agent_user)
        res = self.client.get("/api/delivery-agent/availability/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["agent_id"], self.existing_agent.id)
        self.assertTrue(res.data["is_active"])
        self.assertFalse(res.data["is_online"])
        self.assertEqual(res.data["shift_starts_at"], time(9))
        self.assertEqual(res.data["shift_ends_at"], time(18))


class ShopAdminDeliveryTaskManagementTests(APITestCase):

    def setUp(self):
        self.password = "StrongPassword123!"

        # Shop 1 Admin & approved Shop 1
        self.shop_admin_1 = User.objects.create_user(
            username="task_shop1_admin",
            email="task_shop1_admin@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.shop_1 = Shop.objects.create(
            shop_admin=self.shop_admin_1,
            shop_name="Clean Express",
            contact_number="9876543201",
            address_line="100 Express Road",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
        )

        # Shop 2 Admin & approved Shop 2
        self.shop_admin_2 = User.objects.create_user(
            username="task_shop2_admin",
            email="task_shop2_admin@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.shop_2 = Shop.objects.create(
            shop_admin=self.shop_admin_2,
            shop_name="Quick Wash",
            contact_number="9876543202",
            address_line="200 Quick Ave",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
        )

        # Ineligible shop admins
        self.unapproved_shop_admin = User.objects.create_user(
            username="task_unapproved_admin",
            email="task_unapproved@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.unapproved_shop = Shop.objects.create(
            shop_admin=self.unapproved_shop_admin,
            shop_name="Pending Cleaners 2",
            contact_number="9876543203",
            address_line="300 Pending Blvd",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=False,
        )
        self.unlinked_shop_admin = User.objects.create_user(
            username="task_unlinked_admin",
            email="task_unlinked@example.com",
            password=self.password,
            role="shop_admin",
        )

        # Other roles
        self.customer = User.objects.create_user(
            username="task_customer",
            email="task_customer@example.com",
            first_name="Deepak",
            last_name="Menon",
            phone_number="9876543299",
            password=self.password,
            role="customer",
        )
        self.platform_admin = User.objects.create_user(
            username="task_plat_admin",
            email="task_plat_admin@example.com",
            password=self.password,
            role="platform_admin",
        )

        # Delivery Agents for Shop 1
        # 1. Active, online agent
        self.agent_user_1 = User.objects.create_user(
            username="task_agent_1",
            email="task_agent_1@example.com",
            first_name="Rahul",
            last_name="Nair",
            phone_number="9876543210",
            password=self.password,
            role="delivery_agent",
        )
        self.agent_1 = DeliveryAgent.objects.create(
            user=self.agent_user_1,
            shop=self.shop_1,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
            is_active=True,
            is_online=True,
        )

        # 2. Active, offline agent (for advance scheduling)
        self.agent_user_offline = User.objects.create_user(
            username="task_agent_offline",
            email="task_agent_offline@example.com",
            first_name="Sanjay",
            last_name="Verma",
            phone_number="9876543211",
            password=self.password,
            role="delivery_agent",
        )
        self.agent_offline = DeliveryAgent.objects.create(
            user=self.agent_user_offline,
            shop=self.shop_1,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
            is_active=True,
            is_online=False,
        )

        # 3. Inactive agent profile
        self.agent_user_inactive = User.objects.create_user(
            username="task_agent_inactive",
            email="task_agent_inactive@example.com",
            password=self.password,
            role="delivery_agent",
        )
        self.agent_inactive = DeliveryAgent.objects.create(
            user=self.agent_user_inactive,
            shop=self.shop_1,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
            is_active=False,
            is_online=False,
        )

        # 4. Active agent profile with inactive user
        self.agent_user_user_inactive = User.objects.create_user(
            username="task_agent_user_inactive",
            email="task_agent_user_inact@example.com",
            password=self.password,
            role="delivery_agent",
            is_active=False,
        )
        self.agent_with_inactive_user = DeliveryAgent.objects.create(
            user=self.agent_user_user_inactive,
            shop=self.shop_1,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
            is_active=True,
            is_online=False,
        )

        # Delivery Agent for Shop 2
        self.agent_user_shop2 = User.objects.create_user(
            username="task_agent_shop2",
            email="task_agent_shop2@example.com",
            password=self.password,
            role="delivery_agent",
        )
        self.agent_shop2 = DeliveryAgent.objects.create(
            user=self.agent_user_shop2,
            shop=self.shop_2,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
            is_active=True,
            is_online=True,
        )

    def create_order(self, shop=None, order_status="placed", order_number=None):
        shop = shop or self.shop_1
        order = Order.objects.create(
            customer=self.customer,
            shop=shop,
            pickup_address_line="Flat 4B, Riverview Apartments",
            pickup_city="Kochi",
            pickup_district="Ernakulam",
            pickup_state="Kerala",
            pickup_pincode="682001",
            total_amount=Decimal("150.00"),
            order_status=order_status,
            payment_status="pending",
        )
        if order_number:
            order.order_number = order_number
            order.save(update_fields=["order_number"])
        return order

    def create_task(self, order, task_type="pickup", status="unassigned", delivery_agent=None, scheduled_at=None):
        task = DeliveryTask.objects.filter(order=order, task_type=task_type).first()
        if not task:
            return DeliveryTask.objects.create(
                order=order,
                task_type=task_type,
                status=status,
                delivery_agent=delivery_agent,
                scheduled_at=scheduled_at,
            )
        task.status = status
        task.delivery_agent = delivery_agent
        task.scheduled_at = scheduled_at
        task.save()
        return task

    # 1. Shop Admin can list own shop delivery tasks
    def test_shop_admin_can_list_own_shop_delivery_tasks(self):
        order_1 = self.create_order(self.shop_1)
        task_1 = self.create_task(order_1, task_type="pickup", status="unassigned")
        task_2 = self.create_task(order_1, task_type="delivery", status="assigned", delivery_agent=self.agent_1)

        order_2 = self.create_order(self.shop_2)
        self.create_task(order_2, task_type="pickup", status="unassigned")

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.get("/api/shop-admin/delivery-tasks/")
        self.assertEqual(res.status_code, 200, res.data)

        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 2)
        task_ids = [t["id"] for t in results]
        self.assertIn(task_1.id, task_ids)
        self.assertIn(task_2.id, task_ids)

    # 2. Shop Admin can retrieve own shop task detail
    def test_shop_admin_can_retrieve_own_shop_task_detail(self):
        order = self.create_order(self.shop_1, order_number="DRY000888")
        task = self.create_task(order, task_type="pickup", status="assigned", delivery_agent=self.agent_1)

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.get(f"/api/shop-admin/delivery-tasks/{task.id}/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["id"], task.id)
        self.assertEqual(res.data["task_type"], "pickup")
        self.assertEqual(res.data["status"], "assigned")
        self.assertEqual(res.data["order_number"], "DRY000888")
        self.assertEqual(res.data["delivery_agent_id"], self.agent_1.id)
        self.assertEqual(res.data["delivery_agent"]["username"], self.agent_user_1.username)
        self.assertEqual(res.data["order"]["customer_name"], "Deepak Menon")
        self.assertEqual(res.data["order"]["pickup_city"], "Kochi")

    # 3. Shop Admin cannot retrieve another shop's task (returns 404)
    def test_shop_admin_cannot_retrieve_another_shops_task_returns_404(self):
        order_2 = self.create_order(self.shop_2)
        task_2 = self.create_task(order_2, task_type="pickup", status="unassigned")

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.get(f"/api/shop-admin/delivery-tasks/{task_2.id}/")
        self.assertEqual(res.status_code, 404)

    # 4. Filter tasks by type, status, agent ID, and assignment state
    def test_filter_tasks_by_type_status_agent_and_assignment_state(self):
        order = self.create_order(self.shop_1)
        task_pickup = self.create_task(order, task_type="pickup", status="unassigned")
        task_delivery = self.create_task(
            order,
            task_type="delivery",
            status="assigned",
            delivery_agent=self.agent_1,
        )

        self.client.force_authenticate(user=self.shop_admin_1)

        # Filter by task_type
        res_pickup = self.client.get("/api/shop-admin/delivery-tasks/?task_type=pickup")
        results = res_pickup.data.get("results", res_pickup.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], task_pickup.id)

        res_delivery = self.client.get("/api/shop-admin/delivery-tasks/?task_type=delivery")
        results_del = res_delivery.data.get("results", res_delivery.data)
        self.assertEqual(len(results_del), 1)
        self.assertEqual(results_del[0]["id"], task_delivery.id)

        # Filter by status
        res_unassigned = self.client.get("/api/shop-admin/delivery-tasks/?status=unassigned")
        self.assertEqual(len(res_unassigned.data.get("results", res_unassigned.data)), 1)

        # Filter by is_assigned
        res_assigned_true = self.client.get("/api/shop-admin/delivery-tasks/?is_assigned=true")
        self.assertEqual(len(res_assigned_true.data.get("results", res_assigned_true.data)), 1)
        self.assertEqual(res_assigned_true.data.get("results", res_assigned_true.data)[0]["id"], task_delivery.id)

        res_assigned_false = self.client.get("/api/shop-admin/delivery-tasks/?is_assigned=false")
        self.assertEqual(len(res_assigned_false.data.get("results", res_assigned_false.data)), 1)
        self.assertEqual(res_assigned_false.data.get("results", res_assigned_false.data)[0]["id"], task_pickup.id)

        # Filter by delivery_agent_id
        res_by_agent = self.client.get(f"/api/shop-admin/delivery-tasks/?delivery_agent_id={self.agent_1.id}")
        self.assertEqual(len(res_by_agent.data.get("results", res_by_agent.data)), 1)
        self.assertEqual(res_by_agent.data.get("results", res_by_agent.data)[0]["id"], task_delivery.id)

    # 5. Search tasks by order number and customer details
    def test_search_tasks_by_order_number_and_customer_details(self):
        order_custom = self.create_order(self.shop_1, order_number="SPECIAL-SEARCH-001")
        task_search = self.create_task(order_custom, task_type="pickup", status="unassigned")

        self.client.force_authenticate(user=self.shop_admin_1)

        res_search_num = self.client.get("/api/shop-admin/delivery-tasks/?search=SPECIAL-SEARCH")
        results = res_search_num.data.get("results", res_search_num.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], task_search.id)

        res_search_name = self.client.get("/api/shop-admin/delivery-tasks/?search=Deepak")
        self.assertTrue(len(res_search_name.data.get("results", res_search_name.data)) >= 1)

    # 6. Unauthorized and ineligible roles rejected
    def test_unauthorized_and_ineligible_roles_rejected_from_tasks(self):
        # 1. Unauthenticated -> 401
        res_unauth = self.client.get("/api/shop-admin/delivery-tasks/")
        self.assertEqual(res_unauth.status_code, 401)

        # 2. Customer -> 403
        self.client.force_authenticate(user=self.customer)
        self.assertEqual(self.client.get("/api/shop-admin/delivery-tasks/").status_code, 403)

        # 3. Delivery Agent -> 403
        self.client.force_authenticate(user=self.agent_user_1)
        self.assertEqual(self.client.get("/api/shop-admin/delivery-tasks/").status_code, 403)

        # 4. Platform Admin -> 403
        self.client.force_authenticate(user=self.platform_admin)
        self.assertEqual(self.client.get("/api/shop-admin/delivery-tasks/").status_code, 403)

        # 5. Unapproved Shop Admin -> 403
        self.client.force_authenticate(user=self.unapproved_shop_admin)
        self.assertEqual(self.client.get("/api/shop-admin/delivery-tasks/").status_code, 403)

        # 6. Unlinked Shop Admin -> 403
        self.client.force_authenticate(user=self.unlinked_shop_admin)
        self.assertEqual(self.client.get("/api/shop-admin/delivery-tasks/").status_code, 403)

    # 7. Assign eligible active online agent successfully
    def test_assign_eligible_active_online_agent_successfully(self):
        order = self.create_order(self.shop_1)
        task = self.create_task(order, task_type="pickup", status="unassigned")

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
            {"delivery_agent_id": self.agent_1.id},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], "assigned")
        self.assertEqual(res.data["delivery_agent_id"], self.agent_1.id)

        task.refresh_from_db()
        self.assertEqual(task.status, "assigned")
        self.assertEqual(task.delivery_agent, self.agent_1)

    # 8. Assign eligible active offline agent successfully (advance scheduling)
    def test_assign_eligible_active_offline_agent_successfully(self):
        order = self.create_order(self.shop_1)
        task = self.create_task(order, task_type="pickup", status="unassigned")

        self.assertFalse(self.agent_offline.is_online)
        self.assertTrue(self.agent_offline.is_active)

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
            {"delivery_agent_id": self.agent_offline.id},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], "assigned")
        self.assertEqual(res.data["delivery_agent_id"], self.agent_offline.id)

        task.refresh_from_db()
        self.assertEqual(task.status, "assigned")
        self.assertEqual(task.delivery_agent, self.agent_offline)

    # 9. Assignment with valid scheduled_at
    def test_assignment_with_valid_scheduled_at(self):
        order = self.create_order(self.shop_1)
        task = self.create_task(order, task_type="pickup", status="unassigned")
        future_time = timezone.now() + timedelta(hours=3)

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
            {
                "delivery_agent_id": self.agent_1.id,
                "scheduled_at": future_time.isoformat(),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)

        task.refresh_from_db()
        self.assertIsNotNone(task.scheduled_at)
        self.assertEqual(task.delivery_agent, self.agent_1)

    # 10. Reassignment omitting scheduled_at preserves existing scheduled time
    def test_reassignment_omitting_scheduled_at_preserves_existing_schedule(self):
        order = self.create_order(self.shop_1)
        existing_schedule = timezone.now() + timedelta(hours=5)
        task = self.create_task(
            order,
            task_type="pickup",
            status="assigned",
            delivery_agent=self.agent_1,
            scheduled_at=existing_schedule,
        )

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
            {"delivery_agent_id": self.agent_offline.id},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)

        task.refresh_from_db()
        self.assertEqual(task.delivery_agent, self.agent_offline)
        self.assertIsNotNone(task.scheduled_at)
        # Verify preserved
        self.assertEqual(task.scheduled_at.year, existing_schedule.year)
        self.assertEqual(task.scheduled_at.minute, existing_schedule.minute)

    # 11. Reassignment before work starts succeeds
    def test_successful_reassignment_before_work_starts(self):
        order = self.create_order(self.shop_1)
        task = self.create_task(
            order,
            task_type="pickup",
            status="assigned",
            delivery_agent=self.agent_1,
        )

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
            {"delivery_agent_id": self.agent_offline.id},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["delivery_agent_id"], self.agent_offline.id)

        task.refresh_from_db()
        self.assertEqual(task.delivery_agent, self.agent_offline)

    # 12. Cross-shop agent assignment rejected with 400
    def test_reject_cross_shop_agent_assignment_400(self):
        order = self.create_order(self.shop_1)
        task = self.create_task(order, task_type="pickup", status="unassigned")

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
            {"delivery_agent_id": self.agent_shop2.id},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("delivery_agent_id", res.data)

        task.refresh_from_db()
        self.assertIsNone(task.delivery_agent)

    # 13. Inactive delivery agent profile rejected with 400
    def test_reject_inactive_delivery_agent_assignment_400(self):
        order = self.create_order(self.shop_1)
        task = self.create_task(order, task_type="pickup", status="unassigned")

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
            {"delivery_agent_id": self.agent_inactive.id},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("delivery_agent_id", res.data)

    # 14. Inactive user account delivery agent rejected with 400
    def test_reject_inactive_user_account_agent_assignment_400(self):
        order = self.create_order(self.shop_1)
        task = self.create_task(order, task_type="pickup", status="unassigned")

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
            {"delivery_agent_id": self.agent_with_inactive_user.id},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("delivery_agent_id", res.data)

    # 15. Completed, failed, and cancelled tasks cannot be assigned
    def test_reject_assignment_on_terminal_tasks_400(self):
        for term_status in ["completed", "failed", "cancelled"]:
            with self.subTest(status=term_status):
                order = self.create_order(self.shop_1)
                task = self.create_task(
                    order,
                    task_type="pickup",
                    status=term_status,
                )
                self.client.force_authenticate(user=self.shop_admin_1)
                res = self.client.post(
                    f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
                    {"delivery_agent_id": self.agent_1.id},
                    format="json",
                )
                self.assertEqual(res.status_code, 400, res.data)
                self.assertIn("status", res.data)

    # 16. Tasks associated with terminal orders cannot be assigned
    def test_reject_assignment_when_order_is_terminal_400(self):
        order_cancelled = self.create_order(self.shop_1, order_status="cancelled")
        task = self.create_task(order_cancelled, task_type="pickup", status="unassigned")

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
            {"delivery_agent_id": self.agent_1.id},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("order", res.data)

    # 17. in_progress tasks cannot be reassigned
    def test_reject_reassignment_when_task_is_in_progress_400(self):
        order = self.create_order(self.shop_1)
        task = self.create_task(
            order,
            task_type="pickup",
            status="in_progress",
            delivery_agent=self.agent_1,
        )

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
            {"delivery_agent_id": self.agent_offline.id},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("status", res.data)

    # 18. Invalid or past scheduled_at rejected with 400
    def test_reject_invalid_or_old_scheduled_at_400(self):
        order = self.create_order(self.shop_1)
        task = self.create_task(order, task_type="pickup", status="unassigned")

        self.client.force_authenticate(user=self.shop_admin_1)

        # 1. Days in the past
        past_time_days = timezone.now() - timedelta(days=2)
        res_days = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
            {
                "delivery_agent_id": self.agent_1.id,
                "scheduled_at": past_time_days.isoformat(),
            },
            format="json",
        )
        self.assertEqual(res_days.status_code, 400, res_days.data)
        self.assertIn("scheduled_at", res_days.data)

        # 2. Minutes in the past (previously permitted under 1-hour tolerance, now strictly rejected)
        past_time_mins = timezone.now() - timedelta(minutes=15)
        res_mins = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
            {
                "delivery_agent_id": self.agent_1.id,
                "scheduled_at": past_time_mins.isoformat(),
            },
            format="json",
        )
        self.assertEqual(res_mins.status_code, 400, res_mins.data)
        self.assertIn("scheduled_at", res_mins.data)

        # 3. Malformed date string
        res_malformed = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
            {
                "delivery_agent_id": self.agent_1.id,
                "scheduled_at": "not-a-valid-datetime",
            },
            format="json",
        )
        self.assertEqual(res_malformed.status_code, 400, res_malformed.data)
        self.assertIn("scheduled_at", res_malformed.data)

    # 19. Unexpected fields or nonexistent agent ID rejected with 400
    def test_reject_unexpected_fields_or_nonexistent_agent_id_400(self):
        order = self.create_order(self.shop_1)
        task = self.create_task(order, task_type="pickup", status="unassigned")

        self.client.force_authenticate(user=self.shop_admin_1)

        # Nonexistent agent
        res_nonexist = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
            {"delivery_agent_id": 999999},
            format="json",
        )
        self.assertEqual(res_nonexist.status_code, 400)
        self.assertIn("delivery_agent_id", res_nonexist.data)

        # Unexpected fields
        res_unexpected = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/assign/",
            {
                "delivery_agent_id": self.agent_1.id,
                "status": "completed",
                "task_type": "delivery",
            },
            format="json",
        )
        self.assertEqual(res_unexpected.status_code, 400)
        self.assertIn("status", res_unexpected.data)
        self.assertIn("task_type", res_unexpected.data)

    # 20. Another shop's task cannot be assigned (returns 404)
    def test_cross_shop_task_assignment_returns_404(self):
        order_2 = self.create_order(self.shop_2)
        task_2 = self.create_task(order_2, task_type="pickup", status="unassigned")

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task_2.id}/assign/",
            {"delivery_agent_id": self.agent_1.id},
            format="json",
        )
        self.assertEqual(res.status_code, 404)

    # 21. Successful unassignment before work starts
    def test_successful_unassignment_before_work_starts(self):
        order = self.create_order(self.shop_1)
        task = self.create_task(
            order,
            task_type="pickup",
            status="assigned",
            delivery_agent=self.agent_1,
        )

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(f"/api/shop-admin/delivery-tasks/{task.id}/unassign/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], "unassigned")
        self.assertIsNone(res.data["delivery_agent"])

        task.refresh_from_db()
        self.assertEqual(task.status, "unassigned")
        self.assertIsNone(task.delivery_agent)

    # 22. Unassignment preserves existing scheduled_at
    def test_unassignment_preserves_existing_scheduled_at(self):
        order = self.create_order(self.shop_1)
        scheduled_time = timezone.now() + timedelta(hours=4)
        task = self.create_task(
            order,
            task_type="pickup",
            status="assigned",
            delivery_agent=self.agent_1,
            scheduled_at=scheduled_time,
        )

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(f"/api/shop-admin/delivery-tasks/{task.id}/unassign/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)

        task.refresh_from_db()
        self.assertIsNone(task.delivery_agent)
        self.assertEqual(task.status, "unassigned")
        self.assertIsNotNone(task.scheduled_at)

    # 23. Unassignment of already unassigned task is safe and idempotent
    def test_unassignment_of_already_unassigned_task_is_safe_and_idempotent(self):
        order = self.create_order(self.shop_1)
        task = self.create_task(order, task_type="pickup", status="unassigned")

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(f"/api/shop-admin/delivery-tasks/{task.id}/unassign/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], "unassigned")
        self.assertIsNone(res.data["delivery_agent"])

    # 24. Terminal tasks cannot be unassigned
    def test_reject_unassignment_on_terminal_tasks_400(self):
        order = self.create_order(self.shop_1)
        task = self.create_task(order, task_type="pickup", status="cancelled")

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(f"/api/shop-admin/delivery-tasks/{task.id}/unassign/", {}, format="json")
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("status", res.data)

    # 25. in_progress tasks cannot be unassigned
    def test_reject_unassignment_when_task_is_in_progress_400(self):
        order = self.create_order(self.shop_1)
        task = self.create_task(
            order,
            task_type="pickup",
            status="in_progress",
            delivery_agent=self.agent_1,
        )

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(f"/api/shop-admin/delivery-tasks/{task.id}/unassign/", {}, format="json")
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("status", res.data)

    # 26. Tasks associated with terminal orders cannot be unassigned
    def test_reject_unassignment_when_order_is_terminal_400(self):
        order = self.create_order(self.shop_1, order_status="cancelled")
        task = self.create_task(
            order,
            task_type="pickup",
            status="assigned",
            delivery_agent=self.agent_1,
        )

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(f"/api/shop-admin/delivery-tasks/{task.id}/unassign/", {}, format="json")
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("order", res.data)

    # 27. Cross-shop unassignment returns 404
    def test_cross_shop_unassignment_returns_404(self):
        order_2 = self.create_order(self.shop_2)
        task_2 = self.create_task(
            order_2,
            task_type="pickup",
            status="assigned",
            delivery_agent=self.agent_shop2,
        )

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(f"/api/shop-admin/delivery-tasks/{task_2.id}/unassign/", {}, format="json")
        self.assertEqual(res.status_code, 404)

    # 28. Unassignment rejects unexpected body fields
    def test_unassignment_rejects_unexpected_body_fields_400(self):
        order = self.create_order(self.shop_1)
        task = self.create_task(
            order,
            task_type="pickup",
            status="assigned",
            delivery_agent=self.agent_1,
        )

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.post(
            f"/api/shop-admin/delivery-tasks/{task.id}/unassign/",
            {"force": True},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("force", res.data)
