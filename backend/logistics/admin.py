from django.contrib import admin
from .models import *

# Register your models here.

class DeliveryAgentAdminView(admin.ModelAdmin):
    readonly_fields=(
        'created_at',
        'updated_at',
    )

    list_display=(
        'user',
        'shop',
        'shift_starts_at',
        'shift_ends_at',
        'is_active',
        'created_at',
        'updated_at',
    )

    search_fields=(
        'user__username',
        'shop__shop_name'
    )

    list_filter=(
        'user',
        'shop',
        'is_active'
    )

    ordering='-created_at',

admin.site.register(DeliveryAgent,DeliveryAgentAdminView)


class DeliveryTaskAdminView(admin.ModelAdmin):

    list_display=(
        'order',
        'delivery_agent',
        'task_type',
        'status',
        'scheduled_at',
        'completed_at',
        'created_at',
        'updated_at'
    )

    readonly_fields=(
        'task_type',
        'created_at',
        'updated_at',
    )

    search_fields=(
        'order__order_number',
        'delivery_agent',  
    )

    list_filter=(
        'task_type',
        'status',

    )

    ordering=['-created_at']

    
admin.site.register(DeliveryTask,DeliveryTaskAdminView)