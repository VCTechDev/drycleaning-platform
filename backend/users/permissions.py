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


class IsDeliveryAgent(BasePermission):

    def has_permission(self, request, view):
        if not (
            request.user.is_authenticated
            and request.user.is_active
            and request.user.role == "delivery_agent"
        ):
            return False
        try:
            from logistics.models import DeliveryAgent
            return DeliveryAgent.objects.filter(user=request.user, is_active=True).exists()
        except Exception:
            return False

    def has_object_permission(self, request, view, obj):
        if not self.has_permission(request, view):
            return False
        try:
            from logistics.models import DeliveryAgent
            agent = DeliveryAgent.objects.filter(user=request.user, is_active=True).first()
            if not agent:
                return False
        except Exception:
            return False

        if hasattr(obj, "delivery_agent"):
            return obj.delivery_agent == agent
        if hasattr(obj, "user"):
            return obj.user == request.user
        return obj == agent
