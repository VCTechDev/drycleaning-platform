import secrets
from datetime import timedelta

from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from accounts.models import PasswordResetOTP
from accounts.serializers import (
    ChangePasswordSerializer,
    CustomerRegistrationSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    VerifyOTPSerializer,
)
from accounts.serializers.auth import find_user_by_identifier


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
