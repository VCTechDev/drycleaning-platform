from rest_framework import serializers

from users.models import User


class CustomerProfileSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = (
            "username",
            "first_name",
            "last_name",
            "email",
            "phone_number",
        )

        read_only_fields = ("username",)


class CustomerRegistrationSerializer(serializers.ModelSerializer):

    password = serializers.CharField(
        write_only=True,
        min_length=8
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

    def validate(self, attrs):

        # Make sure both password fields contain the same password.
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({
                "password": "Passwords do not match."
            })

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