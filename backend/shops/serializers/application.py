from rest_framework import serializers

from shops.models import ShopApplication, ServiceRequest


class ShopApplicationSerializer(serializers.ModelSerializer):
    """Public application fields; token hashes are never serialized."""

    class Meta:
        model = ShopApplication
        fields = (
            "public_id",
            "owner_name",
            "email",
            "phone_number",
            "shop_name",
            "description",
            "image",
            "address_line",
            "city",
            "district",
            "state",
            "pincode",
            "opening_time",
            "closing_time",
            "status",
            "rejection_reason",
            "reviewed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "public_id",
            "status",
            "rejection_reason",
            "reviewed_at",
            "created_at",
            "updated_at",
        )
        extra_kwargs = {
            "owner_name": {"required": False},
            "email": {"required": False, "allow_null": True},
            "phone_number": {"required": False},
            "shop_name": {"required": False},
            "description": {"required": False},
            "address_line": {"required": False},
            "city": {"required": False},
            "district": {"required": False},
            "state": {"required": False},
            "pincode": {"required": False},
            "opening_time": {"required": False, "allow_null": True},
            "closing_time": {"required": False, "allow_null": True},
            "image": {"required": False, "allow_null": True},
        }

    def validate(self, attrs):
        if self.instance and self.instance.status != ShopApplication.STATUS_DRAFT:
            raise serializers.ValidationError(
                "Only draft applications can be edited."
            )
        return attrs

    def validate_email(self, value):
        if value is None:
            return value
        return value.strip().lower()


class ShopApplicationStatusSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField(
        required=False,
        allow_blank=False,
        trim_whitespace=True,
    )


class PlatformShopApplicationListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopApplication
        fields = (
            "public_id",
            "owner_name",
            "email",
            "phone_number",
            "shop_name",
            "district",
            "city",
            "status",
            "created_at",
            "reviewed_at",
        )


class PlatformShopApplicationDetailSerializer(serializers.ModelSerializer):
    reviewed_by_username = serializers.CharField(
        source="reviewed_by.username",
        read_only=True,
        allow_null=True,
    )
    approved_user_username = serializers.CharField(
        source="approved_user.username",
        read_only=True,
        allow_null=True,
    )
    created_shop_id = serializers.IntegerField(
        source="created_shop.id",
        read_only=True,
        allow_null=True,
    )
    notifications = serializers.SerializerMethodField()

    class Meta:
        model = ShopApplication
        fields = (
            "public_id",
            "owner_name",
            "email",
            "phone_number",
            "shop_name",
            "description",
            "image",
            "address_line",
            "city",
            "district",
            "state",
            "pincode",
            "opening_time",
            "closing_time",
            "status",
            "rejection_reason",
            "reviewed_by_username",
            "reviewed_at",
            "approved_user_username",
            "created_shop_id",
            "notifications",
            "created_at",
            "updated_at",
        )

    def get_notifications(self, obj):
        return [
            {
                "type": notification.notification_type,
                "status": notification.status,
                "attempts": notification.attempts,
                "sent_at": notification.sent_at,
                "last_error": notification.last_error,
            }
            for notification in obj.notifications.all()
        ]


class ServiceRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceRequest
        fields = ("service_name", "description", "image")

    def validate_service_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Service name is required.")
        return value


class ShopAdminServiceRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceRequest
        fields = (
            "id",
            "service_name",
            "description",
            "image",
            "status",
            "rejection_reason",
            "approved_service",
            "reviewed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "rejection_reason",
            "approved_service",
            "reviewed_at",
            "created_at",
            "updated_at",
        )


class PlatformServiceRequestListSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.shop_name", read_only=True)
    requested_by_username = serializers.CharField(
        source="requested_by.username",
        read_only=True,
    )

    class Meta:
        model = ServiceRequest
        fields = (
            "id",
            "shop_name",
            "requested_by_username",
            "service_name",
            "status",
            "created_at",
            "reviewed_at",
        )


class PlatformServiceRequestDetailSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.shop_name", read_only=True)
    requested_by_username = serializers.CharField(
        source="requested_by.username",
        read_only=True,
    )
    reviewed_by_username = serializers.CharField(
        source="reviewed_by.username",
        read_only=True,
        allow_null=True,
    )
    approved_service_id = serializers.IntegerField(
        source="approved_service.id",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = ServiceRequest
        fields = (
            "id",
            "shop_name",
            "requested_by_username",
            "service_name",
            "description",
            "image",
            "status",
            "rejection_reason",
            "approved_service_id",
            "reviewed_by_username",
            "reviewed_at",
            "created_at",
            "updated_at",
        )
