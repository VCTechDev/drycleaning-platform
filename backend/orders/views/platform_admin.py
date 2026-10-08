from django.utils.dateparse import parse_date
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from orders.models import Order, OrderItem, OrderStatusHistory
from orders.serializers import (
    PlatformAdminOrderDetailSerializer,
    PlatformAdminOrderListSerializer,
)
from users.permissions import IsPlatformAdmin


class PlatformAdminOrderViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get_serializer_class(self):
        if self.action == "list":
            return PlatformAdminOrderListSerializer
        return PlatformAdminOrderDetailSerializer

    def get_queryset(self):
        queryset = (
            Order.objects.select_related("customer", "shop", "shop__shop_admin")
            .prefetch_related(
                "order_items",
                "status_history",
                "delivery_tasks",
            )
            .order_by("-created_at")
        )

        order_status = self.request.query_params.get("status")
        if order_status:
            queryset = queryset.filter(order_status=order_status)

        payment_status = self.request.query_params.get("payment_status")
        if payment_status:
            queryset = queryset.filter(payment_status=payment_status)

        shop_id = self.request.query_params.get("shop")
        if shop_id:
            try:
                shop_id = int(shop_id)
                if shop_id < 1:
                    raise ValueError
            except (TypeError, ValueError):
                raise ValidationError({"shop": "shop must be a positive integer."})
            queryset = queryset.filter(shop_id=shop_id)

        for parameter, lookup in (
            ("created_from", "created_at__date__gte"),
            ("created_to", "created_at__date__lte"),
        ):
            value = self.request.query_params.get(parameter)
            if value:
                parsed = parse_date(value)
                if parsed is None:
                    raise ValidationError({parameter: "Use YYYY-MM-DD."})
                queryset = queryset.filter(**{lookup: parsed})

        return queryset
