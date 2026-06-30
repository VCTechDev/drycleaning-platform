from django.contrib import admin
from .models import *

# Register your models here.


class ShopAdmin(admin.ModelAdmin):
    list_display = (
        "shop_admin",
        "shop_name",
        "description",
        "image",
        "contact_number",
        "address_line",
        "city",
        "district",
        "state",
        "pincode",
        "opening_time",
        "closing_time",
        "is_approved",
        "is_open",
        "created_at",
        "updated_at",
    )


admin.site.register(Shop, ShopAdmin)


class ServiceView(admin.ModelAdmin):
    list_display = (
        "service_name",
        "description",
        "image",
        "is_active",
        "created_at",
        "updated_at",
    )

    list_filter = (
        "service_name",
        "is_active",
    )


admin.site.register(Service, ServiceView)


class ShopServiceView(admin.ModelAdmin):

    list_display = ("shop", "service", "price", "estimated_days", "is_active")

    list_filter=(
        "shop", 
        "service",
    )


admin.site.register(ShopService, ShopServiceView)


class GarmentTypeView(admin.ModelAdmin):
    list_display = (
        "garment_name",
        "description",
        "image",
        "is_active",
        "created_at",
        "updated_at",
    )


admin.site.register(GarmentType, GarmentTypeView)
