from rest_framework import serializers
from shops.models import Shop, ShopService


class CustomerShopListSerializer(serializers.ModelSerializer):

    class Meta:
        model = Shop
        fields = (
            "id",
            "shop_name",
            "description",
            "image",
            "city",
            "is_open",
        )


class CustomerShopDetailSerializer(serializers.ModelSerializer):

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
            "is_open",
        )


class CustomerShopServiceSerializer(serializers.ModelSerializer):

    service = serializers.CharField(source="service.service_name", read_only=True)
    garment_type = serializers.CharField(
        source="garment_type.garment_name", read_only=True
    )

    class Meta:
        model = ShopService
        fields = (
            "id",
            "service",
            "garment_type",
            "price",
            "estimated_days",
        )
