from rest_framework import serializers

from orders.models import Order, OrderItem, OrderStatusHistory


class PlatformAdminOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = (
            "id",
            "shop_service",
            "garment_name_snapshot",
            "service_name_snapshot",
            "quantity",
            "unit_price_snapshot",
            "line_total",
            "item_status",
        )


class PlatformAdminOrderHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusHistory
        fields = ("status", "created_at")


class PlatformAdminOrderListSerializer(serializers.ModelSerializer):
    customer_username = serializers.CharField(
        source="customer.username",
        read_only=True,
    )
    shop_name = serializers.CharField(source="shop.shop_name", read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "customer_username",
            "shop_name",
            "total_amount",
            "order_status",
            "payment_status",
            "created_at",
            "updated_at",
        )


class PlatformAdminOrderDetailSerializer(serializers.ModelSerializer):
    customer_username = serializers.CharField(
        source="customer.username",
        read_only=True,
    )
    customer_email = serializers.EmailField(
        source="customer.email",
        read_only=True,
        allow_null=True,
    )
    customer_phone = serializers.CharField(
        source="customer.phone_number",
        read_only=True,
        allow_null=True,
    )
    shop_name = serializers.CharField(source="shop.shop_name", read_only=True)
    shop_admin_username = serializers.CharField(
        source="shop.shop_admin.username",
        read_only=True,
        allow_null=True,
    )
    items = PlatformAdminOrderItemSerializer(
        source="order_items",
        many=True,
        read_only=True,
    )
    status_history = PlatformAdminOrderHistorySerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "customer_username",
            "customer_email",
            "customer_phone",
            "shop_name",
            "shop_admin_username",
            "note",
            "pickup_address_line",
            "pickup_city",
            "pickup_district",
            "pickup_state",
            "pickup_pincode",
            "total_amount",
            "order_status",
            "payment_status",
            "created_at",
            "updated_at",
            "items",
            "status_history",
        )
