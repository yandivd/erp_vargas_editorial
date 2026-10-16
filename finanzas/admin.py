from django.contrib import admin
from .models import MovimientoCaja, ActivoFijo, Depreciacion, GastoOperativo


@admin.register(MovimientoCaja)
class MovimientoCajaAdmin(admin.ModelAdmin):
    list_display = ('fecha', 'tipo', 'categoria', 'monto', 'metodo', 'concepto', 'pedido')
    list_filter = ('tipo', 'categoria', 'metodo')
    search_fields = ('concepto',)
    date_hierarchy = 'fecha'
    readonly_fields = ('fecha',)


@admin.register(ActivoFijo)
class ActivoFijoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'fecha_compra', 'valor_compra', 'vida_util_meses',
                    'depreciacion_mensual', 'valor_actual', 'activo')
    list_filter = ('activo',)


@admin.register(Depreciacion)
class DepreciacionAdmin(admin.ModelAdmin):
    list_display = ('activo', 'mes', 'monto', 'fecha_registro')
    list_filter = ('activo',)
    date_hierarchy = 'mes'


@admin.register(GastoOperativo)
class GastoOperativoAdmin(admin.ModelAdmin):
    list_display = ('concepto', 'monto', 'fecha', 'mes_imputacion')
    date_hierarchy = 'fecha'