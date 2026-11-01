from django.urls import path

from . import api


app_name = 'clientes_api'

urlpatterns = [
    path('lista/', api.api_lista_clientes, name='lista'),
]
