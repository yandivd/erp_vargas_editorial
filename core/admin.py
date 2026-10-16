from django.contrib import admin
from .models import Parametro


@admin.register(Parametro)
class ParametroAdmin(admin.ModelAdmin):
    list_display = ('clave', 'valor', 'descripcion', 'fecha_actualizacion')
    search_fields = ('clave', 'descripcion')