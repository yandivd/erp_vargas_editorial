from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pedidos', '0013_book_imagen'),
    ]

    operations = [
        migrations.AddField(
            model_name='pedido',
            name='bono_fidelidad_aplicado',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                max_digits=10,
                verbose_name='Bono de fidelidad aplicado',
            ),
        ),
        migrations.AddField(
            model_name='pedido',
            name='sellos_fidelidad_otorgados',
            field=models.BooleanField(
                default=False,
                verbose_name='Sellos de fidelidad otorgados',
            ),
        ),
    ]
