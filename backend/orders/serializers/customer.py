from rest_framework import serializers

from orders.models import (
    Order,
    OrderItem,
    OrderStatusHistory,
)


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
            OrderItem.objects.create(
                order=order,
                **item,
            )

        return order


class CustomerOrderListItemSerializer(serializers.ModelSerializer):

    garment = serializers.CharField(
        source="garment_name_snapshot",
        read_only=True,
    )

    service = serializers.CharField(
        source="service_name_snapshot",
        read_only=True,
    )

    garment_image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = (
            "garment",
            "service",
            "quantity",
            "garment_image",
        )

    def get_garment_image(self, obj):

        image = obj.shop_service.garment_type.image

        if not image:
            return None

        request = self.context.get("request")

        if request:
            return request.build_absolute_uri(image.url)

        return image.url


class CustomerOrderListSerializer(serializers.ModelSerializer):

    shop = serializers.CharField(
        source="shop.shop_name",
        read_only=True,
    )

    shop_city = serializers.CharField(
        source="shop.city",
        read_only=True,
    )

    shop_district = serializers.CharField(
        source="shop.district",
        read_only=True,
    )

    items = CustomerOrderListItemSerializer(
        source="order_items",
        many=True,
        read_only=True,
    )

    services_count = serializers.SerializerMethodField()

    items_count = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "shop",
            "shop_city",
            "shop_district",
            "items",
            "services_count",
            "items_count",
            "total_amount",
            "order_status",
            "created_at",
        )

    def get_services_count(self, obj):

        return len(
            {
                item.service_name_snapshot
                for item in obj.order_items.all()
                if item.service_name_snapshot
            }
        )

    def get_items_count(self, obj):

        return sum(
            item.quantity
            for item in obj.order_items.all()
            if item.item_status == "active"
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

    garment_image = serializers.SerializerMethodField()

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
            "garment_image",
            "unit_price",
            "line_total",
        )

    def get_garment_image(self, obj):

        image = obj.shop_service.garment_type.image

        if not image:
            return None

        request = self.context.get("request")

        if request:
            return request.build_absolute_uri(image.url)

        return image.url


class CustomerOrderDetailSerializer(serializers.ModelSerializer):

    shop = serializers.CharField(
        source="shop.shop_name",
        read_only=True,
    )

    shop_city = serializers.CharField(
        source="shop.city",
        read_only=True,
    )

    shop_district = serializers.CharField(
        source="shop.district",
        read_only=True,
    )

    shop_state = serializers.CharField(
        source="shop.state",
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
            "shop_city",
            "shop_district",
            "shop_state",
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


class CustomerOrderTrackingHistorySerializer(serializers.ModelSerializer):

    class Meta:
        model = OrderStatusHistory
        fields = (
            "status",
            "created_at",
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

        history = {item.status: item for item in obj.status_history.all()}

        if obj.order_status == "cancelled":

            cancelled_history = history.get("cancelled")

            return [
                {
                    "status": "cancelled",
                    "completed": True,
                    "current": True,
                    "created_at": (
                        cancelled_history.created_at if cancelled_history else None
                    ),
                }
            ]

        current_index = workflow.index(obj.order_status)

        return [
            {
                "status": status,
                "completed": index <= current_index,
                "current": index == current_index,
                "created_at": (
                    history[status].created_at if status in history else None
                ),
            }
            for index, status in enumerate(workflow)
        ]
