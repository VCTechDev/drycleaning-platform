from django.db import migrations, models
from django.db.migrations.exceptions import IrreversibleError


SEQUENCE_NAME = "logistics_delivery_agent_agent_id_seq"
DELIVERY_AGENT_TABLE = "logistics_deliveryagent"


def assign_existing_agent_ids(apps, schema_editor):
    DeliveryAgent = apps.get_model("logistics", "DeliveryAgent")

    with schema_editor.connection.cursor() as cursor:
        for agent in DeliveryAgent.objects.filter(agent_id__isnull=True).order_by("pk"):
            cursor.execute("SELECT nextval(%s::regclass)", [SEQUENCE_NAME])
            sequence_value = cursor.fetchone()[0]
            DeliveryAgent.objects.filter(pk=agent.pk).update(
                agent_id=f"VC-AGT-{sequence_value:05d}"
            )


def prevent_identity_rollback(apps, schema_editor):
    raise IrreversibleError(
        "Delivery-agent public IDs are permanent; restore the database backup "
        "or roll forward instead of reversing this migration."
    )


class Migration(migrations.Migration):

    dependencies = [
        ("logistics", "0005_deliverytask_failure_reason_deliveryotpauditlog_and_more"),
        ("users", "0005_alter_user_options"),
    ]

    operations = [
        migrations.RunSQL(
            # Do not hide a pre-existing sequence with unknown ownership or
            # state. A clean deployment must create this sequence exactly once.
            sql=f"CREATE SEQUENCE {SEQUENCE_NAME} START WITH 1",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.AddField(
            model_name="deliveryagent",
            name="agent_id",
            field=models.CharField(
                editable=False,
                max_length=20,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name="deliveryagent",
            name="email_verified",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="deliveryagent",
            name="phone_verified",
            field=models.BooleanField(default=False),
        ),
        migrations.RunSQL(
            sql=(
                f"ALTER SEQUENCE {SEQUENCE_NAME} "
                f"OWNED BY {DELIVERY_AGENT_TABLE}.agent_id"
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunPython(
            assign_existing_agent_ids,
            prevent_identity_rollback,
        ),
        migrations.AlterField(
            model_name="deliveryagent",
            name="agent_id",
            field=models.CharField(
                editable=False,
                max_length=20,
                unique=True,
            ),
        ),
    ]
