import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import OperationalError, transaction
from django.http import Http404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from logistics.models import (
    DeliveryAgent,
    DeliveryOTPAuditLog,
    DeliveryTask,
    DeliveryVerificationOTP,
)
from logistics.serializers.delivery_agent import (
    DeliveryAgentAvailabilitySerializer,
    DeliveryAgentTaskCompleteSerializer,
    DeliveryAgentTaskFailSerializer,
    DeliveryAgentTaskSerializer,
)
from orders.models import Order
from users.permissions import IsDeliveryAgent

OTP_VALIDITY_MINUTES = 15
OTP_RESEND_COOLDOWN_SECONDS = 60
OTP_INCORRECT_COOLDOWN_SECONDS = 60
DEFAULT_INCORRECT_ATTEMPTS_THRESHOLD = 5


def get_incorrect_attempts_threshold():
    return getattr(
        settings,
        "DELIVERY_OTP_INCORRECT_ATTEMPTS_THRESHOLD",
        DEFAULT_INCORRECT_ATTEMPTS_THRESHOLD,
    )


def _get_client_ip(request):
    if not request:
        return None
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _log_otp_audit(request, task, agent, action, details=""):
    try:
        ip = _get_client_ip(request)
        user_agent = (request.META.get("HTTP_USER_AGENT", "") if request else "")[:255]
        DeliveryOTPAuditLog.objects.create(
            task=task,
            delivery_agent=agent,
            action=action,
            ip_address=ip,
            user_agent=user_agent,
            details=details[:255],
        )
    except Exception:
        pass



