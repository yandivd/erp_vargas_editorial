from django.contrib import admin
from .models import Cliente, TarjetaFidelidad


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'telefono', 'total_pedidos', 'fecha_registro')
    search_fields = ('nombre', 'telefono',)
    readonly_fields = ('fecha_registro',)


@admin.register(TarjetaFidelidad)
class TarjetaFidelidadAdmin(admin.ModelAdmin):
    list_display = ('cliente', 'sellos', 'bono_saldo', 'fecha_actualizacion')
    search_fields = ('cliente__nombre', 'cliente__telefono')
    readonly_fields = ('token', 'fecha_creacion', 'fecha_actualizacion')