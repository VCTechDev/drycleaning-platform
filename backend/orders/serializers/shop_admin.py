from rest_framework import serializers

from orders.models import Order, OrderItem, OrderStatusHistory
from logistics.models import DeliveryTask
from users.models import User


class ShopAdminOrderCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "phone_number",
        )


class ShopAdminOrderItemSerializer(serializers.ModelSerializer):
    garment = serializers.CharField(
        source="garment_name_snapshot",
        read_only=True,
    )
    service = serializers.CharField(
        source="service_name_snapshot",
        read_only=True,
    )
    unit_price = serializers.DecimalField(
        source="unit_price_snapshot",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    garment_image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = (
            "id",
            "garment",
            "service",
            "quantity",
            "unit_price",
            "line_total",
            "item_status",
            "garment_image",
        )

    def get_garment_image(self, obj):
        image = getattr(
            getattr(getattr(obj, "shop_service", None), "garment_type", None),
            "image",
            None,
        )
        if not image:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(image.url)
        return image.url


class ShopAdminOrderDeliveryTaskSerializer(serializers.ModelSerializer):
    delivery_agent_username = serializers.CharField(
        source="delivery_agent.user.username",
        read_only=True,
        allow_null=True,
    )
    delivery_agent_phone = serializers.CharField(
        source="delivery_agent.user.phone_number",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = DeliveryTask
        fields = (
            "id",
            "task_type",
            "status",
            "delivery_agent_username",
            "delivery_agent_phone",
            "scheduled_at",
            "completed_at",
            "created_at",
            "updated_at",
        )


class ShopAdminOrderStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusHistory
        fields = (
            "status",
            "created_at",
        )


class ShopAdminOrderListSerializer(serializers.ModelSerializer):
    customer = ShopAdminOrderCustomerSerializer(read_only=True)
    items_count = serializers.SerializerMethodField()
    services_count = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "customer",
            "pickup_address_line",
            "pickup_city",
            "pickup_district",
            "total_amount",
            "order_status",
            "rejection_reason",
            "payment_status",
            "items_count",
            "services_count",
            "created_at",
            "updated_at",
        )

    def get_items_count(self, obj):
        return sum(
            item.quantity
            for item in obj.order_items.all()
            if item.item_status == "active"
        )

    def get_services_count(self, obj):
        return len(
            {
                item.service_name_snapshot
                for item in obj.order_items.all()
                if item.service_name_snapshot
            }
        )


class ShopAdminOrderDetailSerializer(serializers.ModelSerializer):
    customer = ShopAdminOrderCustomerSerializer(read_only=True)
    items = ShopAdminOrderItemSerializer(
        source="order_items",
        many=True,
        read_only=True,
    )
    status_history = ShopAdminOrderStatusHistorySerializer(
        many=True,
        read_only=True,
    )
    delivery_tasks = ShopAdminOrderDeliveryTaskSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "customer",
            "note",
            "pickup_address_line",
            "pickup_city",
            "pickup_district",
            "pickup_state",
            "pickup_pincode",
            "total_amount",
            "order_status",
            "rejection_reason",
            "payment_status",
            "created_at",
            "updated_at",
            "items",
            "status_history",
            "delivery_tasks",
        )


class ShopAdminOrderRejectSerializer(serializers.Serializer):
    reason = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
        max_length=500,
    )

    def validate_reason(self, value):
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError(
                "A rejection reason is required and cannot be blank."
            )
        return stripped
