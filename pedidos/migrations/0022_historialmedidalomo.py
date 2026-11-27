from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('pedidos', '0021_book_oculto_catalogo'),
    ]

    operations = [
        migrations.CreateModel(
            name='HistorialMedidaLomo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('referencia_externa', models.PositiveIntegerField(db_index=True, verbose_name='Referencia original')),
                ('titulo', models.CharField(blank=True, max_length=200, verbose_name='Título')),
                ('medida_original', models.DecimalField(decimal_places=2, max_digits=6, verbose_name='Medida original (cm)')),
                ('nueva_medida', models.DecimalField(decimal_places=2, max_digits=6, verbose_name='Medida final (cm)')),
                ('asterisco', models.BooleanField(default=False, verbose_name='Asterisco')),
                ('veces', models.PositiveIntegerField(default=1, verbose_name='Veces registrada')),
                ('fecha', models.DateTimeField(auto_now_add=True, verbose_name='Primera vez')),
                ('ultima_fecha', models.DateTimeField(auto_now=True, verbose_name='Última vez')),
                ('usuario', models.CharField(blank=True, max_length=100, verbose_name='Usuario')),
                ('pedido', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='medidas_lomo', to='pedidos.pedido')),
            ],
            options={
                'verbose_name': 'Historial de medida de lomo',
                'verbose_name_plural': 'Historial de medidas de lomo',
                'ordering': ['referencia_externa', '-ultima_fecha'],
                'unique_together': {('referencia_externa', 'medida_original', 'nueva_medida', 'asterisco')},
            },
        ),
    ]
