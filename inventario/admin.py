from django.contrib import admin
from .models import Material, MovimientoInventario


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'stock_actual', 'unidad_medida',
                    'stock_minimo', 'costo_promedio', 'stock_bajo', 'activo')
    list_filter = ('activo', 'unidad_medida')
    search_fields = ('nombre',)


@admin.register(MovimientoInventario)
class MovimientoInventarioAdmin(admin.ModelAdmin):
    list_display = ('fecha', 'tipo', 'material', 'cantidad',
                    'costo_unitario', 'costo_total', 'pedido', 'proveedor')
    list_filter = ('tipo', 'material')
    search_fields = ('material__nombre', 'motivo')
    readonly_fields = ('fecha', 'costo_total')
    date_hierarchy = 'fecha'