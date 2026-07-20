from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from shops.models import Shop
from shops.serializers import (
    CustomerShopListSerializer,
    CustomerShopDetailSerializer,
    CustomerShopServiceSerializer,
)


class CustomerShopViewSet(ReadOnlyModelViewSet):

    queryset = Shop.objects.filter(
        is_approved=True,
        is_open=True,
    )

    serializer_class = CustomerShopListSerializer

    filter_backends = [SearchFilter]

    search_fields = [
        "shop_name",
        "district",
        "city",
    ]

    def get_serializer_class(self):

        if self.action == "retrieve":
            return CustomerShopDetailSerializer

        return CustomerShopListSerializer

    @action(
        detail=True,
        methods=["get"],
        url_path="services",
    )
    def services(self, request, pk=None):

        shop = self.get_object()

        queryset = shop.shop_services.filter(
            is_active=True,
        )

        serializer = CustomerShopServiceSerializer(
            queryset,
            many=True,
        )

        return Response(serializer.data)
