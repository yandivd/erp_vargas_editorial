from django.contrib import admin
from .models import clientes


@admin.register(clientes)
class clientesAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'telefono', 'email', 'total_pedidos', 'fecha_registro')
    search_fields = ('nombre', 'telefono', 'email')
    readonly_fields = ('fecha_registro',)