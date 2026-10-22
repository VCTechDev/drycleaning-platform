from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    DeliveryAgentAvailabilityView,
    ShopAdminDeliveryAgentViewSet,
)

router = DefaultRouter()
router.register(
    "shop-admin/delivery-agents",
    ShopAdminDeliveryAgentViewSet,
    basename="shop-admin-delivery-agents",
)

urlpatterns = [
    path(
        "delivery-agent/availability/",
        DeliveryAgentAvailabilityView.as_view(),
        name="delivery-agent-availability",
    ),
    path("", include(router.urls)),
]
