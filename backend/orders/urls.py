from rest_framework.routers import DefaultRouter
from .views import CustomerOrderViewSet

router = DefaultRouter()

router.register(
    "orders",
    CustomerOrderViewSet,
    basename="customer-orders",
)

urlpatterns = router.urls
