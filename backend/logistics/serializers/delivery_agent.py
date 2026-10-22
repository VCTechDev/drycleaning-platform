from rest_framework import serializers

from logistics.models import DeliveryAgent, DeliveryTask
from orders.models import Order
from shops.models import Shop


class DeliveryAgentAvailabilitySerializer(serializers.Serializer):
    """Serializer for Delivery Agent availability toggling."""

    is_online = serializers.BooleanField(required=True)

    FORBIDDEN_FIELDS = {
        "is_active",
        "shift_starts_at",
        "shift_ends_at",
        "shop",
        "shop_id",
        "role",
        "user",
        "user_id",
        "username",
        "email",
    }

    def validate(self, attrs):
        if hasattr(self, "initial_data") and isinstance(self.initial_data, dict):
            forbidden = sorted(list(self.FORBIDDEN_FIELDS.intersection(self.initial_data.keys())))
            if forbidden:
                raise serializers.ValidationError({
                    field: f"Field '{field}' cannot be modified by delivery agents."
                    for field in forbidden
                })

        agent = self.context["agent"]
        if not agent.is_active and attrs.get("is_online"):
            raise serializers.ValidationError({
                "is_online": "Deactivated delivery agents cannot be set online."
            })
        return attrs

    def save(self):
        agent = self.context["agent"]
        agent.is_online = self.validated_data["is_online"]
        agent.save(update_fields=["is_online", "updated_at"])
        return agent


class DeliveryAgentTaskShopSerializer(serializers.ModelSerializer):
    """Sanitized shop contact and address representation for delivery agents."""

    class Meta:
        model = Shop
        fields = (
            "id",
            "shop_name",
            "contact_number",
            "address_line",
            "city",
            "district",
            "state",
            "pincode",
        )
        read_only_fields = fields


class DeliveryAgentTaskOrderSerializer(serializers.ModelSerializer):
    """Sanitized operational order representation for delivery agents."""

    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.CharField(source="customer.phone_number", read_only=True)
    shop = DeliveryAgentTaskShopSerializer(read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "order_status",
            "customer_name",
            "customer_phone",
            "pickup_address_line",
            "pickup_city",
            "pickup_district",
            "pickup_state",
            "pickup_pincode",
            "note",
            "shop",
        )
        read_only_fields = fields

    def get_customer_name(self, obj):
        user = obj.customer
        name = f"{user.first_name} {user.last_name}".strip()
        return name if name else user.username


class DeliveryAgentTaskSerializer(serializers.ModelSerializer):
    """Dedicated read serializer for delivery agent tasks."""

    order = DeliveryAgentTaskOrderSerializer(read_only=True)
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    shop = DeliveryAgentTaskShopSerializer(source="order.shop", read_only=True)

    class Meta:
        model = DeliveryTask
        fields = (
            "id",
            "order",
            "order_number",
            "shop",
            "task_type",
            "status",
            "scheduled_at",
            "completed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields
