from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path,include

from rest_framework_simplejwt.views import TokenRefreshView
from accounts.views import IdentifierTokenObtainPairView




urlpatterns = [
    path('admin/', admin.site.urls),
    path(
        "api/token/",
        IdentifierTokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),
    path(
        "api/token/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path("api/",include("shops.urls")),
    path("api/",include("orders.urls")),
    path("api/",include("accounts.urls")),
    path("api/",include("users.urls")),
    
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )
