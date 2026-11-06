from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finanzas', '0012_alter_movimientocaja_categoria'),
    ]

    operations = [
        migrations.AlterField(
            model_name='movimientocaja',
            name='categoria',
            field=models.CharField(choices=[('ANTICIPO_CLIENTE', 'Anticipo de cliente'), ('SALDO_CLIENTE', 'Saldo de cliente'), ('SALDO_INICIAL', 'Saldo de apertura'), ('VUELTO_CLIENTE', 'Vuelto a cliente'), ('INGRESO_MANUAL', 'Ingreso manual'), ('PROPINA', 'Propina'), ('MENSAJERIA', 'Mensajería / Envío'), ('VENTA_DIRECTA', 'Venta directa'), ('OTRO_INGRESO', 'Otro ingreso'), ('PAGO_PROVEEDOR', 'Pago a proveedor'), ('COMPRA_MATERIAL', 'Compra de material'), ('GASTO_OPERATIVO', 'Gasto operativo'), ('PAGO_NOMINA', 'Pago de Nómina'), ('RETIRO_UTILIDADES', 'Retiro de Utilidades'), ('COMPRA_ACTIVO', 'Compra de activo fijo'), ('TRANSFERENCIA', 'Transferencia entre cuentas'), ('COMPRA_DIVISA', 'Compra de divisa'), ('VENTA_DIVISA', 'Venta de divisa'), ('GANANCIA_CAMBIARIA', 'Ganancia por diferencia cambiaria'), ('PERDIDA_CAMBIARIA', 'Pérdida por diferencia cambiaria')], max_length=30),
        ),
    ]
