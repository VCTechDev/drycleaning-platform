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

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.shop.shop_name}"


class DeliveryTask(models.Model):

    TASK_TYPE = (
        ("pickup", "PICKUP"),
        ("delivery", "DELIVERY"),
    )

    STATUS = (
        ("unassigned", "UNASSIGNED"),
        ("assigned", "ASSIGNED"),
        ("in_progress", "IN_PROGRESS"),
        ("completed", "COMPLETED"),
        ("failed", "FAILED"),
    )

    order = models.ForeignKey(
        Order,
        on_delete=models.PROTECT,
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
         if( self.delivery_agent and self.delivery_agent.shop != self.order.shop):
            raise ValidationError("Delivery Agent must belong to the same shop as the order.")
         
    def save(self,*args,**kwargs):

        self.full_clean()
        super().save(*args,**kwargs)

    def __str__(self):
        return f"{self.order.order_number} - {self.task_type} "
