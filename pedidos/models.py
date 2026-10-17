from django.db import models
from django.utils import timezone
from clientes.models import Cliente


class Pedido(models.Model):
    ESTADO_CHOICES = [
        ('Borrador', 'Borrador'),
        ('Pendiente de anticipo', 'Pendiente de anticipo'),
        ('Anticipo recibido', 'Anticipo recibido'),
        ('En diseño', 'En diseño'),
        ('Diseño aprobado', 'Diseño aprobado'),
        ('Pendiente de impresión', 'Pendiente de impresión'),
        ('Impreso', 'Impreso'),
        ('Pegado', 'Pegado'),
        ('Portada solicitada', 'Portada solicitada'),
        ('Portada recibida', 'Portada recibida'),
        ('Entregado a encuadernador', 'Entregado a encuadernador'),
        ('Encuadernando', 'Encuadernando'),
        ('Recibido de encuadernador', 'Recibido de encuadernador'),
        ('Listo para entregar', 'Listo para entregar'),
        ('Entregado', 'Entregado'),
        ('Cancelado', 'Cancelado'),
    ]

    # Datos del libro
    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT, related_name='pedidos')
    titulo_libro = models.CharField(max_length=200)
    autor = models.CharField(max_length=200, blank=True)
    paginas = models.PositiveIntegerField()
    cantidad = models.PositiveIntegerField(default=1)
    lleva_scotch = models.BooleanField(default=False)
    lleva_esquineros = models.BooleanField(default=False)
    tipo_tapa = models.CharField(max_length=50, blank=True)

    # Precio y pagos
    precio_venta = models.DecimalField(max_digits=10, decimal_places=2)
    anticipo_requerido = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    anticipo_recibido = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    saldo_pendiente = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Estado y fechas
    estado = models.CharField(max_length=50, choices=ESTADO_CHOICES, default='Borrador')
    fecha_pedido = models.DateTimeField(auto_now_add=True)
    fecha_entrega_prometida = models.DateField(null=True, blank=True)
    fecha_entrega_real = models.DateTimeField(null=True, blank=True)

    # Tiempo invertido (para control interno)
    horas_invertidas = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    # Entrega
    direccion_entrega = models.TextField(blank=True)
    telefono_entrega = models.CharField(max_length=50, blank=True)

    notas = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Pedido'
        verbose_name_plural = 'Pedidos'
        ordering = ['-fecha_pedido']

    def __str__(self):
        return f"#{self.id} - {self.titulo_libro} ({self.cliente.nombre})"

    def save(self, *args, **kwargs):
        # Calcular saldo automáticamente
        self.saldo_pendiente = self.precio_venta - self.anticipo_recibido
        super().save(*args, **kwargs)

    @property
    def hojas_necesarias(self):
        """Hojas físicas necesarias (4 páginas por hoja)"""
        return (self.paginas + 3) // 4  # Redondeo hacia arriba

    @property
    def dias_para_entrega(self):
        if not self.fecha_entrega_prometida:
            return None
        return (self.fecha_entrega_prometida - timezone.now().date()).days

    @property
    def esta_atrasado(self):
        if not self.fecha_entrega_prometida or self.estado == 'Entregado':
            return False
        return timezone.now().date() > self.fecha_entrega_prometida

    @property
    def ganancia_bruta(self):
        costos = sum(s.monto for s in self.servicios_externos.all())
        return self.precio_venta - costos

    @property
    def ganancia_por_hora(self):
        if not self.horas_invertidas or self.horas_invertidas == 0:
            return None
        return self.ganancia_bruta / self.horas_invertidas


class HistorialEstado(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='historial')
    estado_anterior = models.CharField(max_length=50, blank=True)
    estado_nuevo = models.CharField(max_length=50)
    fecha = models.DateTimeField(auto_now_add=True)
    usuario = models.CharField(max_length=100, blank=True)
    notas = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Historial de estado'
        verbose_name_plural = 'Historial de estados'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.pedido} - {self.estado_nuevo}"

class ServicioExterno(models.Model):
    TIPO_CHOICES = [
        ('PORTADA', 'Portada'),
        ('ENCUADERNADO', 'Encuadernado'),
        ('OTRO', 'Otro'),
    ]
    ESTADO_CHOICES = [
        ('SOLICITADO', 'Solicitado'),
        ('RECIBIDO', 'Recibido'),
        ('PAGADO', 'Pagado'),
    ]
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='servicios_externos')
    proveedor = models.ForeignKey('proveedores.Proveedor', on_delete=models.PROTECT)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='SOLICITADO')
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    fecha_recepcion = models.DateTimeField(null=True, blank=True)
    fecha_pago = models.DateTimeField(null=True, blank=True)
    notas = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Servicio externo'
        verbose_name_plural = 'Servicios externos'
        ordering = ['-fecha_solicitud']

    def __str__(self):
        return f"{self.get_tipo_display()} - {self.pedido} - {self.monto}"