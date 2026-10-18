from django.contrib import admin
from .models import OrdenCompra, DetalleCompra

class DetalleInline(admin.TabularInline):
    model = DetalleCompra
    extra = 1

@admin.register(OrdenCompra)
class OrdenCompraAdmin(admin.ModelAdmin):
    list_display = ('id', 'proveedor', 'fecha', 'total', 'estado')
    list_filter = ('estado', 'proveedor')
    inlines = [DetalleInline]