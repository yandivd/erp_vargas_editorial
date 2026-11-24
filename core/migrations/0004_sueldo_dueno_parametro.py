from django.db import migrations


def crear_sueldo_dueno(apps, schema_editor):
    Parametro = apps.get_model('core', 'Parametro')
    Parametro.objects.get_or_create(
        clave='sueldo_dueno',
        defaults={
            'valor': 0,
            'descripcion': 'Sueldo del dueño para el cálculo del punto de equilibrio',
        },
    )


class Migration(migrations.Migration):
    dependencies = [('core', '0003_tarifamensajeria')]

    operations = [
        migrations.RunPython(crear_sueldo_dueno, migrations.RunPython.noop),
    ]
