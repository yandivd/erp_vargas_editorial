from django.urls import path

from . import api


app_name = 'empleados_api'

urlpatterns = [
    path('empleados/', api.api_empleados, name='empleados'),
    path('pagos/', api.api_pagos, name='pagos'),
]
