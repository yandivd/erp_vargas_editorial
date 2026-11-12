import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('clientes', '0004_remove_cliente_email'),
    ]

    operations = [
        migrations.CreateModel(
            name='TarjetaFidelidad',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                (
                    'sellos',
                    models.PositiveIntegerField(default=0, verbose_name='Sellos'),
                ),
                (
                    'bono_saldo',
                    models.DecimalField(
                        decimal_places=2,
                        default=0,
                        max_digits=10,
                        verbose_name='Saldo del bono',
                    ),
                ),
                (
                    'token',
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        unique=True,
                        verbose_name='Token público',
                    ),
                ),
                (
                    'fecha_creacion',
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    'fecha_actualizacion',
                    models.DateTimeField(auto_now=True),
                ),
                (
                    'cliente',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='tarjeta_fidelidad',
                        to='clientes.cliente',
                        verbose_name='Cliente',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Tarjeta de fidelidad',
                'verbose_name_plural': 'Tarjetas de fidelidad',
                'ordering': ['cliente__nombre'],
            },
        ),
    ]
