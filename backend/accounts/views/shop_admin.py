from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from accounts.serializers import ShopAdminProfileSerializer
from users.permissions import IsShopAdmin


class ShopAdminProfileViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsShopAdmin]
    serializer_class = ShopAdminProfileSerializer

    def get_object(self):
        return self.request.user
