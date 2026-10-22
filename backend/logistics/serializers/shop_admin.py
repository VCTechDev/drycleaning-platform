
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from logistics.models import DeliveryAgent, DeliveryTask
from orders.models import Order
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


class ShopAdminDeliveryTaskOrderSerializer(serializers.ModelSerializer):
    """Order representation for shop admin delivery task serialization."""

    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.CharField(source="customer.phone_number", read_only=True)
    customer_email = serializers.CharField(source="customer.email", read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "order_status",
            "total_amount",
            "customer_name",
            "customer_phone",
            "customer_email",
            "pickup_address_line",
            "pickup_city",
            "pickup_district",
            "pickup_state",
            "pickup_pincode",
            "note",
        )
        read_only_fields = fields

    def get_customer_name(self, obj):
        user = obj.customer
        name = f"{user.first_name} {user.last_name}".strip()
        return name if name else user.username


class ShopAdminDeliveryTaskAgentSerializer(serializers.ModelSerializer):
    """Delivery agent representation for shop admin delivery task serialization."""

    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    phone_number = serializers.CharField(source="user.phone_number", read_only=True)

    class Meta:
        model = DeliveryAgent
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "phone_number",
            "is_active",
            "is_online",
            "shift_starts_at",
            "shift_ends_at",
        )
        read_only_fields = fields


class ShopAdminDeliveryTaskSerializer(serializers.ModelSerializer):
    """Detailed read representation of DeliveryTask for Shop Admin."""

    order = ShopAdminDeliveryTaskOrderSerializer(read_only=True)
    delivery_agent = ShopAdminDeliveryTaskAgentSerializer(read_only=True)
    delivery_agent_id = serializers.IntegerField(
        source="delivery_agent.id",
        read_only=True,
        allow_null=True,
    )
    order_number = serializers.CharField(source="order.order_number", read_only=True)

    class Meta:
        model = DeliveryTask
        fields = (
            "id",
            "order",
            "order_number",
            "task_type",
            "status",
            "delivery_agent",
            "delivery_agent_id",
            "scheduled_at",
            "completed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class ShopAdminDeliveryTaskAssignSerializer(serializers.Serializer):
    """Serializer for assigning or reassigning a delivery agent to a delivery task."""

    delivery_agent_id = serializers.IntegerField(required=True)
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True)

    ALLOWED_FIELDS = {"delivery_agent_id", "scheduled_at"}

    def validate(self, attrs):
        if hasattr(self, "initial_data") and isinstance(self.initial_data, dict):
            unexpected = sorted(list(set(self.initial_data.keys()) - self.ALLOWED_FIELDS))
            if unexpected:
                raise serializers.ValidationError({
                    field: f"Field '{field}' is not permitted in assignment request."
                    for field in unexpected
                })

        task = self.context["task"]
        shop = self.context["shop"]

        # Reject assignment if task is terminal
        if task.status in DeliveryTask.TERMINAL_STATUSES:
            raise serializers.ValidationError({
                "status": f"Cannot assign or reassign a task in terminal status '{task.status}'."
            })

        # Reject reassignment while task is in_progress
        if task.status == DeliveryTask.STATUS_IN_PROGRESS:
            raise serializers.ValidationError({
                "status": "Cannot reassign a task that is currently in progress."
            })

        # Reject assignment if order is in terminal status
        if task.order.order_status in Order.TERMINAL_STATUSES:
            raise serializers.ValidationError({
                "order": f"Cannot assign task for an order in terminal status '{task.order.order_status}'."
            })

        agent_id = attrs["delivery_agent_id"]
        try:
            agent = (
                DeliveryAgent.objects.select_related("user", "shop")
                .get(id=agent_id)
            )
        except DeliveryAgent.DoesNotExist:
            raise serializers.ValidationError({
                "delivery_agent_id": "Delivery agent does not exist."
            })

        if agent.shop_id != shop.id:
            raise serializers.ValidationError({
                "delivery_agent_id": "Delivery agent does not belong to your shop."
            })

        if not agent.is_active:
            raise serializers.ValidationError({
                "delivery_agent_id": "Cannot assign an inactive delivery agent."
            })

        if not agent.user.is_active:
            raise serializers.ValidationError({
                "delivery_agent_id": "Delivery agent user account is inactive."
            })

        scheduled_at = attrs.get("scheduled_at")
        if scheduled_at is not None and scheduled_at < timezone.now():
            raise serializers.ValidationError({
                "scheduled_at": "Scheduled time cannot be in the past."
            })

        attrs["delivery_agent"] = agent
        return attrs

    def save(self):
        task = self.context["task"]
        agent = self.validated_data["delivery_agent"]
        task.delivery_agent = agent
        task.status = DeliveryTask.STATUS_ASSIGNED

        if "scheduled_at" in self.validated_data and self.validated_data["scheduled_at"] is not None:
            task.scheduled_at = self.validated_data["scheduled_at"]

        task.save()
        return task


class ShopAdminDeliveryTaskUnassignSerializer(serializers.Serializer):
    """Serializer for unassigning a delivery agent from a delivery task."""

    def validate(self, attrs):
        task = self.context["task"]

        if hasattr(self, "initial_data") and isinstance(self.initial_data, dict):
            if len(self.initial_data) > 0:
                unexpected = sorted(list(self.initial_data.keys()))
                raise serializers.ValidationError({
                    field: f"Field '{field}' is not permitted in unassignment request."
                    for field in unexpected
                })

        if task.status in DeliveryTask.TERMINAL_STATUSES:
            raise serializers.ValidationError({
                "status": f"Cannot unassign a task in terminal status '{task.status}'."
            })

        if task.status == DeliveryTask.STATUS_IN_PROGRESS:
            raise serializers.ValidationError({
                "status": "Cannot unassign a task that is currently in progress."
            })

        if task.order.order_status in Order.TERMINAL_STATUSES:
            raise serializers.ValidationError({
                "order": f"Cannot unassign task for an order in terminal status '{task.order.order_status}'."
            })

        return attrs

    def save(self):
        task = self.context["task"]
        task.delivery_agent = None
        task.status = DeliveryTask.STATUS_UNASSIGNED
        task.save()
        return task
