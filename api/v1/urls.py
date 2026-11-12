from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from . import views


app_name = 'api_v1'

router = DefaultRouter()
router.register(r'clientes', views.ClienteViewSetV1, basename='clientes')
router.register(r'libros', views.LibroViewSetV1, basename='libros')
router.register(r'pedidos', views.PedidoViewSetV1, basename='pedidos')
router.register(r'empleados', views.EmpleadoViewSetV1, basename='empleados')
router.register(r'proveedores', views.ProveedorViewSetV1, basename='proveedores')

urlpatterns = [
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('auth/me/', views.me, name='me'),
    path(
        'fidelidad/publica/<uuid:token>/',
        views.fidelidad_publica,
        name='fidelidad_publica',
    ),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('dashboard/resumen/', views.dashboard, {'tab': 'resumen'}, name='dashboard_resumen'),
    path('dashboard/produccion/', views.dashboard, {'tab': 'produccion'}, name='dashboard_produccion'),
    path('dashboard/clientes/', views.dashboard, {'tab': 'clientes'}, name='dashboard_clientes'),
    path('catalogo/', views.catalogo, name='catalogo'),
    path('tienda/', views.tienda, name='tienda'),
    path('tienda/<int:pk>/vender/', views.tienda_vender, name='tienda_vender'),
    path('entregas/', views.entregas, name='entregas'),
    path('entregas/crear/', views.entrega_crear, name='entrega_crear'),
    path('entregas/pedidos-disponibles/', views.entrega_pedidos_disponibles, name='entrega_pedidos_disponibles'),
    path('entregas/<int:pk>/', views.entrega_detalle, name='entrega_detalle'),
    path('entregas/<int:pk>/confirmar/', views.entrega_confirmar, name='entrega_confirmar'),
    path('inventario/', views.inventario, name='inventario'),
    path('inventario/movimiento/', views.inventario_movimiento, name='inventario_movimiento'),
    path('inventario/<int:material_id>/historial/', views.inventario_historial, name='inventario_historial'),
    path('inventario/movimiento/<int:movimiento_id>/orden-trabajo/', views.inventario_orden_trabajo, name='inventario_orden_trabajo'),
    path('proveedores/<int:proveedor_id>/lotes/', views.proveedor_lotes, name='proveedor_lotes'),
    path('proveedores/lotes/<int:lote_id>/pagar/', views.proveedor_lote_pagar, name='proveedor_lote_pagar'),
    path('proveedores/lotes/<int:lote_id>/orden/', views.proveedor_lote_orden, name='proveedor_lote_orden'),
    path('finanzas/activos/', views.finanzas_activos, name='finanzas_activos'),
    path('finanzas/activos/<int:pk>/', views.finanzas_activo_detalle, name='finanzas_activo_detalle'),
    path('finanzas/caja/', views.finanzas_caja, name='finanzas_caja'),
    path('finanzas/caja/resumen/', views.finanzas_caja_resumen, name='finanzas_caja_resumen'),
    path('finanzas/caja/movimiento/', views.finanzas_caja_movimiento, name='finanzas_caja_movimiento'),
    path('finanzas/arqueo/', views.finanzas_arqueo, name='finanzas_arqueo'),
    path('finanzas/arqueos/', views.finanzas_arqueos, name='finanzas_arqueos'),
    path('finanzas/arqueos/<int:pk>/', views.finanzas_arqueo_detalle, name='finanzas_arqueo_detalle'),
    path('finanzas/divisas/compra/', views.finanzas_divisas_compra, name='finanzas_divisas_compra'),
    path('finanzas/divisas/venta/', views.finanzas_divisas_venta, name='finanzas_divisas_venta'),
] + router.urls
