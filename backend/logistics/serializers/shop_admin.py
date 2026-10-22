from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from logistics.models import DeliveryAgent, DeliveryTask
from users.models import User


class DeliveryAgentUserSerializer(serializers.ModelSerializer):
    """Read-only user representation for delivery agent profiles."""

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone_number",
            "role",
            "date_joined",
        )
        read_only_fields = fields


class DeliveryAgentSerializer(serializers.ModelSerializer):
    """Detailed read serializer for DeliveryAgent instances."""

    user = DeliveryAgentUserSerializer(read_only=True)
    shop_name = serializers.CharField(source="shop.shop_name", read_only=True)
    active_tasks_count = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryAgent
        fields = (
            "id",
            "user",
            "shop",
            "shop_name",
            "shift_starts_at",
            "shift_ends_at",
            "is_active",
            "is_online",
            "active_tasks_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "user",
            "shop",
            "shop_name",
            "is_online",
            "active_tasks_count",
            "created_at",
            "updated_at",
        )

    def get_active_tasks_count(self, obj):
        if hasattr(obj, "_prefetched_objects_cache") and "delivery_tasks" in obj._prefetched_objects_cache:
            active_statuses = {DeliveryTask.STATUS_ASSIGNED, DeliveryTask.STATUS_IN_PROGRESS}
            return sum(1 for task in obj.delivery_tasks.all() if task.status in active_statuses)
        return obj.delivery_tasks.filter(
            status__in=[
                DeliveryTask.STATUS_ASSIGNED,
                DeliveryTask.STATUS_IN_PROGRESS,
            ]
        ).count()


class ShopAdminDeliveryAgentRegisterSerializer(serializers.Serializer):
    """Serializer for registering a new delivery agent by Shop Admin."""

    username = serializers.CharField(
        max_length=150,
        required=True,
        trim_whitespace=True,
    )
    email = serializers.EmailField(
        required=True,
        trim_whitespace=True,
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=False,
        style={"input_type": "password"},
    )
    first_name = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
        default="",
        trim_whitespace=True,
    )
    last_name = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
        default="",
        trim_whitespace=True,
    )
    phone_number = serializers.CharField(
        max_length=15,
        required=False,
        allow_blank=True,
        default="",
        trim_whitespace=True,
    )
    shift_starts_at = serializers.TimeField(required=True)
    shift_ends_at = serializers.TimeField(required=True)
    is_active = serializers.BooleanField(required=False, default=True)

    def validate_username(self, value):
        username = value.strip()
        if not username:
            raise serializers.ValidationError("Username cannot be blank.")
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return username

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return email

    def validate(self, attrs):
        password = attrs.get("password")
        password_confirm = attrs.get("password_confirm")

        if password_confirm is not None and password != password_confirm:
            raise serializers.ValidationError({
                "password_confirm": "Passwords do not match."
            })

        try:
            validate_password(password)
        except DjangoValidationError as error:
            raise serializers.ValidationError({
                "password": list(error.messages),
            }) from error

        shift_starts = attrs.get("shift_starts_at")
        shift_ends = attrs.get("shift_ends_at")
        if shift_starts and shift_ends and shift_starts == shift_ends:
            raise serializers.ValidationError({
                "shift_ends_at": "Shift start time and end time cannot be identical."
            })

        return attrs

    def create(self, validated_data):
        shop = self.context["shop"]

        validated_data.pop("password_confirm", None)
        username = validated_data.pop("username")
        email = validated_data.pop("email")
        password = validated_data.pop("password")
        first_name = validated_data.pop("first_name", "")
        last_name = validated_data.pop("last_name", "")
        phone_number = validated_data.pop("phone_number", "")

        shift_starts_at = validated_data["shift_starts_at"]
        shift_ends_at = validated_data["shift_ends_at"]
        is_active = validated_data.get("is_active", True)

        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                phone_number=phone_number,
                role="delivery_agent",
            )
            agent = DeliveryAgent.objects.create(
                user=user,
                shop=shop,
                shift_starts_at=shift_starts_at,
                shift_ends_at=shift_ends_at,
                is_active=is_active,
                is_online=False,
            )
        return agent


class ShopAdminDeliveryAgentUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating permitted agent fields by Shop Admin."""

    first_name = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    last_name = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    phone_number = serializers.CharField(
        max_length=15,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )

    IMMUTABLE_FIELDS = {
        "shop",
        "shop_id",
        "is_online",
        "role",
        "user",
        "user_id",
        "username",
        "email",
    }

    class Meta:
        model = DeliveryAgent
        fields = (
            "shift_starts_at",
            "shift_ends_at",
            "is_active",
            "first_name",
            "last_name",
            "phone_number",
        )

    def validate(self, attrs):
        if hasattr(self, "initial_data") and isinstance(self.initial_data, dict):
            forbidden = sorted(list(self.IMMUTABLE_FIELDS.intersection(self.initial_data.keys())))
            if forbidden:
                raise serializers.ValidationError({
                    field: f"Field '{field}' is immutable and cannot be updated."
                    for field in forbidden
                })

        shift_starts = attrs.get("shift_starts_at", getattr(self.instance, "shift_starts_at", None))
        shift_ends = attrs.get("shift_ends_at", getattr(self.instance, "shift_ends_at", None))
        if shift_starts and shift_ends and shift_starts == shift_ends:
            raise serializers.ValidationError({
                "shift_ends_at": "Shift start time and end time cannot be identical."
            })
        return attrs

    def update(self, instance, validated_data):
        user = instance.user
        user_modified = False

        for field in ("first_name", "last_name", "phone_number"):
            if field in validated_data:
                setattr(user, field, validated_data.pop(field))
                user_modified = True

        with transaction.atomic():
            if user_modified:
                user.save()

            if "is_active" in validated_data:
                instance.is_active = validated_data["is_active"]
                if not instance.is_active:
                    instance.is_online = False

            if "shift_starts_at" in validated_data:
                instance.shift_starts_at = validated_data["shift_starts_at"]

            if "shift_ends_at" in validated_data:
                instance.shift_ends_at = validated_data["shift_ends_at"]

            instance.save()

        return instance
