from django.urls import path
from accounts.views import CustomerProfileViewSet,CustomerRegistrationView

customer_profile = CustomerProfileViewSet.as_view(
    {
        "get": "retrieve",
        "patch": "partial_update",
    }
)


urlpatterns = [
    path('register/',CustomerRegistrationView.as_view(),name="customer-register"),
    path("profile/", customer_profile, name="customer-profile"),
]
