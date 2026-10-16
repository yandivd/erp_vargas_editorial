from django.contrib import admin
from .models import Pedido, HistorialEstado


class HistorialEstadoInline(admin.TabularInline):
    model = HistorialEstado
    extra = 0
    readonly_fields = ('fecha',)


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'titulo_libro', 'clientes', 'paginas', 'precio_venta',
        'anticipo_recibido', 'saldo_pendiente', 'estado',
        'fecha_entrega_prometida', 'esta_atrasado'
    )
    list_filter = ('estado', 'lleva_scotch', 'lleva_esquineros')
    search_fields = ('titulo_libro', 'autor', 'clientes__nombre')
    readonly_fields = ('fecha_pedido', 'saldo_pendiente')
    inlines = [HistorialEstadoInline]

    fieldsets = (
        ('Datos del libro', {
            'fields': ('clientes', 'titulo_libro', 'autor', 'paginas', 'cantidad',
                       'lleva_scotch', 'lleva_esquineros', 'tipo_tapa')
        }),
        ('Precio y pagos', {
            'fields': ('precio_venta', 'anticipo_requerido', 'anticipo_recibido', 'saldo_pendiente')
        }),
        ('Estado', {
            'fields': ('estado', 'fecha_pedido', 'fecha_entrega_prometida',
                       'fecha_entrega_real', 'horas_invertidas')
        }),
        ('Entrega', {
            'fields': ('direccion_entrega', 'telefono_entrega')
        }),
        ('Notas', {
            'fields': ('notas',)
        }),
    )


@admin.register(HistorialEstado)
class HistorialEstadoAdmin(admin.ModelAdmin):
    list_display = ('pedido', 'estado_anterior', 'estado_nuevo', 'fecha', 'usuario')
    list_filter = ('estado_nuevo',)

from .models import Pedido, HistorialEstado, ServicioExterno


@admin.register(ServicioExterno)
class ServicioExternoAdmin(admin.ModelAdmin):
    list_display = ('pedido', 'tipo', 'proveedor', 'monto', 'estado',
                    'fecha_solicitud', 'fecha_recepcion', 'fecha_pago')
    list_filter = ('tipo', 'estado', 'proveedor')
    search_fields = ('pedido__titulo_libro', 'proveedor__nombre')
    readonly_fields = ('fecha_solicitud',)