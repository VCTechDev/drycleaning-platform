from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from orders.models import Order
from shops.models import Shop
from users.models import User


class PlatformAdminOrderAnalyticsTests(APITestCase):
    def setUp(self):
        password = "StrongPassword123!"
        self.platform_admin = User.objects.create_user(
            username="platform_admin_orders",
            email="platform-orders@example.com",
            password=password,
            role="platform_admin",
        )
        self.customer = User.objects.create_user(
            username="order_customer",
            email="order-customer@example.com",
            password=password,
            role="customer",
        )
        self.shop_admin = User.objects.create_user(
            username="order_shop_admin",
            email="order-shop-admin@example.com",
            password=password,
            role="shop_admin",
        )
        self.delivery_agent = User.objects.create_user(
            username="order_delivery_agent",
            email="order-delivery@example.com",
            password=password,
            role="delivery_agent",
        )
        self.shop = self.create_shop(
            shop_name="First Order Shop",
            shop_admin=self.shop_admin,
        )
        self.other_shop = self.create_shop(
            shop_name="Second Order Shop",
            shop_admin=User.objects.create_user(
                username="other_order_shop_admin",
                email="other-order-shop-admin@example.com",
                password=password,
                role="shop_admin",
            ),
        )

    @staticmethod
    def create_shop(*, shop_name, shop_admin):
        return Shop.objects.create(
            shop_admin=shop_admin,
            shop_name=shop_name,
            description="Order test shop",
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

    @staticmethod
    def local_datetime(value, hour=12, minute=0, second=0, microsecond=0):
        return timezone.make_aware(
            datetime.combine(
                value,
                time(hour, minute, second, microsecond),
            ),
            timezone.get_current_timezone(),
        )

    def create_order(
        self,
        *,
        created_at=None,
        amount="100.00",
        order_status="placed",
        payment_status="pending",
        shop=None,
    ):
        order = Order.objects.create(
            customer=self.customer,
            shop=shop or self.shop,
            pickup_address_line="Customer address",
            pickup_city="Kochi",
            pickup_district="Ernakulam",
            pickup_state="Kerala",
            pickup_pincode="682001",
            total_amount=Decimal(amount),
            order_status=order_status,
            payment_status=payment_status,
        )
        if created_at is not None:
            Order.objects.filter(pk=order.pk).update(created_at=created_at)
        return order

    def authenticate_platform_admin(self):
        self.client.force_authenticate(user=self.platform_admin)

    def test_platform_admin_can_access_orders_across_shops_and_api_is_read_only(self):
        first = self.create_order(shop=self.shop)
        self.create_order(shop=self.other_shop)
        self.authenticate_platform_admin()

        listed = self.client.get("/api/platform/orders/")
        detail = self.client.get(f"/api/platform/orders/{first.pk}/")
        analytics = self.client.get("/api/platform/orders/analytics/")

        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(listed.data["count"], 2)
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(analytics.status_code, 200, analytics.data)
        self.assertEqual(analytics.data["summary"]["total_orders"], 2)

        self.assertEqual(
            self.client.post("/api/platform/orders/", {}, format="json").status_code,
            405,
        )
        self.assertEqual(
            self.client.put(
                f"/api/platform/orders/{first.pk}/",
                {"order_status": "cancelled"},
                format="json",
            ).status_code,
            405,
        )
        self.assertEqual(
            self.client.patch(
                f"/api/platform/orders/{first.pk}/",
                {"order_status": "cancelled"},
                format="json",
            ).status_code,
            405,
        )
        self.assertEqual(
            self.client.delete(f"/api/platform/orders/{first.pk}/").status_code,
            405,
        )

    def test_platform_order_endpoints_are_role_isolated(self):
        order = self.create_order()
        endpoints = (
            "/api/platform/orders/",
            f"/api/platform/orders/{order.pk}/",
            "/api/platform/orders/analytics/",
        )

        self.client.force_authenticate(user=None)
        for endpoint in endpoints:
            with self.subTest(user="anonymous", endpoint=endpoint):
                self.assertEqual(self.client.get(endpoint).status_code, 401)

        for user in (self.customer, self.shop_admin, self.delivery_agent):
            self.client.force_authenticate(user=user)
            for endpoint in endpoints:
                with self.subTest(user=user.username, endpoint=endpoint):
                    self.assertEqual(self.client.get(endpoint).status_code, 403)

    def test_all_date_filter_includes_all_orders_and_list_count_matches_analytics(self):
        self.create_order(
            created_at=self.local_datetime(timezone.localdate() - timedelta(days=10)),
        )
        self.create_order(
            created_at=self.local_datetime(timezone.localdate()),
            order_status="cancelled",
            amount="50.00",
        )
        self.authenticate_platform_admin()

        listed = self.client.get("/api/platform/orders/?date_preset=all")
        analytics = self.client.get(
            "/api/platform/orders/analytics/?date_preset=all"
        )

        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(analytics.status_code, 200, analytics.data)
        self.assertEqual(
            listed.data["count"], analytics.data["summary"]["total_orders"]
        )
        self.assertEqual(analytics.data["summary"]["cancelled_orders"], 1)
        self.assertEqual(analytics.data["filters"]["created_from"], None)
        self.assertEqual(analytics.data["filters"]["created_to"], None)

    def test_today_uses_configured_timezone_and_excludes_next_midnight(self):
        today = timezone.localdate()
        next_day = today + timedelta(days=1)
        self.create_order(created_at=self.local_datetime(today, hour=0))
        self.create_order(
            created_at=self.local_datetime(
                today,
                hour=23,
                minute=59,
                second=59,
                microsecond=999999,
            )
        )
        self.create_order(created_at=self.local_datetime(next_day, hour=0))
        self.authenticate_platform_admin()

        response = self.client.get(
            "/api/platform/orders/analytics/?date_preset=today"
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["summary"]["total_orders"], 2)
        self.assertEqual(response.data["filters"]["created_from"], today.isoformat())
        self.assertEqual(response.data["filters"]["created_to"], today.isoformat())
        self.assertEqual(
            response.data["filters"]["timezone"],
            timezone.get_current_timezone_name(),
        )

    def test_this_week_is_monday_through_sunday(self):
        today = timezone.localdate()
        monday = today - timedelta(days=today.weekday())
        sunday = monday + timedelta(days=6)
        next_monday = monday + timedelta(days=7)
        self.create_order(created_at=self.local_datetime(monday, hour=0))
        self.create_order(
            created_at=self.local_datetime(
                sunday,
                hour=23,
                minute=59,
                second=59,
                microsecond=999999,
            )
        )
        self.create_order(created_at=self.local_datetime(next_monday, hour=0))
        self.authenticate_platform_admin()

        response = self.client.get(
            "/api/platform/orders/analytics/?date_preset=this_week"
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["summary"]["total_orders"], 2)
        self.assertEqual(response.data["filters"]["created_from"], monday.isoformat())
        self.assertEqual(response.data["filters"]["created_to"], sunday.isoformat())

    def test_this_month_uses_calendar_month_boundaries(self):
        today = timezone.localdate()
        first_of_month = today.replace(day=1)
        if first_of_month.month == 1:
            previous_month = date(first_of_month.year - 1, 12, 31)
        else:
            previous_month = first_of_month - timedelta(days=1)
        if first_of_month.month == 12:
            next_month = date(first_of_month.year + 1, 1, 1)
        else:
            next_month = date(first_of_month.year, first_of_month.month + 1, 1)
        last_of_month = next_month - timedelta(days=1)
        self.create_order(created_at=self.local_datetime(previous_month, hour=23))
        self.create_order(created_at=self.local_datetime(first_of_month, hour=0))
        self.authenticate_platform_admin()

        response = self.client.get(
            "/api/platform/orders/analytics/?date_preset=this_month"
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["summary"]["total_orders"], 1)
        self.assertEqual(
            response.data["filters"]["created_from"], first_of_month.isoformat()
        )
        self.assertEqual(
            response.data["filters"]["created_to"], last_of_month.isoformat()
        )

    def test_custom_range_is_inclusive_and_list_matches_analytics(self):
        today = timezone.localdate()
        start = today - timedelta(days=2)
        end = today
        self.create_order(created_at=self.local_datetime(start, hour=0))
        self.create_order(
            created_at=self.local_datetime(
                end,
                hour=23,
                minute=59,
                second=59,
                microsecond=999999,
            )
        )
        self.create_order(
            created_at=self.local_datetime(end + timedelta(days=1), hour=0)
        )
        self.authenticate_platform_admin()

        params = f"created_from={start.isoformat()}&created_to={end.isoformat()}"
        listed = self.client.get(f"/api/platform/orders/?{params}")
        analytics = self.client.get(f"/api/platform/orders/analytics/?{params}")

        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(analytics.status_code, 200, analytics.data)
        self.assertEqual(listed.data["count"], 2)
        self.assertEqual(analytics.data["summary"]["total_orders"], 2)

    def test_invalid_date_filters_return_400(self):
        self.authenticate_platform_admin()
        invalid_queries = (
            {"created_from": "2026-02-30", "created_to": "2026-03-01"},
            {"created_from": "2026-03-01"},
            {"created_to": "2026-03-01"},
            {"created_from": "2026-04-01", "created_to": "2026-03-01"},
            {"date_preset": "yesterday"},
            {
                "date_preset": "today",
                "created_from": "2026-03-01",
                "created_to": "2026-03-02",
            },
        )

        for query in invalid_queries:
            with self.subTest(query=query):
                response = self.client.get(
                    "/api/platform/orders/analytics/",
                    query,
                )
                self.assertEqual(response.status_code, 400, response.data)

    def test_analytics_excludes_cancelled_orders_and_handles_empty_periods(self):
        today = timezone.localdate()
        self.create_order(
            created_at=self.local_datetime(today),
            amount="125.50",
        )
        self.create_order(
            created_at=self.local_datetime(today),
            amount="80.25",
            order_status="cancelled",
        )
        self.create_order(
            created_at=self.local_datetime(today - timedelta(days=10)),
            amount="999.99",
        )
        self.authenticate_platform_admin()

        current = self.client.get(
            "/api/platform/orders/analytics/?date_preset=today"
        )
        empty = self.client.get(
            "/api/platform/orders/analytics/?created_from=2020-01-01&created_to=2020-01-02"
        )

        self.assertEqual(current.status_code, 200, current.data)
        self.assertEqual(current.data["summary"]["total_orders"], 2)
        self.assertEqual(current.data["summary"]["cancelled_orders"], 1)
        self.assertEqual(
            Decimal(str(current.data["summary"]["gross_order_value"])),
            Decimal("125.50"),
        )
        self.assertEqual(empty.status_code, 200, empty.data)
        self.assertEqual(empty.data["summary"]["total_orders"], 0)
        self.assertEqual(empty.data["summary"]["cancelled_orders"], 0)
        self.assertEqual(
            Decimal(str(empty.data["summary"]["gross_order_value"])),
            Decimal("0.00"),
        )

    def test_existing_status_payment_and_shop_filters_apply_to_list_and_analytics(self):
        self.create_order(
            shop=self.shop,
            order_status="processing",
            payment_status="success",
        )
        self.create_order(
            shop=self.other_shop,
            order_status="processing",
            payment_status="success",
        )
        self.create_order(
            shop=self.shop,
            order_status="placed",
            payment_status="pending",
        )
        self.authenticate_platform_admin()

        query = {
            "status": "processing",
            "payment_status": "success",
            "shop": self.shop.pk,
        }
        listed = self.client.get("/api/platform/orders/", query)
        analytics = self.client.get("/api/platform/orders/analytics/", query)

        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(analytics.status_code, 200, analytics.data)
        self.assertEqual(listed.data["count"], 1)
        self.assertEqual(analytics.data["summary"]["total_orders"], 1)
