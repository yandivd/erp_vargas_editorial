from django.db import models
from proveedores.models import Proveedor
from clientes.models import Cliente
from pedidos.models import Pedido


class MovimientoCaja(models.Model):
    TIPO_CHOICES = [
        ('INGRESO', 'Ingreso'),
        ('EGRESO', 'Egreso'),
    ]
    CATEGORIA_CHOICES = [
        ('ANTICIPO_clientes', 'Anticipo de clientes'),
        ('SALDO_clientes', 'Saldo de clientes'),
        ('PAGO_PROVEEDOR', 'Pago a proveedor'),
        ('COMPRA_MATERIAL', 'Compra de material'),
        ('GASTO_OPERATIVO', 'Gasto operativo'),
        ('COMPRA_ACTIVO', 'Compra de activo fijo'),
        ('OTRO', 'Otro'),
    ]
    METODO_CHOICES = [
        ('EFECTIVO', 'Efectivo'),
        ('TRANSFERENCIA', 'Transferencia'),
        ('TARJETA', 'Tarjeta'),
        ('OTRO', 'Otro'),
    ]
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    categoria = models.CharField(max_length=30, choices=CATEGORIA_CHOICES)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    metodo = models.CharField(max_length=20, choices=METODO_CHOICES, default='EFECTIVO')
    concepto = models.CharField(max_length=200, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)
    pedido = models.ForeignKey(Pedido, on_delete=models.SET_NULL, null=True, blank=True)
    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True)
    clientes = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = 'Movimiento de caja'
        verbose_name_plural = 'Movimientos de caja'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.get_tipo_display()}: {self.monto} - {self.concepto}"


class ActivoFijo(models.Model):
    nombre = models.CharField(max_length=200)
    fecha_compra = models.DateField()
    valor_compra = models.DecimalField(max_digits=12, decimal_places=2)
    vida_util_meses = models.PositiveIntegerField()
    valor_residual = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    depreciacion_acumulada = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Activo fijo'
        verbose_name_plural = 'Activos fijos'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre

    @property
    def depreciacion_mensual(self):
        base = self.valor_compra - self.valor_residual
        if self.vida_util_meses == 0:
            return 0
        return base / self.vida_util_meses

    @property
    def valor_actual(self):
        return self.valor_compra - self.depreciacion_acumulada


class Depreciacion(models.Model):
    activo = models.ForeignKey(ActivoFijo, on_delete=models.CASCADE, related_name='depreciaciones')
    mes = models.DateField()  # Primer día del mes
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Depreciación'
        verbose_name_plural = 'Depreciaciones'
        unique_together = ('activo', 'mes')

    def __str__(self):
        return f"{self.activo.nombre} - {self.mes} - {self.monto}"


class GastoOperativo(models.Model):
    concepto = models.CharField(max_length=200)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    fecha = models.DateField()
    mes_imputacion = models.DateField(help_text="Primer día del mes al que corresponde")
    notas = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Gasto operativo'
        verbose_name_plural = 'Gastos operativos'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.concepto} - {self.monto}"