from django.contrib import admin
from .models import Pedido, HistorialEstado, ServicioExterno, Book, Estado
from .services import ServicioPedido


# ==========================================
# ADMIN DE LIBROS (BOOK)
# ==========================================
@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'autor', 'paginas',)
    search_fields = ('titulo', 'autor')
    # list_filter = ('tipo_tapa',)


# ==========================================
# ADMIN DE ESTADOS
# ==========================================
@admin.register(Estado)
class EstadoAdmin(admin.ModelAdmin):
    # El primer campo (colored_name) será el enlace. 
    # Luego ponemos orden, es_final y activo (estos sí son editables)
    list_display = ('colored_name', 'orden', 'es_final', 'activo')
    list_editable = ('orden', 'es_final', 'activo')
    ordering = ('orden',)
    
    def colored_name(self, obj):
        return obj.colored_name()
    colored_name.short_description = 'Nombre'


# ==========================================
# ADMIN DE PEDIDOS
# ==========================================
from django.contrib import admin
from .models import Pedido, HistorialEstado, ServicioExterno, Book, Estado
from .services import ServicioPedido


class HistorialEstadoInline(admin.TabularInline):
    model = HistorialEstado
    extra = 0
    readonly_fields = ('fecha',)


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    # Agregamos 'id' y 'referencia_externa' al principio para que sean lo primero que veas
    list_display = (
        'id', 'referencia_externa', 'get_titulo_libro', 'cliente', 'get_paginas', 'precio_venta',
        'anticipo_recibido', 'saldo_pendiente', 'estado',
        'fecha_entrega_prometida', 'esta_atrasado'
    )
    list_filter = ('estado', 'lleva_scotch', 'lleva_esquineros')
    # Agregamos la referencia a los campos de búsqueda
    search_fields = ('referencia_externa', 'libro__titulo', 'libro__autor', 'cliente__nombre')
    readonly_fields = ('fecha_pedido', 'saldo_pendiente')
    inlines = [HistorialEstadoInline]
    autocomplete_fields = ['libro']

    fieldsets = (
        ('Datos del libro', {
            # Agregamos 'referencia_externa' aquí para que sea editable
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
    
    # Columnas personalizadas para leer datos desde 'libro'
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
                # Aquí pasamos obj.estado.nombre en lugar del objeto entero
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
# ADMIN DE SERVICIOS EXTERNOS
# ==========================================
@admin.register(ServicioExterno)
class ServicioExternoAdmin(admin.ModelAdmin):
    list_display = ('pedido', 'tipo', 'proveedor', 'monto', 'estado',
                    'fecha_solicitud', 'fecha_recepcion', 'fecha_pago')
    list_filter = ('tipo', 'estado', 'proveedor')
    search_fields = ('pedido__libro__titulo', 'proveedor__nombre')
    readonly_fields = ('fecha_solicitud',)