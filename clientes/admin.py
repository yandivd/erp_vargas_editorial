from django.contrib import admin
from .models import Cliente, EventoFidelidad, TarjetaFidelidad


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'telefono', 'total_pedidos', 'fecha_registro')
    search_fields = ('nombre', 'telefono',)
    readonly_fields = ('fecha_registro',)


@admin.register(TarjetaFidelidad)
class TarjetaFidelidadAdmin(admin.ModelAdmin):
    list_display = (
        'cliente',
        'sellos',
        'bono_saldo',
        'fecha_ultima_compra',
        'fecha_actualizacion',
    )
    search_fields = ('cliente__nombre', 'cliente__telefono')
    readonly_fields = (
        'token',
        'fecha_ultima_compra',
        'fecha_creacion',
        'fecha_actualizacion',
    )


@admin.register(EventoFidelidad)
class EventoFidelidadAdmin(admin.ModelAdmin):
    list_display = ('fecha', 'tarjeta', 'tipo', 'cantidad', 'pedido')
    list_filter = ('tipo',)
    search_fields = ('tarjeta__cliente__nombre', 'tarjeta__cliente__telefono')
    readonly_fields = ('fecha',)
    date_hierarchy = 'fecha'