from django.urls import path
from . import views

app_name = 'finanzas'

urlpatterns = [
    path('caja/', views.caja, name='caja'),
    path('gasto/', views.registrar_gasto, name='registrar_gasto'),
]