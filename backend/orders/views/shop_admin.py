from django.db import transaction
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from orders.models import Order
from orders.serializers import (
    ShopAdminOrderDetailSerializer,
    ShopAdminOrderListSerializer,
    ShopAdminOrderRejectSerializer,
)
from users.permissions import IsShopAdmin


class ShopAdminOrderViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsShopAdmin]
    http_method_names = ["get", "post", "head", "options"]

    def get_shop(self):
        try:
            shop = self.request.user.shop
        except Exception:
            raise PermissionDenied("You are not linked to a shop.")
        if not shop.is_approved:
            raise PermissionDenied("Only approved shops can manage orders.")
        return shop

    def get_serializer_class(self):
        if self.action == "list":
            return ShopAdminOrderListSerializer
        return ShopAdminOrderDetailSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or user.role != "shop_admin":
            return Order.objects.none()
        shop = self.get_shop()

        queryset = (
            Order.objects.filter(shop=shop)
            .select_related("customer", "shop")
            .prefetch_related(
                "order_items__shop_service__garment_type",
                "order_items__shop_service__service",
                "status_history",
                "delivery_tasks__delivery_agent__user",
            )
            .order_by("-created_at")
        )

        status = self.request.query_params.get("status")
        if status:
            queryset = queryset.filter(order_status=status)

        payment_status = self.request.query_params.get("payment_status")
        if payment_status:
            queryset = queryset.filter(payment_status=payment_status)

        search = self.request.query_params.get("search")
        if search:
            search = search.strip()
            queryset = queryset.filter(
                Q(order_number__icontains=search)
                | Q(customer__username__icontains=search)
                | Q(customer__email__icontains=search)
                | Q(customer__phone_number__icontains=search)
                | Q(customer__first_name__icontains=search)
                | Q(customer__last_name__icontains=search)
            )

        return queryset

    @action(detail=True, methods=["post"], url_path="accept")
    def accept(self, request, pk=None):
        shop = self.get_shop()
        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .filter(pk=pk, shop=shop)
                .first()
            )
            if not order:
                return Response(
                    {"detail": "Not found."},
                    status=404,
                )
            if order.order_status != Order.STATUS_PLACED:
                raise ValidationError(
                    {
                        "order_status": (
                            f"Cannot accept order in '{order.order_status}' status. "
                            "Only 'placed' orders can be accepted."
                        )
                    }
                )
            order.transition_to(Order.STATUS_ACCEPTED, by_user=request.user)
            order.save()
        return Response(
            ShopAdminOrderDetailSerializer(
                order,
                context={"request": request},
            ).data
        )

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        shop = self.get_shop()
        serializer = ShopAdminOrderRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data["reason"]

        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .filter(pk=pk, shop=shop)
                .first()
            )
            if not order:
                return Response(
                    {"detail": "Not found."},
                    status=404,
                )
            if order.order_status != Order.STATUS_PLACED:
                raise ValidationError(
                    {
                        "order_status": (
                            f"Cannot reject order in '{order.order_status}' status. "
                            "Only 'placed' orders can be rejected."
                        )
                    }
                )
            order.transition_to(
                Order.STATUS_REJECTED,
                by_user=request.user,
                reason=reason,
            )
            order.save()
        return Response(
            ShopAdminOrderDetailSerializer(
                order,
                context={"request": request},
            ).data
        )

    @action(detail=True, methods=["post"], url_path="start-processing")
    def start_processing(self, request, pk=None):
        shop = self.get_shop()
        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .filter(pk=pk, shop=shop)
                .first()
            )
            if not order:
                return Response(
                    {"detail": "Not found."},
                    status=404,
                )
            if order.order_status != Order.STATUS_PICKED_UP:
                raise ValidationError(
                    {
                        "order_status": (
                            f"Cannot start processing order in '{order.order_status}' status. "
                            "Garments must be physically picked up ('picked_up') first."
                        )
                    }
                )
            order.transition_to(Order.STATUS_PROCESSING, by_user=request.user)
            order.save()
        return Response(
            ShopAdminOrderDetailSerializer(
                order,
                context={"request": request},
            ).data
        )

    @action(detail=True, methods=["post"], url_path="ready")
    def ready(self, request, pk=None):
        shop = self.get_shop()
        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .filter(pk=pk, shop=shop)
                .first()
            )
            if not order:
                return Response(
                    {"detail": "Not found."},
                    status=404,
                )
            if order.order_status != Order.STATUS_PROCESSING:
                raise ValidationError(
                    {
                        "order_status": (
                            f"Cannot mark order ready in '{order.order_status}' status. "
                            "Order must be in 'processing' status first."
                        )
                    }
                )
            order.transition_to(Order.STATUS_READY, by_user=request.user)
            order.save()
        return Response(
            ShopAdminOrderDetailSerializer(
                order,
                context={"request": request},
            ).data
        )
