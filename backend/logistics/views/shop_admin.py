from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from logistics.models import DeliveryAgent
from logistics.serializers.shop_admin import (
    DeliveryAgentSerializer,
    ShopAdminDeliveryAgentRegisterSerializer,
    ShopAdminDeliveryAgentUpdateSerializer,
)
from users.permissions import IsShopAdmin


class ShopAdminDeliveryAgentViewSet(viewsets.ModelViewSet):
    """
    Shop Admin endpoint to list, retrieve, register, and update delivery agents.
    Strictly isolated to the authenticated Shop Admin's approved shop.
    """

    permission_classes = [IsAuthenticated, IsShopAdmin]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_shop(self):
        user = self.request.user
        try:
            shop = user.shop
        except Exception:
            raise PermissionDenied("You are not linked to a shop.")
        if not shop.is_approved:
            raise PermissionDenied("Only approved shops can manage delivery agents.")
        return shop

    def get_serializer_class(self):
        if self.action == "create":
            return ShopAdminDeliveryAgentRegisterSerializer
        if self.action in ["partial_update", "update"]:
            return ShopAdminDeliveryAgentUpdateSerializer
        return DeliveryAgentSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request.user.is_authenticated and self.request.user.role == "shop_admin":
            try:
                context["shop"] = self.get_shop()
            except Exception:
                pass
        return context

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or user.role != "shop_admin":
            return DeliveryAgent.objects.none()

        shop = self.get_shop()
        queryset = (
            DeliveryAgent.objects.filter(shop=shop)
            .select_related("user", "shop")
            .prefetch_related("delivery_tasks")
            .order_by("-created_at")
        )

        search = self.request.query_params.get("search")
        if search:
            search = search.strip()
            queryset = queryset.filter(
                Q(user__username__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(user__email__icontains=search)
                | Q(user__phone_number__icontains=search)
            )

        is_active = self.request.query_params.get("is_active")
        if is_active is not None and is_active != "":
            if is_active.lower() in ["true", "1"]:
                queryset = queryset.filter(is_active=True)
            elif is_active.lower() in ["false", "0"]:
                queryset = queryset.filter(is_active=False)

        is_online = self.request.query_params.get("is_online")
        if is_online is not None and is_online != "":
            if is_online.lower() in ["true", "1"]:
                queryset = queryset.filter(is_online=True)
            elif is_online.lower() in ["false", "0"]:
                queryset = queryset.filter(is_online=False)

        return queryset

    def create(self, request, *args, **kwargs):
        shop = self.get_shop()
        serializer = self.get_serializer(
            data=request.data,
            context={"shop": shop, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        agent = serializer.save()
        return Response(
            DeliveryAgentSerializer(agent, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True,
            context={"shop": self.get_shop(), "request": request},
        )
        serializer.is_valid(raise_exception=True)
        updated_agent = serializer.save()
        return Response(
            DeliveryAgentSerializer(updated_agent, context={"request": request}).data
        )
