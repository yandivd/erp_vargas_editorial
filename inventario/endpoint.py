from django.urls import path

from . import api


app_name = 'inventario_api'

urlpatterns = [
    path('materiales/', api.api_materiales, name='materiales'),
    path('lotes/', api.api_lotes, name='lotes'),
]
