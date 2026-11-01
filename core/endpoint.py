from django.urls import path

from . import api


app_name = 'core_api'

urlpatterns = [
    path('dashboard/', api.dashboard_api, name='dashboard'),
]
