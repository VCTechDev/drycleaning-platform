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
