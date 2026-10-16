from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APITestCase

from orders.models import Order, OrderStatusHistory
from logistics.models import DeliveryAgent, DeliveryTask
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


class ShopAdminOrderWorkflowTests(APITestCase):
    def setUp(self):
        self.password = "StrongPassword123!"
        self.shop_admin_1 = User.objects.create_user(
            username="shop1_admin",
            email="shop1@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.shop_admin_2 = User.objects.create_user(
            username="shop2_admin",
            email="shop2@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.unlinked_shop_admin = User.objects.create_user(
            username="unlinked_shop_admin",
            email="unlinked@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.customer = User.objects.create_user(
            username="customer_user",
            email="customer@example.com",
            password=self.password,
            role="customer",
        )
        self.shop_1 = Shop.objects.create(
            shop_admin=self.shop_admin_1,
            shop_name="Clean Express",
            description="Premium cleaning",
            contact_number="9876543210",
            address_line="Main Street",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
        )
        self.shop_2 = Shop.objects.create(
            shop_admin=self.shop_admin_2,
            shop_name="Second Cleaners",
            description="Second shop",
            contact_number="9876543211",
            address_line="Second Street",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
        )

    def create_order(self, shop, order_status="placed"):
        return Order.objects.create(
            customer=self.customer,
            shop=shop,
            pickup_address_line="123 Customer Lane",
            pickup_city="Kochi",
            pickup_district="Ernakulam",
            pickup_state="Kerala",
            pickup_pincode="682001",
            total_amount=Decimal("150.00"),
            order_status=order_status,
            payment_status="pending",
        )

    def test_shop_admin_list_and_detail_scoping_and_cross_shop_isolation(self):
        order_1 = self.create_order(self.shop_1)
        order_2 = self.create_order(self.shop_2)

        self.client.force_authenticate(user=self.shop_admin_1)
        list_res = self.client.get("/api/shop-admin/orders/")
        self.assertEqual(list_res.status_code, 200)
        results = list_res.data.get("results", list_res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], order_1.id)

        detail_own = self.client.get(f"/api/shop-admin/orders/{order_1.id}/")
        self.assertEqual(detail_own.status_code, 200)
        self.assertEqual(detail_own.data["id"], order_1.id)

        detail_other = self.client.get(f"/api/shop-admin/orders/{order_2.id}/")
        self.assertEqual(detail_other.status_code, 404)

    def test_unlinked_shop_admin_cannot_access_shop_admin_orders(self):
        self.client.force_authenticate(user=self.unlinked_shop_admin)
        res = self.client.get("/api/shop-admin/orders/")
        self.assertEqual(res.status_code, 403)

    def test_shop_admin_accept_order_creates_pickup_task_exactly_once(self):
        order = self.create_order(self.shop_1, order_status="placed")
        self.client.force_authenticate(user=self.shop_admin_1)

        res = self.client.post(f"/api/shop-admin/orders/{order.id}/accept/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["order_status"], "accepted")

        order.refresh_from_db()
        self.assertEqual(order.order_status, "accepted")

        # Verify OrderStatusHistory
        history = OrderStatusHistory.objects.filter(order=order, status="accepted")
        self.assertTrue(history.exists())

        # Verify DeliveryTask created exactly once
        tasks = DeliveryTask.objects.filter(order=order, task_type="pickup")
        self.assertEqual(tasks.count(), 1)
        pickup_task = tasks.first()
        self.assertEqual(pickup_task.status, "unassigned")
        self.assertEqual(pickup_task.order, order)

        # Try to accept again -> 400
        res_repeat = self.client.post(f"/api/shop-admin/orders/{order.id}/accept/")
        self.assertEqual(res_repeat.status_code, 400)
        self.assertEqual(DeliveryTask.objects.filter(order=order, task_type="pickup").count(), 1)

    def test_shop_admin_reject_order_requires_non_empty_reason(self):
        order = self.create_order(self.shop_1, order_status="placed")
        self.client.force_authenticate(user=self.shop_admin_1)

        # Empty body
        res_empty = self.client.post(f"/api/shop-admin/orders/{order.id}/reject/", {}, format="json")
        self.assertEqual(res_empty.status_code, 400)

        # Whitespace only
        res_ws = self.client.post(
            f"/api/shop-admin/orders/{order.id}/reject/",
            {"reason": "   "},
            format="json",
        )
        self.assertEqual(res_ws.status_code, 400)

        # Valid non-empty reason
        reason_text = "Shop capacity exceeded for dry cleaning heavy woolens."
        res_valid = self.client.post(
            f"/api/shop-admin/orders/{order.id}/reject/",
            {"reason": reason_text},
            format="json",
        )
        self.assertEqual(res_valid.status_code, 200, res_valid.data)
        self.assertEqual(res_valid.data["order_status"], "rejected")
        self.assertEqual(res_valid.data["rejection_reason"], reason_text)

        order.refresh_from_db()
        self.assertEqual(order.order_status, "rejected")
        self.assertEqual(order.rejection_reason, reason_text)

        # Verify OrderStatusHistory
        history = OrderStatusHistory.objects.filter(order=order, status="rejected")
        self.assertTrue(history.exists())

    def test_rejected_and_cancelled_orders_are_terminal(self):
        rejected_order = self.create_order(self.shop_1, order_status="rejected")
        cancelled_order = self.create_order(self.shop_1, order_status="cancelled")
        self.client.force_authenticate(user=self.shop_admin_1)

        actions = ["accept", "reject", "start-processing", "ready"]
        for action in actions:
            with self.subTest(order="rejected", action=action):
                payload = {"reason": "Test reason"} if action == "reject" else {}
                res = self.client.post(
                    f"/api/shop-admin/orders/{rejected_order.id}/{action}/",
                    payload,
                    format="json",
                )
                self.assertEqual(res.status_code, 400)

            with self.subTest(order="cancelled", action=action):
                payload = {"reason": "Test reason"} if action == "reject" else {}
                res = self.client.post(
                    f"/api/shop-admin/orders/{cancelled_order.id}/{action}/",
                    payload,
                    format="json",
                )
                self.assertEqual(res.status_code, 400)

    def test_shop_admin_cannot_start_processing_before_physical_pickup(self):
        self.client.force_authenticate(user=self.shop_admin_1)

        # Placed
        order_placed = self.create_order(self.shop_1, order_status="placed")
        res_placed = self.client.post(f"/api/shop-admin/orders/{order_placed.id}/start-processing/")
        self.assertEqual(res_placed.status_code, 400)

        # Accepted
        order_accepted = self.create_order(self.shop_1, order_status="accepted")
        res_acc = self.client.post(f"/api/shop-admin/orders/{order_accepted.id}/start-processing/")
        self.assertEqual(res_acc.status_code, 400)

        # Pickup scheduled (NOT yet physically picked up)
        order_sched = self.create_order(self.shop_1, order_status="pickup_scheduled")
        res_sched = self.client.post(f"/api/shop-admin/orders/{order_sched.id}/start-processing/")
        self.assertEqual(res_sched.status_code, 400)
        self.assertIn("picked up", str(res_sched.data))

    def test_shop_admin_can_start_processing_once_physically_picked_up_and_mark_ready(self):
        order = self.create_order(self.shop_1, order_status="picked_up")
        self.client.force_authenticate(user=self.shop_admin_1)

        # Start processing
        res_proc = self.client.post(f"/api/shop-admin/orders/{order.id}/start-processing/")
        self.assertEqual(res_proc.status_code, 200, res_proc.data)
        self.assertEqual(res_proc.data["order_status"], "processing")
        order.refresh_from_db()
        self.assertEqual(order.order_status, "processing")

        # Mark ready
        res_ready = self.client.post(f"/api/shop-admin/orders/{order.id}/ready/")
        self.assertEqual(res_ready.status_code, 200, res_ready.data)
        self.assertEqual(res_ready.data["order_status"], "ready")
        order.refresh_from_db()
        self.assertEqual(order.order_status, "ready")

        # Delivery task created
        delivery_tasks = DeliveryTask.objects.filter(order=order, task_type="delivery")
        self.assertEqual(delivery_tasks.count(), 1)
        del_task = delivery_tasks.first()
        self.assertEqual(del_task.status, "unassigned")
        self.assertEqual(del_task.order, order)

        # Calling ready again -> 400, no duplicate task
        res_ready_repeat = self.client.post(f"/api/shop-admin/orders/{order.id}/ready/")
        self.assertEqual(res_ready_repeat.status_code, 400)
        self.assertEqual(DeliveryTask.objects.filter(order=order, task_type="delivery").count(), 1)

    def test_shop_admin_cross_shop_mutation_blocked(self):
        order_2 = self.create_order(self.shop_2, order_status="placed")
        self.client.force_authenticate(user=self.shop_admin_1)

        res_accept = self.client.post(f"/api/shop-admin/orders/{order_2.id}/accept/")
        self.assertEqual(res_accept.status_code, 404)

        res_reject = self.client.post(
            f"/api/shop-admin/orders/{order_2.id}/reject/",
            {"reason": "Attempting cross-shop rejection"},
            format="json",
        )
        self.assertEqual(res_reject.status_code, 404)


class CustomerOrderCancellationTests(APITestCase):
    def setUp(self):
        self.password = "StrongPassword123!"
        self.customer_1 = User.objects.create_user(
            username="customer_one",
            email="cust1@example.com",
            password=self.password,
            role="customer",
        )
        self.customer_2 = User.objects.create_user(
            username="customer_two",
            email="cust2@example.com",
            password=self.password,
            role="customer",
        )
        self.shop_admin = User.objects.create_user(
            username="shop_adm_cancel",
            email="shopcancel@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.shop = Shop.objects.create(
            shop_admin=self.shop_admin,
            shop_name="Cancel Test Shop",
            description="Testing cancellations",
            contact_number="9876543210",
            address_line="Main Street",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
        )

    def create_order(self, customer, order_status="placed"):
        return Order.objects.create(
            customer=customer,
            shop=self.shop,
            pickup_address_line="Customer address",
            pickup_city="Kochi",
            pickup_district="Ernakulam",
            pickup_state="Kerala",
            pickup_pincode="682001",
            total_amount=Decimal("120.00"),
            order_status=order_status,
            payment_status="pending",
        )

    def test_customer_can_cancel_placed_accepted_and_pickup_scheduled_orders(self):
        self.client.force_authenticate(user=self.customer_1)

        for status in ["placed", "accepted", "pickup_scheduled"]:
            with self.subTest(initial_status=status):
                order = self.create_order(self.customer_1, order_status=status)
                res = self.client.post(f"/api/orders/{order.id}/cancel/")
                self.assertEqual(res.status_code, 200, res.data)
                self.assertEqual(res.data["order_status"], "cancelled")
                order.refresh_from_db()
                self.assertEqual(order.order_status, "cancelled")

    def test_customer_cannot_cancel_after_physical_pickup(self):
        self.client.force_authenticate(user=self.customer_1)
        order = self.create_order(self.customer_1, order_status="picked_up")

        res = self.client.post(f"/api/orders/{order.id}/cancel/")
        self.assertEqual(res.status_code, 400)
        self.assertIn("physical pickup", str(res.data))
        order.refresh_from_db()
        self.assertEqual(order.order_status, "picked_up")

    def test_customer_cannot_cancel_in_processing_ready_delivered_or_terminal(self):
        self.client.force_authenticate(user=self.customer_1)

        non_cancellable = ["processing", "ready", "delivered", "cancelled", "rejected"]
        for status in non_cancellable:
            with self.subTest(status=status):
                order = self.create_order(self.customer_1, order_status=status)
                res = self.client.post(f"/api/orders/{order.id}/cancel/")
                self.assertEqual(res.status_code, 400)

    def test_customer_cannot_cancel_another_customers_order(self):
        order_cust1 = self.create_order(self.customer_1, order_status="placed")
        self.client.force_authenticate(user=self.customer_2)

        res = self.client.post(f"/api/orders/{order_cust1.id}/cancel/")
        self.assertEqual(res.status_code, 404)

    def test_cancellation_cancels_unassigned_pickup_task(self):
        order = self.create_order(self.customer_1, order_status="accepted")
        pickup_task = order.delivery_tasks.get(task_type="pickup")
        self.assertEqual(pickup_task.status, "unassigned")
        self.client.force_authenticate(user=self.customer_1)

        res = self.client.post(f"/api/orders/{order.id}/cancel/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["order_status"], "cancelled")

        pickup_task.refresh_from_db()
        self.assertEqual(pickup_task.status, "cancelled")
        order.refresh_from_db()
        self.assertEqual(order.order_status, "cancelled")

    def test_cancellation_cancels_assigned_pickup_task_and_preserves_agent(self):
        agent_user = User.objects.create_user(
            username="pickup_agent_cancel",
            email="agent-cancel@example.com",
            password=self.password,
            role="delivery_agent",
        )
        agent = DeliveryAgent.objects.create(
            user=agent_user,
            shop=self.shop,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
            is_online=True,
        )
        order = self.create_order(self.customer_1, order_status="accepted")
        pickup_task = order.delivery_tasks.get(task_type="pickup")
        pickup_task.delivery_agent = agent
        pickup_task.status = "assigned"
        pickup_task.save()

        order.order_status = "pickup_scheduled"
        order.save(update_fields=["order_status", "updated_at"])

        self.client.force_authenticate(user=self.customer_1)

        res = self.client.post(f"/api/orders/{order.id}/cancel/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["order_status"], "cancelled")

        pickup_task.refresh_from_db()
        self.assertEqual(pickup_task.status, "cancelled")
        self.assertEqual(pickup_task.delivery_agent, agent)

    def test_cancellation_blocked_if_pickup_task_is_in_progress(self):
        agent_user = User.objects.create_user(
            username="inprogress_pickup_agent",
            email="agent-inprogress@example.com",
            password=self.password,
            role="delivery_agent",
        )
        agent = DeliveryAgent.objects.create(
            user=agent_user,
            shop=self.shop,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
            is_online=True,
        )
        order = self.create_order(self.customer_1, order_status="accepted")
        pickup_task = order.delivery_tasks.get(task_type="pickup")
        pickup_task.delivery_agent = agent
        pickup_task.status = "in_progress"
        pickup_task.save()

        self.client.force_authenticate(user=self.customer_1)

        res = self.client.post(f"/api/orders/{order.id}/cancel/")
        self.assertEqual(res.status_code, 400)
        self.assertIn("in progress", str(res.data).lower())

        pickup_task.refresh_from_db()
        self.assertEqual(pickup_task.status, "in_progress")
        order.refresh_from_db()
        self.assertEqual(order.order_status, "accepted")

    def test_cancellation_blocked_if_pickup_task_is_completed(self):
        agent_user = User.objects.create_user(
            username="completed_pickup_agent",
            email="agent-completed@example.com",
            password=self.password,
            role="delivery_agent",
        )
        agent = DeliveryAgent.objects.create(
            user=agent_user,
            shop=self.shop,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
            is_online=True,
        )
        order = self.create_order(self.customer_1, order_status="accepted")
        pickup_task = order.delivery_tasks.get(task_type="pickup")
        pickup_task.delivery_agent = agent
        pickup_task.status = "completed"
        pickup_task.save()

        self.client.force_authenticate(user=self.customer_1)

        res = self.client.post(f"/api/orders/{order.id}/cancel/")
        self.assertEqual(res.status_code, 400)
        self.assertIn("physical pickup", str(res.data).lower())

        pickup_task.refresh_from_db()
        self.assertEqual(pickup_task.status, "completed")
        order.refresh_from_db()
        self.assertEqual(order.order_status, "accepted")

    def test_cancellation_does_not_affect_delivery_tasks(self):
        order = self.create_order(self.customer_1, order_status="placed")
        delivery_task = DeliveryTask.objects.create(
            order=order,
            task_type="delivery",
            status="unassigned",
        )
        self.client.force_authenticate(user=self.customer_1)

        res = self.client.post(f"/api/orders/{order.id}/cancel/")
        self.assertEqual(res.status_code, 200, res.data)

        delivery_task.refresh_from_db()
        self.assertEqual(delivery_task.status, "unassigned")


class DeliveryTaskCancellationInvariantTests(APITestCase):
    def setUp(self):
        password = "StrongPassword123!"
        self.customer = User.objects.create_user(
            username="invariant_customer",
            email="inv-customer@example.com",
            password=password,
            role="customer",
        )
        self.shop_admin = User.objects.create_user(
            username="invariant_admin",
            email="inv-admin@example.com",
            password=password,
            role="shop_admin",
        )
        self.agent_user_1 = User.objects.create_user(
            username="inv_agent_1",
            email="inv-agent1@example.com",
            password=password,
            role="delivery_agent",
        )
        self.agent_user_2 = User.objects.create_user(
            username="inv_agent_2",
            email="inv-agent2@example.com",
            password=password,
            role="delivery_agent",
        )
        self.shop = Shop.objects.create(
            shop_admin=self.shop_admin,
            shop_name="Task Invariant Shop",
            description="Testing task invariants",
            contact_number="9876543210",
            address_line="Main Street",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
        )
        self.agent_1 = DeliveryAgent.objects.create(
            user=self.agent_user_1,
            shop=self.shop,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
            is_online=True,
        )
        self.agent_2 = DeliveryAgent.objects.create(
            user=self.agent_user_2,
            shop=self.shop,
            shift_starts_at=time(9),
            shift_ends_at=time(18),
            is_online=True,
        )

    def create_placed_order(self):
        return Order.objects.create(
            customer=self.customer,
            shop=self.shop,
            pickup_address_line="Customer address",
            pickup_city="Kochi",
            pickup_district="Ernakulam",
            pickup_state="Kerala",
            pickup_pincode="682001",
            total_amount=Decimal("120.00"),
            order_status="placed",
            payment_status="pending",
        )

    def test_cannot_transition_from_cancelled_status(self):
        order = self.create_placed_order()
        task = DeliveryTask.objects.create(
            order=order,
            task_type="pickup",
            status="cancelled",
        )
        for target_status in ["unassigned", "assigned", "in_progress", "completed", "failed"]:
            with self.subTest(target_status=target_status):
                task.status = target_status
                with self.assertRaises(ValidationError) as ctx:
                    task.save()
                self.assertIn("terminal status", str(ctx.exception))

    def test_cannot_reassign_cancelled_task(self):
        order = self.create_placed_order()
        task = DeliveryTask.objects.create(
            order=order,
            delivery_agent=self.agent_1,
            task_type="pickup",
            status="cancelled",
        )
        task.delivery_agent = self.agent_2
        with self.assertRaises(ValidationError) as ctx:
            task.save()
        self.assertIn("terminal status", str(ctx.exception))

    def test_cannot_cancel_task_already_in_progress(self):
        order = self.create_placed_order()
        task = DeliveryTask.objects.create(
            order=order,
            delivery_agent=self.agent_1,
            task_type="pickup",
            status="in_progress",
        )
        task.status = "cancelled"
        with self.assertRaises(ValidationError) as ctx:
            task.save()
        self.assertIn("in progress", str(ctx.exception))
