from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from orders.filters import apply_order_filters, parse_order_date_filters
from orders.models import Order
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

    def get_base_queryset(self):
        return (
            Order.objects.select_related("customer", "shop", "shop__shop_admin")
            .prefetch_related(
                "order_items",
                "status_history",
                "delivery_tasks",
            )
            .order_by("-created_at")
        )

    def get_queryset(self):
        queryset, _ = apply_order_filters(
            self.get_base_queryset(),
            self.request.query_params,
        )
        return queryset

    @action(detail=False, methods=["get"], url_path="analytics")
    def analytics(self, request):
        date_filters = parse_order_date_filters(request.query_params)
        queryset, _ = apply_order_filters(
            self.get_base_queryset(),
            request.query_params,
            date_filters=date_filters,
        )

        gross_order_value = (
            queryset.exclude(order_status__in=["cancelled", "rejected"])
            .aggregate(total=Sum("total_amount"))["total"]
            or Decimal("0.00")
        )

        return Response(
            {
                "filters": {
                    "date_preset": date_filters.preset,
                    "created_from": (
                        date_filters.start_date.isoformat()
                        if date_filters.start_date
                        else None
                    ),
                    "created_to": (
                        date_filters.end_date.isoformat()
                        if date_filters.end_date
                        else None
                    ),
                    "timezone": timezone.get_current_timezone_name(),
                },
                "summary": {
                    "total_orders": queryset.count(),
                    "cancelled_orders": queryset.filter(
                        order_status="cancelled"
                    ).count(),
                    "rejected_orders": queryset.filter(
                        order_status="rejected"
                    ).count(),
                    "gross_order_value": gross_order_value,
                },
            }
        )
