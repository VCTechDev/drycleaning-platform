from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models

# Create your models here.


class User(AbstractUser):

    ROLE_CHOICES = (
        ("customer", "Customer"),
        ("shop_admin", "Shop Admin"),
        ("delivery_agent", "Delivery Agent"),
        ("platform_admin", "Platform Admin"),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES)

    email = models.EmailField(
        unique=True,
        blank=True,
        null=True,
    )

    phone_number = models.CharField(max_length=16, blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("phone_number",),
                condition=(
                    models.Q(role="delivery_agent")
                    & models.Q(phone_number__isnull=False)
                    & ~models.Q(phone_number="")
                ),
                name="users_delivery_agent_phone_unique",
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(role="delivery_agent")
                    | (
                        models.Q(phone_number__isnull=False)
                        & ~models.Q(phone_number="")
                    )
                ),
                name="users_delivery_agent_phone_required",
            ),
        ]

    def clean(self):
        super().clean()
        if self.email:
            self.email = self.email.strip().lower()
        if self.role == "delivery_agent":
            if not self.email or not self.email.strip():
                raise ValidationError({"email": "Delivery agents must have an email address."})

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.strip().lower()
        previous = None
        update_fields = kwargs.get("update_fields")
        if self.pk:
            previous = (
                type(self).objects.filter(pk=self.pk)
                .values("phone_number", "email")
                .first()
            )

        super().save(*args, **kwargs)

        if previous and self.role == "delivery_agent":
            changed_phone = (
                previous["phone_number"] != self.phone_number
                and (update_fields is None or "phone_number" in update_fields)
            )
            changed_email = (
                previous["email"] != self.email
                and (update_fields is None or "email" in update_fields)
            )
            verification_updates = {}
            if changed_phone:
                verification_updates["phone_verified"] = False
            if changed_email:
                verification_updates["email_verified"] = False

            if verification_updates:
                from logistics.models import DeliveryAgent

                DeliveryAgent.objects.filter(user_id=self.pk).update(
                    **verification_updates
                )

    def __str__(self):
        return self.username
