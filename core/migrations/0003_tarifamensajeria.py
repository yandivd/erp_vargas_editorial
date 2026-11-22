from django.db import migrations, models


def seed_tarifas(apps, schema_editor):
    Tarifa = apps.get_model('core', 'TarifaMensajeria')
    MUNICIPIOS = {
        'La Habana': [
            ('Arroyo Naranjo', 1500), ('Boyeros', 2375), ('Centro Habana', 1250), ('Cerro', 1250),
            ('Cotorro', 1000), ('Diez de Octubre', 1250), ('Guanabacoa', 2000), ('Habana del Este', 2500),
            ('La Habana Vieja', 1250), ('La Lisa', 2625), ('Marianao', 2000), ('Playa', 2125),
            ('Plaza de la Revolución', 1500), ('Regla', 1500), ('San Miguel del Padrón', 1000),
        ],
        'Artemisa': [
            ('Alquízar', 0), ('Artemisa', 0), ('Bahía Honda', 0), ('Bauta', 0), ('Caimito', 0),
            ('Candelaria', 0), ('Guanajay', 0), ('Güira de Melena', 0), ('Mariel', 0),
            ('San Antonio de los Baños', 0), ('San Cristóbal', 0),
        ],
    }
    for prov, items in MUNICIPIOS.items():
        for mun, costo in items:
            Tarifa.objects.update_or_create(provincia=prov, municipio=mun, defaults={'costo': costo})


class Migration(migrations.Migration):
    dependencies = [('core', '0001_initial')]
    operations = [
        migrations.CreateModel(
            name='TarifaMensajeria',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provincia', models.CharField(max_length=100)),
                ('municipio', models.CharField(max_length=100)),
                ('costo', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
            ],
            options={
                'verbose_name': 'Tarifa de mensajería',
                'verbose_name_plural': 'Tarifas de mensajería',
                'ordering': ['provincia', 'municipio'],
                'unique_together': {('provincia', 'municipio')},
            },
        ),
        migrations.RunPython(seed_tarifas, migrations.RunPython.noop),
    ]
