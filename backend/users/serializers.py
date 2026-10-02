from rest_framework import serializers

from users.models import User


class PlatformAdminUserSerializer(serializers.ModelSerializer):
    shop_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "phone_number",
            "role",
            "is_active",
            "date_joined",
            "shop_name",
        )

    def get_shop_name(self, obj):
        try:
            return obj.shop.shop_name
        except User.shop.RelatedObjectDoesNotExist:
            return None
