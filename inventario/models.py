from django.db import models
from proveedores.models import Proveedor


class Material(models.Model):
    UNIDAD_CHOICES = [
        ('hoja', 'Hoja'),
        ('ml', 'Mililitro'),
        ('pomo', 'Pomo'),
        ('litro', 'Litro'),
        ('unidad', 'Unidad'),
        ('rollo', 'Rollo'),
    ]
    nombre = models.CharField(max_length=100)
    unidad_medida = models.CharField(max_length=20, choices=UNIDAD_CHOICES)
    stock_actual = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    stock_minimo = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    costo_promedio = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Material'
        verbose_name_plural = 'Materiales'
        ordering = ['nombre']

    def __str__(self):
        return f"{self.nombre} ({self.stock_actual} {self.unidad_medida})"

    @property
    def stock_bajo(self):
        return self.stock_actual <= self.stock_minimo


class MovimientoInventario(models.Model):
    TIPO_CHOICES = [
        ('ENTRADA', 'Entrada'),
        ('SALIDA', 'Salida'),
        ('AJUSTE', 'Ajuste'),
    ]
    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name='movimientos')
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    cantidad = models.DecimalField(max_digits=12, decimal_places=2)
    costo_unitario = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    costo_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    fecha = models.DateTimeField(auto_now_add=True)
    pedido = models.ForeignKey('pedidos.Pedido', on_delete=models.SET_NULL,
                                null=True, blank=True, related_name='movimientos_inventario')
    proveedor = models.ForeignKey(Proveedor, on_delete=models.SET_NULL,
                                   null=True, blank=True)
    motivo = models.CharField(max_length=200, blank=True)

    class Meta:
        verbose_name = 'Movimiento de inventario'
        verbose_name_plural = 'Movimientos de inventario'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.get_tipo_display()} {self.cantidad} {self.material.nombre}"

    def save(self, *args, **kwargs):
        # Calcular costo total
        self.costo_total = self.cantidad * self.costo_unitario

        # Actualizar stock del material
        if self.pk is None:  # Solo si es nuevo
            material = self.material
            if self.tipo == 'ENTRADA':
                material.stock_actual += self.cantidad
            elif self.tipo == 'SALIDA':
                material.stock_actual -= self.cantidad
            elif self.tipo == 'AJUSTE':
                material.stock_actual = self.cantidad

            # Recalcular costo promedio
            if self.tipo == 'ENTRADA' and material.stock_actual > 0:
                valor_anterior = (material.stock_actual - self.cantidad) * material.costo_promedio
                valor_nuevo = self.cantidad * self.costo_unitario
                material.costo_promedio = (valor_anterior + valor_nuevo) / material.stock_actual

            material.save()

        super().save(*args, **kwargs)