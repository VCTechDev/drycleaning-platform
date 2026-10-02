from rest_framework.routers import DefaultRouter

from users.views import PlatformAdminUserViewSet


router = DefaultRouter()
router.register("platform/users", PlatformAdminUserViewSet, basename="platform-users")

urlpatterns = router.urls
