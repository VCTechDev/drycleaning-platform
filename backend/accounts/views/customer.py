from rest_framework import mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from accounts.serializers import CustomerProfileSerializer
from users.permissions import IsCustomer


class CustomerProfileViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):

    permission_classes = [IsAuthenticated, IsCustomer]
    serializer_class=CustomerProfileSerializer

    def get_object(self):
        return self.request.user
