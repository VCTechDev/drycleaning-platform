from django.db import models
from django.db import connection
from users.models import User
from shops.models import Shop
from orders.models import Order

from django.core.exceptions import ValidationError
from users.phone import normalize_phone_number

# Create your models here.


class DeliveryAgent(models.Model):

    PUBLIC_AGENT_ID_SEQUENCE = "logistics_delivery_agent_agent_id_seq"

    agent_id = models.CharField(
        max_length=20,
        unique=True,
        editable=False,
    )

    user = models.OneToOneField(
        User, on_delete=models.PROTECT, related_name="delivery_agent"
    )
    shop = models.ForeignKey(
        Shop, on_delete=models.PROTECT, related_name="delivery_agents"
    )

    shift_starts_at = models.TimeField()
    shift_ends_at = models.TimeField()
    is_active = models.BooleanField(default=True)
    
    is_online=models.BooleanField(default=False)

    phone_verified = models.BooleanField(default=False)
    email_verified = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.user_id:
            user = getattr(self, "user", None)
            if user is None:
                user = User.objects.get(pk=self.user_id)
            if user and user.role != "delivery_agent":
                raise ValidationError("User linked to DeliveryAgent must have role 'delivery_agent'.")
            if user and not user.phone_number:
                raise ValidationError({"user": "Delivery agents must have a phone number."})
            if user and not user.email:
                raise ValidationError({"user": "Delivery agents must have an email address."})
            if user and user.phone_number:
                normalize_phone_number(user.phone_number)
        if not self.is_active and self.is_online:
            raise ValidationError("An inactive delivery agent cannot be set online.")
        if self.shift_starts_at and self.shift_ends_at and self.shift_starts_at == self.shift_ends_at:
            raise ValidationError("Shift start time and end time cannot be identical.")

    def save(self, *args, **kwargs):
        if self.pk:
            current = (
                type(self).objects.filter(pk=self.pk)
                .values("agent_id")
                .first()
            )
            if current and current["agent_id"] != self.agent_id:
                raise ValidationError({"agent_id": "Agent ID cannot be changed."})

        if not self.agent_id:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT nextval(%s::regclass)",
                    [self.PUBLIC_AGENT_ID_SEQUENCE],
                )
                sequence_value = cursor.fetchone()[0]
            self.agent_id = f"VC-AGT-{sequence_value:05d}"

        user = getattr(self, "user", None)
        if self.user_id and user is None:
            user = User.objects.get(pk=self.user_id)
        if user and user.role == "delivery_agent":
            normalized_phone = normalize_phone_number(user.phone_number)
            if user.phone_number != normalized_phone:
                user.phone_number = normalized_phone
                user.save(update_fields=["phone_number"])

        if not self.is_active:
            self.is_online = False
            update_fields = kwargs.get("update_fields")
            if update_fields is not None:
                kwargs["update_fields"] = set(update_fields) | {"is_online"}
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} - {self.shop.shop_name}"



class DeliveryTask(models.Model):

    TASK_TYPE_PICKUP = "pickup"
    TASK_TYPE_DELIVERY = "delivery"

    STATUS_UNASSIGNED = "unassigned"
    STATUS_ASSIGNED = "assigned"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_CANCELLED = "cancelled"

    TASK_TYPE = (
        (TASK_TYPE_PICKUP, "PICKUP"),
        (TASK_TYPE_DELIVERY, "DELIVERY"),
    )

    STATUS = (
        (STATUS_UNASSIGNED, "UNASSIGNED"),
        (STATUS_ASSIGNED, "ASSIGNED"),
        (STATUS_IN_PROGRESS, "IN_PROGRESS"),
        (STATUS_COMPLETED, "COMPLETED"),
        (STATUS_FAILED, "FAILED"),
        (STATUS_CANCELLED, "CANCELLED"),
    )

    TERMINAL_STATUSES = {
        STATUS_COMPLETED,
        STATUS_CANCELLED,
    }

    order = models.ForeignKey(
        Order,
        on_delete=models.PROTECT,
        related_name="delivery_tasks",
    )
    delivery_agent = models.ForeignKey(
        DeliveryAgent,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="delivery_tasks",
    )

    task_type = models.CharField(max_length=20, choices=TASK_TYPE)
    status = models.CharField(max_length=50, choices=STATUS, default="unassigned")
    failure_reason = models.TextField(blank=True, default="")
    scheduled_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = (
            "order",
            "task_type",
        )

    def clean(self):
        if self.delivery_agent and self.delivery_agent.shop != self.order.shop:
            raise ValidationError("Delivery Agent must belong to the same shop as the order.")

        if self.pk:
            old = (
                DeliveryTask.objects.filter(pk=self.pk)
                .values("status", "delivery_agent_id")
                .first()
            )
            if old:
                old_status = old["status"]
                if old_status in self.TERMINAL_STATUSES and self.status != old_status:
                    raise ValidationError(
                        f"Cannot transition task from terminal status '{old_status}'."
                    )
                if (
                    old_status in self.TERMINAL_STATUSES
                    and self.delivery_agent_id != old["delivery_agent_id"]
                ):
                    raise ValidationError(
                        f"Cannot reassign task in terminal status '{old_status}'."
                    )
                if old_status == self.STATUS_IN_PROGRESS and self.status == self.STATUS_CANCELLED:
                    raise ValidationError(
                        "Cannot cancel a task that is already in progress."
                    )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.order.order_number} - {self.task_type}"


class DeliveryVerificationOTP(models.Model):
    task = models.ForeignKey(
        DeliveryTask,
        on_delete=models.CASCADE,
        related_name="verification_otps",
    )
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    consecutive_failed_attempts = models.PositiveSmallIntegerField(default=0)
    cooldown_until = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    invalidated_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["task", "created_at"]),
            models.Index(fields=["expires_at", "verified_at", "invalidated_at"]),
        ]

    def __str__(self):
        return f"DeliveryOTP(task_id={self.task_id}, created={self.created_at})"


class DeliveryOTPAuditLog(models.Model):
    ACTION_GENERATED = "generated"
    ACTION_RESENT = "resent"
    ACTION_VERIFIED = "verified"
    ACTION_FAILED_ATTEMPT = "failed_attempt"
    ACTION_COOLDOWN_TRIGGERED = "cooldown_triggered"
    ACTION_INVALIDATED = "invalidated"
    ACTION_TASK_FAILED = "task_failed"

    ACTION_CHOICES = (
        (ACTION_GENERATED, "GENERATED"),
        (ACTION_RESENT, "RESENT"),
        (ACTION_VERIFIED, "VERIFIED"),
        (ACTION_FAILED_ATTEMPT, "FAILED_ATTEMPT"),
        (ACTION_COOLDOWN_TRIGGERED, "COOLDOWN_TRIGGERED"),
        (ACTION_INVALIDATED, "INVALIDATED"),
        (ACTION_TASK_FAILED, "TASK_FAILED"),
    )

    task = models.ForeignKey(
        DeliveryTask,
        on_delete=models.CASCADE,
        related_name="otp_audit_logs",
    )
    delivery_agent = models.ForeignKey(
        DeliveryAgent,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="otp_audit_logs",
    )
    action = models.CharField(max_length=40, choices=ACTION_CHOICES)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True, default="")
    details = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["task", "created_at"]),
            models.Index(fields=["action", "created_at"]),
        ]

    def __str__(self):
        return f"DeliveryOTPAudit(task_id={self.task_id}, action={self.action}, created={self.created_at})"
