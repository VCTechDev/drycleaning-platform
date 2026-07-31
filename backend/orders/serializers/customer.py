from rest_framework import serializers

from orders.models import Order, OrderItem


class CustomerOrderItemCreateSerializer(serializers.ModelSerializer):

    class Meta:
        model = OrderItem
        fields = (
            "shop_service",
            "quantity",
        )


class CustomerOrderCreateSerializer(serializers.ModelSerializer):

    items = CustomerOrderItemCreateSerializer(
        many=True,
        write_only=True,
    )

    class Meta:
        model = Order
        fields = (
            "shop",
            "note",
            "pickup_address_line",
            "pickup_city",
            "pickup_district",
            "pickup_state",
            "pickup_pincode",
            "items",
        )

    def create(self, validated_data):
        items = validated_data.pop("items")

        order = Order.objects.create(**validated_data)

        for item in items:

            OrderItem.objects.create(order=order, **item)

        return order


class CustomerOrderListSerializer(serializers.ModelSerializer):

    shop = serializers.CharField(
        source="shop.shop_name",
        read_only=True,
    )

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "shop",
            "total_amount",
            "order_status",
            "payment_status",
            "created_at",
        )


class CustomerOrderItemSerializer(serializers.ModelSerializer):

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

    class Meta:
        model = OrderItem
        fields = (
            "garment",
            "service",
            "quantity",
            "unit_price",
            "line_total",
        )


class CustomerOrderDetailSerializer(serializers.ModelSerializer):

    shop = serializers.CharField(
        source="shop_shop_name",
        read_only=True,
    )

    items = CustomerOrderItemSerializer(
        source="order_items",
        many=True,
        read_only=True,
    )

    class Meta:
        model = Order
        fields = (
            "order_number",
            "shop",
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
            "items",
        )


class CustomerOrderTrackingSerializer(serializers.ModelSerializer):

    tracking = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "order_number",
            "order_status",
            "tracking",
        )

    def get_tracking(self, obj):

        workflow = [
            "placed",
            "accepted",
            "pickup_scheduled",
            "picked_up",
            "processing",
            "ready",
            "delivered",
        ]

        current_index = workflow.index(obj.order_status)

        return [
            {
                "status": status,
                "completed": index <= current_index,
            }

            for index,status in enumerate(workflow)
        ]
