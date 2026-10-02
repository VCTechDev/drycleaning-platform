from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower, Trim
from django.utils import timezone
import uuid
from users.models import User

# Create your models here.

class Shop(models.Model):

    DISTRICT_CHOICES = (
        ('Thiruvananthapuram', 'Thiruvananthapuram'),
        ('Kollam', 'Kollam'),
        ('Pathanamthitta', 'Pathanamthitta'),
        ('Alappuzha', 'Alappuzha'),
        ('Kottayam', 'Kottayam'),
        ('Idukki', 'Idukki'),
        ('Ernakulam', 'Ernakulam'),
        ('Thrissur', 'Thrissur'),
        ('Palakkad', 'Palakkad'),
        ('Malappuram', 'Malappuram'),
        ('Kozhikode', 'Kozhikode'),
        ('Wayanad', 'Wayanad'),
        ('Kannur', 'Kannur'),
        ('Kasaragod', 'Kasaragod'),
    )

    STATE_CHOICES=(
        ('Kerala','Kerala'),
    )

    shop_admin = models.OneToOneField(User,null=True,blank=True,on_delete=models.SET_NULL,related_name='shop')
    shop_name= models.CharField(max_length=50)
    description = models.TextField(blank=True)
    image=models.ImageField(upload_to='shops/',blank=True ,null=True)
    contact_number=models.CharField(max_length=15)

    address_line=models.CharField(max_length=255)
    city=models.CharField(max_length=50)
    district=models.CharField(max_length=30,choices=DISTRICT_CHOICES)
    state=models.CharField(max_length=20,choices=STATE_CHOICES)
    pincode=models.CharField(max_length=10)

    opening_time=models.TimeField()
    closing_time=models.TimeField()

    is_approved=models.BooleanField(default=False)
    is_open=models.BooleanField(default=False)

    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.shop_name


class ShopApplication(models.Model):

    STATUS_DRAFT = "draft"
    STATUS_SUBMITTED = "submitted"
    STATUS_UNDER_REVIEW = "under_review"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"

    STATUS_CHOICES = (
        (STATUS_DRAFT, "Draft"),
        (STATUS_SUBMITTED, "Submitted"),
        (STATUS_UNDER_REVIEW, "Under review"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    )

    phone_validator = RegexValidator(
        regex=r"^\+?[0-9 ()-]{7,15}$",
        message="Enter a valid phone number.",
    )
    pincode_validator = RegexValidator(
        regex=r"^[0-9]{3,10}$",
        message="Enter a valid pincode.",
    )

    public_id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )
    access_token_hash = models.CharField(max_length=128)

    owner_name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(null=True, blank=True)
    phone_number = models.CharField(
        max_length=15,
        blank=True,
        validators=[phone_validator],
    )
    shop_name = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    image = models.ImageField(
        upload_to="shop_applications/",
        blank=True,
        null=True,
    )
    address_line = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=50, blank=True)
    district = models.CharField(
        max_length=30,
        choices=Shop.DISTRICT_CHOICES,
        blank=True,
    )
    state = models.CharField(
        max_length=20,
        choices=Shop.STATE_CHOICES,
        blank=True,
    )
    pincode = models.CharField(
        max_length=10,
        blank=True,
        validators=[pincode_validator],
    )
    opening_time = models.TimeField(null=True, blank=True)
    closing_time = models.TimeField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
        db_index=True,
    )
    rejection_reason = models.TextField(blank=True, null=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_shop_applications",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # These are approval results, not applicant relationships. They make the
    # approval operation auditable and safely idempotent.
    approved_user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_shop_application",
    )
    created_shop = models.OneToOneField(
        Shop,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_application",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("status", "created_at")),
            models.Index(fields=("email", "created_at")),
        ]

    ALLOWED_TRANSITIONS = {
        STATUS_DRAFT: {STATUS_SUBMITTED},
        STATUS_SUBMITTED: {STATUS_UNDER_REVIEW},
        STATUS_UNDER_REVIEW: {STATUS_APPROVED, STATUS_REJECTED},
        STATUS_APPROVED: set(),
        STATUS_REJECTED: set(),
    }

    def set_access_token(self, raw_token):
        self.access_token_hash = make_password(raw_token)

    def check_access_token(self, raw_token):
        return check_password(raw_token, self.access_token_hash)

    def validate_for_submission(self):
        required_fields = (
            "owner_name",
            "email",
            "phone_number",
            "shop_name",
            "description",
            "address_line",
            "city",
            "district",
            "state",
            "pincode",
            "opening_time",
            "closing_time",
            "image",
        )
        errors = {}
        for field_name in required_fields:
            value = getattr(self, field_name)
            missing = value is None or (
                isinstance(value, str) and not value.strip()
            )
            if field_name == "image" and not value:
                missing = True
            if missing:
                errors[field_name] = "This field is required before submission."

        if errors:
            raise ValidationError(errors)

    def transition_to(self, target_status, *, reviewer=None, reason=None):
        allowed = self.ALLOWED_TRANSITIONS.get(self.status, set())
        if target_status not in allowed:
            raise ValueError(
                f"Cannot transition application from {self.status} to "
                f"{target_status}."
            )

        if target_status == self.STATUS_REJECTED:
            if not reason or not reason.strip():
                raise ValueError("A rejection reason is required.")
            self.rejection_reason = reason.strip()
        elif target_status == self.STATUS_APPROVED:
            self.rejection_reason = None

        self.status = target_status
        if target_status in {self.STATUS_APPROVED, self.STATUS_REJECTED}:
            self.reviewed_by = reviewer
            self.reviewed_at = timezone.now()

    def __str__(self):
        return f"{self.shop_name} ({self.status})"
    


