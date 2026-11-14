from django.db import migrations, models
from django.db.models import Max


def poblar_ultima_compra(apps, schema_editor):
    TarjetaFidelidad = apps.get_model('clientes', 'TarjetaFidelidad')
    Pedido = apps.get_model('pedidos', 'Pedido')

    for tarjeta in TarjetaFidelidad.objects.all().iterator():
        fechas = Pedido.objects.filter(
            cliente_id=tarjeta.cliente_id,
            estado__nombre='Entregado',
        ).aggregate(
            entrega=Max('fecha_entrega_real'),
            pedido=Max('fecha_pedido'),
        )
        fecha = fechas['entrega'] or fechas['pedido']
        if fecha:
            tarjeta.fecha_ultima_compra = fecha
            tarjeta.save(update_fields=['fecha_ultima_compra'])


class Migration(migrations.Migration):

    dependencies = [
        ('clientes', '0005_tarjeta_fidelidad'),
        ('pedidos', '0014_pedido_fidelidad'),
    ]

    operations = [
        migrations.AddField(
            model_name='tarjetafidelidad',
            name='fecha_ultima_compra',
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name='Última compra',
            ),
        ),
        migrations.RunPython(
            poblar_ultima_compra,
            migrations.RunPython.noop,
        ),
    ]
