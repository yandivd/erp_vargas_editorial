from django.urls import path

from . import api


app_name = 'compras_api'

urlpatterns = [
    path('lista/', api.api_compras, name='lista'),
]
