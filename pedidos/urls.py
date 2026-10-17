from django.urls import path
from . import views

app_name = 'pedidos'

urlpatterns = [
    path('', views.lista, name='lista'),
    path('<int:pk>/', views.detalle, name='detalle'),
    path('<int:pk>/cambiar-estado/', views.cambiar_estado, name='cambiar_estado'),
    path('<int:pk>/anticipo/', views.registrar_anticipo, name='registrar_anticipo'),
    path('<int:pk>/confirmar/', views.confirmar_pedido, name='confirmar'),
]