from django.urls import path
from . import views

app_name = 'inventario'

urlpatterns = [
    path('', views.lista_inventario, name='lista'),
    path('comprar/', views.registrar_compra_modal, name='comprar_modal'),
    path('<int:pk>/', views.detalle_material, name='detalle'),
    path('<int:pk>/ajuste/', views.registrar_ajuste, name='ajuste'),
]