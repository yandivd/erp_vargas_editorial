from django.contrib import admin
from django.urls import path, include
from django.contrib.auth import views as auth_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('login/', auth_views.LoginView.as_view(template_name='login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    
    # La PWA debe ir ANTES de las rutas con prefijos para que Django
    # pueda resolver el manifest y el service worker correctamente.
    path('', include('pwa.urls')), 
    
    # Rutas de la aplicación
    path('', include('core.urls')),
    path('pedidos/', include('pedidos.urls')),
    path('inventario/', include('inventario.urls')),
    path('finanzas/', include('finanzas.urls')),
    path('clientes/', include('clientes.urls')),
    path('proveedores/', include('proveedores.urls')),
    path('empleados/', include('empleados.urls')),
    path('compras/', include('compras.urls')),
]