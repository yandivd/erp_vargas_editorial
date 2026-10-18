from django.urls import path
from . import views

app_name = 'empleados'

urlpatterns = [
    path('', views.lista_empleados, name='lista'),
    path('registrar/', views.registrar_empleado, name='registrar'),
    path('pagar/', views.pagar_nomina, name='pagar'),
]