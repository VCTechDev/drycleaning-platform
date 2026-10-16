from rest_framework import serializers

from .customer import CustomerProfileSerializer


class ShopAdminProfileSerializer(CustomerProfileSerializer):
    username = serializers.CharField(read_only=True)
    role = serializers.CharField(read_only=True)
    shop_id = serializers.SerializerMethodField()
    shop_name = serializers.SerializerMethodField()
    is_shop_approved = serializers.SerializerMethodField()
    is_shop_open = serializers.SerializerMethodField()

    class Meta(CustomerProfileSerializer.Meta):
        fields = CustomerProfileSerializer.Meta.fields + (
            "role",
            "shop_id",
            "shop_name",
            "is_shop_approved",
            "is_shop_open",
        )
        read_only_fields = (
            "username",
            "role",
            "shop_id",
            "shop_name",
            "is_shop_approved",
            "is_shop_open",
        )

    def get_shop_id(self, obj):
        shop = getattr(obj, "shop", None)
        return shop.id if shop else None

    def get_shop_name(self, obj):
        shop = getattr(obj, "shop", None)
        return shop.shop_name if shop else None

    def get_is_shop_approved(self, obj):
        shop = getattr(obj, "shop", None)
        return shop.is_approved if shop else False

    def get_is_shop_open(self, obj):
        shop = getattr(obj, "shop", None)
        return shop.is_open if shop else False
