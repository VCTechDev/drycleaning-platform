from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0004_delivery_agent_contact_constraints"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="user",
            options={},
        ),
    ]
