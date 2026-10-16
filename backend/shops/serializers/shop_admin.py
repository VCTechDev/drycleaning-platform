from rest_framework import serializers

from shops.models import GarmentType, Service, Shop, ShopService


class GarmentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = GarmentType
        fields = (
            "id",
            "garment_name",
            "description",
            "image",
            "is_active",
        )


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
        garment_type = attrs.get(
            "garment_type", getattr(self.instance, "garment_type", None)
        )
        if garment_type and not garment_type.is_active:
            raise serializers.ValidationError(
                {"garment_type": "Inactive garment types cannot be configured."}
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
        if not self.instance:
            view = self.context.get("view")
            shop = view.get_shop() if view and hasattr(view, "get_shop") else None
            if shop and service and garment_type:
                if ShopService.objects.filter(
                    shop=shop,
                    service=service,
                    garment_type=garment_type,
                ).exists():
                    raise serializers.ValidationError(
                        "This service and garment type combination is already configured for your shop."
                    )
        return attrs


class ShopAdminShopProfileSerializer(serializers.ModelSerializer):
    active_services_count = serializers.SerializerMethodField()
    shop_admin_username = serializers.CharField(
        source="shop_admin.username",
        read_only=True,
    )
    shop_admin_email = serializers.EmailField(
        source="shop_admin.email",
        read_only=True,
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
            "shop_admin_username",
            "shop_admin_email",
            "active_services_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "shop_name",
            "is_approved",
            "is_open",
            "shop_admin_username",
            "shop_admin_email",
            "active_services_count",
            "created_at",
            "updated_at",
        )

    def get_active_services_count(self, obj):
        return obj.shop_services.filter(
            is_active=True,
            service__is_active=True,
        ).count()


class ShopAdminShopProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shop
        fields = (
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
        )

    def validate_contact_number(self, value):
        if value is not None and not value.strip():
            raise serializers.ValidationError("Contact number cannot be empty.")
        return value.strip() if value else value

    def validate(self, attrs):
        opening_time = attrs.get(
            "opening_time", getattr(self.instance, "opening_time", None)
        )
        closing_time = attrs.get(
            "closing_time", getattr(self.instance, "closing_time", None)
        )
        if opening_time and closing_time and opening_time >= closing_time:
            raise serializers.ValidationError(
                {"closing_time": "Closing time must be after opening time."}
            )
        return attrs