class DeliveryAgentAvailabilityView(APIView):
    """
    Delivery Agent endpoint to view and update availability (online/offline).
    Only authenticated, active delivery agents can update their status.
    """

    permission_classes = [IsAuthenticated, IsDeliveryAgent]

    def get_agent(self, request):
        try:
            return DeliveryAgent.objects.get(user=request.user)
        except DeliveryAgent.DoesNotExist:
            raise PermissionDenied("Delivery agent profile not found.")

    def get(self, request):
        agent = self.get_agent(request)
        return Response({
            "agent_id": agent.id,
            "public_agent_id": agent.agent_id,
            "is_active": agent.is_active,
            "is_online": agent.is_online,
            "shift_starts_at": agent.shift_starts_at,
            "shift_ends_at": agent.shift_ends_at,
        })

    def patch(self, request):
        agent = self.get_agent(request)
        if not agent.is_active:
            raise PermissionDenied("Inactive delivery agent account cannot modify availability.")

        serializer = DeliveryAgentAvailabilitySerializer(
            data=request.data,
            context={"agent": agent, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        agent = serializer.save()
        return Response({
            "agent_id": agent.id,
            "public_agent_id": agent.agent_id,
            "is_active": agent.is_active,
            "is_online": agent.is_online,
        })


class DeliveryAgentTaskViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Delivery Agent endpoint to view assigned tasks, start them, and mark them completed.
    Strictly scoped to tasks assigned exclusively to the authenticated active delivery agent.
    """

    permission_classes = [IsAuthenticated, IsDeliveryAgent]
    http_method_names = ["get", "post", "head", "options"]
    serializer_class = DeliveryAgentTaskSerializer

    def get_agent(self):
        user = self.request.user
        try:
            agent = user.delivery_agent
        except Exception:
            raise PermissionDenied("Delivery agent profile not found.")
        if not agent.is_active or not user.is_active:
            raise PermissionDenied("Inactive delivery agents cannot access tasks.")
        return agent

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or user.role != "delivery_agent" or not user.is_active:
            return DeliveryTask.objects.none()

        try:
            agent = self.get_agent()
        except Exception:
            return DeliveryTask.objects.none()

        queryset = (
            DeliveryTask.objects.filter(delivery_agent=agent)
            .select_related(
                "order",
                "order__customer",
                "order__shop",
                "delivery_agent",
                "delivery_agent__user",
            )
            .order_by("-created_at")
        )

        task_type = self.request.query_params.get("task_type")
        if task_type:
            queryset = queryset.filter(task_type=task_type.strip().lower())

        task_status = self.request.query_params.get("status")
        if task_status:
            queryset = queryset.filter(status=task_status.strip().lower())

        scheduled_date = self.request.query_params.get("scheduled_date")
        if scheduled_date:
            try:
                queryset = queryset.filter(scheduled_at__date=scheduled_date.strip())
            except Exception:
                pass

        return queryset

    def _validate_empty_payload(self, request):
        if hasattr(request, "data") and isinstance(request.data, dict) and len(request.data) > 0:
            unexpected = sorted(list(request.data.keys()))
            raise ValidationError({
                field: f"Field '{field}' is not permitted in this request."
                for field in unexpected
            })

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        self._validate_empty_payload(request)
        agent = self.get_agent()

        try:
            with transaction.atomic():
                # Resolve task and order_id before locking
                task_info = (
                    DeliveryTask.objects.filter(pk=pk, delivery_agent=agent)
                    .values("id", "order_id")
                    .first()
                )
                if not task_info:
                    raise Http404("Task not found.")

                order_id = task_info["order_id"]

                # Lock Order first (Global Lock Hierarchy: Order -> DeliveryTask)
                order = (
                    Order.objects.select_for_update()
                    .filter(pk=order_id)
                    .first()
                )
                if not order:
                    raise Http404("Order not found.")

                # Lock DeliveryTask second
                task = (
                    DeliveryTask.objects.select_for_update(of=("self",))
                    .filter(pk=pk, delivery_agent=agent)
                    .first()
                )
                if not task:
                    raise Http404("Task not found.")

                # Revalidate task-order association under locks
                if task.order_id != order.id:
                    raise ValidationError({"task": "Task is no longer associated with this order."})

                task.order = order

                # Validate terminal states
                if task.status in DeliveryTask.TERMINAL_STATUSES:
                    raise ValidationError({
                        "status": f"Cannot start task in terminal status '{task.status}'."
                    })

                if order.order_status in Order.TERMINAL_STATUSES:
                    raise ValidationError({
                        "order": f"Cannot start task for an order in terminal status '{order.order_status}'."
                    })

                # Validate task status
                if task.status != DeliveryTask.STATUS_ASSIGNED:
                    raise ValidationError({
                        "status": f"Cannot start task in '{task.status}' status. Only 'assigned' tasks can be started."
                    })

                # Validate schedule
                if task.scheduled_at is not None and timezone.now() < task.scheduled_at:
                    raise ValidationError({
                        "scheduled_at": "Task cannot be started before its scheduled time."
                    })

                # Validate task type & order status alignment
                if task.task_type == DeliveryTask.TASK_TYPE_PICKUP:
                    if order.order_status == Order.STATUS_ACCEPTED:
                        try:
                            order.transition_to(Order.STATUS_PICKUP_SCHEDULED, by_user=request.user)
                            order.save()
                        except DjangoValidationError as exc:
                            raise ValidationError({"order_status": list(exc.messages) if hasattr(exc, "messages") else str(exc)})
                        except DjangoPermissionDenied as exc:
                            raise PermissionDenied(str(exc))
                    elif order.order_status == Order.STATUS_PICKUP_SCHEDULED:
                        pass
                    else:
                        raise ValidationError({
                            "order_status": (
                                f"Cannot start pickup task when order is in '{order.order_status}' status. "
                                "Order must be 'accepted' or 'pickup_scheduled'."
                            )
                        })
                elif task.task_type == DeliveryTask.TASK_TYPE_DELIVERY:
                    if order.order_status != Order.STATUS_READY:
                        raise ValidationError({
                            "order_status": (
                                f"Cannot start delivery task when order is in '{order.order_status}' status. "
                                "Order must be in 'ready' status."
                            )
                        })
                else:
                    raise ValidationError({
                        "task_type": f"Unknown task type '{task.task_type}'."
                    })

                task.status = DeliveryTask.STATUS_IN_PROGRESS
                task.save(update_fields=["status", "updated_at"])

            return Response(
                DeliveryAgentTaskSerializer(task, context={"request": request}).data,
                status=status.HTTP_200_OK,
            )
        except OperationalError as exc:
            msg = str(exc).lower()
            if "deadlock detected" in msg or "could not obtain lock" in msg or "lock timeout" in msg:
                return Response(
                    {"detail": "A concurrent update conflict occurred. Please retry your request."},
                    status=status.HTTP_409_CONFLICT,
                )
            raise

    @action(detail=True, methods=["post"], url_path="request-otp")
    def request_otp(self, request, pk=None):
        self._validate_empty_payload(request)
        agent = self.get_agent()

        try:
            with transaction.atomic():
                task_info = (
                    DeliveryTask.objects.filter(pk=pk, delivery_agent=agent)
                    .values("id", "order_id", "task_type", "status")
                    .first()
                )
                if not task_info:
                    raise Http404("Task not found.")

                if task_info["task_type"] != DeliveryTask.TASK_TYPE_DELIVERY:
                    raise ValidationError({
                        "task_type": "OTP verification is only applicable to delivery tasks."
                    })

                order_id = task_info["order_id"]

                order = (
                    Order.objects.select_for_update()
                    .filter(pk=order_id)
                    .first()
                )
                if not order:
                    raise Http404("Order not found.")

                task = (
                    DeliveryTask.objects.select_for_update(of=("self",))
                    .filter(pk=pk, delivery_agent=agent)
                    .first()
                )
                if not task:
                    raise Http404("Task not found.")

                if task.order_id != order.id:
                    raise ValidationError({"task": "Task is no longer associated with this order."})

                task.order = order

                if task.status in DeliveryTask.TERMINAL_STATUSES:
                    raise ValidationError({
                        "status": f"Cannot request OTP for task in terminal status '{task.status}'."
                    })

                if order.order_status in Order.TERMINAL_STATUSES:
                    raise ValidationError({
                        "order": f"Cannot request OTP for order in terminal status '{order.order_status}'."
                    })

                if task.status != DeliveryTask.STATUS_IN_PROGRESS:
                    raise ValidationError({
                        "status": (
                            f"Cannot request OTP in '{task.status}' status. "
                            "Task must be 'in_progress' to request delivery OTP."
                        )
                    })

                now = timezone.now()

                active_otp = (
                    DeliveryVerificationOTP.objects.select_for_update()
                    .filter(
                        task=task,
                        verified_at__isnull=True,
                        invalidated_at__isnull=True,
                    )
                    .order_by("-created_at")
                    .first()
                )

                if active_otp is not None:
                    resend_cutoff = active_otp.created_at + timedelta(seconds=OTP_RESEND_COOLDOWN_SECONDS)
                    cooldown_cutoff = active_otp.cooldown_until if active_otp.cooldown_until else None
                    effective_cutoff = max(resend_cutoff, cooldown_cutoff) if cooldown_cutoff else resend_cutoff

                    if now < effective_cutoff:
                        remaining_seconds = int((effective_cutoff - now).total_seconds()) + 1
                        _log_otp_audit(
                            request,
                            task,
                            agent,
                            DeliveryOTPAuditLog.ACTION_COOLDOWN_TRIGGERED,
                            f"Resend/attempt cooldown active. {remaining_seconds}s remaining.",
                        )
                        return Response(
                            {
                                "detail": (
                                    f"Please wait {remaining_seconds} seconds before requesting a new OTP."
                                )
                            },
                            status=status.HTTP_429_TOO_MANY_REQUESTS,
                        )

                    active_otp.invalidated_at = now
                    active_otp.save(update_fields=["invalidated_at", "updated_at"])
                    _log_otp_audit(
                        request,
                        task,
                        agent,
                        DeliveryOTPAuditLog.ACTION_INVALIDATED,
                        "Previous OTP invalidated by new issue request.",
                    )

                raw_code = f"{secrets.randbelow(1_000_000):06d}"
                expires_at = now + timedelta(minutes=OTP_VALIDITY_MINUTES)

                new_otp = DeliveryVerificationOTP.objects.create(
                    task=task,
                    code_hash=make_password(raw_code),
                    expires_at=expires_at,
                )

                action_type = (
                    DeliveryOTPAuditLog.ACTION_RESENT
                    if active_otp is not None
                    else DeliveryOTPAuditLog.ACTION_GENERATED
                )
                _log_otp_audit(
                    request,
                    task,
                    agent,
                    action_type,
                    f"OTP generated, expires in {OTP_VALIDITY_MINUTES} minutes.",
                )

                customer_email = order.customer.email if order.customer else None
                if customer_email:
                    try:
                        send_mail(
                            subject=f"VeeCleen Delivery Code for Order #{order.order_number}",
                            message=(
                                f"Hello {order.customer.first_name or order.customer.username},\n\n"
                                f"Your delivery agent has arrived with your cleaned garments.\n"
                                f"Your 6-digit delivery verification code is: {raw_code}\n\n"
                                f"This code expires in {OTP_VALIDITY_MINUTES} minutes. Share it with your delivery agent to receive your order.\n\n"
                                "Thank you for choosing VeeCleen!"
                            ),
                            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@veecleen.local"),
                            recipient_list=[customer_email],
                            fail_silently=False,
                        )
                    except Exception:
                        pass

                return Response(
                    {
                        "detail": "Verification OTP sent to customer.",
                        "expires_at": new_otp.expires_at,
                        "resend_cooldown_seconds": OTP_RESEND_COOLDOWN_SECONDS,
                    },
                    status=status.HTTP_200_OK,
                )
        except OperationalError as exc:
            msg = str(exc).lower()
            if "deadlock detected" in msg or "could not obtain lock" in msg or "lock timeout" in msg:
                return Response(
                    {"detail": "A concurrent update conflict occurred. Please retry your request."},
                    status=status.HTTP_409_CONFLICT,
                )
            raise

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        agent = self.get_agent()

        try:
            with transaction.atomic():
                task_info = (
                    DeliveryTask.objects.filter(pk=pk, delivery_agent=agent)
                    .values("id", "order_id", "task_type")
                    .first()
                )
                if not task_info:
                    raise Http404("Task not found.")

                order_id = task_info["order_id"]
                task_type = task_info["task_type"]

                if task_type == DeliveryTask.TASK_TYPE_PICKUP:
                    self._validate_empty_payload(request)
                    submitted_otp = None
                else:
                    serializer = DeliveryAgentTaskCompleteSerializer(data=request.data)
                    serializer.is_valid(raise_exception=True)
                    submitted_otp = serializer.validated_data.get("otp", "").strip()
                    if not submitted_otp:
                        raise ValidationError({
                            "otp": "OTP is required to complete delivery."
                        })

                order = (
                    Order.objects.select_for_update()
                    .filter(pk=order_id)
                    .first()
                )
                if not order:
                    raise Http404("Order not found.")

                task = (
                    DeliveryTask.objects.select_for_update(of=("self",))
                    .filter(pk=pk, delivery_agent=agent)
                    .first()
                )
                if not task:
                    raise Http404("Task not found.")

                if task.order_id != order.id:
                    raise ValidationError({"task": "Task is no longer associated with this order."})

                task.order = order

                if task.status in DeliveryTask.TERMINAL_STATUSES:
                    raise ValidationError({
                        "status": f"Cannot complete task in terminal status '{task.status}'."
                    })

                if order.order_status in Order.TERMINAL_STATUSES:
                    raise ValidationError({
                        "order": f"Cannot complete task for an order in terminal status '{order.order_status}'."
                    })

                if task.status != DeliveryTask.STATUS_IN_PROGRESS:
                    raise ValidationError({
                        "status": f"Cannot complete task in '{task.status}' status. Only 'in_progress' tasks can be completed."
                    })

                now = timezone.now()

                if task.task_type == DeliveryTask.TASK_TYPE_PICKUP:
                    if order.order_status != Order.STATUS_PICKUP_SCHEDULED:
                        raise ValidationError({
                            "order_status": (
                                f"Cannot complete pickup task when order is in '{order.order_status}' status. "
                                "Order must be in 'pickup_scheduled' status."
                            )
                        })
                    try:
                        order.transition_to(Order.STATUS_PICKED_UP, by_user=request.user)
                        order.save()
                    except DjangoValidationError as exc:
                        raise ValidationError({"order_status": list(exc.messages) if hasattr(exc, "messages") else str(exc)})
                    except DjangoPermissionDenied as exc:
                        raise PermissionDenied(str(exc))
                elif task.task_type == DeliveryTask.TASK_TYPE_DELIVERY:
                    if order.order_status != Order.STATUS_READY:
                        raise ValidationError({
                            "order_status": (
                                f"Cannot complete delivery task when order is in '{order.order_status}' status. "
                                "Order must be in 'ready' status."
                            )
                        })

                    otp_record = (
                        DeliveryVerificationOTP.objects.select_for_update()
                        .filter(
                            task=task,
                            verified_at__isnull=True,
                            invalidated_at__isnull=True,
                        )
                        .order_by("-created_at")
                        .first()
                    )

                    if otp_record is None:
                        _log_otp_audit(
                            request,
                            task,
                            agent,
                            DeliveryOTPAuditLog.ACTION_FAILED_ATTEMPT,
                            "Completion attempt with no active OTP.",
                        )
                        return Response(
                            {"otp": "No active OTP found for this delivery. Please request an OTP first."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    if otp_record.cooldown_until:
                        if now < otp_record.cooldown_until:
                            remaining_seconds = int((otp_record.cooldown_until - now).total_seconds()) + 1
                            _log_otp_audit(
                                request,
                                task,
                                agent,
                                DeliveryOTPAuditLog.ACTION_COOLDOWN_TRIGGERED,
                                f"Attempt blocked during cooldown. {remaining_seconds}s remaining.",
                            )
                            return Response(
                                {
                                    "detail": (
                                        f"Too many incorrect attempts. Please wait {remaining_seconds} seconds before trying again."
                                    )
                                },
                                status=status.HTTP_429_TOO_MANY_REQUESTS,
                            )
                        else:
                            otp_record.cooldown_until = None
                            otp_record.consecutive_failed_attempts = 0
                            otp_record.save(update_fields=["cooldown_until", "consecutive_failed_attempts", "updated_at"])

                    if otp_record.expires_at <= now:
                        _log_otp_audit(
                            request,
                            task,
                            agent,
                            DeliveryOTPAuditLog.ACTION_FAILED_ATTEMPT,
                            "Attempt with expired OTP.",
                        )
                        return Response(
                            {"otp": "OTP has expired. Please request a new code."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    if not check_password(submitted_otp, otp_record.code_hash):
                        otp_record.consecutive_failed_attempts += 1
                        threshold = get_incorrect_attempts_threshold()

                        if otp_record.consecutive_failed_attempts >= threshold:
                            otp_record.cooldown_until = now + timedelta(seconds=OTP_INCORRECT_COOLDOWN_SECONDS)
                            otp_record.save(update_fields=["consecutive_failed_attempts", "cooldown_until", "updated_at"])
                            _log_otp_audit(
                                request,
                                task,
                                agent,
                                DeliveryOTPAuditLog.ACTION_COOLDOWN_TRIGGERED,
                                f"Cooldown activated after {otp_record.consecutive_failed_attempts} failed attempts.",
                            )
                            return Response(
                                {
                                    "detail": (
                                        f"Too many incorrect attempts. Cooldown activated for {OTP_INCORRECT_COOLDOWN_SECONDS} seconds."
                                    )
                                },
                                status=status.HTTP_429_TOO_MANY_REQUESTS,
                            )

                        otp_record.save(update_fields=["consecutive_failed_attempts", "updated_at"])
                        _log_otp_audit(
                            request,
                            task,
                            agent,
                            DeliveryOTPAuditLog.ACTION_FAILED_ATTEMPT,
                            f"Incorrect OTP attempt #{otp_record.consecutive_failed_attempts}.",
                        )
                        return Response(
                            {"otp": "Invalid OTP code."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )


                    otp_record.verified_at = now
                    otp_record.cooldown_until = None
                    otp_record.consecutive_failed_attempts = 0
                    otp_record.save(update_fields=["verified_at", "cooldown_until", "consecutive_failed_attempts", "updated_at"])
                    _log_otp_audit(
                        request,
                        task,
                        agent,
                        DeliveryOTPAuditLog.ACTION_VERIFIED,
                        "OTP verified successfully. Completing delivery.",
                    )

                    try:
                        order.transition_to(Order.STATUS_DELIVERED, by_user=request.user)
                        order.save()
                    except DjangoValidationError as exc:
                        raise ValidationError({"order_status": list(exc.messages) if hasattr(exc, "messages") else str(exc)})
                    except DjangoPermissionDenied as exc:
                        raise PermissionDenied(str(exc))
                else:
                    raise ValidationError({
                        "task_type": f"Unknown task type '{task.task_type}'."
                    })

                task.status = DeliveryTask.STATUS_COMPLETED
                task.completed_at = now
                task.save(update_fields=["status", "completed_at", "updated_at"])

            return Response(
                DeliveryAgentTaskSerializer(task, context={"request": request}).data,
                status=status.HTTP_200_OK,
            )
        except OperationalError as exc:
            msg = str(exc).lower()
            if "deadlock detected" in msg or "could not obtain lock" in msg or "lock timeout" in msg:
                return Response(
                    {"detail": "A concurrent update conflict occurred. Please retry your request."},
                    status=status.HTTP_409_CONFLICT,
                )
            raise

    @action(detail=True, methods=["post"], url_path="fail")
    def fail(self, request, pk=None):
        serializer = DeliveryAgentTaskFailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data["reason"]

        agent = self.get_agent()

        try:
            with transaction.atomic():
                task_info = (
                    DeliveryTask.objects.filter(pk=pk, delivery_agent=agent)
                    .values("id", "order_id", "task_type", "status")
                    .first()
                )
                if not task_info:
                    raise Http404("Task not found.")

                order_id = task_info["order_id"]

                order = (
                    Order.objects.select_for_update()
                    .filter(pk=order_id)
                    .first()
                )
                if not order:
                    raise Http404("Order not found.")

                task = (
                    DeliveryTask.objects.select_for_update(of=("self",))
                    .filter(pk=pk, delivery_agent=agent)
                    .first()
                )
                if not task:
                    raise Http404("Task not found.")

                if task.order_id != order.id:
                    raise ValidationError({"task": "Task is no longer associated with this order."})

                task.order = order

                if task.status in DeliveryTask.TERMINAL_STATUSES:
                    raise ValidationError({
                        "status": f"Cannot report failure for task in terminal status '{task.status}'."
                    })

                if order.order_status in Order.TERMINAL_STATUSES:
                    raise ValidationError({
                        "order": f"Cannot report failure for order in terminal status '{order.order_status}'."
                    })

                if task.status not in {DeliveryTask.STATUS_ASSIGNED, DeliveryTask.STATUS_IN_PROGRESS}:
                    raise ValidationError({
                        "status": (
                            f"Cannot report failure for task in '{task.status}' status. "
                            "Only 'assigned' or 'in_progress' tasks can be marked as failed."
                        )
                    })

                now = timezone.now()

                if task.task_type == DeliveryTask.TASK_TYPE_DELIVERY:
                    DeliveryVerificationOTP.objects.filter(
                        task=task,
                        verified_at__isnull=True,
                        invalidated_at__isnull=True,
                    ).update(invalidated_at=now)

                task.status = DeliveryTask.STATUS_FAILED
                task.failure_reason = reason
                task.completed_at = None
                task.save(update_fields=["status", "failure_reason", "completed_at", "updated_at"])

                _log_otp_audit(
                    request,
                    task,
                    agent,
                    DeliveryOTPAuditLog.ACTION_TASK_FAILED,
                    f"Task marked failed ({task.task_type}): {reason[:200]}",
                )

            return Response(
                DeliveryAgentTaskSerializer(task, context={"request": request}).data,
                status=status.HTTP_200_OK,
            )
        except OperationalError as exc:
            msg = str(exc).lower()
            if "deadlock detected" in msg or "could not obtain lock" in msg or "lock timeout" in msg:
                return Response(
                    {"detail": "A concurrent update conflict occurred. Please retry your request."},
                    status=status.HTTP_409_CONFLICT,
                )
            raise
