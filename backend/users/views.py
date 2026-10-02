from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from users.models import User
from users.permissions import IsPlatformAdmin
from users.serializers import PlatformAdminUserSerializer


class PlatformAdminUserViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    serializer_class = PlatformAdminUserSerializer

    def get_queryset(self):
        queryset = User.objects.filter(
            role__in=("customer", "shop_admin", "delivery_agent")
        ).order_by("-date_joined")

        role = self.request.query_params.get("role")
        if role:
            if role not in {"customer", "shop_admin", "delivery_agent"}:
                raise ValidationError({"role": "Unsupported user role."})
            queryset = queryset.filter(role=role)

        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q

            queryset = queryset.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )
        return queryset
