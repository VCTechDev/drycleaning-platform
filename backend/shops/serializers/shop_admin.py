from rest_framework import serializers

from shops.models import Service, ShopService


class ShopAdminServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = (
            "id",
            "service_name",
            "description",
            "image",
            "is_active",
        )


class ShopAdminShopServiceSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.service_name", read_only=True)
    garment_name = serializers.CharField(
        source="garment_type.garment_name",
        read_only=True,
    )

    class Meta:
        model = ShopService
        fields = (
            "id",
            "service",
            "service_name",
            "garment_type",
            "garment_name",
            "price",
            "estimated_days",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "service_name",
            "garment_name",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        service = attrs.get("service", getattr(self.instance, "service", None))
        if service and not service.is_active:
            raise serializers.ValidationError(
                {"service": "Inactive platform services cannot be configured."}
            )
        price = attrs.get("price")
        if price is not None and price <= 0:
            raise serializers.ValidationError(
                {"price": "Price must be greater than zero."}
            )
        estimated_days = attrs.get("estimated_days")
        if estimated_days is not None and estimated_days < 1:
            raise serializers.ValidationError(
                {"estimated_days": "Estimated days must be at least one."}
            )
        return attrs
