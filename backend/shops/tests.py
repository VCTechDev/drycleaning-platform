from datetime import time
from decimal import Decimal
from io import BytesIO
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from shops.models import (
    GarmentType,
    Service,
    ServiceRequest,
    Shop,
    ShopService,
)
from users.models import User


class ShopAdminProfileAndAvailabilityTests(APITestCase):
    def setUp(self):
        self.password = "StrongPassword123!"
        self.shop_admin_1 = User.objects.create_user(
            username="shop1_admin_user",
            email="shop1admin@example.com",
            password=self.password,
            role="shop_admin",
            first_name="Asha",
            last_name="Clean",
            phone_number="9876543210",
        )
        self.shop_admin_2 = User.objects.create_user(
            username="shop2_admin_user",
            email="shop2admin@example.com",
            password=self.password,
            role="shop_admin",
            first_name="Babu",
            last_name="Clean",
            phone_number="9876543211",
        )
        self.unlinked_shop_admin = User.objects.create_user(
            username="unlinked_shop_admin_user",
            email="unlinkedshop@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.customer = User.objects.create_user(
            username="shop_customer_user",
            email="customer_shops@example.com",
            password=self.password,
            role="customer",
        )

        self.shop_1 = Shop.objects.create(
            shop_admin=self.shop_admin_1,
            shop_name="Asha Premium Cleaners",
            description="Leading dry cleaners in Kochi",
            contact_number="9876543210",
            address_line="10 North Avenue",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9, 0),
            closing_time=time(19, 0),
            is_approved=True,
            is_open=False,
        )
        self.shop_2 = Shop.objects.create(
            shop_admin=self.shop_admin_2,
            shop_name="Babu Express Cleaners",
            description="Babu shop",
            contact_number="9876543211",
            address_line="20 South Avenue",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(8, 0),
            closing_time=time(20, 0),
            is_approved=True,
            is_open=False,
        )

        self.service_dryclean = Service.objects.create(
            service_name="Dry Cleaning",
            description="Professional dry cleaning",
            is_active=True,
        )
        self.service_ironing = Service.objects.create(
            service_name="Steam Ironing",
            description="Wrinkle-free pressing",
            is_active=True,
        )
        self.garment_shirt = GarmentType.objects.create(
            garment_name="Silk Shirt",
            description="Delicate silk shirt",
            is_active=True,
        )
        self.garment_inactive = GarmentType.objects.create(
            garment_name="Vintage Rug",
            description="Old rug",
            is_active=False,
        )

        self.shop1_service = ShopService.objects.create(
            shop=self.shop_1,
            service=self.service_dryclean,
            garment_type=self.garment_shirt,
            price=Decimal("120.00"),
            estimated_days=2,
            is_active=True,
        )

    def test_shop_admin_retrieve_profile(self):
        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.get("/api/shop-admin/shop/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["shop_name"], self.shop_1.shop_name)
        self.assertEqual(res.data["contact_number"], "9876543210")
        self.assertEqual(res.data["is_approved"], True)
        self.assertEqual(res.data["is_open"], False)

    def test_unlinked_shop_admin_cannot_access_shop_endpoints(self):
        self.client.force_authenticate(user=self.unlinked_shop_admin)
        res_profile = self.client.get("/api/shop-admin/shop/")
        self.assertEqual(res_profile.status_code, 403)

        res_status = self.client.post(
            "/api/shop-admin/shop/operational-status/",
            {"is_open": True},
            format="json",
        )
        self.assertEqual(res_status.status_code, 403)

    def test_shop_admin_update_allowed_profile_fields(self):
        self.client.force_authenticate(user=self.shop_admin_1)
        update_data = {
            "contact_number": "9112233445",
            "description": "Updated shop description with expanded hours.",
            "address_line": "99 Marine Drive",
            "city": "Ernakulam",
            "opening_time": "08:30:00",
            "closing_time": "20:30:00",
        }
        res = self.client.patch("/api/shop-admin/shop/", update_data, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.shop_1.refresh_from_db()
        self.assertEqual(self.shop_1.contact_number, "9112233445")
        self.assertEqual(self.shop_1.city, "Ernakulam")
        self.assertEqual(self.shop_1.opening_time, time(8, 30))
        self.assertEqual(self.shop_1.closing_time, time(20, 30))

    def test_shop_admin_cannot_modify_restricted_fields(self):
        self.client.force_authenticate(user=self.shop_admin_1)
        # Attempting to change approval or opening state directly via profile PATCH
        res = self.client.patch(
            "/api/shop-admin/shop/",
            {
                "is_approved": False,
                "is_open": True,
                "shop_admin": self.shop_admin_2.id,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.shop_1.refresh_from_db()
        self.assertEqual(self.shop_1.is_approved, True)
        self.assertEqual(self.shop_1.is_open, False)
        self.assertEqual(self.shop_1.shop_admin, self.shop_admin_1)

    def test_shop_cannot_be_opened_if_unapproved(self):
        self.shop_1.is_approved = False
        self.shop_1.save()
        self.client.force_authenticate(user=self.shop_admin_1)

        res = self.client.post(
            "/api/shop-admin/shop/operational-status/",
            {"is_open": True},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("approved", str(res.data).lower())
        self.shop_1.refresh_from_db()
        self.assertFalse(self.shop_1.is_open)

    def test_shop_cannot_be_opened_without_active_services(self):
        # Deactivate existing service
        self.shop1_service.is_active = False
        self.shop1_service.save()
        self.client.force_authenticate(user=self.shop_admin_1)

        res = self.client.post(
            "/api/shop-admin/shop/operational-status/",
            {"is_open": True},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("active service", str(res.data).lower())
        self.shop_1.refresh_from_db()
        self.assertFalse(self.shop_1.is_open)

    def test_shop_can_be_opened_and_closed_when_eligible(self):
        self.client.force_authenticate(user=self.shop_admin_1)

        # Open shop
        res_open = self.client.post(
            "/api/shop-admin/shop/operational-status/",
            {"is_open": True},
            format="json",
        )
        self.assertEqual(res_open.status_code, 200, res_open.data)
        self.assertTrue(res_open.data["is_open"])
        self.shop_1.refresh_from_db()
        self.assertTrue(self.shop_1.is_open)

        # Close shop
        res_close = self.client.post(
            "/api/shop-admin/shop/operational-status/",
            {"is_open": False},
            format="json",
        )
        self.assertEqual(res_close.status_code, 200, res_close.data)
        self.assertFalse(res_close.data["is_open"])
        self.shop_1.refresh_from_db()
        self.assertFalse(self.shop_1.is_open)

    def test_automatic_closure_when_approval_revoked(self):
        # First open shop
        self.shop_1.is_open = True
        self.shop_1.save()

        # Revoke approval
        self.shop_1.is_approved = False
        self.shop_1.save()

        self.shop_1.refresh_from_db()
        self.assertFalse(self.shop_1.is_open)

    def test_automatic_closure_when_last_active_service_deactivated(self):
        # First open shop
        self.shop_1.is_open = True
        self.shop_1.save()
        self.assertTrue(self.shop_1.is_open)

        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.patch(
            f"/api/shop-admin/shop-services/{self.shop1_service.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertFalse(res.data["is_active"])

        # Check shop is automatically closed
        self.shop_1.refresh_from_db()
        self.assertFalse(self.shop_1.is_open)

    def test_service_hard_delete_forbidden(self):
        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.delete(f"/api/shop-admin/shop-services/{self.shop1_service.id}/")
        self.assertEqual(res.status_code, 405)
        self.assertTrue(ShopService.objects.filter(id=self.shop1_service.id).exists())

    def test_service_creation_validation_duplicate_and_inactive_garment(self):
        self.client.force_authenticate(user=self.shop_admin_1)

        # Duplicate (shop, garment_type, service)
        dup_payload = {
            "service": self.service_dryclean.id,
            "garment_type": self.garment_shirt.id,
            "price": "150.00",
            "estimated_days": 3,
        }
        res_dup = self.client.post("/api/shop-admin/shop-services/", dup_payload, format="json")
        self.assertEqual(res_dup.status_code, 400)
        self.assertIn("already configured", str(res_dup.data).lower())

        # Inactive garment type
        inactive_payload = {
            "service": self.service_ironing.id,
            "garment_type": self.garment_inactive.id,
            "price": "90.00",
            "estimated_days": 1,
        }
        res_inact = self.client.post("/api/shop-admin/shop-services/", inactive_payload, format="json")
        self.assertEqual(res_inact.status_code, 400)
        self.assertIn("inactive", str(res_inact.data).lower())

    def test_shop_services_scoped_and_cross_shop_isolation(self):
        shop2_service = ShopService.objects.create(
            shop=self.shop_2,
            service=self.service_dryclean,
            garment_type=self.garment_shirt,
            price=Decimal("150.00"),
            estimated_days=2,
            is_active=True,
        )
        self.client.force_authenticate(user=self.shop_admin_1)

        # List should only include shop 1
        res_list = self.client.get("/api/shop-admin/shop-services/")
        self.assertEqual(res_list.status_code, 200)
        results = res_list.data.get("results", res_list.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], self.shop1_service.id)

        # Detail of shop 2's service should return 404
        res_detail = self.client.get(f"/api/shop-admin/shop-services/{shop2_service.id}/")
        self.assertEqual(res_detail.status_code, 404)

        # Mutation of shop 2's service should return 404
        res_patch = self.client.patch(
            f"/api/shop-admin/shop-services/{shop2_service.id}/",
            {"price": "200.00"},
            format="json",
        )
        self.assertEqual(res_patch.status_code, 404)

    def test_service_request_scoped_and_cross_shop_isolation(self):
        sr_shop1 = ServiceRequest.objects.create(
            shop=self.shop_1,
            requested_by=self.shop_admin_1,
            service_name="Leather Jacket Conditioning",
            description="Specialist leather cleaning",
        )
        sr_shop2 = ServiceRequest.objects.create(
            shop=self.shop_2,
            requested_by=self.shop_admin_2,
            service_name="Wedding Gown Preservation",
            description="Acid-free gown preservation",
        )

        self.client.force_authenticate(user=self.shop_admin_1)

        # List only shop 1's requests
        res_list = self.client.get("/api/shop-admin/service-requests/")
        self.assertEqual(res_list.status_code, 200)
        results = res_list.data.get("results", res_list.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], sr_shop1.id)

        # Detail of shop 2's request returns 404
        res_detail = self.client.get(f"/api/shop-admin/service-requests/{sr_shop2.id}/")
        self.assertEqual(res_detail.status_code, 404)

        # Create new service request
        new_sr_payload = {
            "service_name": "Curtain Dry Cleaning",
            "description": "Heavy velvet and blackout curtains",
        }
        res_create = self.client.post(
            "/api/shop-admin/service-requests/",
            new_sr_payload,
            format="json",
        )
        self.assertEqual(res_create.status_code, 201)
        self.assertEqual(res_create.data["service_name"], "Curtain Dry Cleaning")
        created_sr = ServiceRequest.objects.get(service_name="Curtain Dry Cleaning")
        self.assertEqual(created_sr.shop, self.shop_1)

    def test_garment_types_endpoint_returns_only_active_types(self):
        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.get("/api/shop-admin/garment-types/")
        self.assertEqual(res.status_code, 200)
        results = res.data.get("results", res.data)
        garment_names = [g["garment_name"] for g in results]
        self.assertIn("Silk Shirt", garment_names)
        self.assertNotIn("Vintage Rug", garment_names)

    def test_shop_admin_user_profile_get_and_patch(self):
        self.client.force_authenticate(user=self.shop_admin_1)

        # GET
        res_get = self.client.get("/api/shop-admin/profile/")
        self.assertEqual(res_get.status_code, 200)
        self.assertEqual(res_get.data["username"], "shop1_admin_user")
        self.assertEqual(res_get.data["shop_id"], self.shop_1.id)
        self.assertEqual(res_get.data["shop_name"], self.shop_1.shop_name)

        # PATCH
        patch_payload = {
            "first_name": "Asha Updated",
            "last_name": "Cleaners Updated",
            "phone_number": "9998887776",
        }
        res_patch = self.client.patch("/api/shop-admin/profile/", patch_payload, format="json")
        self.assertEqual(res_patch.status_code, 200)
        self.assertEqual(res_patch.data["first_name"], "Asha Updated")
        self.shop_admin_1.refresh_from_db()
        self.assertEqual(self.shop_admin_1.first_name, "Asha Updated")
        self.assertEqual(self.shop_admin_1.phone_number, "9998887776")

    def test_automatic_closure_when_approval_revoked_with_partial_save(self):
        self.shop_1.is_open = True
        self.shop_1.save()
        self.assertTrue(self.shop_1.is_open)

        # Revoke approval using partial save with update_fields
        self.shop_1.is_approved = False
        self.shop_1.save(update_fields=["is_approved"])

        self.shop_1.refresh_from_db()
        self.assertFalse(self.shop_1.is_approved)
        self.assertFalse(self.shop_1.is_open)

    def test_automatic_closure_when_ineligible_with_partial_save(self):
        self.shop_1.is_open = True
        self.shop_1.save()
        self.assertTrue(self.shop_1.is_open)

        # Deactivate only active service
        self.shop1_service.is_active = False
        self.shop1_service.save()

        # Save an unrelated field on the shop
        self.shop_1.description = "Updated description"
        self.shop_1.save(update_fields=["description"])

        self.shop_1.refresh_from_db()
        self.assertFalse(self.shop_1.is_open)
        self.assertEqual(self.shop_1.description, "Updated description")

    def test_global_service_deactivation_auto_closes_open_shops(self):
        # shop_1 is open with only service_dryclean active
        self.shop_1.is_open = True
        self.shop_1.save()
        self.assertTrue(self.shop_1.is_open)

        # shop_2 has two active services: service_dryclean and service_ironing
        self.shop_2.is_approved = True
        self.shop_2.save()
        ShopService.objects.create(
            shop=self.shop_2,
            service=self.service_dryclean,
            garment_type=self.garment_shirt,
            price=Decimal("150.00"),
            estimated_days=2,
            is_active=True,
        )
        ShopService.objects.create(
            shop=self.shop_2,
            service=self.service_ironing,
            garment_type=self.garment_shirt,
            price=Decimal("50.00"),
            estimated_days=1,
            is_active=True,
        )
        self.shop_2.is_open = True
        self.shop_2.save()
        self.assertTrue(self.shop_2.is_open)

        # Deactivate service_dryclean globally
        self.service_dryclean.is_active = False
        self.service_dryclean.save()

        # shop_1 had only service_dryclean active, so it must be automatically closed
        self.shop_1.refresh_from_db()
        self.assertFalse(self.shop_1.is_open)

        # shop_2 still has service_ironing active, so it remains open
        self.shop_2.refresh_from_db()
        self.assertTrue(self.shop_2.is_open)


_temp_media_dir = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=_temp_media_dir)
class ShopAdminImageUploadTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(_temp_media_dir, ignore_errors=True)

    def setUp(self):
        self.password = "StrongPassword123!"
        self.shop_admin_1 = User.objects.create_user(
            username="upload_admin_1",
            email="upload1@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.shop_admin_2 = User.objects.create_user(
            username="upload_admin_2",
            email="upload2@example.com",
            password=self.password,
            role="shop_admin",
        )
        self.customer = User.objects.create_user(
            username="upload_customer",
            email="uploadcust@example.com",
            password=self.password,
            role="customer",
        )
        self.shop_1 = Shop.objects.create(
            shop_admin=self.shop_admin_1,
            shop_name="Upload Test Shop 1",
            contact_number="9876543210",
            address_line="Upload Road 1",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
            is_open=False,
        )
        self.shop_2 = Shop.objects.create(
            shop_admin=self.shop_admin_2,
            shop_name="Upload Test Shop 2",
            contact_number="9876543211",
            address_line="Upload Road 2",
            city="Kochi",
            district="Ernakulam",
            state="Kerala",
            pincode="682001",
            opening_time=time(9),
            closing_time=time(18),
            is_approved=True,
            is_open=False,
        )

    @staticmethod
    def create_in_memory_image(filename="test_shop.jpg"):
        image = Image.new("RGB", (50, 50), color="blue")
        buffer = BytesIO()
        image.save(buffer, format="JPEG")
        return SimpleUploadedFile(
            filename,
            buffer.getvalue(),
            content_type="image/jpeg",
        )

    def test_multipart_image_upload_succeeds_for_approved_shop_admin(self):
        self.client.force_authenticate(user=self.shop_admin_1)
        image = self.create_in_memory_image("new_shop_front.jpg")

        res = self.client.patch(
            "/api/shop-admin/shop/",
            {"image": image},
            format="multipart",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn("image", res.data)
        self.assertIsNotNone(res.data["image"])
        self.assertIn("new_shop_front", str(res.data["image"]))

        self.shop_1.refresh_from_db()
        self.assertTrue(bool(self.shop_1.image))
        self.assertIn("new_shop_front", self.shop_1.image.name)

    def test_multipart_upload_ignores_protected_fields(self):
        self.client.force_authenticate(user=self.shop_admin_1)
        image = self.create_in_memory_image("protected_check.jpg")

        res = self.client.patch(
            "/api/shop-admin/shop/",
            {
                "image": image,
                "is_approved": False,
                "is_open": True,
                "shop_admin": self.shop_admin_2.id,
            },
            format="multipart",
        )
        self.assertEqual(res.status_code, 200, res.data)

        self.shop_1.refresh_from_db()
        self.assertTrue(self.shop_1.is_approved)
        self.assertFalse(self.shop_1.is_open)
        self.assertEqual(self.shop_1.shop_admin, self.shop_admin_1)

    def test_cross_shop_and_unauthorized_upload_rejected(self):
        image = self.create_in_memory_image("unauth.jpg")

        # Unauthenticated
        res_unauth = self.client.patch(
            "/api/shop-admin/shop/",
            {"image": image},
            format="multipart",
        )
        self.assertEqual(res_unauth.status_code, 401)

        # Customer role
        self.client.force_authenticate(user=self.customer)
        image_cust = self.create_in_memory_image("cust.jpg")
        res_cust = self.client.patch(
            "/api/shop-admin/shop/",
            {"image": image_cust},
            format="multipart",
        )
        self.assertEqual(res_cust.status_code, 403)

        # Shop admin 2 can only update shop 2, never shop 1
        self.client.force_authenticate(user=self.shop_admin_2)
        image_shop2 = self.create_in_memory_image("shop2.jpg")
        res_shop2 = self.client.patch(
            "/api/shop-admin/shop/",
            {"image": image_shop2},
            format="multipart",
        )
        self.assertEqual(res_shop2.status_code, 200)
        self.shop_2.refresh_from_db()
        self.assertIn("shop2", self.shop_2.image.name)

        # shop 1 must remain untouched
        self.shop_1.refresh_from_db()
        self.assertFalse(bool(self.shop_1.image))

    def test_existing_profile_json_updates_still_work(self):
        self.client.force_authenticate(user=self.shop_admin_1)
        res = self.client.patch(
            "/api/shop-admin/shop/",
            {"contact_number": "9123456789", "city": "Aluva"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.shop_1.refresh_from_db()
        self.assertEqual(self.shop_1.contact_number, "9123456789")
        self.assertEqual(self.shop_1.city, "Aluva")
