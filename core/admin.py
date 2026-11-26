from django.contrib import admin
from .models import Banner, Parametro


@admin.register(Parametro)
class ParametroAdmin(admin.ModelAdmin):
    list_display = ('clave', 'valor', 'descripcion', 'fecha_actualizacion')
    search_fields = ('clave', 'descripcion')


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'activo', 'orden', 'imagen')
    list_editable = ('activo', 'orden')
    list_filter = ('activo',)
    search_fields = ('titulo',)
