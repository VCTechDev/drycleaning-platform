from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from accounts.serializers import PlatformAdminProfileSerializer
from users.permissions import IsPlatformAdmin


class PlatformAdminProfileViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):

    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    serializer_class = PlatformAdminProfileSerializer

    def get_object(self):
        return self.request.user
