from django.conf import settings
from django.db import models


class PasswordResetOTP(models.Model):
    PASSWORD_RESET = "password_reset"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_otps",
    )
    purpose = models.CharField(max_length=40, default=PASSWORD_RESET)
    code_hash = models.CharField(max_length=128)
    verification_token_hash = models.CharField(
        max_length=128,
        blank=True,
        null=True,
    )
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    verified_at = models.DateTimeField(blank=True, null=True)
    used_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("user", "purpose", "created_at")),
            models.Index(fields=("expires_at", "used_at")),
        ]

    def __str__(self):
        return f"{self.user_id}:{self.purpose}:{self.created_at}"
