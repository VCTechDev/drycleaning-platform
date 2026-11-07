from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models


_HMAC_SHA256_HEX_VALIDATOR = RegexValidator(
    regex=r"\A[0-9a-f]{64}\Z",
    message="Enter a lowercase hexadecimal HMAC-SHA256 digest.",
)


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


class DeliveryAgentLoginChallenge(models.Model):
    """Persistent state for the separate delivery-agent login OTP flow."""

    STATUS_PENDING = "pending"
    STATUS_SUCCEEDED = "succeeded"
    STATUS_FAILED = "failed"
    STATUS_NOT_AVAILABLE = "not_available"

    CHANNEL_STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_SUCCEEDED, "Succeeded"),
        (STATUS_FAILED, "Failed"),
        (STATUS_NOT_AVAILABLE, "Not available"),
    )

    delivery_agent = models.ForeignKey(
        "logistics.DeliveryAgent",
        on_delete=models.CASCADE,
        related_name="login_challenges",
    )
    challenge_id_digest = models.CharField(
        max_length=64,
        unique=True,
        editable=False,
    )
    otp_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    resend_available_at = models.DateTimeField()
    incorrect_attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(blank=True, null=True)
    invalidated_at = models.DateTimeField(blank=True, null=True)
    sms_status = models.CharField(
        max_length=20,
        choices=CHANNEL_STATUS_CHOICES,
        default=STATUS_PENDING,
    )
    email_status = models.CharField(
        max_length=20,
        choices=CHANNEL_STATUS_CHOICES,
        default=STATUS_NOT_AVAILABLE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("delivery_agent", "created_at")),
            models.Index(fields=("expires_at", "used_at", "invalidated_at")),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(incorrect_attempts__gte=0),
                name="accounts_login_attempts_non_negative",
            ),
            models.UniqueConstraint(
                fields=("delivery_agent",),
                condition=models.Q(
                    used_at__isnull=True,
                    invalidated_at__isnull=True,
                ),
                name="accounts_delivery_agent_login_active_unique",
            ),
        ]

    def __str__(self):
        return f"DeliveryAgentLoginChallenge(agent={self.delivery_agent_id}, created={self.created_at})"


class DeliveryAgentLoginRateLimitEvent(models.Model):
    identifier_key_digest = models.CharField(
        max_length=64,
        validators=[_HMAC_SHA256_HEX_VALIDATOR],
    )
    ip_key_digest = models.CharField(
        max_length=64,
        validators=[_HMAC_SHA256_HEX_VALIDATOR],
    )
    key_version = models.CharField(max_length=32)
    created_at = models.DateTimeField()

    class Meta:
        indexes = [
            models.Index(
                fields=("identifier_key_digest", "key_version", "created_at"),
                name="acct_rl_ident_time_idx",
            ),
            models.Index(
                fields=("ip_key_digest", "key_version", "created_at"),
                name="acct_rl_ip_time_idx",
            ),
            models.Index(
                fields=("created_at",),
                name="acct_rl_created_idx",
            ),
        ]
