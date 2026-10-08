from rest_framework import mixins, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from django.db.models.functions import Lower, Trim

from shops.models import Service, ServiceRequest, Shop, ShopService
from shops.serializers import (
    ServiceRequestCreateSerializer,
    ShopAdminServiceRequestSerializer,
    ShopAdminServiceSerializer,
    ShopAdminShopServiceSerializer,
)
from users.permissions import IsShopAdmin


class ShopAdminServiceViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsShopAdmin]
    serializer_class = ShopAdminServiceSerializer

    def get_queryset(self):
        return Service.objects.filter(is_active=True).order_by("service_name")


class ShopAdminShopServiceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsShopAdmin]
    serializer_class = ShopAdminShopServiceSerializer
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_shop(self):
        try:
            shop = self.request.user.shop
        except Shop.DoesNotExist:
            raise PermissionDenied("You are not linked to a shop.")
        if not shop.is_approved:
            raise PermissionDenied("Only approved shops can manage services.")
        return shop

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return ShopService.objects.none()
        try:
            shop_id = self.request.user.shop.id
        except Shop.DoesNotExist:
            return ShopService.objects.none()
        return ShopService.objects.filter(shop_id=shop_id).select_related(
            "service",
            "garment_type",
        )

    def perform_create(self, serializer):
        serializer.save(shop=self.get_shop())


class ShopAdminServiceRequestViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsShopAdmin]

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return ServiceRequest.objects.none()
        try:
            shop_id = self.request.user.shop.id
        except Shop.DoesNotExist:
            return ServiceRequest.objects.none()
        return ServiceRequest.objects.filter(shop_id=shop_id).select_related(
            "approved_service"
        )

    def get_serializer_class(self):
        if self.action == "create":
            return ServiceRequestCreateSerializer
        return ShopAdminServiceRequestSerializer

    def perform_create(self, serializer):
        try:
            shop = self.request.user.shop
        except Shop.DoesNotExist:
            raise PermissionDenied("You are not linked to a shop.")
        if not shop.is_approved:
            raise PermissionDenied("Only approved shops can request services.")

        service_name = serializer.validated_data["service_name"]
        if ServiceRequest.objects.annotate(
            _normalized_name=Lower(Trim("service_name")),
        ).filter(
            shop=shop,
            _normalized_name=service_name.casefold(),
            status__in=[
                ServiceRequest.STATUS_PENDING,
                ServiceRequest.STATUS_UNDER_REVIEW,
            ],
        ).exists():
            raise ValidationError(
                {
                    "service_name": (
                        "An active request for this service already exists."
                    )
                }
            )
        if Service.objects.annotate(
            _normalized_name=Lower(Trim("service_name")),
        ).filter(_normalized_name=service_name.casefold()).exists():
            raise ValidationError(
                {
                    "service_name": (
                        "This service already exists. Add it through the "
                        "shop service management endpoint."
                    )
                }
            )
        serializer.save(shop=shop, requested_by=self.request.user)
