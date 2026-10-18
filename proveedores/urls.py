from django.urls import path
from . import views

app_name = 'proveedores'

urlpatterns = [
    path('', views.lista_proveedores, name='lista'),
    path('cuentas-por-pagar/', views.cuentas_por_pagar, name='cuentas_por_pagar'),
    path('servicio/<int:pk>/recibir/', views.recibir_servicio, name='recibir_servicio'),
    path('servicio/<int:pk>/pagar/', views.pagar_servicio, name='pagar_servicio'),
]