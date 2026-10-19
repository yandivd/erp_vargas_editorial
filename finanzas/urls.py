from django.urls import path
from . import views

app_name = 'finanzas'

urlpatterns = [
    path('caja/', views.caja, name='caja'),
    path('gasto/', views.registrar_gasto, name='registrar_gasto'),
    path('activos/', views.lista_activos, name='activos'),
    path('activos/registrar/', views.registrar_activo, name='registrar_activo'),
    path('activos/depreciar/', views.depreciar_mes, name='depreciar_mes'),
    path('reportes/', views.reporte_mensual, name='reportes'),
    path('arqueo/', views.arqueo_caja, name='arqueo_caja'),
]