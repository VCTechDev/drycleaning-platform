import logging
import os
import secrets

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from django.db.models.functions import Lower, Trim
from django.utils import timezone

from shops.models import (
    Service,
    ServiceRequest,
    Shop,
    ShopApplication,
    ShopApplicationNotification,
)
from users.models import User


logger = logging.getLogger(__name__)


def generate_application_token():
    return secrets.token_urlsafe(32)


def _next_shop_admin_username(application):
    base = f"shop_admin_{application.pk}"
    username = base
    suffix = 2
    while User.objects.filter(username=username).exists():
        username = f"{base}_{suffix}"
        suffix += 1
    return username


def _copy_application_image(application, shop):
    if not application.image:
        return

    application.image.open("rb")
    try:
        shop.image.save(
            os.path.basename(application.image.name),
            ContentFile(application.image.read()),
            save=False,
        )
    finally:
        application.image.close()


def _copy_service_request_image(service_request, service):
    if not service_request.image:
        return

    service_request.image.open("rb")
    try:
        service.image.save(
            os.path.basename(service_request.image.name),
            ContentFile(service_request.image.read()),
            save=False,
        )
    finally:
        service_request.image.close()


def approve_shop_application(application_id, reviewer):
    with transaction.atomic():
        application = ShopApplication.objects.select_for_update().get(
            pk=application_id
        )

        if application.status != ShopApplication.STATUS_UNDER_REVIEW:
            raise ValueError("Only applications under review can be approved.")

        if application.approved_user_id or application.created_shop_id:
            raise ValueError("This application has already been provisioned.")

        try:
            application.validate_for_submission()
        except ValidationError as exc:
            raise ValueError(
                f"Application is incomplete: {exc.message_dict}"
            ) from exc

        if User.objects.filter(email__iexact=application.email).exists():
            raise ValueError(
                "An account already exists with the applicant's email address."
            )

        user = User(
            username=_next_shop_admin_username(application),
            email=application.email.lower(),
            first_name=application.owner_name,
            phone_number=application.phone_number,
            role="shop_admin",
            is_active=True,
        )
        user.set_unusable_password()
        user.save()

        shop = Shop.objects.create(
            shop_admin=user,
            shop_name=application.shop_name,
            description=application.description,
            contact_number=application.phone_number,
            address_line=application.address_line,
            city=application.city,
            district=application.district,
            state=application.state,
            pincode=application.pincode,
            opening_time=application.opening_time,
            closing_time=application.closing_time,
            is_approved=True,
            is_open=False,
        )
        _copy_application_image(application, shop)
        if shop.image:
            shop.save(update_fields=["image", "updated_at"])

        application.transition_to(
            ShopApplication.STATUS_APPROVED,
            reviewer=reviewer,
        )
        application.approved_user = user
        application.created_shop = shop
        application.save(
            update_fields=[
                "status",
                "rejection_reason",
                "reviewed_by",
                "reviewed_at",
                "approved_user",
                "created_shop",
                "updated_at",
            ]
        )

        notification = ShopApplicationNotification.objects.create(
            application=application,
            notification_type=ShopApplicationNotification.APPROVAL,
            recipient_email=application.email,
        )

    notification = send_shop_approval_email(notification, application, user)
    return application, user, shop, notification


def reject_shop_application(application_id, reviewer, reason):
    with transaction.atomic():
        application = ShopApplication.objects.select_for_update().get(
            pk=application_id
        )
        application.transition_to(
            ShopApplication.STATUS_REJECTED,
            reviewer=reviewer,
            reason=reason,
        )
        application.save(
            update_fields=[
                "status",
                "rejection_reason",
                "reviewed_by",
                "reviewed_at",
                "updated_at",
            ]
        )

        notification = ShopApplicationNotification.objects.create(
            application=application,
            notification_type=ShopApplicationNotification.REJECTION,
            recipient_email=application.email,
        )

    notification = send_shop_rejection_email(notification, application)
    return application, notification


def _deliver_application_notification(notification, subject, message):
    notification.attempts += 1
    notification.save(update_fields=["attempts", "updated_at"])

    try:
        sent = send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[notification.recipient_email],
            fail_silently=False,
        )
        if sent != 1:
            raise RuntimeError("Email was not sent.")
    except Exception:
        notification.status = ShopApplicationNotification.FAILED
        notification.last_error = "Email delivery failed; retry required."
        notification.save(update_fields=[
            "status",
            "last_error",
            "updated_at",
        ])
        logger.error(
            "Shop application notification delivery failed for notification %s",
            notification.pk,
        )
        return notification

    notification.status = ShopApplicationNotification.SENT
    notification.sent_at = timezone.now()
    notification.last_error = ""
    notification.save(update_fields=[
        "status",
        "sent_at",
        "last_error",
        "updated_at",
    ])
    return notification


def send_shop_approval_email(notification, application, user):
    return _deliver_application_notification(
        notification,
        "Your VeeCleen shop application was approved",
        (
            f"Hello {application.owner_name},\n\n"
            "Your VeeCleen shop application has been approved.\n\n"
            f"Username: {user.username}\n"
            "Login: Use the VeeCleen login page.\n\n"
            "For security, no temporary password was created. "
            "Use Forgot Password with your email address to set "
            "your password before logging in.\n"
        ),
    )


def send_shop_rejection_email(notification, application):
    return _deliver_application_notification(
        notification,
        "Update on your VeeCleen shop application",
        (
            f"Hello {application.owner_name},\n\n"
            "Your VeeCleen shop application was not approved.\n\n"
            f"Reason: {application.rejection_reason}\n"
        ),
    )


def approve_service_request(request_id, reviewer):
    with transaction.atomic():
        service_request = ServiceRequest.objects.select_for_update().get(
            pk=request_id
        )
        if service_request.status != ServiceRequest.STATUS_UNDER_REVIEW:
            raise ValueError(
                "Only service requests under review can be approved."
            )
        if not service_request.shop.is_approved:
            raise ValueError("The requesting shop is not approved.")

        service_name = service_request.service_name.strip()
        service = Service.objects.annotate(
            _normalized_name=Lower(Trim("service_name")),
        ).filter(_normalized_name=service_name.casefold()).first()

        if service is None:
            try:
                with transaction.atomic():
                    service = Service.objects.create(
                        service_name=service_name,
                        description=service_request.description,
                    )
                    _copy_service_request_image(service_request, service)
                    if service.image:
                        service.save(update_fields=["image", "updated_at"])
            except IntegrityError:
                service = Service.objects.annotate(
                    _normalized_name=Lower(Trim("service_name")),
                ).get(_normalized_name=service_name.casefold())
        elif not service.is_active:
            service.is_active = True
            service.save(update_fields=["is_active", "updated_at"])

        service_request.transition_to(
            ServiceRequest.STATUS_APPROVED,
            reviewer=reviewer,
        )
        service_request.approved_service = service
        service_request.save(
            update_fields=[
                "status",
                "rejection_reason",
                "reviewed_by",
                "reviewed_at",
                "approved_service",
                "updated_at",
            ]
        )

    return service_request, service
