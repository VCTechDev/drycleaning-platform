from rest_framework.permissions import BasePermission


class IsCustomer(BasePermission):

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == "customer"
        )


class IsPlatformAdmin(BasePermission):
    
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == "platform_admin"
        )


class IsShopAdmin(BasePermission):

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == "shop_admin"
        )

    def has_object_permission(self, request, view, obj):
        if not (request.user.is_authenticated and request.user.role == "shop_admin"):
            return False
        try:
            shop = request.user.shop
        except Exception:
            return False

        if hasattr(obj, "shop"):
            return obj.shop == shop
        if hasattr(obj, "shop_admin"):
            return obj.shop_admin == request.user
        return obj == shop
