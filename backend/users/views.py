from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from users.models import User
from users.permissions import IsPlatformAdmin
from users.serializers import PlatformAdminUserSerializer


class PlatformAdminUserViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    serializer_class = PlatformAdminUserSerializer

    def get_queryset(self):
        queryset = User.objects.filter(
            role__in=("customer", "shop_admin", "delivery_agent")
        ).select_related("shop").order_by("-date_joined")

        role = self.request.query_params.get("role")
        if role:
            if role not in {"customer", "shop_admin", "delivery_agent"}:
                raise ValidationError({"role": "Unsupported user role."})
            queryset = queryset.filter(role=role)

        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            normalized_is_active = is_active.lower()
            if normalized_is_active not in {"true", "false"}:
                raise ValidationError(
                    {"is_active": "Use true or false."}
                )
            queryset = queryset.filter(
                is_active=normalized_is_active == "true"
            )

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )
        return queryset
