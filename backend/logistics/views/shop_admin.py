from django.db import transaction
from django.db.models import Q
from django.http import Http404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from logistics.models import DeliveryAgent, DeliveryTask
from logistics.serializers.shop_admin import (
    DeliveryAgentSerializer,
    ShopAdminDeliveryAgentRegisterSerializer,
    ShopAdminDeliveryAgentUpdateSerializer,
    ShopAdminDeliveryTaskAssignSerializer,
    ShopAdminDeliveryTaskSerializer,
    ShopAdminDeliveryTaskUnassignSerializer,
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


class ShopAdminDeliveryTaskViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Shop Admin endpoint to list, retrieve, assign, and unassign delivery tasks.
    Strictly tenant-scoped to the authenticated Shop Admin's approved shop.
    """

    permission_classes = [IsAuthenticated, IsShopAdmin]
    http_method_names = ["get", "post", "head", "options"]

    def get_shop(self):
        user = self.request.user
        try:
            shop = user.shop
        except Exception:
            raise PermissionDenied("You are not linked to a shop.")
        if not shop.is_approved:
            raise PermissionDenied("Only approved shops can manage delivery tasks.")
        return shop

    def get_serializer_class(self):
        if self.action == "assign":
            return ShopAdminDeliveryTaskAssignSerializer
        if self.action == "unassign":
            return ShopAdminDeliveryTaskUnassignSerializer
        return ShopAdminDeliveryTaskSerializer

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
            return DeliveryTask.objects.none()

        shop = self.get_shop()
        queryset = (
            DeliveryTask.objects.filter(order__shop=shop)
            .select_related(
                "order__customer",
                "order__shop",
                "delivery_agent__user",
                "delivery_agent__shop",
            )
            .order_by("-created_at")
        )

        task_type = self.request.query_params.get("task_type")
        if task_type:
            queryset = queryset.filter(task_type=task_type.strip().lower())

        task_status = self.request.query_params.get("status")
        if task_status:
            queryset = queryset.filter(status=task_status.strip().lower())

        agent_id = self.request.query_params.get("delivery_agent_id")
        if agent_id:
            try:
                queryset = queryset.filter(delivery_agent_id=int(agent_id))
            except (ValueError, TypeError):
                pass

        is_assigned = self.request.query_params.get("is_assigned")
        if is_assigned is not None and is_assigned != "":
            if is_assigned.lower() in ["true", "1"]:
                queryset = queryset.filter(delivery_agent__isnull=False)
            elif is_assigned.lower() in ["false", "0"]:
                queryset = queryset.filter(delivery_agent__isnull=True)

        search = self.request.query_params.get("search")
        if search:
            search = search.strip()
            queryset = queryset.filter(
                Q(order__order_number__icontains=search)
                | Q(order__customer__first_name__icontains=search)
                | Q(order__customer__last_name__icontains=search)
                | Q(order__customer__username__icontains=search)
                | Q(order__customer__phone_number__icontains=search)
                | Q(order__pickup_address_line__icontains=search)
                | Q(order__pickup_city__icontains=search)
            )

        return queryset

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        shop = self.get_shop()
        with transaction.atomic():
            task = (
                DeliveryTask.objects.select_for_update(of=("self",))
                .filter(pk=pk, order__shop=shop)
                .first()
            )
            if not task:
                raise Http404

            serializer = ShopAdminDeliveryTaskAssignSerializer(
                data=request.data,
                context={"task": task, "shop": shop, "request": request},
            )
            serializer.is_valid(raise_exception=True)
            updated_task = serializer.save()

        return Response(
            ShopAdminDeliveryTaskSerializer(updated_task, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="unassign")
    def unassign(self, request, pk=None):
        shop = self.get_shop()
        with transaction.atomic():
            task = (
                DeliveryTask.objects.select_for_update(of=("self",))
                .filter(pk=pk, order__shop=shop)
                .first()
            )
            if not task:
                raise Http404

            serializer = ShopAdminDeliveryTaskUnassignSerializer(
                data=request.data,
                context={"task": task, "shop": shop, "request": request},
            )
            serializer.is_valid(raise_exception=True)
            updated_task = serializer.save()

        return Response(
            ShopAdminDeliveryTaskSerializer(updated_task, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )
