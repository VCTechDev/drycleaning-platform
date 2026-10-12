from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

# Register your models here.

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("VeeCleen access", {"fields": ("role",)}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("VeeCleen access", {"fields": ("role",)}),
    )
    list_display=(
        "username",
        "role",
        "email",
        "is_staff",
        "is_active",
        
    )