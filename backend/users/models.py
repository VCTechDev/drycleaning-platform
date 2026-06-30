from django.db import models
from django.contrib.auth.models import AbstractUser

# Create your models here.


class User(AbstractUser):

    ROLE_CHOICES = (
        ("customer", "Customer"),
        ("shop_admin", "Shop Admin"),
        ("delivery_agent", "Delivery Agent"),
        ("platform_admin", "Platform Admin"),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES)

    phone_number = models.CharField(max_length=15, blank=True, null=True)

    def __str__(self):
        return self.username