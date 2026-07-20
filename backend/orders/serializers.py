from rest_framework import serializers
from .models import Order, OrderItem


class OrderSerializer(serializers.ModelSerializer):

    class Meta:
        model = Order
        fields = "__all__"


class OrderItemCreateSerializer(serializers.ModelSerializer):

    class Meta:
        model = OrderItem
        fields = "shop_service", "quantity"


class OrderCreateSerializer(serializers.ModelSerializer):
    items = OrderItemCreateSerializer(many=True)

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

    def create(self, validate_data):
        items = validate_data.pop("items")

        order = Order.objects.create(**validate_data)

        for item in items:
            OrderItem.objects.create(order=order, **item)

        return order
