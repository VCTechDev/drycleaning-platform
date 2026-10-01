from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth.password_validation import validate_password

from users.models import User


class CustomerProfileSerializer(serializers.ModelSerializer):

    username = serializers.CharField(required=False)
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = (
            "username",
            "first_name",
            "last_name",
            "email",
            "phone_number",
        )

    def validate_username(self, value):
        if User.objects.exclude(pk=self.instance.pk).filter(
            username=value
        ).exists():
            raise serializers.ValidationError("Username already taken.")

        return value

    def validate_email(self, value):
        if value in (None, ""):
            return None

        value = value.strip().lower()

        if User.objects.exclude(pk=self.instance.pk).filter(
            email__iexact=value
        ).exists():
            raise serializers.ValidationError(
                "A user with that email already exists."
            )

        return value


class CustomerRegistrationSerializer(serializers.ModelSerializer):

    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )

    password_confirm = serializers.CharField(
        write_only=True
    )

    class Meta:
        model = User
        fields = (
            "username",
            "email",
            "phone_number",
            "password",
            "password_confirm",
        )

        extra_kwargs = {
            "email": {
                "required": True,
                "allow_blank": False,
                "allow_null": False,
            },
        }

    def validate(self, attrs):

        # Make sure both password fields contain the same password.
        if attrs.get("password") != attrs.get("password_confirm"):
            raise serializers.ValidationError({
                "password": "Passwords do not match."
            })

        try:
            validate_password(attrs["password"])
        except DjangoValidationError as error:
            raise serializers.ValidationError({
                "password": error.messages,
            }) from error

        email = attrs["email"].strip().lower()

        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({
                "email": "A user with that email already exists."
            })

        attrs["email"] = email

        return attrs

    def create(self, validated_data):

        # password_confirm is only used for validation.
        # We don't need to save it in the User model.
        validated_data.pop("password_confirm")

        # Always create this account as a customer.
        # The frontend must NOT decide the user's role.
        user = User.objects.create_user(
            role="customer",
            **validated_data
        )

        return user
