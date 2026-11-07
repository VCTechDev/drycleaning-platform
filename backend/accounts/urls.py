from django.urls import path
from accounts.views import (
    ChangePasswordView,
    CustomerProfileViewSet,
    CustomerRegistrationView,
    DeliveryAgentEmailVerificationConfirmView,
    DeliveryAgentEmailVerificationRequestView,
    DeliveryAgentLoginRequestOTPView,
    DeliveryAgentLoginVerifyOTPView,
    ForgotPasswordView,
    PlatformAdminProfileViewSet,
    ResetPasswordView,
    ShopAdminProfileViewSet,
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

shop_admin_profile = ShopAdminProfileViewSet.as_view(
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
        "shop-admin/profile/",
        shop_admin_profile,
        name="shop-admin-profile",
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
    path(
        "auth/delivery-agent/request-otp/",
        DeliveryAgentLoginRequestOTPView.as_view(),
        name="delivery-agent-request-otp",
    ),
    path(
        "auth/delivery-agent/verify-otp/",
        DeliveryAgentLoginVerifyOTPView.as_view(),
        name="delivery-agent-verify-otp",
    ),
    path(
        "auth/delivery-agent/verify-email/request/",
        DeliveryAgentEmailVerificationRequestView.as_view(),
        name="delivery-agent-verify-email-request",
    ),
    path(
        "auth/delivery-agent/verify-email/confirm/",
        DeliveryAgentEmailVerificationConfirmView.as_view(),
        name="delivery-agent-verify-email-confirm",
    ),
    path(
        "auth/delivery-agent/email-verification/request/",
        DeliveryAgentEmailVerificationRequestView.as_view(),
        name="delivery-agent-email-verification-request",
    ),
    path(
        "auth/delivery-agent/email-verification/confirm/",
        DeliveryAgentEmailVerificationConfirmView.as_view(),
        name="delivery-agent-email-verification-confirm",
    ),
]
