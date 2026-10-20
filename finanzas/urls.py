from django.urls import path
from . import views

app_name = 'finanzas'

urlpatterns = [
    path('caja/', views.caja, name='caja'),
    path('caja/ajax/', views.caja_ajax, name='caja_ajax'),
    path('gasto/', views.registrar_gasto, name='registrar_gasto'),
    path('ingreso/', views.registrar_ingreso, name='registrar_ingreso'),
    path('activos/', views.lista_activos, name='activos'),
    path('activos/registrar/', views.registrar_activo, name='registrar_activo'),
    path('activos/depreciar/', views.depreciar_mes, name='depreciar_mes'),
    path('reportes/', views.reporte_mensual, name='reportes'),
    path('arqueo/', views.arqueo_caja, name='arqueo_caja'),
    path('divisas/', views.gestionar_divisas, name='gestionar_divisas'),
    path('arqueo/<int:pk>/pdf/', views.arqueo_caja_pdf, name='arqueo_caja_pdf'),
]