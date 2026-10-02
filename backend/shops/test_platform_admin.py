from datetime import time
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import re
from threading import Barrier
from unittest import skipUnless
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import close_old_connections, connection
from django.test import TransactionTestCase, override_settings
from rest_framework.test import APIClient, APITestCase
from PIL import Image

from shops.models import (
    GarmentType,
    Service,
    ServiceRequest,
    Shop,
    ShopApplication,
    ShopApplicationNotification,
    ShopService,
)
from users.models import User


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PlatformAdminFoundationTests(APITestCase):
    application_payload = {
        "owner_name": "Asha Owner",
        "email": "asha@example.com",
        "phone_number": "+919876543210",
        "shop_name": "Asha Cleaners",
        "description": "A local dry-cleaning shop.",
        "address_line": "1 Market Road",
        "city": "Kochi",
        "district": "Ernakulam",
        "state": "Kerala",
        "pincode": "682001",
        "opening_time": "09:00:00",
        "closing_time": "18:00:00",
    }

    def setUp(self):
        self.password = "StrongPassword123!"
        self.platform_admin = User.objects.create_user(
            username="platform_admin",
            email="platform@example.com",
            password=self.password,
            role="platform_admin",
        )
        self.customer = User.objects.create_user(
            username="customer",
            email="customer@example.com",
            password=self.password,
            role="customer",
        )
        self.shop_admin = User.objects.create_user(
            username="shop_admin_existing",
            email="shopadmin@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.delivery_agent = User.objects.create_user(
            username="delivery_agent",
            email="delivery@example.com",
            password=self.password,
            role="delivery_agent",
        )
        self.shop = Shop.objects.create(
            shop_admin=self.shop_admin,
            shop_name="Existing Cleaners",
            description="Existing shop",
            contact_number="9876543210",
            address_line="2 Main Road",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682002",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
        )
        self.garment_type = GarmentType.objects.create(
            garment_name="Shirt",
        )
        self.service = Service.objects.create(
            service_name="Dry Cleaning",
            description="Standard dry cleaning",
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def create_application(self, **overrides):
        payload = {**self.application_payload, **overrides}
        image = payload.pop("image", self.application_image())
        if image is not None:
            payload["image"] = image
        self.client.force_authenticate(user=None)
        response = self.client.post(
            "/api/shop-applications/",
            payload,
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["application"], response.data["access_token"]

    @staticmethod
    def application_image():
        image = Image.new("RGB", (1, 1), color="white")
        content = BytesIO()
        image.save(content, format="JPEG")
        return SimpleUploadedFile(
            "shop.jpg",
            content.getvalue(),
            content_type="image/jpeg",
        )

    def create_under_review_application(self, **overrides):
        application_data, token = self.create_application(**overrides)
        application_id = application_data["public_id"]
        self.client.post(
            f"/api/shop-applications/{application_id}/submit/",
            HTTP_X_APPLICATION_TOKEN=token,
        )
        self.authenticate(self.platform_admin)
        response = self.client.post(
            f"/api/platform/shop-applications/{application_id}/under-review/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        return application_id

    def test_public_application_uses_token_and_enforces_lifecycle(self):
        application, token = self.create_application()
        application_id = application["public_id"]

        unauthorized = self.client.get(
            f"/api/shop-applications/{application_id}/"
        )
        self.assertEqual(unauthorized.status_code, 404)

        _, another_token = self.create_application(
            email="another@example.com",
            shop_name="Another Cleaners",
        )
        wrong_token = self.client.get(
            f"/api/shop-applications/{application_id}/",
            HTTP_X_APPLICATION_TOKEN=another_token,
        )
        self.assertEqual(wrong_token.status_code, 404)

        self.client.force_authenticate(user=None)
        retrieved = self.client.get(
            f"/api/shop-applications/{application_id}/",
            HTTP_X_APPLICATION_TOKEN=token,
        )
        self.assertEqual(retrieved.status_code, 200)
        self.assertEqual(retrieved.data["status"], "draft")

        updated = self.client.patch(
            f"/api/shop-applications/{application_id}/",
            {"city": "Aluva"},
            format="json",
            HTTP_X_APPLICATION_TOKEN=token,
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["city"], "Aluva")

        submitted = self.client.post(
            f"/api/shop-applications/{application_id}/submit/",
            HTTP_X_APPLICATION_TOKEN=token,
        )
        self.assertEqual(submitted.status_code, 200)
        self.assertEqual(submitted.data["status"], "submitted")

        invalid_resubmit = self.client.post(
            f"/api/shop-applications/{application_id}/submit/",
            HTTP_X_APPLICATION_TOKEN=token,
        )
        self.assertEqual(invalid_resubmit.status_code, 400)

        submitted_update = self.client.patch(
            f"/api/shop-applications/{application_id}/",
            {"city": "Kottayam"},
            format="multipart",
            HTTP_X_APPLICATION_TOKEN=token,
        )
        self.assertEqual(submitted_update.status_code, 400)

    def test_incomplete_draft_is_allowed_but_submission_requires_image_and_fields(self):
        application, token = self.create_application(image=None)
        self.assertEqual(application["status"], ShopApplication.STATUS_DRAFT)

        response = self.client.post(
            f"/api/shop-applications/{application['public_id']}/submit/",
            HTTP_X_APPLICATION_TOKEN=token,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("image", response.data)

        complete, complete_token = self.create_application()
        submitted = self.client.post(
            f"/api/shop-applications/{complete['public_id']}/submit/",
            HTTP_X_APPLICATION_TOKEN=complete_token,
        )
        self.assertEqual(submitted.status_code, 200, submitted.data)

    def test_cors_allows_the_public_application_token_header(self):
        self.assertIn(
            "x-application-token",
            {header.lower() for header in settings.CORS_ALLOW_HEADERS},
        )

    def test_platform_roles_are_isolated(self):
        endpoints = (
            "/api/platform/shop-applications/",
            "/api/platform/service-requests/",
            "/api/platform/services/",
            "/api/platform/shops/",
            "/api/platform/orders/",
            "/api/platform/users/",
            "/api/platform/dashboard/",
        )
        for user in (None, self.customer, self.shop_admin):
            self.client.force_authenticate(user=user)
            for endpoint in endpoints:
                with self.subTest(user=user, endpoint=endpoint):
                    expected = 401 if user is None else 403
                    self.assertEqual(self.client.get(endpoint).status_code, expected)

        self.authenticate(self.delivery_agent)
        self.assertEqual(
            self.client.get("/api/platform/dashboard/").status_code,
            403,
        )

        self.authenticate(self.platform_admin)
        self.assertEqual(
            self.client.get("/api/platform/shop-applications/").status_code,
            200,
        )

    def test_invalid_application_transitions_are_rejected(self):
        application, _ = self.create_application()
        self.authenticate(self.platform_admin)
        response = self.client.post(
            f"/api/platform/shop-applications/{application['public_id']}/approve/"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            ShopApplication.objects.get(public_id=application["public_id"]).status,
            ShopApplication.STATUS_DRAFT,
        )

    @patch("shops.services.send_mail", return_value=1)
    def test_approval_creates_unusable_shop_admin_and_shop(self, mock_send_mail):
        application_id = self.create_under_review_application()

        response = self.client.post(
            f"/api/platform/shop-applications/{application_id}/approve/"
        )
        self.assertEqual(response.status_code, 200, response.data)

        application = ShopApplication.objects.get(public_id=application_id)
        self.assertEqual(application.status, ShopApplication.STATUS_APPROVED)
        self.assertEqual(application.reviewed_by, self.platform_admin)
        self.assertIsNotNone(application.reviewed_at)
        self.assertIsNotNone(application.approved_user)
        self.assertIsNotNone(application.created_shop)
        self.assertTrue(application.created_shop.is_approved)
        self.assertEqual(application.created_shop.shop_admin, application.approved_user)
        self.assertEqual(application.approved_user.role, "shop_admin")
        self.assertFalse(application.approved_user.has_usable_password())
        self.assertTrue(application.approved_user.username.startswith("shop_admin_"))
        mock_send_mail.assert_called_once()
        self.assertIn(application.approved_user.username, mock_send_mail.call_args.kwargs["message"])
        self.assertIn("forgot password", mock_send_mail.call_args.kwargs["message"].lower())
        self.assertNotIn("StrongPassword123!", mock_send_mail.call_args.kwargs["message"])

        forgot = self.client.post(
            "/api/auth/forgot-password/",
            {"identifier": application.approved_user.email},
            format="json",
        )
        self.assertEqual(forgot.status_code, 200)
        self.assertTrue(application.approved_user.password_reset_otps.exists())
        otp = re.search(r"\b\d{6}\b", mail.outbox[-1].body).group()
        verification = self.client.post(
            "/api/auth/verify-otp/",
            {"identifier": application.approved_user.email, "otp": otp},
            format="json",
        )
        self.assertEqual(verification.status_code, 200)
        reset = self.client.post(
            "/api/auth/reset-password/",
            {
                "identifier": application.approved_user.email,
                "reset_token": verification.data["reset_token"],
                "new_password": "NewStrongPassword123!",
                "password_confirm": "NewStrongPassword123!",
            },
            format="json",
        )
        self.assertEqual(reset.status_code, 200)
        login = self.client.post(
            "/api/token/",
            {
                "username": application.approved_user.username,
                "password": "NewStrongPassword123!",
            },
            format="json",
        )
        self.assertEqual(login.status_code, 200)

        duplicate = self.client.post(
            f"/api/platform/shop-applications/{application_id}/approve/"
        )
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(User.objects.filter(role="shop_admin").count(), 2)

    @patch("shops.services.send_mail", return_value=1)
    def test_rejection_requires_reason_and_creates_no_account_or_shop(self, mock_send_mail):
        application_id = self.create_under_review_application(
            email="reject@example.com",
            shop_name="Rejected Cleaners",
        )

        missing_reason = self.client.post(
            f"/api/platform/shop-applications/{application_id}/reject/",
            {},
            format="json",
        )
        self.assertEqual(missing_reason.status_code, 400)

        rejected = self.client.post(
            f"/api/platform/shop-applications/{application_id}/reject/",
            {"rejection_reason": "The submitted details need correction."},
            format="json",
        )
        self.assertEqual(rejected.status_code, 200, rejected.data)
        application = ShopApplication.objects.get(public_id=application_id)
        self.assertEqual(application.status, ShopApplication.STATUS_REJECTED)
        self.assertEqual(User.objects.filter(email="reject@example.com").count(), 0)
        self.assertFalse(Shop.objects.filter(shop_name="Rejected Cleaners").exists())
        self.assertEqual(mock_send_mail.call_count, 1)
        self.assertIn("need correction", mock_send_mail.call_args.kwargs["message"])

    @patch("shops.services.send_mail", side_effect=RuntimeError("SMTP unavailable"))
    def test_approval_email_failure_preserves_approval_and_records_failure(self, mock_send_mail):
        application_id = self.create_under_review_application(
            email="approval-failure@example.com",
        )

        response = self.client.post(
            f"/api/platform/shop-applications/{application_id}/approve/"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["notification"]["status"], "failed")
        self.assertFalse(response.data["notification"]["delivered"])
        self.assertEqual(mock_send_mail.call_count, 1)

        application = ShopApplication.objects.get(public_id=application_id)
        self.assertEqual(application.status, ShopApplication.STATUS_APPROVED)
        self.assertIsNotNone(application.created_shop_id)
        self.assertIsNotNone(application.approved_user_id)
        notification = application.notifications.get(
            notification_type=ShopApplicationNotification.APPROVAL,
        )
        self.assertEqual(notification.status, ShopApplicationNotification.FAILED)
        self.assertEqual(notification.attempts, 1)
        self.assertNotIn("SMTP", notification.last_error)

    @patch("shops.services.send_mail", side_effect=RuntimeError("SMTP unavailable"))
    def test_rejection_email_failure_preserves_rejection_and_records_failure(self, mock_send_mail):
        application_id = self.create_under_review_application(
            email="rejection-failure@example.com",
        )

        response = self.client.post(
            f"/api/platform/shop-applications/{application_id}/reject/",
            {"rejection_reason": "Not enough information."},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["notification"]["status"], "failed")
        self.assertFalse(response.data["notification"]["delivered"])
        self.assertEqual(mock_send_mail.call_count, 1)

        application = ShopApplication.objects.get(public_id=application_id)
        self.assertEqual(application.status, ShopApplication.STATUS_REJECTED)
        self.assertIsNone(application.created_shop_id)
        self.assertIsNone(application.approved_user_id)
        notification = application.notifications.get(
            notification_type=ShopApplicationNotification.REJECTION,
        )
        self.assertEqual(notification.status, ShopApplicationNotification.FAILED)
        self.assertEqual(notification.attempts, 1)

    def test_shop_admin_can_manage_only_own_shop_services_and_request_new_service(self):
        self.authenticate(self.shop_admin)
        services = self.client.get("/api/shop-admin/services/")
        self.assertEqual(services.status_code, 200)
        self.assertEqual(len(services.data["results"]), 1)

        created = self.client.post(
            "/api/shop-admin/shop-services/",
            {
                "service": self.service.id,
                "garment_type": self.garment_type.id,
                "price": "150.00",
                "estimated_days": 2,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        shop_service = ShopService.objects.get(shop=self.shop)

        other_admin = User.objects.create_user(
            username="other_shop_admin",
            email="other-shop@example.com",
            password=self.password,
            role="shop_admin",
        )
        other_shop = Shop.objects.create(
            shop_admin=other_admin,
            shop_name="Other Cleaners",
            contact_number="9876543211",
            address_line="3 Main Road",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682003",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
        )
        other_shop_service = ShopService.objects.create(
            shop=other_shop,
            service=self.service,
            garment_type=self.garment_type,
            price="100.00",
            estimated_days=1,
        )
        forbidden = self.client.patch(
            f"/api/shop-admin/shop-services/{other_shop_service.id}/",
            {"price": "1.00"},
            format="json",
        )
        self.assertEqual(forbidden.status_code, 404)

        request_response = self.client.post(
            "/api/shop-admin/service-requests/",
            {
                "service_name": "Premium Restoration",
                "description": "Special restoration service",
            },
            format="json",
        )
        self.assertEqual(request_response.status_code, 201, request_response.data)
        service_request = ServiceRequest.objects.get(shop=self.shop)
        self.assertEqual(service_request.requested_by, self.shop_admin)

        cross_shop_request = self.client.post(
            "/api/shop-admin/service-requests/",
            {
                "service_name": "Cross Shop Request",
                "description": "Must remain owned by the authenticated shop",
                "shop": other_shop.id,
            },
            format="json",
        )
        self.assertEqual(cross_shop_request.status_code, 201, cross_shop_request.data)
        self.assertEqual(
            ServiceRequest.objects.get(service_name="Cross Shop Request").shop,
            self.shop,
        )

        duplicate_request = self.client.post(
            "/api/shop-admin/service-requests/",
            {
                "service_name": "premium restoration",
                "description": "Duplicate request",
            },
            format="json",
        )
        self.assertEqual(duplicate_request.status_code, 400)

    def test_unapproved_shop_cannot_create_service_request(self):
        self.shop.is_approved = False
        self.shop.save(update_fields=["is_approved"])
        self.authenticate(self.shop_admin)
        response = self.client.post(
            "/api/shop-admin/service-requests/",
            {"service_name": "Unapproved Service"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_platform_filters_reject_malformed_shop_ids(self):
        self.authenticate(self.platform_admin)
        orders = self.client.get("/api/platform/orders/?shop=abc")
        service_requests = self.client.get(
            "/api/platform/service-requests/?shop=abc"
        )
        self.assertEqual(orders.status_code, 400)
        self.assertEqual(service_requests.status_code, 400)
        self.assertIn("shop", orders.data)
        self.assertIn("shop", service_requests.data)

    def test_platform_services_reject_case_insensitive_duplicates(self):
        self.authenticate(self.platform_admin)
        first = self.client.post(
            "/api/platform/services/",
            {"service_name": "Leather Care", "description": "Care"},
            format="json",
        )
        duplicate = self.client.post(
            "/api/platform/services/",
            {"service_name": "leather care", "description": "Duplicate"},
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(duplicate.status_code, 400)

    def test_platform_approves_service_request_without_creating_shop_service(self):
        service_request = ServiceRequest.objects.create(
            shop=self.shop,
            requested_by=self.shop_admin,
            service_name="Leather Care",
            description="Care for leather garments",
        )
        self.authenticate(self.platform_admin)
        under_review = self.client.post(
            f"/api/platform/service-requests/{service_request.id}/under-review/"
        )
        self.assertEqual(under_review.status_code, 200, under_review.data)

        approved = self.client.post(
            f"/api/platform/service-requests/{service_request.id}/approve/"
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        service_request.refresh_from_db()
        self.assertEqual(service_request.status, ServiceRequest.STATUS_APPROVED)
        self.assertIsNotNone(service_request.approved_service)
        self.assertFalse(
            ShopService.objects.filter(
                shop=self.shop,
                service=service_request.approved_service,
            ).exists()
        )

    def test_platform_service_request_approval_reuses_existing_service(self):
        existing = Service.objects.create(
            service_name="Leather Care",
            description="Existing global service",
        )
        service_request = ServiceRequest.objects.create(
            shop=self.shop,
            requested_by=self.shop_admin,
            service_name=" leather care ",
        )
        self.authenticate(self.platform_admin)
        under_review = self.client.post(
            f"/api/platform/service-requests/{service_request.id}/under-review/"
        )
        self.assertEqual(under_review.status_code, 200, under_review.data)
        approved = self.client.post(
            f"/api/platform/service-requests/{service_request.id}/approve/"
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        service_request.refresh_from_db()
        self.assertEqual(service_request.approved_service_id, existing.id)
        self.assertEqual(
            Service.objects.filter(service_name__iexact="leather care").count(),
            1,
        )

    def test_terminal_applications_cannot_be_edited(self):
        rejected, rejected_token = self.create_application(
            email="terminal-rejected@example.com",
        )
        self.client.post(
            f"/api/shop-applications/{rejected['public_id']}/submit/",
            HTTP_X_APPLICATION_TOKEN=rejected_token,
        )
        self.authenticate(self.platform_admin)
        self.client.post(
            f"/api/platform/shop-applications/{rejected['public_id']}/under-review/"
        )
        self.client.post(
            f"/api/platform/shop-applications/{rejected['public_id']}/reject/",
            {"rejection_reason": "Rejected for testing."},
            format="json",
        )
        self.client.force_authenticate(user=None)
        rejected_update = self.client.patch(
            f"/api/shop-applications/{rejected['public_id']}/",
            {"city": "Kollam"},
            format="multipart",
            HTTP_X_APPLICATION_TOKEN=rejected_token,
        )
        self.assertEqual(rejected_update.status_code, 400)

        approved, approved_token = self.create_application(
            email="terminal-approved@example.com",
        )
        self.client.post(
            f"/api/shop-applications/{approved['public_id']}/submit/",
            HTTP_X_APPLICATION_TOKEN=approved_token,
        )
        self.authenticate(self.platform_admin)
        self.client.post(
            f"/api/platform/shop-applications/{approved['public_id']}/under-review/"
        )
        self.client.post(
            f"/api/platform/shop-applications/{approved['public_id']}/approve/"
        )
        self.client.force_authenticate(user=None)
        approved_update = self.client.patch(
            f"/api/shop-applications/{approved['public_id']}/",
            {"city": "Kannur"},
            format="multipart",
            HTTP_X_APPLICATION_TOKEN=approved_token,
        )
        self.assertEqual(approved_update.status_code, 400)

    def test_platform_order_and_dashboard_do_not_expose_authentication_data(self):
        shop_service = ShopService.objects.create(
            shop=self.shop,
            service=self.service,
            garment_type=self.garment_type,
            price=Decimal("125.00"),
            estimated_days=2,
        )
        from orders.models import Order, OrderItem

        order = Order.objects.create(
            customer=self.customer,
            shop=self.shop,
            pickup_address_line="Customer address",
            pickup_city="Kochi",
            pickup_district="Ernakulam",
            pickup_state="Kerala",
            pickup_pincode="682004",
        )
        OrderItem.objects.create(order=order, shop_service=shop_service, quantity=2)

        self.authenticate(self.platform_admin)
        orders = self.client.get("/api/platform/orders/")
        self.assertEqual(orders.status_code, 200, orders.data)
        self.assertEqual(orders.data["results"][0]["order_number"], order.order_number)
        dashboard = self.client.get("/api/platform/dashboard/")
        self.assertEqual(dashboard.status_code, 200, dashboard.data)
        self.assertIn("gross_order_value", dashboard.data["business"])

        users = self.client.get("/api/platform/users/")
        self.assertEqual(users.status_code, 200)
        body = str(users.data)
        self.assertNotIn("password", body.lower())
        self.assertNotIn("otp", body.lower())


@skipUnless(
    connection.vendor == "postgresql",
    "Concurrency locking tests require PostgreSQL.",
)
@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PlatformAdminConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.reviewer = User.objects.create_user(
            username="concurrency_admin",
            email="concurrency-admin@example.com",
            password="StrongPassword123!",
            role="platform_admin",
        )

    @staticmethod
    def image_file():
        image = Image.new("RGB", (1, 1), color="white")
        content = BytesIO()
        image.save(content, format="JPEG")
        return SimpleUploadedFile(
            "concurrency-shop.jpg",
            content.getvalue(),
            content_type="image/jpeg",
        )

    def create_application(
        self,
        status=ShopApplication.STATUS_UNDER_REVIEW,
    ):
        return ShopApplication.objects.create(
            access_token_hash=make_password("application-token"),
            owner_name="Concurrent Owner",
            email="concurrent-owner@example.com",
            phone_number="9876543210",
            shop_name="Concurrent Cleaners",
            description="Concurrency test shop",
            image=self.image_file(),
            address_line="1 Test Road",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            status=status,
        )

    @staticmethod
    def approve(application_id, reviewer_id):
        from shops.services import approve_shop_application

        close_old_connections()
        try:
            approve_shop_application(
                application_id,
                User.objects.get(pk=reviewer_id),
            )
            return "approved"
        except Exception as exc:
            return type(exc).__name__
        finally:
            close_old_connections()

    @staticmethod
    def reject(application_id, reviewer_id):
        from shops.services import reject_shop_application

        close_old_connections()
        try:
            reject_shop_application(
                application_id,
                User.objects.get(pk=reviewer_id),
                "Concurrent rejection test",
            )
            return "rejected"
        except Exception as exc:
            return type(exc).__name__
        finally:
            close_old_connections()

    @patch("shops.services.send_mail", return_value=1)
    def test_concurrent_approval_creates_one_result(self, mock_send_mail):
        application = self.create_application()
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(
                lambda _: self.approve(application.pk, self.reviewer.pk),
                (1, 2),
            ))

        application.refresh_from_db()
        self.assertEqual(results.count("approved"), 1)
        self.assertEqual(application.status, ShopApplication.STATUS_APPROVED)
        self.assertEqual(
            User.objects.filter(email="concurrent-owner@example.com").count(),
            1,
        )
        self.assertEqual(
            Shop.objects.filter(shop_name="Concurrent Cleaners").count(),
            1,
        )
        self.assertEqual(mock_send_mail.call_count, 1)

    @patch("shops.services.send_mail", return_value=1)
    def test_concurrent_approval_and_rejection_are_serialized(self, mock_send_mail):
        application = self.create_application()
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(
                lambda operation: operation(application.pk, self.reviewer.pk),
                (self.approve, self.reject),
            ))

        application.refresh_from_db()
        self.assertEqual(
            set(results) & {"approved", "rejected"},
            {application.status},
        )
        if application.status == ShopApplication.STATUS_APPROVED:
            self.assertEqual(
                User.objects.filter(email="concurrent-owner@example.com").count(),
                1,
            )
            self.assertEqual(
                Shop.objects.filter(shop_name="Concurrent Cleaners").count(),
                1,
            )
        else:
            self.assertFalse(
                User.objects.filter(email="concurrent-owner@example.com").exists()
            )
            self.assertFalse(
                Shop.objects.filter(shop_name="Concurrent Cleaners").exists()
            )

    def test_concurrent_public_update_and_submit_preserve_submitted_state(self):
        application = self.create_application(status=ShopApplication.STATUS_DRAFT)
        token = "application-token"
        barrier = Barrier(2)

        def run(action):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                client = APIClient()
                return action(client).status_code
            finally:
                close_old_connections()

        def update(client):
            return client.patch(
                f"/api/shop-applications/{application.public_id}/",
                {"city": "Aluva"},
                format="json",
                HTTP_X_APPLICATION_TOKEN=token,
            )

        def submit(client):
            return client.post(
                f"/api/shop-applications/{application.public_id}/submit/",
                HTTP_X_APPLICATION_TOKEN=token,
            )

        with ThreadPoolExecutor(max_workers=2) as executor:
            update_status, submit_status = executor.map(
                run,
                (update, submit),
            )

        application.refresh_from_db()
        self.assertIn(update_status, {200, 400})
        self.assertEqual(submit_status, 200)
        self.assertEqual(application.status, ShopApplication.STATUS_SUBMITTED)
