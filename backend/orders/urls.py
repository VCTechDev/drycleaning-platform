from rest_framework.routers import DefaultRouter
from .views import (
    CustomerOrderViewSet,
    PlatformAdminOrderViewSet,
    ShopAdminOrderViewSet,
)

router = DefaultRouter()

router.register(
    "orders",
    CustomerOrderViewSet,
    basename="customer-orders",
)
router.register(
    "shop-admin/orders",
    ShopAdminOrderViewSet,
    basename="shop-admin-orders",
)
router.register(
    "platform/orders",
    PlatformAdminOrderViewSet,
    basename="platform-orders",
)


urlpatterns = router.urls
