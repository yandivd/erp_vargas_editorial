from django.urls import path
from . import views

app_name = 'clientes'

urlpatterns = [
    path('', views.lista_clientes, name='lista'),
    path('<int:pk>/', views.detalle_cliente, name='detalle'),
]