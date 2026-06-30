from decimal import Decimal
from django.db import models
from django.db.models import Sum
from django.core.validators import MinValueValidator


from users.models import User
from shops.models import Shop, ShopService

# Create your models here.


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

    STATE_CHOICES = (("Kerala", "Kerala"),)

    ORDER_STATUS = (
        ("placed", "PLACED"),
        ("accepted", "ACCEPTED"),
        ("pickup_scheduled", "PICKUP_SCHEDULED"),
        ("picked_up", "PICKED_UP"),
        ("processing", "PROCESSING"),
        ("ready", "READY"),
        ("delivered", "DELIVERED"),
        ("cancelled", "CANCELLED"),
    )

    PAYMENT_STATUS = (
        ("pending", "PENDING"),
        ("processing", "PROCESSING"),
        ("success", "SUCCESS"),
        ("failed", "FAILED"),
        ("cancelled", "CANCELLED"),
    )

    customer = models.ForeignKey(User, on_delete=models.PROTECT, related_name="orders")
    shop = models.ForeignKey(Shop, on_delete=models.PROTECT, related_name="orders")
    order_number = models.CharField(max_length=50, unique=True,blank=True)
    note = models.TextField(max_length=200, blank=True)

    pickup_address_line = models.CharField(max_length=244)
    pickup_city = models.CharField(max_length=100)
    pickup_district = models.CharField(max_length=50, choices=DISTRICT_CHOICES)
    pickup_state = models.CharField(max_length=50, choices=STATE_CHOICES)
    pickup_pincode = models.CharField(max_length=40)

    total_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )

    order_status = models.CharField(
        max_length=50, choices=ORDER_STATUS, default="placed"
    )
    payment_status = models.CharField(
        max_length=50, choices=PAYMENT_STATUS, default="pending"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self,*args,**kwargs):

        old_status=None
        if self.pk is not None:
            old_status=Order.objects.get(pk=self.pk).order_status
        
        is_new=self.pk is  None
        super().save(*args,**kwargs)
        
        from logistics.models import DeliveryTask
        if old_status!="accepted" and self.order_status == "accepted":
            DeliveryTask.objects.create(order=self,task_type="pickup")

        if is_new:
            self.order_number=f"DRY{self.pk:06d}"
            super().save(update_fields=["order_number"])

    def __str__(self):
        return self.order_number


class OrderItem(models.Model):
    ITEM_STATUS = (
        ("active", "ACTIVE"),
        ("cancelled", "CANCELLED"),
        ("rejected", "REJECTED"),
    )

    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="order_items"
    )
    shop_service = models.ForeignKey(
        ShopService, on_delete=models.PROTECT, related_name="order_items"
    )

    quantity = models.PositiveSmallIntegerField(default=1,validators=[MinValueValidator(1)])

    garment_name_snapshot = models.CharField(max_length=50, blank=True)
    service_name_snapshot = models.CharField(max_length=50, blank=True)
    unit_price_snapshot = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )

    line_total = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )

    item_status = models.CharField(max_length=50, choices=ITEM_STATUS, default="active")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):

        is_new = self.pk is None
        if is_new:
            self.garment_name_snapshot = self.shop_service.garment_type.garment_name
            self.service_name_snapshot = self.shop_service.service.service_name
            self.unit_price_snapshot = self.shop_service.price

        self.line_total = self.quantity * self.unit_price_snapshot

        super().save(*args, **kwargs)

        self.order.total_amount = self.order.order_items.filter(
            item_status="active"
        ).aggregate(total=Sum("line_total"))["total"] or Decimal("0.00")
        self.order.save(update_fields=["total_amount"])

    def __str__(self):
        return f"{self.order.order_number} - {self.service_name_snapshot} - {self.garment_name_snapshot}"
