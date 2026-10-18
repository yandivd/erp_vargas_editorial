from django.db import models
from django.utils import timezone
from proveedores.models import Proveedor
from inventario.models import Material


class OrdenCompra(models.Model):
    ESTADOS = [
        ('BORRADOR', 'Borrador (Pendiente de Recibir)'),
        ('RECIBIDA', 'Recibida (Pagada y en Almacén)'),
        ('CANCELADA', 'Cancelada'),
    ]
    
    proveedor = models.ForeignKey(Proveedor, on_delete=models.PROTECT, related_name='ordenes_compra', verbose_name='Proveedor')
    fecha = models.DateField(default=timezone.now, verbose_name='Fecha de Emisión')
    fecha_recepcion = models.DateTimeField(null=True, blank=True, verbose_name='Fecha de Recepción')
    estado = models.CharField(max_length=20, choices=ESTADOS, default='BORRADOR', verbose_name='Estado')
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='Total')
    notas = models.TextField(blank=True, verbose_name='Notas')
    
    class Meta:
        verbose_name = 'Orden de Compra'
        verbose_name_plural = 'Órdenes de Compra'
        ordering = ['-fecha']

    def __str__(self):
        return f"OC-{self.id:05d} - {self.proveedor.nombre}"


class DetalleCompra(models.Model):
    orden = models.ForeignKey(OrdenCompra, on_delete=models.CASCADE, related_name='detalles')
    material = models.ForeignKey(Material, on_delete=models.PROTECT, verbose_name='Material')
    cantidad = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Cantidad')
    costo_unitario = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Costo Unitario')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, editable=False)

    class Meta:
        verbose_name = 'Detalle de Compra'
        verbose_name_plural = 'Detalles de Compra'

    def save(self, *args, **kwargs):
        self.subtotal = self.cantidad * self.costo_unitario
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.cantidad} x {self.material.nombre}"