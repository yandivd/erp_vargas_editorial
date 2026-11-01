from django.urls import path

from . import api


app_name = 'finanzas_api'

urlpatterns = [
    path('caja/', api.api_movimientos_caja, name='caja'),
]
