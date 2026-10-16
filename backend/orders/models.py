from decimal import Decimal

from django.core.exceptions import PermissionDenied, ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Sum

from users.models import User
from shops.models import Shop, ShopService


class Order(models.Model):

    DISTRICT_CHOICES = (
        ("Thiruvananthapuram", "Thiruvananthapuram"),
        ("Kollam", "Kollam"),
        ("Pathanamthitta", "Pathanamthitta"),
        ("Alappuzha", "Alappuzha"),
        ("Kottayam", "Kottayam"),
        ("Idukki", "Idukki"),
        ("Ernakulam", "Ernakulam"),
        ("Thrissur", "Thrissur"),
        ("Palakkad", "Palakkad"),
        ("Malappuram", "Malappuram"),
        ("Kozhikode", "Kozhikode"),
        ("Wayanad", "Wayanad"),
        ("Kannur", "Kannur"),
        ("Kasaragod", "Kasaragod"),
    )

    STATE_CHOICES = (
        ("Kerala", "Kerala"),
    )

    STATUS_PLACED = "placed"
    STATUS_ACCEPTED = "accepted"
    STATUS_PICKUP_SCHEDULED = "pickup_scheduled"
    STATUS_PICKED_UP = "picked_up"
    STATUS_PROCESSING = "processing"
    STATUS_READY = "ready"
    STATUS_DELIVERED = "delivered"
    STATUS_CANCELLED = "cancelled"
    STATUS_REJECTED = "rejected"

    ORDER_STATUS = (
        (STATUS_PLACED, "PLACED"),
        (STATUS_ACCEPTED, "ACCEPTED"),
        (STATUS_PICKUP_SCHEDULED, "PICKUP_SCHEDULED"),
        (STATUS_PICKED_UP, "PICKED_UP"),
        (STATUS_PROCESSING, "PROCESSING"),
        (STATUS_READY, "READY"),
        (STATUS_DELIVERED, "DELIVERED"),
        (STATUS_CANCELLED, "CANCELLED"),
        (STATUS_REJECTED, "REJECTED"),
    )

    TERMINAL_STATUSES = {
        STATUS_DELIVERED,
        STATUS_CANCELLED,
        STATUS_REJECTED,
    }

    ALLOWED_TRANSITIONS = {
        STATUS_PLACED: {STATUS_ACCEPTED, STATUS_REJECTED, STATUS_CANCELLED},
        STATUS_ACCEPTED: {STATUS_PICKUP_SCHEDULED, STATUS_CANCELLED},
        STATUS_PICKUP_SCHEDULED: {STATUS_PICKED_UP, STATUS_CANCELLED},
        STATUS_PICKED_UP: {STATUS_PROCESSING},
        STATUS_PROCESSING: {STATUS_READY},
        STATUS_READY: {STATUS_DELIVERED},
        STATUS_DELIVERED: set(),
        STATUS_CANCELLED: set(),
        STATUS_REJECTED: set(),
    }

    PAYMENT_STATUS = (
        ("pending", "PENDING"),
        ("processing", "PROCESSING"),
        ("success", "SUCCESS"),
        ("failed", "FAILED"),
        ("cancelled", "CANCELLED"),
    )

    customer = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="orders",
    )

    shop = models.ForeignKey(
        Shop,
        on_delete=models.PROTECT,
        related_name="orders",
    )

    order_number = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
    )

    note = models.TextField(
        max_length=200,
        blank=True,
    )

    pickup_address_line = models.CharField(
        max_length=244,
    )

    pickup_city = models.CharField(
        max_length=100,
    )

    pickup_district = models.CharField(
        max_length=50,
        choices=DISTRICT_CHOICES,
    )

    pickup_state = models.CharField(
        max_length=50,
        choices=STATE_CHOICES,
    )

    pickup_pincode = models.CharField(
        max_length=40,
    )

    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    order_status = models.CharField(
        max_length=50,
        choices=ORDER_STATUS,
        default="placed",
    )

    rejection_reason = models.TextField(
        blank=True,
        null=True,
    )

    payment_status = models.CharField(
        max_length=50,
        choices=PAYMENT_STATUS,
        default="pending",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        indexes = [
            models.Index(
                fields=("order_status", "created_at"),
                name="orders_status_created_idx",
            ),
            models.Index(
                fields=("payment_status", "created_at"),
                name="orders_payment_created_idx",
            ),
            models.Index(
                fields=("created_at",),
                name="orders_created_at_idx",
            ),
        ]

    def transition_to(self, target_status, *, by_user=None, reason=None):
        if self.order_status in self.TERMINAL_STATUSES:
            raise ValidationError(
                f"Cannot transition order from terminal status '{self.order_status}'."
            )

        allowed = self.ALLOWED_TRANSITIONS.get(self.order_status, set())
        if target_status not in allowed:
            raise ValidationError(
                f"Cannot transition order from '{self.order_status}' to '{target_status}'."
            )

        if by_user is not None:
            if by_user.role == "shop_admin":
                if hasattr(by_user, "shop") and self.shop_id != by_user.shop.id:
                    raise PermissionDenied(
                        "You can only manage orders for your own shop."
                    )
                allowed_shop_admin_transitions = {
                    (self.STATUS_PLACED, self.STATUS_ACCEPTED),
                    (self.STATUS_PLACED, self.STATUS_REJECTED),
                    (self.STATUS_PICKED_UP, self.STATUS_PROCESSING),
                    (self.STATUS_PROCESSING, self.STATUS_READY),
                }
                if (self.order_status, target_status) not in allowed_shop_admin_transitions:
                    raise PermissionDenied(
                        f"Shop Admin is not permitted to transition order from '{self.order_status}' to '{target_status}'."
                    )
            elif by_user.role == "customer":
                if self.customer_id != by_user.id:
                    raise PermissionDenied(
                        "You can only cancel your own orders."
                    )
                if target_status != self.STATUS_CANCELLED:
                    raise PermissionDenied(
                        "Customers can only cancel orders."
                    )
                if self.order_status in {
                    self.STATUS_PICKED_UP,
                    self.STATUS_PROCESSING,
                    self.STATUS_READY,
                    self.STATUS_DELIVERED,
                }:
                    raise ValidationError(
                        "Order cannot be cancelled after physical pickup has occurred."
                    )

        if target_status == self.STATUS_REJECTED:
            if not reason or not str(reason).strip():
                raise ValidationError(
                    "A rejection reason is required when rejecting an order."
                )
            self.rejection_reason = str(reason).strip()

        self.order_status = target_status

    def create_pickup_task(self, old_status):

        from logistics.models import DeliveryTask

        if old_status != "accepted" and self.order_status == "accepted":

            task, created = DeliveryTask.objects.get_or_create(
                order=self,
                task_type="pickup",
            )

            if created:
                self.assign_delivery_agent(task)

    def create_delivery_task(self, old_status):

        from logistics.models import DeliveryTask

        if old_status != "ready" and self.order_status == "ready":

            task, created = DeliveryTask.objects.get_or_create(
                order=self,
                task_type="delivery",
            )

            if created:
                self.assign_delivery_agent(task)

    def assign_delivery_agent(self, task):
        if task.delivery_agent is not None:
            return

        delivery_agent = self.shop.delivery_agents.filter(
            is_active=True,
            is_online=True,
        ).first()

        if delivery_agent is not None:
            task.delivery_agent = delivery_agent
            task.status = "assigned"
            task.save(update_fields=["delivery_agent", "status", "updated_at"])

    def save(self, *args, **kwargs):

        old_status = None

        if self.pk is not None:
            old_status = Order.objects.get(
                pk=self.pk
            ).order_status

        is_new = self.pk is None

        super().save(*args, **kwargs)

        # Create initial history entry.
        if is_new:
            OrderStatusHistory.objects.create(
                order=self,
                status=self.order_status,
            )

        # Create history only when the status actually changes.
        elif old_status != self.order_status:
            OrderStatusHistory.objects.create(
                order=self,
                status=self.order_status,
            )

        self.create_pickup_task(old_status)
        self.create_delivery_task(old_status)

        if is_new:
            self.order_number = f"DRY{self.pk:06d}"

            super().save(
                update_fields=["order_number"]
            )

    def __str__(self):
        return self.order_number


class OrderStatusHistory(models.Model):

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="status_history",
    )

    status = models.CharField(
        max_length=50,
        choices=Order.ORDER_STATUS,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.order.order_number} - {self.status}"


