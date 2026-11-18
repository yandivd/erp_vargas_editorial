from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pedidos', '0014_pedido_fidelidad'),
    ]

    operations = [
        migrations.RenameField(
            model_name='pedido',
            old_name='lleva_scotch',
            new_name='lleva_cantos_tintados',
        ),
        migrations.AlterField(
            model_name='pedido',
            name='lleva_cantos_tintados',
            field=models.BooleanField(
                default=False,
                verbose_name='Lleva cantos tintados',
            ),
        ),
    ]
