from django.urls import path
from accounts.views import (
    ChangePasswordView,
    CustomerProfileViewSet,
    CustomerRegistrationView,
    ForgotPasswordView,
    PlatformAdminProfileViewSet,
    ResetPasswordView,
    VerifyOTPView,
)

customer_profile = CustomerProfileViewSet.as_view(
    {
        "get": "retrieve",
        "patch": "partial_update",
    }
)

platform_admin_profile = PlatformAdminProfileViewSet.as_view(
    {
        "get": "retrieve",
        "patch": "partial_update",
    }
)


urlpatterns = [
    path("register/", CustomerRegistrationView.as_view(), name="customer-register"),
    path("profile/", customer_profile, name="customer-profile"),
    path(
        "platform/profile/",
        platform_admin_profile,
        name="platform-admin-profile",
    ),
    path(
        "auth/forgot-password/",
        ForgotPasswordView.as_view(),
        name="forgot-password",
    ),
    path(
        "auth/verify-otp/",
        VerifyOTPView.as_view(),
        name="verify-otp",
    ),
    path(
        "auth/reset-password/",
        ResetPasswordView.as_view(),
        name="reset-password",
    ),
    path(
        "auth/change-password/",
        ChangePasswordView.as_view(),
        name="change-password",
    ),
]
