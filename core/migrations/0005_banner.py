from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('core', '0004_sueldo_dueno_parametro')]

    operations = [
        migrations.CreateModel(
            name='Banner',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('titulo', models.CharField(blank=True, max_length=200, verbose_name='Título')),
                ('imagen', models.ImageField(upload_to='banners/', verbose_name='Imagen')),
                ('activo', models.BooleanField(default=True, verbose_name='Activo')),
                ('orden', models.PositiveIntegerField(default=0, verbose_name='Orden')),
            ],
            options={
                'verbose_name': 'Banner',
                'verbose_name_plural': 'Banners',
                'ordering': ['orden', 'id'],
            },
        ),
    ]
