import re

from django.db import migrations, models
from django.db.models import Q


DEFAULT_COUNTRY_CODE = "+91"
E164_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")
INDIAN_LOCAL_PATTERN = re.compile(r"^[6-9]\d{9}$")


def normalize_existing_phone(value):
    """Apply the India-first policy used by the historical data migration.

    Unprefixed ten-digit values are treated as Indian mobile numbers only when
    they match the Indian mobile pattern. Other international values must
    carry an explicit country code.
    """
    compact = re.sub(r"[\s().-]+", "", str(value).strip())
    if compact.startswith("00"):
        compact = f"+{compact[2:]}"
    elif INDIAN_LOCAL_PATTERN.fullmatch(compact):
        compact = f"{DEFAULT_COUNTRY_CODE}{compact}"

    if not E164_PATTERN.fullmatch(compact):
        raise ValueError("phone number is not a supported international number")
    return compact


def normalize_delivery_agent_phones(apps, schema_editor):
    User = apps.get_model("users", "User")
    DeliveryAgent = apps.get_model("logistics", "DeliveryAgent")

    agent_user_ids = set(
        DeliveryAgent.objects.values_list("user_id", flat=True)
    )
    delivery_agent_user_ids = set(
        User.objects.filter(role="delivery_agent").values_list("id", flat=True)
    )
    user_ids = agent_user_ids | delivery_agent_user_ids

    users = list(User.objects.filter(pk__in=user_ids).order_by("pk"))
    missing = [user.pk for user in users if not user.phone_number]
    if missing:
        raise RuntimeError(
            "Cannot enforce delivery-agent phone requirements: "
            f"{len(missing)} existing delivery-agent record(s) have no phone number. "
            "Clean the data manually and rerun migrations."
        )

    normalized = {}
    invalid = []
    for user in users:
        try:
            normalized[user.pk] = normalize_existing_phone(user.phone_number)
        except ValueError:
            invalid.append(user.pk)

    if invalid:
        raise RuntimeError(
            "Cannot normalize existing delivery-agent phone numbers: "
            f"{len(invalid)} record(s) contain unsupported values. "
            "Clean the data manually and rerun migrations."
        )

    duplicate_values = {}
    for user_id, phone_number in normalized.items():
        duplicate_values.setdefault(phone_number, []).append(user_id)
    duplicates = [
        phone_number
        for phone_number, user_ids_for_phone in duplicate_values.items()
        if len(user_ids_for_phone) > 1
    ]
    if duplicates:
        raise RuntimeError(
            "Cannot enforce unique delivery-agent phone numbers: "
            f"{len(duplicates)} normalized value(s) are duplicated. "
            "Resolve duplicates manually and rerun migrations."
        )

    for user in users:
        phone_number = normalized[user.pk]
        if user.phone_number != phone_number:
            User.objects.filter(pk=user.pk).update(phone_number=phone_number)


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_alter_user_email"),
        ("logistics", "0005_deliverytask_failure_reason_deliveryotpauditlog_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="phone_number",
            field=models.CharField(blank=True, max_length=16, null=True),
        ),
        migrations.RunPython(
            normalize_delivery_agent_phones,
            migrations.RunPython.noop,
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.UniqueConstraint(
                condition=(
                    Q(role="delivery_agent")
                    & Q(phone_number__isnull=False)
                    & ~Q(phone_number="")
                ),
                fields=("phone_number",),
                name="users_delivery_agent_phone_unique",
            ),
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.CheckConstraint(
                condition=(
                    ~Q(role="delivery_agent")
                    | (
                        Q(phone_number__isnull=False)
                        & ~Q(phone_number="")
                    )
                ),
                name="users_delivery_agent_phone_required",
            ),
        ),
    ]
