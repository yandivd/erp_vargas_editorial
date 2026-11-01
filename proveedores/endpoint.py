from django.urls import path

from . import api


app_name = 'proveedores_api'

urlpatterns = [
    path('lista/', api.api_proveedores, name='lista'),
]
