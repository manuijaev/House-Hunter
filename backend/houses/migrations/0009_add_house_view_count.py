# Generated manually for adding view_count to House model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('houses', '0008_user_is_online_user_last_seen'),
    ]

    operations = [
        migrations.AddField(
            model_name='house',
            name='view_count',
            field=models.PositiveIntegerField(default=0, help_text='Number of times this house has been viewed by tenants'),
        ),
    ]