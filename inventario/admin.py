from django.contrib import admin
from .models import Material, MovimientoInventario, LoteConsumo


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = (
        'nombre', 'stock_actual', 'unidad_medida', 'stock_consumo', 
        'unidad_consumo', 'costo_promedio', 'stock_bajo', 'activo'
    )
    list_filter = ('activo', 'unidad_medida')
    search_fields = ('nombre',)
    
    # Organizamos el formulario por secciones para que no se vea amontonado
    fieldsets = (
        ('Información Básica', {
            'fields': ('nombre', 'unidad_medida', 'activo')
        }),
        ('Inventario Granel (Compras)', {
            'fields': ('stock_actual', 'stock_minimo', 'costo_promedio')
        }),
        ('Fraccionamiento (Lotes de Consumo)', {
            'fields': ('unidad_consumo', 'cantidad_por_unidad', 'stock_consumo'),
            'description': 'Configura aquí si este material se divide en unidades más pequeñas (ej: 1 Litro = 15.38 pomos de 65ml).'
        }),
    )


@admin.register(MovimientoInventario)
class MovimientoInventarioAdmin(admin.ModelAdmin):
    list_display = (
        'fecha', 'tipo', 'material', 'cantidad',
        'costo_unitario', 'costo_total', 'pedido', 'proveedor'
    )
    list_filter = ('tipo', 'material')
    search_fields = ('material__nombre', 'motivo')
    readonly_fields = ('fecha', 'costo_total')
    date_hierarchy = 'fecha'


@admin.register(LoteConsumo)
class LoteConsumoAdmin(admin.ModelAdmin):
    list_display = (
        'codigo', 'material', 'costo_total', 'estado', 'fecha_apertura'
    )
    list_filter = ('estado', 'material')
    search_fields = ('codigo', 'material__nombre')
    readonly_fields = ('fecha_apertura',)
    
    # Esto permite filtrar rápido por los que están cerrados
    actions = ['marcar_como_cerrado']
    
    @admin.action(description='Marcar lote(s) como Cerrado (Devolver al almacén)')
    def marcar_como_cerrado(self, request, queryset):
        # Por si te equivocas al abrir uno y quieres devolverlo
        for lote in queryset:
            if lote.estado == 'EN_USO':
                lote.estado = 'CERRADO'
                lote.fecha_apertura = None
                lote.save()
                # Devolvemos el stock
                lote.material.stock_consumo += lote.cantidad_inicial
                lote.material.save()
        self.message_user(request, f'{queryset.count()} lotes devueltos al almacén.')