class OrderItem(models.Model):

    ITEM_STATUS = (
        ("active", "ACTIVE"),
        ("cancelled", "CANCELLED"),
        ("rejected", "REJECTED"),
    )

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="order_items",
    )

    shop_service = models.ForeignKey(
        ShopService,
        on_delete=models.PROTECT,
        related_name="order_items",
    )

    quantity = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
    )

    garment_name_snapshot = models.CharField(
        max_length=50,
        blank=True,
    )

    service_name_snapshot = models.CharField(
        max_length=50,
        blank=True,
    )

    unit_price_snapshot = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )

    line_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    item_status = models.CharField(
        max_length=50,
        choices=ITEM_STATUS,
        default="active",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def save(self, *args, **kwargs):

        is_new = self.pk is None

        if is_new:
            self.garment_name_snapshot = (
                self.shop_service.garment_type.garment_name
            )

            self.service_name_snapshot = (
                self.shop_service.service.service_name
            )

            self.unit_price_snapshot = (
                self.shop_service.price
            )

        self.line_total = (
            self.quantity * self.unit_price_snapshot
        )

        super().save(*args, **kwargs)

        self.order.total_amount = (
            self.order.order_items
            .filter(item_status="active")
            .aggregate(total=Sum("line_total"))["total"]
            or Decimal("0.00")
        )

        self.order.save(
            update_fields=["total_amount"]
        )

    def __str__(self):
        return (
            f"{self.order.order_number} - "
            f"{self.service_name_snapshot} - "
            f"{self.garment_name_snapshot}"
        )
