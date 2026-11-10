import re

from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings

from users.models import User


class AccountIdentifierSerializer(serializers.Serializer):
    """Accept the shared identifier shape used by auth endpoints."""

    identifier = serializers.CharField(
        required=False,
        allow_blank=False,
        write_only=True,
    )
    username = serializers.CharField(
        required=False,
        allow_blank=False,
        write_only=True,
    )
    email = serializers.EmailField(
        required=False,
        allow_blank=False,
        write_only=True,
    )

    def validate(self, attrs):
        identifier = (
            attrs.get("identifier")
            or attrs.get("username")
            or attrs.get("email")
        )

        if not identifier:
            raise serializers.ValidationError({
                "identifier": "Username or email is required."
            })

        attrs["identifier"] = identifier.strip()
        return attrs


class ForgotPasswordSerializer(AccountIdentifierSerializer):
    pass


class VerifyOTPSerializer(AccountIdentifierSerializer):
    otp = serializers.RegexField(
        regex=r"^\d{6}$",
        write_only=True,
        error_messages={"invalid": "Enter a valid 6-digit OTP."},
    )


class ResetPasswordSerializer(AccountIdentifierSerializer):
    reset_token = serializers.CharField(
        required=True,
        write_only=True,
        trim_whitespace=True,
    )
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        required=True,
        write_only=True,
        style={"input_type": "password"},
    )

    def validate(self, attrs):
        attrs = super().validate(attrs)

        if attrs["new_password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({
                "password_confirm": "Passwords do not match."
            })

        try:
            password_validation.validate_password(attrs["new_password"])
        except DjangoValidationError as error:
            raise serializers.ValidationError({
                "new_password": error.messages,
            }) from error
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(
        required=True,
        write_only=True,
        style={"input_type": "password"},
    )
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        required=True,
        write_only=True,
        style={"input_type": "password"},
    )

    def validate(self, attrs):
        user = self.context["request"].user

        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({
                "current_password": "Current password is incorrect."
            })

        if attrs["new_password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({
                "password_confirm": "Passwords do not match."
            })

        if attrs["current_password"] == attrs["new_password"]:
            raise serializers.ValidationError({
                "new_password": "New password must be different from the current password."
            })

        try:
            password_validation.validate_password(attrs["new_password"], user)
        except DjangoValidationError as error:
            raise serializers.ValidationError({
                "new_password": error.messages,
            }) from error
        return attrs


def find_user_by_identifier(identifier):
    """Resolve username first, then a case-insensitive email address."""

    user = User.objects.filter(username=identifier).first()

    if user is not None:
        return user

    return User.objects.filter(email__iexact=identifier).first()


class DeliveryAgentLoginRequestSerializer(serializers.Serializer):
    """Validate request for delivery-agent login OTP."""

    identifier = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )


class DeliveryAgentLoginVerifySerializer(serializers.Serializer):
    """Validate submission of delivery-agent challenge ID and OTP."""

    challenge_id = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )
    otp = serializers.RegexField(
        regex=r"^\d{6}$",
        required=True,
        error_messages={"invalid": "Enter a valid 6-digit OTP."},
    )


class DeliveryAgentEmailVerificationRequestSerializer(serializers.Serializer):
    """Validate identifier for delivery agent onboarding email verification."""

    identifier = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )


class DeliveryAgentEmailVerificationConfirmSerializer(serializers.Serializer):
    """Validate submission for delivery agent onboarding email verification."""

    identifier = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    otp = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    code = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )

    def validate(self, attrs):
        ident = (attrs.get("identifier") or attrs.get("email") or "").strip()
        if not ident:
            raise serializers.ValidationError({
                "identifier": "Agent ID, phone number, or email is required."
            })
        raw_code = (attrs.get("otp") or attrs.get("code") or "").strip()
        if not raw_code:
            raise serializers.ValidationError({
                "otp": "Verification code is required."
            })
        if not re.fullmatch(r"^\d{6}$", raw_code):
            raise serializers.ValidationError({
                "otp": "Enter a valid 6-digit verification code."
            })
        return {
            "identifier": ident,
            "otp": raw_code,
        }


class DeliveryAgentTokenRefreshSerializer(TokenRefreshSerializer):
    """Token refresh serializer enforcing delivery-agent and user eligibility."""

    def validate(self, attrs):
        # 1. Perform eligibility checks BEFORE calling parent token-generation/rotation logic
        refresh = self.token_class(attrs["refresh"])
        user_id = refresh.payload.get(api_settings.USER_ID_CLAIM, None)

        if user_id is not None:
            user = get_user_model().objects.filter(
                **{api_settings.USER_ID_FIELD: user_id}
            ).first()
            if user is None or not user.is_active:
                raise AuthenticationFailed(
                    "User account is inactive or deleted.",
                    "no_active_account",
                )
            if user.role == "delivery_agent":
                agent = getattr(user, "delivery_agent", None)
                if agent is None or not agent.is_active:
                    raise AuthenticationFailed(
                        "Delivery agent account is inactive or deactivated.",
                        "no_active_account",
                    )
                if not user.phone_number or not user.phone_number.strip():
                    raise AuthenticationFailed(
                        "Delivery agent missing registered phone number.",
                        "phone_missing",
                    )

                from accounts.views.auth import is_delivery_agent_otp_console_fallback_active

                if not is_delivery_agent_otp_console_fallback_active():
                    if not user.email or not user.email.strip():
                        raise AuthenticationFailed(
                            "Delivery agent missing registered email address.",
                            "email_missing",
                        )
                    if not agent.email_verified:
                        raise AuthenticationFailed(
                            "Delivery agent email address is not verified.",
                            "email_not_verified",
                        )

        # 2. Proceed to parent SimpleJWT validate logic
        return super().validate(attrs)
