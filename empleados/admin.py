from django.contrib import admin
from .models import Empleado, PagoNomina

@admin.register(Empleado)
class EmpleadoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'cargo', 'salario_base', 'telefono', 'activo')
    list_filter = ('cargo', 'activo')
    search_fields = ('nombre',)

@admin.register(PagoNomina)
class PagoNominaAdmin(admin.ModelAdmin):
    list_display = ('fecha', 'empleado', 'mes_correspondiente', 'monto_pagado')
    list_filter = ('empleado', 'fecha')
    date_hierarchy = 'fecha'