from rest_framework.routers import DefaultRouter
from .views import CustomerShopViewSet

router = DefaultRouter()

router.register(
    "shops",
    CustomerShopViewSet,
    basename="customer-shops",
)

urlpatterns = router.urls
