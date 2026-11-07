import hashlib
import hmac
import logging
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import EmailMessage, get_connection, send_mail
from django.db import IntegrityError, connection, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.models import DeliveryAgentLoginChallenge, PasswordResetOTP
from accounts.rate_limit import (
    RateLimitDecision,
    check_and_record_delivery_agent_email_verify_rate_limit,
    check_and_record_delivery_agent_login_rate_limit,
)
from accounts.serializers import (
    ChangePasswordSerializer,
    CustomerRegistrationSerializer,
    DeliveryAgentEmailVerificationConfirmSerializer,
    DeliveryAgentEmailVerificationRequestSerializer,
    DeliveryAgentLoginRequestSerializer,
    DeliveryAgentLoginVerifySerializer,
    DeliveryAgentTokenRefreshSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    VerifyOTPSerializer,
)
from accounts.serializers.auth import find_user_by_identifier
from logistics.models import DeliveryAgent
from users.phone import normalize_phone_number


logger = logging.getLogger("accounts.auth")
User = get_user_model()

OTP_EXPIRY_MINUTES = 10
MAX_OTP_ATTEMPTS = 5


class IdentifierTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Issue the normal SimpleJWT pair for a username or email login."""

    def validate(self, attrs):
        identifier = attrs.get("username", "").strip()
        password = attrs.get("password", "")
        user = find_user_by_identifier(identifier)

        authenticated_user = None

        if user is not None:
            authenticated_user = authenticate(
                request=self.context.get("request"),
                username=user.username,
                password=password,
            )

        if authenticated_user is None or not authenticated_user.is_active:
            raise AuthenticationFailed(
                "No active account found with the given credentials."
            )

        if authenticated_user.role == "delivery_agent":
            raise AuthenticationFailed(
                "Delivery agents must authenticate using OTP."
            )

        self.user = authenticated_user
        refresh = self.get_token(self.user)
        refresh["role"] = self.user.role

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": self.user.pk,
                "username": self.user.username,
                "email": self.user.email,
                "role": self.user.role,
            },
            "role": self.user.role,
        }


class IdentifierTokenObtainPairView(TokenObtainPairView):
    serializer_class = IdentifierTokenObtainPairSerializer


class DeliveryAgentTokenRefreshView(TokenRefreshView):
    """Token refresh view verifying delivery-agent and user active status."""

    serializer_class = DeliveryAgentTokenRefreshSerializer


class CustomerRegistrationView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = CustomerRegistrationSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()

            return Response(
                {"message": "Customer registered successfully."},
                status=status.HTTP_201_CREATED,
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )


def _password_reset_message(otp):
    return (
        "Your VeeCleen password reset code is "
        f"{otp}. It expires in {OTP_EXPIRY_MINUTES} minutes.\n\n"
        "If you did not request this code, you can ignore this email."
    )


class ForgotPasswordView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = find_user_by_identifier(
            serializer.validated_data["identifier"]
        )

        if user is None or not user.is_active or not user.email:
            return Response({
                "message": "If an account matches the submitted identifier, a verification code has been sent."
            })

        now = timezone.now()
        otp = f"{secrets.randbelow(1_000_000):06d}"

        PasswordResetOTP.objects.filter(
            user=user,
            purpose=PasswordResetOTP.PASSWORD_RESET,
            used_at__isnull=True,
        ).update(used_at=now)

        reset_record = PasswordResetOTP.objects.create(
            user=user,
            purpose=PasswordResetOTP.PASSWORD_RESET,
            code_hash=make_password(otp),
            expires_at=now + timedelta(minutes=OTP_EXPIRY_MINUTES),
        )

        try:
            sent_count = send_mail(
                subject="VeeCleen password reset code",
                message=_password_reset_message(otp),
                from_email=None,
                recipient_list=[user.email],
                fail_silently=False,
            )
            if sent_count != 1:
                raise RuntimeError("Password reset email was not sent.")
        except Exception:
            reset_record.delete()
            return Response(
                {"detail": "Unable to send the verification email right now."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if settings.DEBUG:
            print(f"Password reset OTP for {user.email}: {otp}")

        return Response({
            "message": "If an account matches the submitted identifier, a verification code has been sent."
        })


class VerifyOTPView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = find_user_by_identifier(
            serializer.validated_data["identifier"]
        )
        if user is None or not user.is_active:
            return Response(
                {"detail": "Invalid or expired OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            otp_record = PasswordResetOTP.objects.select_for_update().filter(
                user=user,
                purpose=PasswordResetOTP.PASSWORD_RESET,
                verified_at__isnull=True,
                used_at__isnull=True,
            ).first()
            now = timezone.now()

            if otp_record is None:
                return Response(
                    {"detail": "Invalid or expired OTP."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if otp_record.expires_at <= now:
                otp_record.used_at = now
                otp_record.save(update_fields=["used_at"])
                return Response(
                    {"detail": "Invalid or expired OTP."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if otp_record.attempts >= MAX_OTP_ATTEMPTS:
                otp_record.used_at = now
                otp_record.save(update_fields=["used_at"])
                return Response(
                    {"detail": "Too many OTP attempts. Request a new code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            otp_record.attempts += 1
            otp_record.save(update_fields=["attempts"])

            if not check_password(
                serializer.validated_data["otp"],
                otp_record.code_hash,
            ):
                if otp_record.attempts >= MAX_OTP_ATTEMPTS:
                    otp_record.used_at = now
                    otp_record.save(update_fields=["used_at"])

                return Response(
                    {"detail": "Invalid or expired OTP."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            reset_token = secrets.token_urlsafe(32)
            otp_record.verified_at = now
            otp_record.verification_token_hash = make_password(reset_token)
            otp_record.save(update_fields=[
                "verified_at",
                "verification_token_hash",
            ])

        return Response({
            "message": "OTP verified successfully.",
            "reset_token": reset_token,
        })


class ResetPasswordView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = find_user_by_identifier(
            serializer.validated_data["identifier"]
        )

        if user is None or not user.is_active:
            return Response(
                {"detail": "Invalid or expired password reset authorization."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(
                serializer.validated_data["new_password"],
                user=user,
            )
        except DjangoValidationError as error:
            return Response(
                {"new_password": list(error.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            otp_record = PasswordResetOTP.objects.select_for_update().filter(
                user=user,
                purpose=PasswordResetOTP.PASSWORD_RESET,
                verified_at__isnull=False,
                used_at__isnull=True,
            ).first()

            if (
                otp_record is None
                or otp_record.expires_at <= timezone.now()
                or not otp_record.verification_token_hash
                or not check_password(
                    serializer.validated_data["reset_token"],
                    otp_record.verification_token_hash,
                )
            ):
                return Response(
                    {"detail": "Invalid or expired password reset authorization."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user.set_password(serializer.validated_data["new_password"])
            user.save(update_fields=["password"])

            otp_record.used_at = timezone.now()
            otp_record.save(update_fields=["used_at"])

        return Response({"message": "Password reset successfully."})


class ChangePasswordView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={"request": request},
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])

        return Response({"message": "Password changed successfully."})


# =============================================================================
# Delivery Agent Login OTP Helpers & Views
# =============================================================================

class ChallengeSecretConfigurationError(Exception):
    """Raised when DELIVERY_AGENT_LOGIN_CHALLENGE_ID_SECRET is missing, invalid, or insecure."""
    pass


def get_challenge_id_secret() -> bytes:
    """Retrieve and strictly validate the dedicated challenge-ID HMAC secret.

    Fails closed if the secret is missing, shorter than 32 UTF-8 bytes,
    matches SECRET_KEY, or reuses the rate-limit or advisory-lock secrets.
    """
    raw = getattr(settings, "DELIVERY_AGENT_LOGIN_CHALLENGE_ID_SECRET", "")
    if not raw or not isinstance(raw, (str, bytes)):
        raise ChallengeSecretConfigurationError(
            "DELIVERY_AGENT_LOGIN_CHALLENGE_ID_SECRET must be configured."
        )

    secret_bytes = raw.encode("utf-8") if isinstance(raw, str) else bytes(raw)

    if len(secret_bytes) < 32:
        raise ChallengeSecretConfigurationError(
            "DELIVERY_AGENT_LOGIN_CHALLENGE_ID_SECRET must be at least 32 UTF-8 bytes."
        )

    # Must NOT fall back to or equal Django's SECRET_KEY
    django_secret = getattr(settings, "SECRET_KEY", "")
    django_bytes = (
        django_secret.encode("utf-8")
        if isinstance(django_secret, str)
        else bytes(django_secret)
    )
    if secret_bytes == django_bytes:
        raise ChallengeSecretConfigurationError(
            "DELIVERY_AGENT_LOGIN_CHALLENGE_ID_SECRET must not match SECRET_KEY."
        )

    # Must NOT reuse the rate-limit HMAC secret
    rate_hmac = getattr(settings, "DELIVERY_AGENT_LOGIN_RATE_LIMIT_HMAC_SECRET", "")
    rate_hmac_bytes = (
        rate_hmac.encode("utf-8")
        if isinstance(rate_hmac, str)
        else bytes(rate_hmac)
    )
    if rate_hmac_bytes and secret_bytes == rate_hmac_bytes:
        raise ChallengeSecretConfigurationError(
            "DELIVERY_AGENT_LOGIN_CHALLENGE_ID_SECRET must not reuse the rate-limit HMAC secret."
        )

    # Must NOT reuse the advisory lock secret
    lock_secret = getattr(settings, "DELIVERY_AGENT_LOGIN_RATE_LIMIT_LOCK_SECRET", "")
    lock_bytes = (
        lock_secret.encode("utf-8")
        if isinstance(lock_secret, str)
        else bytes(lock_secret)
    )
    if lock_bytes and secret_bytes == lock_bytes:
        raise ChallengeSecretConfigurationError(
            "DELIVERY_AGENT_LOGIN_CHALLENGE_ID_SECRET must not reuse the advisory lock secret."
        )

    return secret_bytes


def compute_challenge_id_digest(raw_challenge_id: str) -> str:
    """Derive HMAC-SHA256 digest from opaque challenge ID using dedicated secret."""
    secret_bytes = get_challenge_id_secret()
    return hmac.new(
        secret_bytes,
        raw_challenge_id.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def find_delivery_agent_by_identifier(identifier: str) -> DeliveryAgent | None:
    """Resolve delivery agent by agent ID (e.g. VC-AGT-00001) or phone number."""
    raw = str(identifier).strip()
    if re.match(r"^VC-AGT-\d+$", raw, re.IGNORECASE):
        return (
            DeliveryAgent.objects.select_related("user", "shop")
            .filter(agent_id__iexact=raw)
            .first()
        )
    try:
        normalized_phone = normalize_phone_number(raw)
    except Exception:
        normalized_phone = None

    if normalized_phone:
        return (
            DeliveryAgent.objects.select_related("user", "shop")
            .filter(user__phone_number=normalized_phone, user__role="delivery_agent")
            .first()
        )
    return None


def find_delivery_agent_for_email_verification(identifier: str) -> DeliveryAgent | None:
    """Resolve delivery agent for onboarding email verification by ID, email, phone, or username."""
    raw = str(identifier).strip()
    if not raw:
        return None

    # 1. Agent ID pattern (e.g. VC-AGT-00001)
    if re.match(r"^VC-AGT-\d+$", raw, re.IGNORECASE):
        return (
            DeliveryAgent.objects.select_related("user", "shop")
            .filter(agent_id__iexact=raw)
            .first()
        )

    # 2. Email pattern
    if "@" in raw:
        return (
            DeliveryAgent.objects.select_related("user", "shop")
            .filter(user__email__iexact=raw, user__role="delivery_agent")
            .first()
        )

    # 3. Phone number
    try:
        normalized_phone = normalize_phone_number(raw)
    except Exception:
        normalized_phone = None

    if normalized_phone:
        agent = (
            DeliveryAgent.objects.select_related("user", "shop")
            .filter(user__phone_number=normalized_phone, user__role="delivery_agent")
            .first()
        )
        if agent is not None:
            return agent

    # 4. Username
    return (
        DeliveryAgent.objects.select_related("user", "shop")
        .filter(user__username__iexact=raw, user__role="delivery_agent")
        .first()
    )


def is_delivery_agent_otp_console_fallback_active() -> bool:
    """Return True only if local dev debug mode and console fallback flag are both active."""
    return bool(
        getattr(settings, "DEBUG", False)
        and getattr(settings, "DELIVERY_AGENT_OTP_CONSOLE_FALLBACK", False)
    )


def is_delivery_agent_eligible(agent: DeliveryAgent | None) -> bool:
    """Verify delivery agent eligibility requirements for login."""
    if agent is None:
        return False
    user = agent.user
    if user is None:
        return False
    if user.role != "delivery_agent":
        return False
    if not user.is_active:
        return False
    if not agent.is_active:
        return False
    if not user.phone_number or not user.phone_number.strip():
        return False

    # In production (or when console fallback is disabled), strictly require
    # verified phone, verified email, and non-empty email address.
    if not is_delivery_agent_otp_console_fallback_active():
        if not agent.phone_verified:
            return False
        if not agent.email_verified:
            return False
        if not user.email or not user.email.strip():
            return False

    return True


class DeliveryAgentLoginRequestOTPView(APIView):
    """Request delivery-agent email login OTP with rate limiting and generic responses."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = DeliveryAgentLoginRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate dedicated challenge-ID secret configuration strictly before proceeding
        try:
            get_challenge_id_secret()
        except ChallengeSecretConfigurationError:
            logger.error("Delivery agent login request failed: challenge secret configuration error.")
            return Response(
                {"detail": "Unable to process login request right now."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        raw_identifier = serializer.validated_data["identifier"]

        # 1. Rate limiting occurs before account lookup to prevent enumeration
        rate_limit_result = check_and_record_delivery_agent_login_rate_limit(
            request=request,
            identifier=raw_identifier,
        )
        if rate_limit_result.decision == RateLimitDecision.BLOCKED:
            return Response(
                {"detail": "Too many login attempts. Please try again later."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        if rate_limit_result.decision != RateLimitDecision.ALLOWED:
            return Response(
                {"detail": "Unable to process login request right now."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # 2. Account eligibility lookup
        agent = find_delivery_agent_by_identifier(raw_identifier)
        if not is_delivery_agent_eligible(agent):
            return Response(
                {
                    "message": (
                        "If an eligible account matches the submitted identifier, "
                        "a verification code has been sent."
                    ),
                    "challenge_id": secrets.token_urlsafe(32),
                    "resend_cooldown_seconds": 60,
                    "expires_in_seconds": 300,
                },
                status=status.HTTP_200_OK,
            )

        # 3. Eligible delivery agent: atomic challenge creation with cooldown check
        try:
            with transaction.atomic():
                # Lock delivery agent row to serialize concurrent requests for this agent
                DeliveryAgent.objects.select_for_update().get(pk=agent.pk)
                active_challenge = (
                    DeliveryAgentLoginChallenge.objects.select_for_update()
                    .filter(
                        delivery_agent=agent,
                        used_at__isnull=True,
                        invalidated_at__isnull=True,
                    )
                    .first()
                )

                now = timezone.now()
                if active_challenge is not None:
                    if now < active_challenge.resend_available_at:
                        remaining = int(
                            (active_challenge.resend_available_at - now).total_seconds()
                        ) + 1
                        return Response(
                            {
                                "detail": f"Please wait {remaining} seconds before requesting another verification code.",
                                "resend_cooldown_seconds": remaining,
                            },
                            status=status.HTTP_429_TOO_MANY_REQUESTS,
                        )
                    active_challenge.invalidated_at = now
                    active_challenge.save(update_fields=["invalidated_at"])

                raw_challenge_id = secrets.token_urlsafe(32)
                challenge_digest = compute_challenge_id_digest(raw_challenge_id)
                raw_otp = f"{secrets.randbelow(1_000_000):06d}"

                new_challenge = DeliveryAgentLoginChallenge.objects.create(
                    delivery_agent=agent,
                    challenge_id_digest=challenge_digest,
                    otp_hash=make_password(raw_otp),
                    expires_at=now + timedelta(minutes=5),
                    resend_available_at=now + timedelta(seconds=60),
                    incorrect_attempts=0,
                    sms_status=DeliveryAgentLoginChallenge.STATUS_NOT_AVAILABLE,
                    email_status=DeliveryAgentLoginChallenge.STATUS_PENDING,
                )
        except IntegrityError:
            return Response(
                {
                    "detail": "Please wait before requesting another verification code.",
                    "resend_cooldown_seconds": 60,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # 4. Deliver OTP exclusively to agent's verified registered email (or dev console fallback)
        has_verified_email = bool(
            agent.user.email
            and agent.user.email.strip()
            and agent.email_verified
        )
        use_console_fallback = (
            is_delivery_agent_otp_console_fallback_active()
            and not has_verified_email
        )

        try:
            if use_console_fallback:
                # Controlled development-only console delivery:
                # Prints OTP formatted as an email message to the development terminal
                # via Django's console email backend.
                console_connection = get_connection(
                    "django.core.mail.backends.console.EmailBackend"
                )
                fallback_recipient = (
                    agent.user.email.strip()
                    if (agent.user.email and agent.user.email.strip())
                    else f"{agent.agent_id.lower()}@veecleen.local"
                )
                msg = EmailMessage(
                    subject="Your VeeCleen Delivery Agent Login Code",
                    body=(
                        "-----------------------------------------------------------------------\n"
                        "[DEVELOPMENT ONLY - CONSOLE OTP DELIVERY]\n"
                        f"Delivery Agent: {agent.agent_id} ({agent.user.phone_number})\n"
                        f"Your VeeCleen delivery agent login verification code is {raw_otp}. "
                        "It expires in 5 minutes.\n\n"
                        "If you did not request this login code, please contact your administrator.\n"
                        "-----------------------------------------------------------------------\n"
                    ),
                    from_email=None,
                    to=[fallback_recipient],
                    connection=console_connection,
                )
                sent_count = msg.send(fail_silently=False)
                if sent_count != 1:
                    raise RuntimeError("Console OTP delivery returned zero sent messages.")
            else:
                sent_count = send_mail(
                    subject="Your VeeCleen Delivery Agent Login Code",
                    message=(
                        f"Your VeeCleen delivery agent login verification code is {raw_otp}. "
                        "It expires in 5 minutes.\n\n"
                        "If you did not request this login code, please contact your administrator."
                    ),
                    from_email=None,
                    recipient_list=[agent.user.email],
                    fail_silently=False,
                )
                if sent_count != 1:
                    raise RuntimeError("Email delivery returned zero sent messages.")

            new_challenge.email_status = DeliveryAgentLoginChallenge.STATUS_SUCCEEDED
            new_challenge.save(update_fields=["email_status"])
        except Exception:
            logger.error("Delivery agent login OTP email delivery failed")
            new_challenge.invalidated_at = timezone.now()
            new_challenge.email_status = DeliveryAgentLoginChallenge.STATUS_FAILED
            new_challenge.save(update_fields=["invalidated_at", "email_status"])
            return Response(
                {"detail": "Unable to deliver verification code right now. Please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        logger.info("Delivery agent login OTP requested successfully")
        return Response(
            {
                "message": (
                    "Verification code printed to development console."
                    if use_console_fallback
                    else "Verification code sent successfully to your registered email."
                ),
                "challenge_id": raw_challenge_id,
                "resend_cooldown_seconds": 60,
                "expires_in_seconds": 300,
            },
            status=status.HTTP_200_OK,
        )


class DeliveryAgentLoginVerifyOTPView(APIView):
    """Verify delivery-agent OTP atomically and issue SimpleJWT tokens."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = DeliveryAgentLoginVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_challenge_id = serializer.validated_data["challenge_id"]
        raw_otp = serializer.validated_data["otp"]
        try:
            challenge_digest = compute_challenge_id_digest(raw_challenge_id)
        except ChallengeSecretConfigurationError:
            logger.error("Delivery agent login verification failed: challenge secret configuration error.")
            return Response(
                {"detail": "Unable to process login verification right now."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        with transaction.atomic():
            challenge = (
                DeliveryAgentLoginChallenge.objects.select_for_update()
                .select_related("delivery_agent", "delivery_agent__user")
                .filter(challenge_id_digest=challenge_digest)
                .first()
            )

            if challenge is None:
                return Response(
                    {"detail": "Invalid or expired verification challenge."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if challenge.used_at is not None or challenge.invalidated_at is not None:
                return Response(
                    {"detail": "Invalid or expired verification challenge."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Strictly require successful email delivery
            if challenge.email_status != DeliveryAgentLoginChallenge.STATUS_SUCCEEDED:
                return Response(
                    {"detail": "Verification code delivery was not confirmed or failed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            now = timezone.now()
            if challenge.expires_at <= now:
                challenge.invalidated_at = now
                challenge.save(update_fields=["invalidated_at"])
                return Response(
                    {"detail": "Verification code has expired. Please request a new code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if challenge.incorrect_attempts >= 5:
                challenge.invalidated_at = now
                challenge.save(update_fields=["invalidated_at"])
                return Response(
                    {"detail": "Maximum attempts exceeded. This challenge has been invalidated."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not check_password(raw_otp, challenge.otp_hash):
                challenge.incorrect_attempts += 1
                if challenge.incorrect_attempts >= 5:
                    challenge.invalidated_at = now
                    challenge.save(update_fields=["incorrect_attempts", "invalidated_at"])
                    return Response(
                        {"detail": "Invalid verification code. Maximum attempts exceeded; challenge invalidated."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                challenge.save(update_fields=["incorrect_attempts"])
                remaining = 5 - challenge.incorrect_attempts
                return Response(
                    {"detail": f"Invalid verification code. {remaining} attempt(s) remaining."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Correct OTP: verify authoritative eligibility at verification time
            agent = challenge.delivery_agent
            user = agent.user if agent else None
            if not is_delivery_agent_eligible(agent):
                challenge.invalidated_at = now
                challenge.save(update_fields=["invalidated_at"])
                return Response(
                    {"detail": "Account is not active or eligible for login."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            challenge.used_at = now
            challenge.verified_at = now
            challenge.save(update_fields=["used_at", "verified_at"])

            refresh = RefreshToken.for_user(user)
            refresh["role"] = user.role

            logger.info("Delivery agent login OTP verified successfully")
            return Response(
                {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                    "user": {
                        "id": user.pk,
                        "username": user.username,
                        "email": user.email,
                        "role": user.role,
                        "agent_id": agent.agent_id,
                    },
                    "role": user.role,
                },
                status=status.HTTP_200_OK,
            )


# =============================================================================
# Delivery Agent Onboarding Email Verification Views
# =============================================================================

UNIFORM_EMAIL_VERIFY_REQUEST_RESPONSE = {
    "message": (
        "If an eligible account matches the submitted identifier, "
        "a verification code has been sent."
    ),
    "resend_cooldown_seconds": 60,
    "expires_in_seconds": 600,
}


class DeliveryAgentEmailVerificationRequestView(APIView):
    """Request email verification code for newly registered delivery agent."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = DeliveryAgentEmailVerificationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        raw_identifier = serializer.validated_data["identifier"]

        # 1. Rate limiting occurs BEFORE account lookup to prevent enumeration
        rate_limit_result = check_and_record_delivery_agent_email_verify_rate_limit(
            request=request,
            identifier=raw_identifier,
        )
        if rate_limit_result.decision == RateLimitDecision.BLOCKED:
            return Response(
                {"detail": "Too many requests. Please try again later."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        if rate_limit_result.decision != RateLimitDecision.ALLOWED:
            return Response(
                {"detail": "Unable to process verification request right now."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # 2. Account eligibility lookup
        agent = find_delivery_agent_for_email_verification(raw_identifier)

        if (
            agent is None
            or not agent.is_active
            or not agent.user
            or not agent.user.is_active
            or agent.user.role != "delivery_agent"
            or not agent.user.email
            or not agent.user.email.strip()
            or agent.email_verified
        ):
            # Inactive, unknown, missing email, or already verified accounts
            # receive the exact same uniform 200 OK response
            return Response(UNIFORM_EMAIL_VERIFY_REQUEST_RESPONSE, status=status.HTTP_200_OK)

        now = timezone.now()
        raw_otp = f"{secrets.randbelow(1_000_000):06d}"
        email_to_send = None

        try:
            with transaction.atomic():
                # Lock agent and user rows and refresh from database
                agent = DeliveryAgent.objects.select_for_update().get(pk=agent.pk)
                user = User.objects.select_for_update().get(pk=agent.user_id)

                # Revalidate under lock
                if (
                    not agent.is_active
                    or not user.is_active
                    or user.role != "delivery_agent"
                    or not user.email
                    or not user.email.strip()
                    or agent.email_verified
                ):
                    return Response(
                        UNIFORM_EMAIL_VERIFY_REQUEST_RESPONSE,
                        status=status.HTTP_200_OK,
                    )

                active = (
                    PasswordResetOTP.objects.select_for_update()
                    .filter(
                        user=user,
                        purpose="delivery_agent_email_verify",
                        verified_at__isnull=True,
                        used_at__isnull=True,
                    )
                    .order_by("-created_at")
                    .first()
                )

                if active is not None:
                    cooldown_until = active.created_at + timedelta(seconds=60)
                    if now < cooldown_until:
                        # Request is suppressed because of per-agent cooldown.
                        # Do NOT expose whether a cooldown is active or send email;
                        # return the exact same uniform response.
                        return Response(
                            UNIFORM_EMAIL_VERIFY_REQUEST_RESPONSE,
                            status=status.HTTP_200_OK,
                        )
                    # Invalidate previous challenge
                    active.used_at = now
                    active.save(update_fields=["used_at"])

                # Store cryptographic hash of code and bind to current registered email
                email_normalized = user.email.strip().lower()
                email_binding = hashlib.sha256(email_normalized.encode("utf-8")).hexdigest()

                record = PasswordResetOTP.objects.create(
                    user=user,
                    purpose="delivery_agent_email_verify",
                    code_hash=make_password(raw_otp),
                    verification_token_hash=email_binding,
                    expires_at=now + timedelta(minutes=10),
                )
                email_to_send = user.email
        except IntegrityError:
            return Response(UNIFORM_EMAIL_VERIFY_REQUEST_RESPONSE, status=status.HTTP_200_OK)

        # Deliver verification email exclusively to registered email address
        if email_to_send:
            try:
                sent_count = send_mail(
                    subject="Verify your VeeCleen Delivery Agent Email",
                    message=(
                        f"Your VeeCleen delivery agent email verification code is {raw_otp}. "
                        "It expires in 10 minutes.\n\n"
                        "If you did not request this verification code, please contact your administrator."
                    ),
                    from_email=None,
                    recipient_list=[email_to_send],
                    fail_silently=False,
                )
                if sent_count != 1:
                    raise RuntimeError("Email sending failed.")
            except Exception:
                logger.error("Delivery agent email verification delivery failed")
                record.used_at = timezone.now()
                record.save(update_fields=["used_at"])
                # Return uniform response to prevent account enumeration via mail delivery failure
                return Response(
                    UNIFORM_EMAIL_VERIFY_REQUEST_RESPONSE,
                    status=status.HTTP_200_OK,
                )

        logger.info("Delivery agent email verification processed successfully")
        return Response(UNIFORM_EMAIL_VERIFY_REQUEST_RESPONSE, status=status.HTTP_200_OK)


class DeliveryAgentEmailVerificationConfirmView(APIView):
    """Verify delivery agent email verification code and set email_verified=True."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = DeliveryAgentEmailVerificationConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        raw_identifier = serializer.validated_data["identifier"]
        raw_otp = serializer.validated_data["otp"]

        agent = find_delivery_agent_for_email_verification(raw_identifier)
        if (
            agent is None
            or not agent.is_active
            or not agent.user
            or not agent.user.is_active
            or agent.user.role != "delivery_agent"
            or not agent.user.email
            or not agent.user.email.strip()
        ):
            return Response(
                {"detail": "Invalid or expired verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Lock agent and user rows and refresh agent from database
            agent = DeliveryAgent.objects.select_for_update().get(pk=agent.pk)
            user = User.objects.select_for_update().get(pk=agent.user_id)

            # Check eligibility using the refreshed state under lock
            if (
                not agent.is_active
                or not user.is_active
                or user.role != "delivery_agent"
                or not user.email
                or not user.email.strip()
            ):
                return Response(
                    {"detail": "Invalid or expired verification code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            challenge = (
                PasswordResetOTP.objects.select_for_update()
                .filter(
                    user=user,
                    purpose="delivery_agent_email_verify",
                    verified_at__isnull=True,
                    used_at__isnull=True,
                )
                .order_by("-created_at")
                .first()
            )

            if challenge is None:
                return Response(
                    {"detail": "Invalid or expired verification code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            now = timezone.now()

            # Email change binding check:
            # If registered email changed after OTP issuance, reject and invalidate old challenge
            current_email_normalized = user.email.strip().lower()
            current_email_binding = hashlib.sha256(
                current_email_normalized.encode("utf-8")
            ).hexdigest()
            if challenge.verification_token_hash != current_email_binding:
                challenge.used_at = now
                challenge.save(update_fields=["used_at"])
                return Response(
                    {"detail": "Invalid or expired verification code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if challenge.expires_at <= now:
                challenge.used_at = now
                challenge.save(update_fields=["used_at"])
                return Response(
                    {"detail": "Verification code has expired. Please request a new code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if challenge.attempts >= 5:
                challenge.used_at = now
                challenge.save(update_fields=["used_at"])
                return Response(
                    {"detail": "Maximum attempts exceeded. This verification code has been invalidated."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not check_password(raw_otp, challenge.code_hash):
                challenge.attempts += 1
                if challenge.attempts >= 5:
                    challenge.used_at = now
                    challenge.save(update_fields=["attempts", "used_at"])
                    return Response(
                        {"detail": "Invalid verification code. Maximum attempts exceeded."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                challenge.save(update_fields=["attempts"])
                remaining = 5 - challenge.attempts
                return Response(
                    {"detail": f"Invalid verification code. {remaining} attempt(s) remaining."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Single-use: mark challenge verified and used
            challenge.verified_at = now
            challenge.used_at = now
            challenge.save(update_fields=["verified_at", "used_at"])

            # Set email_verified=True only after successful verification of currently registered email
            agent.email_verified = True
            agent.save(update_fields=["email_verified", "updated_at"])

        logger.info("Delivery agent email verified successfully")
        return Response(
            {"message": "Email verified successfully. You may now log in."},
            status=status.HTTP_200_OK,
        )
