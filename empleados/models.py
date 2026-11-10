from django.db import models
from django.utils import timezone

class Empleado(models.Model):
    CARGOS = [
        ('GERENTE', 'Gerente / Dueño'),
        ('OPERARIO', 'Operario de Taller'),
        ('AYUDANTE', 'Ayudante'),
    ]
    nombre = models.CharField(max_length=150)
    cargo = models.CharField(max_length=50, choices=CARGOS)
    telefono = models.CharField(max_length=50, blank=True)
    salario_base = models.DecimalField(max_digits=10, decimal_places=2)
    activo = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.nombre} - {self.get_cargo_display()}"

class PagoNomina(models.Model):
    TIPO_PAGO = [
        ('SALARIO', 'Salario (Gasto de Nómina)'),
        ('UTILIDADES', 'Retiro de Utilidades (Dueño)'),
    ]
    MONEDA_CHOICES = [
        ('CUP', 'Peso Cubano (CUP)'),
        ('USD', 'Dólar (USD)'),
    ]

    empleado = models.ForeignKey(Empleado, on_delete=models.PROTECT, related_name='pagos')
    tipo = models.CharField(max_length=20, choices=TIPO_PAGO, default='SALARIO', verbose_name='Tipo de Pago')
    fecha = models.DateField(default=timezone.now)
    mes_correspondiente = models.CharField(max_length=50, help_text="Ej: Octubre 2026")
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2)
    moneda = models.CharField(
        max_length=3,
        choices=MONEDA_CHOICES,
        default='CUP',
        verbose_name='Moneda',
    )
    tasa_aplicada = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        null=True,
        blank=True,
        verbose_name='Tasa aplicada',
    )
    notas = models.TextField(blank=True, help_text="Adelantos, bonos, descuentos, etc.")
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Pago de Nómina'
        verbose_name_plural = 'Pagos de Nómina'
        ordering = ['-fecha']