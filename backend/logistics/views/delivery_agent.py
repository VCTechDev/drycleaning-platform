from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import OperationalError, transaction
from django.http import Http404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from logistics.models import DeliveryAgent, DeliveryTask
from logistics.serializers.delivery_agent import (
    DeliveryAgentAvailabilitySerializer,
    DeliveryAgentTaskSerializer,
)
from orders.models import Order
from users.permissions import IsDeliveryAgent


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

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
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
                        "status": f"Cannot complete task in terminal status '{task.status}'."
                    })

                if order.order_status in Order.TERMINAL_STATUSES:
                    raise ValidationError({
                        "order": f"Cannot complete task for an order in terminal status '{order.order_status}'."
                    })

                # Validate task status
                if task.status != DeliveryTask.STATUS_IN_PROGRESS:
                    raise ValidationError({
                        "status": f"Cannot complete task in '{task.status}' status. Only 'in_progress' tasks can be completed."
                    })

                # Validate task type & order status alignment
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
                task.completed_at = timezone.now()
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
