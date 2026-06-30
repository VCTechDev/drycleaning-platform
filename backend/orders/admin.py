from django.contrib import admin
from .models import *

# Register your models here.


class OrderAdmin(admin.ModelAdmin):

    list_display = (
        "order_number",
        "customer",
        "shop",
        "total_amount",
        "order_status",
        "payment_status",
        "created_at",
    )

    readonly_fields = (
        "order_number",
        "total_amount",
    )

    search_fields = (
        "order_number",
        "customer__username",
        "shop__shop_name"
    )

    list_filter = (
        "customer",
        "shop",
        "order_status",
        "payment_status",
        "created_at",
    )

    ordering = ("-created_at",)

    def get_readonly_fields(self,request,obj=None):
        readonly=list(self.readonly_fields)
        if obj is not None:
            readonly.extend(["customer","shop"])
        return readonly


admin.site.register(Order, OrderAdmin)


class OrderItemAdmin(admin.ModelAdmin):

    list_display = (
        "order",
        "quantity",
        "garment_name_snapshot",
        "service_name_snapshot",
        "unit_price_snapshot",
        "line_total",
        "item_status",
        "created_at",
        "updated_at",
    )

    readonly_fields = (
        "garment_name_snapshot",
        "service_name_snapshot",
        "unit_price_snapshot",
        "line_total",
        "created_at",
        "updated_at",
    )

    search_fields = (
        "order__order_number",
        "garment_name_snapshot",
        "service_name_snapshot",
    )

    list_filter = (
        "item_status",
        "created_at",
    )

    ordering = ("-created_at",)

    def get_readonly_fields(self, request, obj = None):
        readonly=list(self.readonly_fields)
        if obj is not None:
            readonly.extend(['shop_service',"order","quantity"])
        return readonly


admin.site.register(OrderItem, OrderItemAdmin)
