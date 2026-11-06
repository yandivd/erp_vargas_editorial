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

urlpatterns = [
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('auth/me/', views.me, name='me'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('dashboard/resumen/', views.dashboard, {'tab': 'resumen'}, name='dashboard_resumen'),
    path('dashboard/produccion/', views.dashboard, {'tab': 'produccion'}, name='dashboard_produccion'),
    path('dashboard/clientes/', views.dashboard, {'tab': 'clientes'}, name='dashboard_clientes'),
    path('catalogo/', views.catalogo, name='catalogo'),
] + router.urls
