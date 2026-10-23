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
        ('ANTICIPO_CLIENTE', 'Anticipo de cliente'),
        ('SALDO_CLIENTE', 'Saldo de cliente'),
        ('SALDO_INICIAL', 'Saldo de apertura'),
        ('INGRESO_MANUAL', 'Ingreso manual'),
        ('PROPINA', 'Propina'),
        ('MENSAJERIA', 'Mensajería / Envío'),
        ('VENTA_DIRECTA', 'Venta directa'),
        ('OTRO_INGRESO', 'Otro ingreso'),
        ('PAGO_PROVEEDOR', 'Pago a proveedor'),
        ('COMPRA_MATERIAL', 'Compra de material'),
        ('GASTO_OPERATIVO', 'Gasto operativo'),
        ('PAGO_NOMINA', 'Pago de Nómina'),
        ('RETIRO_UTILIDADES', 'Retiro de Utilidades'),
        ('COMPRA_ACTIVO', 'Compra de activo fijo'),
        ('TRANSFERENCIA', 'Transferencia entre cuentas'),
        ('COMPRA_DIVISA', 'Compra de divisa'),
        ('VENTA_DIVISA', 'Venta de divisa'),
        ('GANANCIA_CAMBIARIA', 'Ganancia por diferencia cambiaria'),
        ('PERDIDA_CAMBIARIA', 'Pérdida por diferencia cambiaria'),
    ]
    METODO_CHOICES = [
        ('EFECTIVO', 'Efectivo'),
        ('TRANSFERENCIA', 'Transferencia'),
        ('TARJETA', 'Tarjeta'),
        ('OTRO', 'Otro'),
    ]

    MONEDA_CHOICES = [
        ('CUP', 'Peso Cubano (CUP)'),
        ('USD', 'Dólar (USD)'),
    ]
    moneda = models.CharField(max_length=3, choices=MONEDA_CHOICES, default='CUP', verbose_name='Moneda')
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    categoria = models.CharField(max_length=30, choices=CATEGORIA_CHOICES)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    metodo = models.CharField(max_length=20, choices=METODO_CHOICES, default='EFECTIVO')
    concepto = models.CharField(max_length=200, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)
    pedido = models.ForeignKey(Pedido, on_delete=models.SET_NULL, null=True, blank=True)
    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True)
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True)

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
    
class CierreCaja(models.Model):
    fecha = models.DateTimeField(auto_now_add=True)
    usuario = models.CharField(max_length=100, blank=True)
    
    # Totales
    saldo_sistema = models.DecimalField(max_digits=12, decimal_places=2, help_text="Lo que el ERP dice que debería haber")
    efectivo_real = models.DecimalField(max_digits=12, decimal_places=2, help_text="Lo que se contó")
    diferencia = models.DecimalField(max_digits=12, decimal_places=2, help_text="Efectivo - Sistema")
    
    # Desglose
    transferencia = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Billetes (guardamos la cantidad de cada uno)
    b_20000 = models.IntegerField(default=0)
    b_10000 = models.IntegerField(default=0)
    b_5000 = models.IntegerField(default=0)
    b_2000 = models.IntegerField(default=0)
    b_1000 = models.IntegerField(default=0)
    b_500 = models.IntegerField(default=0)
    b_200 = models.IntegerField(default=0)
    b_100 = models.IntegerField(default=0)
    b_50 = models.IntegerField(default=0)
    b_20 = models.IntegerField(default=0)
    b_10 = models.IntegerField(default=0)
    b_5 = models.IntegerField(default=0)
    b_1 = models.IntegerField(default=0)
    
    notas = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Cierre de Caja'
        verbose_name_plural = 'Cierres de Caja'
        ordering = ['-fecha']

    def __str__(self):
        return f"Cierre {self.fecha.strftime('%d/%m/%Y %H:%M')}"

class LoteDivisa(models.Model):
    fecha_compra = models.DateTimeField(auto_now_add=True)
    cantidad_usd = models.DecimalField(max_digits=12, decimal_places=2)
    precio_compra = models.DecimalField(max_digits=12, decimal_places=2, help_text="CUP por 1 USD")
    cantidad_disponible = models.DecimalField(max_digits=12, decimal_places=2)
    referencia = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ['fecha_compra']  # FIFO

    def __str__(self):
        return f"Lote {self.id}: {self.cantidad_disponible} USD @ {self.precio_compra}"

class DetalleVentaDivisa(models.Model):
    movimiento_venta = models.ForeignKey(
        MovimientoCaja, on_delete=models.CASCADE, related_name='detalles_divisa'
    )
    lote = models.ForeignKey(LoteDivisa, on_delete=models.PROTECT)
    cantidad_usd = models.DecimalField(max_digits=12, decimal_places=2)
    costo_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    costo_total = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"Venta {self.movimiento_venta_id}: {self.cantidad_usd} USD del lote {self.lote_id}"