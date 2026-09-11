from django.db.models import F, Min, Q

from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from shops.models import Shop, Service
from shops.serializers import (
    CustomerShopListSerializer,
    CustomerShopDetailSerializer,
    CustomerShopServiceSerializer,
)


class CustomerShopViewSet(ReadOnlyModelViewSet):

    serializer_class = CustomerShopListSerializer

    filter_backends = [SearchFilter]

    search_fields = [
        "shop_name",
        "district",
        "city",
    ]

    def get_queryset(self):

        queryset = (
            Shop.objects.filter(is_approved=True)
            .annotate(
                starting_price=Min(
                    "shop_services__price",
                    filter=Q(
                        shop_services__is_active=True,
                    ),
                )
            )
            .order_by("-is_open", "shop_name")
        )

        # Search
        # Handled by DRF SearchFilter through ?search=

        # Open shops only
        open_now = self.request.query_params.get("open_now")

        if open_now == "true":
            queryset = queryset.filter(is_open=True)

        # District filter
        district = self.request.query_params.get("district")

        if district:
            queryset = queryset.filter(district=district)

        # Service availability filter
        service = self.request.query_params.get("service")

        if service:
            queryset = queryset.filter(
                shop_services__service_id=service,
                shop_services__is_active=True,
            )

        sort = self.request.query_params.get("sort")

        if sort == "price":
            queryset = queryset.order_by(
                "-is_open",
                F("starting_price").asc(nulls_last=True),
                "shop_name",
            )

        elif sort == "name":
            queryset = queryset.order_by(
                "-is_open",
                "shop_name",
            )

        else:
            queryset = queryset.order_by(
                "-is_open",
                "shop_name",
            )

        return queryset

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

    @action(
        detail=False,
        methods=["get"],
        url_path="filter-options",
    )
    def filter_options(self, request):

        districts = [
            {
                "value": value,
                "label": label,
            }
            for value, label in Shop.DISTRICT_CHOICES
        ]

        services = Service.objects.filter(is_active=True).values(
            "id",
            "service_name",
        )

        return Response(
            {
                "districts": districts,
                "services": list(services),
            }
        )
