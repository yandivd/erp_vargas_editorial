from django.contrib import admin
from django.utils import timezone
from .models import (
    CodigoDescuento, Pedido, HistorialEstado, ServicioExterno, Book, Estado, LoteServicio
)
from .services import ServicioPedido


# ==========================================
# ADMIN DE LIBROS (BOOK)
# ==========================================
@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'autor', 'paginas',)
    search_fields = ('titulo', 'autor')


# ==========================================
# ADMIN DE ESTADOS
# ==========================================
@admin.register(Estado)
class EstadoAdmin(admin.ModelAdmin):
    list_display = ('colored_name', 'orden', 'es_final', 'activo')
    list_editable = ('orden', 'es_final', 'activo')
    ordering = ('orden',)

    def colored_name(self, obj):
        return obj.colored_name()
    colored_name.short_description = 'Nombre'


# ==========================================
# ADMIN DE PEDIDOS
# ==========================================
class HistorialEstadoInline(admin.TabularInline):
    model = HistorialEstado
    extra = 0
    readonly_fields = ('fecha',)


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'referencia_externa', 'get_titulo_libro', 'cliente', 'get_paginas',
        'precio_venta', 'anticipo_recibido', 'saldo_pendiente', 'estado',
        'fecha_entrega_prometida', 'esta_atrasado'
    )
    list_filter = ('estado', 'lleva_scotch', 'lleva_esquineros')
    search_fields = ('referencia_externa', 'libro__titulo', 'libro__autor', 'cliente__nombre')
    readonly_fields = ('fecha_pedido', 'saldo_pendiente')
    inlines = [HistorialEstadoInline]
    autocomplete_fields = ['libro']

    fieldsets = (
        ('Datos del libro', {
            'fields': ('referencia_externa', 'cliente', 'libro', 'cantidad',
                       'lleva_scotch', 'lleva_esquineros')
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

    @admin.display(description='Libro')
    def get_titulo_libro(self, obj):
        return obj.libro.titulo

    @admin.display(description='Páginas')
    def get_paginas(self, obj):
        return obj.libro.paginas

    actions = ['accion_cambiar_a_impreso', 'accion_cambiar_a_entregado']

    @admin.action(description='Marcar como Impreso (consume materiales)')
    def accion_cambiar_a_impreso(self, request, queryset):
        for pedido in queryset:
            ServicioPedido.cambiar_estado(pedido, 'Impreso', usuario=request.user.username)
        self.message_user(request, f'{queryset.count()} pedidos marcados como Impresos.')

    @admin.action(description='Marcar como Entregado')
    def accion_cambiar_a_entregado(self, request, queryset):
        for pedido in queryset:
            ServicioPedido.cambiar_estado(pedido, 'Entregado', usuario=request.user.username)
        self.message_user(request, f'{queryset.count()} pedidos entregados.')

    def save_model(self, request, obj, form, change):
        """Detecta si cambió el estado y ejecuta la lógica."""
        if change:
            anterior = Pedido.objects.get(pk=obj.pk)
            if anterior.estado != obj.estado:
                super().save_model(request, obj, form, change)
                ServicioPedido.cambiar_estado(
                    obj, obj.estado.nombre, usuario=request.user.username,
                    notas='Cambio desde admin'
                )
                return
        super().save_model(request, obj, form, change)


# ==========================================
# ADMIN DE HISTORIAL
# ==========================================
@admin.register(HistorialEstado)
class HistorialEstadoAdmin(admin.ModelAdmin):
    list_display = ('pedido', 'estado_anterior', 'estado_nuevo', 'fecha', 'usuario')
    list_filter = ('estado_nuevo', 'estado_anterior')


# ==========================================
# ADMIN DE LOTES DE SERVICIO
# ==========================================
class ServicioExternoInline(admin.TabularInline):
    """Muestra los servicios que componen un lote."""
    model = ServicioExterno
    extra = 0
    fields = ('pedido', 'tipo', 'monto', 'estado', 'fecha_solicitud')
    readonly_fields = ('fecha_solicitud',)
    can_delete = False
    show_change_link = True


@admin.register(LoteServicio)
class LoteServicioAdmin(admin.ModelAdmin):
    list_display = (
        'numero', 'proveedor', 'tipo', 'cantidad_servicios_display',
        'costo_total_display', 'estado', 'fecha_apertura', 'fecha_cierre'
    )
    list_filter = ('estado', 'tipo', 'proveedor')
    search_fields = ('numero', 'proveedor__nombre')
    readonly_fields = ('numero', 'fecha_apertura', 'fecha_cierre', 'fecha_pago')
    inlines = [ServicioExternoInline]

    fieldsets = (
        ('Identificación', {
            'fields': ('numero', 'proveedor', 'tipo', 'estado')
        }),
        ('Fechas', {
            'fields': ('fecha_apertura', 'fecha_cierre', 'fecha_pago')
        }),
        ('Notas', {
            'fields': ('notas',)
        }),
    )

    @admin.display(description='Servicios')
    def cantidad_servicios_display(self, obj):
        return obj.cantidad_servicios

    @admin.display(description='Total')
    def costo_total_display(self, obj):
        return f"${obj.costo_total:.2f}"


# ==========================================
# ADMIN DE SERVICIOS EXTERNOS
# ==========================================
@admin.register(ServicioExterno)
class ServicioExternoAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'pedido', 'tipo', 'proveedor', 'monto', 'estado',
        'lote', 'fecha_solicitud', 'fecha_recepcion', 'fecha_pago'
    )
    list_filter = ('tipo', 'estado', 'proveedor', 'lote')
    search_fields = (
        'pedido__libro__titulo', 'pedido__cliente__nombre',
        'proveedor__nombre', 'lote__numero'
    )
    list_select_related = ('pedido', 'pedido__libro', 'proveedor', 'lote')
    readonly_fields = ('fecha_solicitud', 'fecha_recepcion', 'fecha_pago')

    fieldsets = (
        ('Pedido y proveedor', {
            'fields': ('pedido', 'proveedor', 'tipo', 'monto')
        }),
        ('Lote', {
            'fields': ('lote',),
            'description': 'Lote al que pertenece este servicio. Se asigna automáticamente al cambiar el pedido a "Pendiente a Carátula" o "Pendiente a Encuadernado".'
        }),
        ('Estado y fechas', {
            'fields': ('estado', 'fecha_solicitud', 'fecha_recepcion', 'fecha_pago')
        }),
        ('Notas', {
            'fields': ('notas',)
        }),
    )

@admin.register(CodigoDescuento)
class CodigoDescuentoAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'porcentaje', 'categoria', 'fecha_inicio', 'fecha_fin', 'activo', 'usos_actuales', 'usos_maximos')
    list_filter = ('activo', 'categoria')
    search_fields = ('codigo', 'descripcion')