class Service(models.Model):

    service_name=models.CharField(max_length=50,unique=True)
    description=models.TextField(max_length=255,blank=True)
    image=models.ImageField(upload_to='services/',blank=True,null=True)
    is_active=models.BooleanField(default=True)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower(Trim("service_name")),
                name="shops_service_name_ci_uniq",
            ),
        ]

    def __str__(self):
        return self.service_name


class ServiceRequest(models.Model):

    STATUS_PENDING = "pending"
    STATUS_UNDER_REVIEW = "under_review"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"

    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_UNDER_REVIEW, "Under review"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    )

    shop = models.ForeignKey(
        Shop,
        on_delete=models.PROTECT,
        related_name="service_requests",
    )
    requested_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="service_requests",
    )
    service_name = models.CharField(max_length=50)
    description = models.TextField(max_length=255, blank=True)
    image = models.ImageField(
        upload_to="service_requests/",
        blank=True,
        null=True,
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
    )
    rejection_reason = models.TextField(blank=True, null=True)
    approved_service = models.ForeignKey(
        Service,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_requests",
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_service_requests",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("shop", "status", "created_at")),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower(Trim("service_name")),
                "shop",
                condition=Q(
                    status__in=("pending", "under_review"),
                ),
                name="shops_sr_shop_active_name_uniq",
            ),
        ]

    ALLOWED_TRANSITIONS = {
        STATUS_PENDING: {STATUS_UNDER_REVIEW},
        STATUS_UNDER_REVIEW: {STATUS_APPROVED, STATUS_REJECTED},
        STATUS_APPROVED: set(),
        STATUS_REJECTED: set(),
    }

    def clean(self):
        if self.shop_id and not self.shop.is_approved:
            raise ValidationError({"shop": "Service requests require an approved shop."})
        if self.requested_by_id:
            if self.requested_by.role != "shop_admin":
                raise ValidationError(
                    {"requested_by": "Only a shop admin can request a service."}
                )
            if self.shop_id and self.shop.shop_admin_id != self.requested_by_id:
                raise ValidationError(
                    {"requested_by": "The requester must administer this shop."}
                )

    def transition_to(self, target_status, *, reviewer=None, reason=None):
        allowed = self.ALLOWED_TRANSITIONS.get(self.status, set())
        if target_status not in allowed:
            raise ValueError(
                f"Cannot transition service request from {self.status} to "
                f"{target_status}."
            )

        if target_status == self.STATUS_REJECTED:
            if not reason or not reason.strip():
                raise ValueError("A rejection reason is required.")
            self.rejection_reason = reason.strip()
        elif target_status == self.STATUS_APPROVED:
            self.rejection_reason = None

        self.status = target_status
        if target_status in {self.STATUS_APPROVED, self.STATUS_REJECTED}:
            self.reviewed_by = reviewer
            self.reviewed_at = timezone.now()

    def __str__(self):
        return f"{self.shop.shop_name} - {self.service_name} ({self.status})"


class ShopApplicationNotification(models.Model):

    APPROVAL = "approval"
    REJECTION = "rejection"

    NOTIFICATION_TYPE_CHOICES = (
        (APPROVAL, "Approval"),
        (REJECTION, "Rejection"),
    )

    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"

    DELIVERY_STATUS_CHOICES = (
        (PENDING, "Pending"),
        (SENT, "Sent"),
        (FAILED, "Failed"),
    )

    application = models.ForeignKey(
        ShopApplication,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(
        max_length=20,
        choices=NOTIFICATION_TYPE_CHOICES,
    )
    recipient_email = models.EmailField()
    status = models.CharField(
        max_length=20,
        choices=DELIVERY_STATUS_CHOICES,
        default=PENDING,
        db_index=True,
    )
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.CharField(max_length=255, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("application", "notification_type"),
                name="shops_app_notification_type_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=("status", "created_at")),
        ]

    def __str__(self):
        return f"{self.application_id} - {self.notification_type} ({self.status})"
    
    
class GarmentType(models.Model):

    garment_name=models.CharField(max_length=50,unique=True)
    description=models.CharField(max_length=100,blank=True)
    image=models.ImageField(upload_to='garments/',null=True,blank=True)
    is_active=models.BooleanField(default=True)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.garment_name
    
    
class ShopService(models.Model):
    shop=models.ForeignKey(Shop,on_delete=models.PROTECT,related_name="shop_services")
    service=models.ForeignKey(Service,on_delete=models.PROTECT,related_name="shop_services")
    garment_type=models.ForeignKey(GarmentType,on_delete=models.PROTECT,related_name="shop_services")
    price=models.DecimalField(null=False,max_digits=10,decimal_places=2)
    estimated_days=models.PositiveSmallIntegerField(blank=False)
    is_active=models.BooleanField(default=True)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)

    class Meta:
        unique_together=('shop','garment_type','service')
        ordering = ['shop']
        

    def __str__(self):
        return f"{self.shop.shop_name} - {self.service.service_name} - {self.garment_type.garment_name}"
