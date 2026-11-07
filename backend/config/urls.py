from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from accounts.views import (
    DeliveryAgentTokenRefreshView,
    IdentifierTokenObtainPairView,
)


urlpatterns = [
    path('admin/', admin.site.urls),
    path(
        "api/token/",
        IdentifierTokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),
    path(
        "api/token/refresh/",
        DeliveryAgentTokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path("api/", include("shops.urls")),
    path("api/", include("orders.urls")),
    path("api/", include("accounts.urls")),
    path("api/", include("users.urls")),
    path("api/", include("logistics.urls")),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )
