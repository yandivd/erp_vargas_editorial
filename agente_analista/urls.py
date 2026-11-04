from django.urls import path

from . import views


app_name = 'agente_analista'

urlpatterns = [
    path('analista/', views.chat, name='chat'),
    path('analista/chat/', views.chat_api, name='chat_api'),
]
