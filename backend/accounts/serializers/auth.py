from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

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
