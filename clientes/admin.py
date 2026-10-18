from django.contrib import admin
from .models import Cliente


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'telefono', 'total_pedidos', 'fecha_registro')
    search_fields = ('nombre', 'telefono',)
    readonly_fields = ('fecha_registro',)