from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pedidos', '0020_usd_pricing'),
    ]

    operations = [
        migrations.AddField(
            model_name='book',
            name='oculto_catalogo',
            field=models.BooleanField(default=False, verbose_name='Oculto del catálogo'),
        ),
    ]
