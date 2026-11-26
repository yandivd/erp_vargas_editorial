from django.conf import settings
from django.db import migrations, models


def convertir_imagen(apps, schema_editor):
    Banner = apps.get_model('core', 'Banner')
    base_media = str(getattr(settings, 'MEDIA_URL', '/media/') or '/media/').rstrip('/')
    for banner in Banner.objects.all():
        valor = str(banner.imagen or '').strip()
        if not valor:
            continue
        if valor.startswith(('http://', 'https://', '/')):
            banner.imagen_url = valor
        else:
            banner.imagen_url = f'{base_media}/{valor.lstrip("/")}'
        banner.save(update_fields=['imagen_url'])


class Migration(migrations.Migration):
    dependencies = [('core', '0005_banner')]

    operations = [
        migrations.AddField(
            model_name='banner',
            name='imagen_url',
            field=models.URLField(blank=True, default='', verbose_name='Imagen (URL)'),
        ),
        migrations.RunPython(convertir_imagen, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='banner',
            name='imagen',
        ),
    ]
