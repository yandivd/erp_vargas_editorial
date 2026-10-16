from django.db import models


class clientes(models.Model):
    nombre = models.CharField(max_length=200)
    telefono = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    direccion = models.TextField(blank=True)
    notas = models.TextField(blank=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'clientes'
        verbose_name_plural = 'clientes'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre

    @property
    def total_pedidos(self):
        return self.pedidos.count()

    @property
    def total_facturado(self):
        return sum(p.precio_venta for p in self.pedidos.all())

    @property
    def saldo_pendiente_total(self):
        return sum(p.saldo_pendiente for p in self.pedidos.filter(
            estado__in=['Anticipo recibido', 'En diseño', 'Pendiente de impresión',
                        'Impreso', 'Pegado', 'Portada solicitada', 'Portada recibida',
                        'Encuadernando', 'Listo para entregar']
        ))