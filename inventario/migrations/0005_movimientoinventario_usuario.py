from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('inventario', '0004_alter_loteconsumo_options_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='movimientoinventario',
            name='usuario',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='movimientos_inventario',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
