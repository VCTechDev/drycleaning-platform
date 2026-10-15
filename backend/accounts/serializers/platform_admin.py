from rest_framework import serializers

from .customer import CustomerProfileSerializer


class PlatformAdminProfileSerializer(CustomerProfileSerializer):
    username = serializers.CharField(read_only=True)
