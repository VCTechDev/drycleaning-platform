from rest_framework import serializers
from django.db.models.functions import Lower, Trim

from shops.models import Service, Shop


class PlatformAdminServiceSerializer(serializers.ModelSerializer):
    shop_count = serializers.IntegerField(read_only=True)
    order_item_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Service
        fields = (
            "id",
            "service_name",
            "description",
            "image",
            "is_active",
            "shop_count",
            "order_item_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "shop_count",
            "order_item_count",
            "created_at",
            "updated_at",
        )

    def validate_service_name(self, value):
        value = value.strip()
        queryset = Service.objects.annotate(
            _normalized_name=Lower(Trim("service_name")),
        ).filter(_normalized_name=value.casefold())
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                "A service with this name already exists."
            )
        return value


class PlatformAdminShopListSerializer(serializers.ModelSerializer):
    shop_admin_username = serializers.CharField(
        source="shop_admin.username",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Shop
        fields = (
            "id",
            "shop_name",
            "shop_admin_username",
            "city",
            "district",
            "state",
            "is_approved",
            "is_open",
            "created_at",
        )


class PlatformAdminShopDetailSerializer(serializers.ModelSerializer):
    shop_admin_id = serializers.IntegerField(
        source="shop_admin.id",
        read_only=True,
        allow_null=True,
    )
    shop_admin_username = serializers.CharField(
        source="shop_admin.username",
        read_only=True,
        allow_null=True,
    )
    shop_admin_email = serializers.EmailField(
        source="shop_admin.email",
        read_only=True,
        allow_null=True,
    )
    shop_admin_phone = serializers.CharField(
        source="shop_admin.phone_number",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Shop
        fields = (
            "id",
            "shop_name",
            "description",
            "image",
            "contact_number",
            "address_line",
            "city",
            "district",
            "state",
            "pincode",
            "opening_time",
            "closing_time",
            "is_approved",
            "is_open",
            "shop_admin_id",
            "shop_admin_username",
            "shop_admin_email",
            "shop_admin_phone",
            "created_at",
            "updated_at",
        )


class ShopOperationalStatusSerializer(serializers.Serializer):
    is_open = serializers.BooleanField()
