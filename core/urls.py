from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('exportar-ia/', views.exportar_datos_ia, name='exportar_datos_ia'),
]