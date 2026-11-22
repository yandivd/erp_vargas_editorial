from decimal import Decimal, ROUND_HALF_UP
from django.db import migrations, models


def poblar_precios_usd(apps, schema_editor):
    Book = apps.get_model('pedidos', 'Book')
    Pedido = apps.get_model('pedidos', 'Pedido')
    tasa_defecto = Decimal('930')

    for book in Book.objects.all().only('id', 'precio', 'precio_usd'):
        precio_cup = Decimal(str(book.precio or 0))
        book.precio_usd = (precio_cup / tasa_defecto).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
        book.save(update_fields=['precio_usd'])

    for pedido in Pedido.objects.all().only('id', 'precio_venta', 'precio_usd', 'tasa_cambio_pedido'):
        precio_cup = Decimal(str(pedido.precio_venta or 0))
        pedido.tasa_cambio_pedido = tasa_defecto
        pedido.precio_usd = (precio_cup / tasa_defecto).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
        pedido.save(update_fields=['precio_usd', 'tasa_cambio_pedido'])


class Migration(migrations.Migration):

    dependencies = [
        ('pedidos', '0019_book_imagenes_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='book',
            name='precio_usd',
            field=models.DecimalField(decimal_places=1, default=0, max_digits=10, verbose_name='Precio base USD'),
        ),
        migrations.AlterField(
            model_name='book',
            name='precio',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='Precio base CUP (legacy)'),
        ),
        migrations.AddField(
            model_name='pedido',
            name='precio_usd',
            field=models.DecimalField(decimal_places=1, default=0, max_digits=10, verbose_name='Precio USD al crear'),
        ),
        migrations.AddField(
            model_name='pedido',
            name='tasa_cambio_pedido',
            field=models.DecimalField(blank=True, decimal_places=4, max_digits=12, null=True, verbose_name='Tasa de cambio al crear'),
        ),
        migrations.AlterField(
            model_name='pedido',
            name='precio_venta',
            field=models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Precio venta CUP congelado'),
        ),
        migrations.RunPython(poblar_precios_usd, migrations.RunPython.noop),
    ]
