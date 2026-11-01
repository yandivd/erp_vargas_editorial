from django.urls import path

from . import api, views


urlpatterns = [
    path('', api.dashboard_page, name='dashboard'),
    path('exportar-ia/', views.exportar_datos_ia, name='exportar_datos_ia'),
]
