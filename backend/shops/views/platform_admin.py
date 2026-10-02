from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from orders.models import Order, OrderItem
from shops.models import Service, ServiceRequest, Shop, ShopApplication
from shops.serializers import (
    PlatformAdminServiceSerializer,
    PlatformAdminShopDetailSerializer,
    PlatformAdminShopListSerializer,
    ShopOperationalStatusSerializer,
    PlatformServiceRequestDetailSerializer,
    PlatformServiceRequestListSerializer,
    PlatformShopApplicationDetailSerializer,
    PlatformShopApplicationListSerializer,
    ShopApplicationSerializer,
    ShopApplicationStatusSerializer,
)
from shops.services import (
    approve_service_request,
    approve_shop_application,
    generate_application_token,
    reject_shop_application,
)
from users.models import User
from users.permissions import IsPlatformAdmin


class PublicShopApplicationViewSet(viewsets.GenericViewSet):
    permission_classes = [AllowAny]
    authentication_classes = []
    queryset = ShopApplication.objects.all()
    lookup_field = "public_id"
    lookup_url_kwarg = "public_id"

    def get_serializer_class(self):
        return ShopApplicationSerializer

    def _get_authorized_application(self):
        try:
            application = self.get_object()
        except (ShopApplication.DoesNotExist, ValueError):
            raise NotFound("Application not found.")

        token = self.request.headers.get("X-Application-Token")
        if not token or not application.check_access_token(token):
            raise NotFound("Application not found.")
        return application

    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        raw_token = generate_application_token()
        application = serializer.save(
            access_token_hash=make_password(raw_token),
        )

        return Response(
            {
                "application": ShopApplicationSerializer(application).data,
                "access_token": raw_token,
            },
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request, *args, **kwargs):
        application = self._get_authorized_application()
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=["patch"], url_path="update")
    def update_draft(self, request, *args, **kwargs):
        application = self._get_authorized_application()

        with transaction.atomic():
            application = ShopApplication.objects.select_for_update().get(
                pk=application.pk
            )

            token = request.headers.get("X-Application-Token")
            if not token or not application.check_access_token(token):
                raise NotFound("Application not found.")

            if application.status != ShopApplication.STATUS_DRAFT:
                raise ValidationError(
                    {"status": "Only draft applications can be edited."}
                )

            serializer = self.get_serializer(
                application,
                data=request.data,
                partial=True,
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()

        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def submit(self, request, *args, **kwargs):
        application = self._get_authorized_application()
        try:
            with transaction.atomic():
                application = ShopApplication.objects.select_for_update().get(
                    pk=application.pk
                )
                application.validate_for_submission()
                application.transition_to(ShopApplication.STATUS_SUBMITTED)
                application.save(update_fields=["status", "updated_at"])
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict)
        except ValueError as exc:
            raise ValidationError({"status": str(exc)})

        return Response(ShopApplicationSerializer(application).data)


class PlatformShopApplicationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    queryset = ShopApplication.objects.select_related(
        "reviewed_by",
        "approved_user",
        "created_shop",
    ).prefetch_related("notifications")
    lookup_field = "public_id"
    lookup_url_kwarg = "public_id"

    def get_serializer_class(self):
        if self.action == "list":
            return PlatformShopApplicationListSerializer
        return PlatformShopApplicationDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        application_status = self.request.query_params.get("status")
        if application_status:
            queryset = queryset.filter(status=application_status)
        return queryset

    def _transition_to_review(self, application):
        try:
            with transaction.atomic():
                locked = ShopApplication.objects.select_for_update().get(
                    pk=application.pk
                )
                locked.transition_to(ShopApplication.STATUS_UNDER_REVIEW)
                locked.save(update_fields=["status", "updated_at"])
                return locked
        except ValueError as exc:
            raise ValidationError({"status": str(exc)})

    @action(detail=True, methods=["post"], url_path="under-review")
    def under_review(self, request, public_id=None):
        application = self._transition_to_review(self.get_object())
        return Response(PlatformShopApplicationDetailSerializer(application).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, public_id=None):
        try:
            application, user, shop, notification = approve_shop_application(
                self.get_object().pk,
                request.user,
            )
        except (ShopApplication.DoesNotExist, ValueError) as exc:
            raise ValidationError({"status": str(exc)})

        return Response(
            {
                "application": PlatformShopApplicationDetailSerializer(
                    application
                ).data,
                "shop_id": shop.pk,
                "shop_admin_username": user.username,
                "notification": {
                    "status": notification.status,
                    "delivered": notification.status == "sent",
                    "attempts": notification.attempts,
                },
            }
        )

    @action(detail=True, methods=["post"])
    def reject(self, request, public_id=None):
        serializer = ShopApplicationStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            application, notification = reject_shop_application(
                self.get_object().pk,
                request.user,
                serializer.validated_data.get("rejection_reason"),
            )
        except (ShopApplication.DoesNotExist, ValueError) as exc:
            raise ValidationError({"status": str(exc)})
        return Response({
            "application": PlatformShopApplicationDetailSerializer(application).data,
            "notification": {
                "status": notification.status,
                "delivered": notification.status == "sent",
                "attempts": notification.attempts,
            },
        })


class PlatformServiceRequestViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    queryset = ServiceRequest.objects.select_related(
        "shop",
        "requested_by",
        "reviewed_by",
        "approved_service",
    )

    def get_serializer_class(self):
        if self.action == "list":
            return PlatformServiceRequestListSerializer
        return PlatformServiceRequestDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        request_status = self.request.query_params.get("status")
        if request_status:
            queryset = queryset.filter(status=request_status)
        shop_id = self.request.query_params.get("shop")
        if shop_id:
            try:
                shop_id = int(shop_id)
                if shop_id < 1:
                    raise ValueError
            except (TypeError, ValueError):
                raise ValidationError({"shop": "shop must be a positive integer."})
            queryset = queryset.filter(shop_id=shop_id)
        return queryset

    @action(detail=True, methods=["post"], url_path="under-review")
    def under_review(self, request, pk=None):
        try:
            with transaction.atomic():
                service_request = ServiceRequest.objects.select_for_update().get(
                    pk=self.get_object().pk
                )
                service_request.transition_to(
                    ServiceRequest.STATUS_UNDER_REVIEW
                )
                service_request.save(update_fields=["status", "updated_at"])
        except (ServiceRequest.DoesNotExist, ValueError) as exc:
            raise ValidationError({"status": str(exc)})
        return Response(PlatformServiceRequestDetailSerializer(service_request).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        try:
            service_request, service = approve_service_request(
                self.get_object().pk,
                request.user,
            )
        except (ServiceRequest.DoesNotExist, ValueError) as exc:
            raise ValidationError({"status": str(exc)})
        return Response(
            {
                "request": PlatformServiceRequestDetailSerializer(
                    service_request
                ).data,
                "service_id": service.pk,
            }
        )

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        serializer = ShopApplicationStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                service_request = ServiceRequest.objects.select_for_update().get(
                    pk=self.get_object().pk
                )
                service_request.transition_to(
                    ServiceRequest.STATUS_REJECTED,
                    reviewer=request.user,
                    reason=serializer.validated_data.get("rejection_reason"),
                )
                service_request.save(
                    update_fields=[
                        "status",
                        "rejection_reason",
                        "reviewed_by",
                        "reviewed_at",
                        "updated_at",
                    ]
                )
        except (ServiceRequest.DoesNotExist, ValueError) as exc:
            raise ValidationError({"status": str(exc)})
        return Response(PlatformServiceRequestDetailSerializer(service_request).data)


class PlatformServiceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    serializer_class = PlatformAdminServiceSerializer
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_queryset(self):
        return Service.objects.annotate(
            shop_count=Count("shop_services__shop", distinct=True),
            order_item_count=Count("shop_services__order_items", distinct=True),
        ).order_by("service_name")


class PlatformShopViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    queryset = Shop.objects.filter(is_approved=True).select_related("shop_admin")

    def get_serializer_class(self):
        if self.action == "list":
            return PlatformAdminShopListSerializer
        return PlatformAdminShopDetailSerializer

    @action(detail=True, methods=["post"], url_path="operational-status")
    def operational_status(self, request, pk=None):
        serializer = ShopOperationalStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shop = self.get_object()
        shop.is_open = serializer.validated_data["is_open"]
        shop.save(update_fields=["is_open", "updated_at"])
        return Response(PlatformAdminShopDetailSerializer(shop).data)


class PlatformDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get(self, request):
        from django.db.models.functions import TruncDate

        orders = Order.objects.all()
        non_cancelled_orders = orders.exclude(order_status="cancelled")
        active_statuses = [
            value
            for value, _ in Order.ORDER_STATUS
            if value not in {"delivered", "cancelled"}
        ]

        period_days = request.query_params.get("days", "30")
        try:
            period_days = max(1, min(int(period_days), 365))
        except ValueError:
            raise ValidationError({"days": "days must be an integer."})

        since = timezone.now() - timedelta(days=period_days)

        def trend(queryset):
            return [
                {"date": row["date"].isoformat(), "count": row["count"]}
                for row in queryset
            ]

        order_trend = trend(
            orders.filter(created_at__gte=since)
            .annotate(date=TruncDate("created_at"))
            .values("date")
            .annotate(count=Count("id"))
            .order_by("date")
        )
        customer_trend = trend(
            User.objects.filter(
                role="customer",
                date_joined__gte=since,
            )
            .annotate(date=TruncDate("date_joined"))
            .values("date")
            .annotate(count=Count("id"))
            .order_by("date")
        )
        shop_trend = trend(
            Shop.objects.filter(created_at__gte=since)
            .annotate(date=TruncDate("created_at"))
            .values("date")
            .annotate(count=Count("id"))
            .order_by("date")
        )

        gross_order_value = non_cancelled_orders.aggregate(
            total=Sum("total_amount")
        )["total"] or 0

        top_shops = list(
            non_cancelled_orders.values("shop_id", "shop__shop_name")
            .annotate(order_count=Count("id"), order_value=Sum("total_amount"))
            .order_by("-order_count", "-order_value")[:10]
        )
        popular_services = list(
            OrderItem.objects.filter(
                item_status="active",
                order__order_status__in=[
                    value for value, _ in Order.ORDER_STATUS
                    if value != "cancelled"
                ],
            )
            .values("service_name_snapshot")
            .annotate(
                item_count=Sum("quantity"),
                order_count=Count("order", distinct=True),
            )
            .order_by("-item_count", "service_name_snapshot")[:10]
        )

        return Response({
            "operational": {
                "total_orders": orders.count(),
                "pending_orders": orders.filter(order_status="placed").count(),
                "active_orders": orders.filter(order_status__in=active_statuses).count(),
                "completed_orders": orders.filter(order_status="delivered").count(),
                "cancelled_orders": orders.filter(order_status="cancelled").count(),
                "pending_shop_applications": ShopApplication.objects.filter(
                    status__in=["submitted", "under_review"]
                ).count(),
                "approved_shops": Shop.objects.filter(is_approved=True).count(),
                "pending_service_requests": ServiceRequest.objects.filter(
                    status__in=["pending", "under_review"]
                ).count(),
                "active_shops": Shop.objects.filter(
                    is_approved=True,
                    is_open=True,
                ).count(),
            },
            "business": {
                "gross_order_value": gross_order_value,
                "order_count_trend": order_trend,
                "customer_growth": customer_trend,
                "shop_growth": shop_trend,
                "top_shops": top_shops,
                "popular_services": popular_services,
            },
        })
