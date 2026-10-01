from django.db.models import Prefetch
from rest_framework import mixins
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
