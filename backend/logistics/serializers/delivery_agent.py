from rest_framework import serializers

from logistics.models import DeliveryAgent


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
