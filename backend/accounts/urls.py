from django.urls import path
from accounts.views import CustomerProfileViewSet

customer_profile = CustomerProfileViewSet.as_view(
    {
        "get": "retrieve",
        "patch": "partial_update",
    }
)


urlpatterns = [
    path("profile/", customer_profile, name="customer-profile"),
]
