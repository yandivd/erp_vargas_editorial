from django.urls import path
from . import views

app_name = 'compras'

urlpatterns = [
    path('', views.lista_compras, name='lista'),
    path('nueva/', views.nueva_compra, name='nueva'),
    path('<int:pk>/recibir/', views.recibir_compra, name='recibir'),
    path('<int:pk>/cancelar/', views.cancelar_compra, name='cancelar'),
    path('<int:pk>/imprimir/', views.imprimir_compra, name='imprimir'),
]