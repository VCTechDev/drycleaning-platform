from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import (
    CustomerShopViewSet,
    PlatformDashboardView,
    PlatformServiceRequestViewSet,
    PlatformServiceViewSet,
    PlatformShopApplicationViewSet,
    PlatformShopViewSet,
    PublicShopApplicationViewSet,
    ShopAdminServiceRequestViewSet,
    ShopAdminServiceViewSet,
    ShopAdminShopServiceViewSet,
)

router = DefaultRouter()

router.register(
    "shops",
    CustomerShopViewSet,
    basename="customer-shops",
)
router.register(
    "platform/shop-applications",
    PlatformShopApplicationViewSet,
    basename="platform-shop-applications",
)
router.register(
    "platform/service-requests",
    PlatformServiceRequestViewSet,
    basename="platform-service-requests",
)
router.register(
    "platform/services",
    PlatformServiceViewSet,
    basename="platform-services",
)
router.register(
    "platform/shops",
    PlatformShopViewSet,
    basename="platform-shops",
)
router.register(
    "shop-admin/services",
    ShopAdminServiceViewSet,
    basename="shop-admin-services",
)
router.register(
    "shop-admin/shop-services",
    ShopAdminShopServiceViewSet,
    basename="shop-admin-shop-services",
)
router.register(
    "shop-admin/service-requests",
    ShopAdminServiceRequestViewSet,
    basename="shop-admin-service-requests",
)

public_application = PublicShopApplicationViewSet.as_view({
    "post": "create",
})
public_application_detail = PublicShopApplicationViewSet.as_view({
    "get": "retrieve",
    "patch": "update_draft",
})
public_application_submit = PublicShopApplicationViewSet.as_view({
    "post": "submit",
})

urlpatterns = [
    path("shop-applications/", public_application, name="public-shop-application"),
    path(
        "shop-applications/<uuid:public_id>/",
        public_application_detail,
        name="public-shop-application-detail",
    ),
    path(
        "shop-applications/<uuid:public_id>/submit/",
        public_application_submit,
        name="public-shop-application-submit",
    ),
    path("platform/dashboard/", PlatformDashboardView.as_view(), name="platform-dashboard"),
] + router.urls
