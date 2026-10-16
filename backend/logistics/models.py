from django.db import models
from users.models import User
from shops.models import Shop
from orders.models import Order

from django.core.exceptions import ValidationError

# Create your models here.


class DeliveryAgent(models.Model):

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

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
        STATUS_FAILED,
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
