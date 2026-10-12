from django.test import TestCase

from .admin import CustomUserAdmin


class UserAdminTests(TestCase):
    def test_role_is_available_on_user_forms(self):
        change_fields = {
            field
            for _, options in CustomUserAdmin.fieldsets
            for field in options["fields"]
        }
        add_fields = {
            field
            for _, options in CustomUserAdmin.add_fieldsets
            for field in options["fields"]
        }

        self.assertIn("role", change_fields)
        self.assertIn("role", add_fields)
