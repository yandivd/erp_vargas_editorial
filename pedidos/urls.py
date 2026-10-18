from django.urls import path
from . import views

app_name = 'pedidos'

urlpatterns = [
    path('', views.lista, name='lista'),
    path('nuevo-modal/', views.nuevo_pedido_modal, name='nuevo_modal'),
    path('calcular-costo/', views.calcular_costo_ajax, name='calcular_costo'),
    path('<int:pk>/', views.detalle, name='detalle'),
    path('<int:pk>/cambiar-estado/', views.cambiar_estado, name='cambiar_estado'),
    path('<int:pk>/confirmar/', views.confirmar_pedido, name='confirmar'),
    path('<int:pk>/anticipo/', views.registrar_anticipo, name='registrar_anticipo'),
    path('libros/', views.lista_libros, name='lista_libros'),
    path('libros/<int:pk>/editar/', views.editar_libro, name='editar_libro'),
    path('<int:pk>/imprimir-pedido/', views.imprimir_pedido, name='imprimir_pedido'),
    path('<int:pk>/imprimir-servicio/', views.imprimir_orden_servicio, name='imprimir_servicio'),
]