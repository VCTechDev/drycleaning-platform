from django.db import OperationalError, transaction
from django.db.models import Prefetch
from django.http import Http404
from rest_framework import mixins
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from orders.models import Order, OrderItem
from orders.serializers import (
    CustomerOrderCreateSerializer,
    CustomerOrderListSerializer,
    CustomerOrderDetailSerializer,
    CustomerOrderTrackingSerializer,
)
from users.permissions import IsCustomer


class CustomerOrderViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsCustomer]

    def get_queryset(self):
        order_items = OrderItem.objects.select_related(
            "shop_service__garment_type",
        )

        return (
            Order.objects.filter(customer=self.request.user)
            .select_related("shop")
            .prefetch_related(
                Prefetch("order_items", queryset=order_items),
            )
            .order_by("-created_at")
        )

    def get_serializer_class(self):

        if self.action == "create":
            return CustomerOrderCreateSerializer

        elif self.action == "list":
            return CustomerOrderListSerializer

        elif self.action == "retrieve":
            return CustomerOrderDetailSerializer

        return CustomerOrderCreateSerializer

    def perform_create(self, serializer):
        serializer.save(customer=self.request.user)

    @action(
        detail=True,
        methods=["get"],
        url_path="tracking",
    )
    def tracking(self, request, pk=None):

        order = self.get_object()
        serializer = CustomerOrderTrackingSerializer(order)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="cancel",
    )
    def cancel(self, request, pk=None):
        try:
            with transaction.atomic():
                order = (
                    Order.objects.select_for_update()
                    .filter(pk=pk, customer=request.user)
                    .first()
                )
                if not order:
                    raise Http404

                if order.order_status in {
                    Order.STATUS_PICKED_UP,
                    Order.STATUS_PROCESSING,
                    Order.STATUS_READY,
                    Order.STATUS_DELIVERED,
                }:
                    raise ValidationError(
                        {
                            "order_status": (
                                "Order cannot be cancelled after physical pickup has occurred."
                            )
                        }
                    )

                if order.order_status in Order.TERMINAL_STATUSES:
                    raise ValidationError(
                        {
                            "order_status": (
                                f"Order is already in a terminal state ({order.order_status})."
                            )
                        }
                    )

                if order.order_status not in {
                    Order.STATUS_PLACED,
                    Order.STATUS_ACCEPTED,
                    Order.STATUS_PICKUP_SCHEDULED,
                }:
                    raise ValidationError(
                        {
                            "order_status": (
                                f"Order cannot be cancelled in '{order.order_status}' status."
                            )
                        }
                    )

                pickup_task = (
                    order.delivery_tasks.select_for_update(of=("self",))
                    .filter(task_type="pickup")
                    .first()
                )
                if pickup_task:
                    if pickup_task.status == "completed":
                        raise ValidationError(
                            {
                                "order_status": (
                                    "Order cannot be cancelled after physical pickup has occurred."
                                )
                            }
                        )
                    if pickup_task.status == "in_progress":
                        raise ValidationError(
                            {
                                "order_status": (
                                    "Order cannot be cancelled while physical pickup is in progress."
                                )
                            }
                        )
                    if pickup_task.status in {"unassigned", "assigned"}:
                        pickup_task.status = "cancelled"
                        pickup_task.save(update_fields=["status", "updated_at"])

                order.transition_to(Order.STATUS_CANCELLED, by_user=request.user)
                order.save()

            return Response(
                CustomerOrderDetailSerializer(
                    order,
                    context={"request": request},
                ).data
            )
        except OperationalError as exc:
            msg = str(exc).lower()
            if "deadlock detected" in msg or "could not obtain lock" in msg or "lock timeout" in msg:
                return Response(
                    {"detail": "A concurrent update conflict occurred. Please retry your request."},
                    status=409,
                )
            raise
