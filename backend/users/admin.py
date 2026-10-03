from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "role", "email", "is_staff", "is_active")

    # Add 'role' to the editable fields in the admin form
    fieldsets = UserAdmin.fieldsets + (
        ("Custom Fields", {"fields": ("role", "phone_number")}),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Custom Fields", {"fields": ("role", "phone_number")}),
    )
