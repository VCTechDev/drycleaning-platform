import json
from datetime import time

from django.conf import settings
from django.test import TestCase
from rest_framework.test import APITestCase

from shops.models import Shop
from users.models import User
from .admin import CustomUserAdmin


class UserAdminTests(TestCase):
    def test_role_is_available_on_user_forms(self):
        change_fields = {
            field
            for _, options in CustomUserAdmin.fieldsets
            for field in options["fields"]
        }
        add_fields = {
            field
            for _, options in CustomUserAdmin.add_fieldsets
            for field in options["fields"]
        }

        self.assertIn("role", change_fields)
        self.assertIn("role", add_fields)


class PlatformAdminUsersApiTests(APITestCase):
    endpoint = "/api/platform/users/"

    def setUp(self):
        password = "StrongPassword123!"
        self.platform_admin = User.objects.create_user(
            username="platform_users_admin",
            email="platform-users-admin@example.com",
            password=password,
            role="platform_admin",
        )
        self.customer = User.objects.create_user(
            username="active_customer",
            email="active-customer@example.com",
            password=password,
            role="customer",
            first_name="Active",
            last_name="Customer",
        )
        self.inactive_customer = User.objects.create_user(
            username="inactive_customer",
            email="inactive-customer@example.com",
            password=password,
            role="customer",
            is_active=False,
        )
        self.shop_admin = User.objects.create_user(
            username="linked_shop_admin",
            email="linked-shop-admin@example.com",
            password=password,
            role="shop_admin",
        )
        self.unassigned_shop_admin = User.objects.create_user(
            username="unassigned_shop_admin",
            email="unassigned-shop-admin@example.com",
            password=password,
            role="shop_admin",
        )
        self.delivery_agent = User.objects.create_user(
            username="delivery_agent_user",
            email="delivery-agent@example.com",
            password=password,
            role="delivery_agent",
        )
        self.shop = Shop.objects.create(
            shop_admin=self.shop_admin,
            shop_name="Linked User Shop",
            description="User API test shop",
            contact_number="9876543210",
            address_line="Test Road",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user)

    def test_anonymous_requests_receive_401(self):
        self.authenticate()

        for endpoint in (
            self.endpoint,
            f"{self.endpoint}{self.customer.pk}/",
        ):
            with self.subTest(endpoint=endpoint):
                self.assertEqual(self.client.get(endpoint).status_code, 401)

    def test_non_platform_roles_receive_403(self):
        for user in (
            self.customer,
            self.shop_admin,
            self.delivery_agent,
        ):
            self.authenticate(user)
            for endpoint in (
                self.endpoint,
                f"{self.endpoint}{self.customer.pk}/",
            ):
                with self.subTest(user=user.username, endpoint=endpoint):
                    self.assertEqual(self.client.get(endpoint).status_code, 403)

    def test_platform_admin_can_list_and_retrieve_eligible_users(self):
        self.authenticate(self.platform_admin)

        listed = self.client.get(self.endpoint)
        detail = self.client.get(f"{self.endpoint}{self.shop_admin.pk}/")

        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data["username"], self.shop_admin.username)
        self.assertEqual(detail.data["role"], "shop_admin")

    def test_platform_admin_accounts_are_excluded_from_list_and_detail(self):
        self.authenticate(self.platform_admin)

        listed = self.client.get(self.endpoint)
        detail = self.client.get(f"{self.endpoint}{self.platform_admin.pk}/")

        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertNotIn(
            self.platform_admin.pk,
            {user["id"] for user in listed.data["results"]},
        )
        self.assertEqual(detail.status_code, 404, detail.data)

    def test_default_listing_includes_active_and_inactive_users(self):
        self.authenticate(self.platform_admin)

        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, 200, response.data)
        users_by_id = {user["id"]: user for user in response.data["results"]}
        self.assertIn(self.customer.pk, users_by_id)
        self.assertIn(self.inactive_customer.pk, users_by_id)
        self.assertTrue(users_by_id[self.customer.pk]["is_active"])
        self.assertFalse(users_by_id[self.inactive_customer.pk]["is_active"])

    def test_is_active_filter_returns_only_requested_status(self):
        self.authenticate(self.platform_admin)

        active = self.client.get(f"{self.endpoint}?is_active=true")
        inactive = self.client.get(f"{self.endpoint}?is_active=false")

        self.assertEqual(active.status_code, 200, active.data)
        self.assertEqual(inactive.status_code, 200, inactive.data)
        self.assertTrue(all(user["is_active"] for user in active.data["results"]))
        self.assertTrue(
            all(not user["is_active"] for user in inactive.data["results"])
        )
        self.assertIn(
            self.inactive_customer.pk,
            {user["id"] for user in inactive.data["results"]},
        )

    def test_invalid_is_active_values_return_400(self):
        self.authenticate(self.platform_admin)

        response = self.client.get(f"{self.endpoint}?is_active=maybe")

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(str(response.data["is_active"]), "Use true or false.")

    def test_role_filters_support_all_roles_and_reject_invalid_roles(self):
        self.authenticate(self.platform_admin)

        for role in ("customer", "shop_admin", "delivery_agent"):
            with self.subTest(role=role):
                response = self.client.get(f"{self.endpoint}?role={role}")
                self.assertEqual(response.status_code, 200, response.data)
                self.assertTrue(response.data["results"])
                self.assertTrue(
                    all(user["role"] == role for user in response.data["results"])
                )

        invalid = self.client.get(f"{self.endpoint}?role=platform_admin")

        self.assertEqual(invalid.status_code, 400, invalid.data)
        self.assertEqual(
            str(invalid.data["role"]),
            "Unsupported user role.",
        )

    def test_search_is_case_insensitive_across_supported_name_and_email_fields(self):
        searchable = User.objects.create_user(
            username="SearchableUsername",
            email="searchable-email@example.com",
            password="StrongPassword123!",
            role="customer",
            first_name="SearchableFirst",
            last_name="SearchableLast",
        )
        self.authenticate(self.platform_admin)

        for term in (
            "searchableusername",
            "SEARCHABLE-EMAIL",
            "searchablefirst",
            "SEARCHABLELAST",
        ):
            with self.subTest(term=term):
                response = self.client.get(self.endpoint, {"search": term})
                self.assertEqual(response.status_code, 200, response.data)
                self.assertIn(
                    searchable.pk,
                    {user["id"] for user in response.data["results"]},
                )

    def test_pagination_uses_global_page_size(self):
        page_size = settings.REST_FRAMEWORK["PAGE_SIZE"]
        for index in range(page_size + 2):
            User.objects.create_user(
                username=f"pagination_agent_{index}",
                email=f"pagination-agent-{index}@example.com",
                password="StrongPassword123!",
                role="delivery_agent",
            )
        self.authenticate(self.platform_admin)

        first_page = self.client.get(f"{self.endpoint}?role=delivery_agent")
        second_page = self.client.get(
            f"{self.endpoint}?role=delivery_agent&page=2"
        )

        expected_count = page_size + 3
        self.assertEqual(first_page.status_code, 200, first_page.data)
        self.assertEqual(second_page.status_code, 200, second_page.data)
        self.assertEqual(first_page.data["count"], expected_count)
        self.assertEqual(len(first_page.data["results"]), page_size)
        self.assertIsNotNone(first_page.data["next"])
        self.assertEqual(len(second_page.data["results"]), 3)

    def test_shop_name_is_returned_or_null_when_unassigned(self):
        self.authenticate(self.platform_admin)

        response = self.client.get(self.endpoint, {"role": "shop_admin"})
        users_by_username = {
            user["username"]: user for user in response.data["results"]
        }

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            users_by_username[self.shop_admin.username]["shop_name"],
            self.shop.shop_name,
        )
        self.assertIsNone(
            users_by_username[self.unassigned_shop_admin.username]["shop_name"]
        )

    def test_responses_do_not_expose_sensitive_fields(self):
        self.authenticate(self.platform_admin)

        listed = self.client.get(self.endpoint)
        detail = self.client.get(f"{self.endpoint}{self.shop_admin.pk}/")
        expected_fields = {
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "phone_number",
            "role",
            "is_active",
            "date_joined",
            "shop_name",
        }

        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(detail.status_code, 200, detail.data)
        for payload in [*listed.data["results"], detail.data]:
            self.assertEqual(set(payload), expected_fields)
            body = json.dumps(payload).lower()
            self.assertNotIn("password", body)
            self.assertNotIn("token", body)
            self.assertNotIn("otp", body)

    def test_post_put_patch_and_delete_remain_unsupported(self):
        self.authenticate(self.platform_admin)

        self.assertEqual(
            self.client.post(self.endpoint, {}, format="json").status_code,
            405,
        )
        for method in ("put", "patch"):
            with self.subTest(method=method):
                response = getattr(self.client, method)(
                    f"{self.endpoint}{self.shop_admin.pk}/",
                    {"role": "customer"},
                    format="json",
                )
                self.assertEqual(response.status_code, 405)
        self.assertEqual(
            self.client.delete(f"{self.endpoint}{self.shop_admin.pk}/").status_code,
            405,
        )
