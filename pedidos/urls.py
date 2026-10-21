from django.urls import path
from . import views

app_name = 'pedidos'

urlpatterns = [
    path('', views.lista, name='lista'),
    path('nuevo-modal/', views.nuevo_pedido_modal, name='nuevo_modal'),
    path('calcular-costo/', views.calcular_costo_ajax, name='calcular_costo'),
    path('cambiar-estado-masivo/', views.cambiar_estado_masivo, name='cambiar_estado_masivo'),  # <-- AQUÍ, antes de <int:pk>
    path('libros/', views.lista_libros, name='lista_libros'),
    path('libros/<int:pk>/editar/', views.editar_libro, name='editar_libro'),
    path('libros/<int:libro_id>/fabricar/', views.fabricar_para_stock, name='fabricar_stock'),
    path('libros/nuevo/', views.crear_libro, name='crear_libro'),
    path('entregados/', views.lista_entregados, name='lista_entregados'),
    path('ajax/', views.lista_ajax, name='lista_ajax'),
    path('entregados/ajax/', views.lista_entregados_ajax, name='lista_entregados_ajax'),
    path('libros/ajax/', views.lista_libros_ajax, name='lista_libros_ajax'),
    path('lotes/', views.lista_lotes, name='lista_lotes'),
    path('lotes/<int:pk>/', views.detalle_lote, name='detalle_lote'),
    path('lotes/<int:pk>/cerrar/', views.cerrar_lote, name='cerrar_lote'),
    path('lotes/<int:pk>/pagar/', views.pagar_lote, name='pagar_lote'),
    path('imprimir-comprobantes/', views.imprimir_comprobantes_masivo, name='imprimir_comprobantes_masivo'),
    path('<int:pk>/', views.detalle, name='detalle'),
    path('<int:pk>/cambiar-estado/', views.cambiar_estado, name='cambiar_estado'),
    path('<int:pk>/confirmar/', views.confirmar_pedido, name='confirmar'),
    path('<int:pk>/anticipo/', views.registrar_anticipo, name='registrar_anticipo'),
    path('<int:pk>/imprimir-pedido/', views.imprimir_pedido, name='imprimir_pedido'),
    path('<int:pk>/imprimir-servicio/', views.imprimir_orden_servicio, name='imprimir_servicio'),
    path('<int:pk>/asignar-cliente/', views.asignar_cliente_y_cobrar, name='asignar_cliente'),
    path('lotes/<int:pk>/pdf/', views.orden_lote_pdf, name='orden_lote_pdf'),
    path('<int:pk>/ticket/', views.imprimir_comprobante_termico, name='imprimir_comprobante_termico'),
    path('imprimir-comprobantes-termico/', views.imprimir_comprobantes_termico, name='imprimir_comprobantes_termico'),
    path('<int:pk>/comprobante-carta/', views.imprimir_pedido_carta, name='imprimir_pedido_carta'),
    path('imprimir-comprobantes-carta/', views.imprimir_comprobantes_lote_carta, name='imprimir_comprobantes_carta'),
    path('validar-descuento/', views.validar_codigo_descuento, name='validar_descuento'),
    path('codigos-vigentes/', views.codigos_vigentes, name='codigos_vigentes'),
    path('entregas/', views.lista_entregas, name='lista_entregas'),
    path('entregas/crear/', views.crear_entrega, name='crear_entrega'),
    path('entregas/<int:pk>/', views.detalle_entrega, name='detalle_entrega'),
    path('entregas/<int:pk>/imprimir/', views.imprimir_entrega, name='imprimir_entrega'),
]