from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet
from rest_framework.decorators import action
from rest_framework.response import Response

from orders.models import Order
from orders.serializers import (
    CustomerOrderCreateSerializer,
    CustomerOrderListSerializer,
    CustomerOrderDetailSerializer,
    CustomerOrderTrackingSerializer,
)


class CustomerOrderViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(customer=self.request.user)

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
