from django.db import models
from django.utils.safestring import mark_safe
from django.utils import timezone
from django.db.models import Sum
from clientes.models import Cliente
from proveedores.models import Proveedor


# ============================================================
# LIBRO (catálogo)
# ============================================================
class Book(models.Model):
    titulo = models.CharField(max_length=200, verbose_name='Título')
    autor = models.CharField(max_length=200, blank=True, verbose_name='Autor')
    paginas = models.PositiveIntegerField(verbose_name='Páginas')
    # tipo_tapa = models.CharField(max_length=50, blank=True, verbose_name='Tipo de tapa')
    descripcion = models.TextField(blank=True, verbose_name='Descripción')
    notas = models.TextField(blank=True, verbose_name='Notas')
    fecha_creacion = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de creación')
    precio = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Precio base') # <-- NUEVO CAMPO

    class Meta:
        verbose_name = 'Libro'
        verbose_name_plural = 'Libros'
        ordering = ['titulo']

    def __str__(self):
        if self.autor:
            return f"{self.titulo} - {self.autor}"
        return self.titulo

    @property
    def hojas_necesarias(self):
        return (self.paginas + 3) // 4  # redondeo hacia arriba


# ============================================================
# ESTADO DEL PEDIDO (configurable)
# ============================================================
class Estado(models.Model):
    nombre = models.CharField(max_length=50, unique=True, verbose_name='Nombre')
    color = models.CharField(
        max_length=7,
        default='#6c757d',
        verbose_name='Color',
        help_text='Color en formato hexadecimal, ej. #FF0000'
    )
    orden = models.PositiveIntegerField(default=0, verbose_name='Orden en el flujo')
    es_final = models.BooleanField(default=False, verbose_name='¿Es estado final?')
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Estado'
        verbose_name_plural = 'Estados'
        ordering = ['orden', 'nombre']

    def __str__(self):
        return self.nombre

    def colored_name(self):
        return mark_safe(f'<span style="color: {self.color}; font-weight: bold;">{self.nombre}</span>')
    colored_name.short_description = 'Nombre'

class CodigoDescuento(models.Model):
    codigo = models.CharField(max_length=50, unique=True, verbose_name='Código')
    descripcion = models.CharField(max_length=200, blank=True, verbose_name='Descripción')
    porcentaje = models.DecimalField(max_digits=5, decimal_places=2, verbose_name='Porcentaje de descuento')
    fecha_inicio = models.DateField(null=True, blank=True, verbose_name='Válido desde')
    fecha_fin = models.DateField(null=True, blank=True, verbose_name='Válido hasta')
    activo = models.BooleanField(default=True, verbose_name='Activo')
    # Condición opcional: solo aplica a libros de cierta categoría/género
    categoria = models.CharField(
        max_length=50, blank=True, verbose_name='Categoría (opcional)',
        help_text='Si se indica, el descuento solo aplica a libros de esta categoría'
    )
    usos_maximos = models.PositiveIntegerField(null=True, blank=True, verbose_name='Usos máximos')
    usos_actuales = models.PositiveIntegerField(default=0, verbose_name='Usos actuales')

    class Meta:
        verbose_name = 'Código de descuento'
        verbose_name_plural = 'Códigos de descuento'
        ordering = ['-fecha_inicio', 'codigo']

    def __str__(self):
        return f"{self.codigo} ({self.porcentaje}%)"

    @property
    def vigente(self):
        from django.utils import timezone
        hoy = timezone.now().date()
        if not self.activo:
            return False
        if self.fecha_inicio and hoy < self.fecha_inicio:
            return False
        if self.fecha_fin and hoy > self.fecha_fin:
            return False
        if self.usos_maximos and self.usos_actuales >= self.usos_maximos:
            return False
        return True

    def aplica_a_libro(self, libro):
        """Devuelve True si el código aplica al libro dado."""
        if not self.categoria:
            return True
        # Asumimos que Book tiene un campo 'categoria' o 'genero'
        return getattr(libro, 'categoria', '') == self.categoria


# ============================================================
# PEDIDO
# ============================================================
class Pedido(models.Model):
    cliente = models.ForeignKey(
        Cliente, on_delete=models.PROTECT, related_name='pedidos',
        verbose_name='Cliente', null=True, blank=True # <-- Agregamos null y blank
    )
    libro = models.ForeignKey(
        Book, on_delete=models.PROTECT, related_name='pedidos',
        verbose_name='Libro'
    )
    cantidad = models.PositiveIntegerField(default=1, verbose_name='Cantidad')

    lleva_scotch = models.BooleanField(default=False, verbose_name='Lleva scotch')
    lleva_esquineros = models.BooleanField(default=False, verbose_name='Lleva esquineros')

    # Precios
    precio_venta = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Precio venta')
    anticipo_requerido = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Anticipo requerido')
    anticipo_recibido = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Anticipo recibido')
    saldo_pendiente = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Saldo pendiente')

    # Estado y fechas
    estado = models.ForeignKey(
        Estado, on_delete=models.PROTECT, related_name='pedidos',
        verbose_name='Estado'
    )
    fecha_pedido = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de pedido')
    fecha_entrega_prometida = models.DateField(null=True, blank=True, verbose_name='Fecha de entrega prometida')
    fecha_entrega_real = models.DateTimeField(null=True, blank=True, verbose_name='Fecha de entrega real')

    horas_invertidas = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        verbose_name='Horas invertidas'
    )

    # Entrega
    direccion_entrega = models.TextField(blank=True, verbose_name='Dirección de entrega')
    telefono_entrega = models.CharField(max_length=50, blank=True, verbose_name='Teléfono de entrega')

    notas = models.TextField(blank=True, verbose_name='Notas')

    referencia_externa = models.PositiveIntegerField(
        null=True, blank=True, unique=True,
        verbose_name='Referencia Original',
        help_text='Número de pedido del sistema anterior (Excel)'
    )
    codigo_descuento = models.ForeignKey(
        CodigoDescuento, on_delete=models.SET_NULL, null=True, blank=True,
        verbose_name='Código de descuento'
    )
    descuento_aplicado = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        verbose_name='Descuento aplicado'
    )

    class Meta:
        verbose_name = 'Pedido'
        verbose_name_plural = 'Pedidos'
        ordering = ['-fecha_pedido']

    def __str__(self):
        nombre_cliente = self.cliente.nombre if self.cliente else "Stock / Venta Directa"
        return f"#{self.id} - {self.libro.titulo} ({nombre_cliente})"

    def save(self, *args, **kwargs):
        self.saldo_pendiente = self.precio_venta - self.anticipo_recibido
        super().save(*args, **kwargs)

    def calcular_fecha_entrega(self):
        """Calcula la fecha de entrega: 28 días desde el pago del anticipo."""
        from datetime import timedelta
        
        # Usamos la fecha actual como base (que será cuando se cobra el anticipo)
        # También podrías usar timezone.now() si prefieres con hora, pero el campo es DateField
        hoy = timezone.now().date()
        self.fecha_entrega_prometida = hoy + timedelta(days=28)
        self.save(update_fields=['fecha_entrega_prometida'])

    # ---------- Atajos para que los servicios existentes sigan funcionando ----------
    @property
    def titulo_libro(self):
        return self.libro.titulo

    @property
    def autor(self):
        return self.libro.autor

    @property
    def paginas(self):
        return self.libro.paginas

    @property
    def hojas_necesarias(self):
        return self.libro.hojas_necesarias

    @property
    def dias_para_entrega(self):
        if not self.fecha_entrega_prometida:
            return None
        return (self.fecha_entrega_prometida - timezone.now().date()).days

    @property
    def esta_atrasado(self):
        if not self.fecha_entrega_prometida or self.estado.es_final:
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

    @property
    def direccion_completa(self):
        return self.direccion_entrega or (self.cliente.direccion if self.cliente else '') or '—'


# ============================================================
# HISTORIAL DE ESTADOS
# ============================================================
class HistorialEstado(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='historial')
    estado_anterior = models.ForeignKey(
        Estado, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='historial_como_anterior'
    )
    estado_nuevo = models.ForeignKey(
        Estado, on_delete=models.CASCADE,
        related_name='historial_como_nuevo'
    )
    fecha = models.DateTimeField(auto_now_add=True)
    usuario = models.CharField(max_length=100, blank=True)
    notas = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Historial de estado'
        verbose_name_plural = 'Historial de estados'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.pedido} - {self.estado_nuevo.nombre}"


# ============================================================
# SERVICIOS EXTERNOS
# ============================================================
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
    proveedor = models.ForeignKey(Proveedor, on_delete=models.PROTECT)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='SOLICITADO')
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    fecha_recepcion = models.DateTimeField(null=True, blank=True)
    fecha_pago = models.DateTimeField(null=True, blank=True)
    notas = models.TextField(blank=True)
    lote = models.ForeignKey(
        'LoteServicio', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='servicios'
    )

    class Meta:
        verbose_name = 'Servicio externo'
        verbose_name_plural = 'Servicios externos'
        ordering = ['-fecha_solicitud']

    def __str__(self):
        return f"{self.get_tipo_display()} - Pedido #{self.pedido_id} - ${self.monto}"
    
# ============================================================
# LOTE DE SERVICIO (agrupa servicios externos del mismo proveedor/tipo)
# ============================================================
class LoteServicio(models.Model):
    ESTADO_CHOICES = [
        ('ABIERTO', 'Abierto'),
        ('CERRADO', 'Cerrado'),
        ('PAGADO', 'Pagado'),
        ('CANCELADO', 'Cancelado'),
    ]

    numero = models.CharField(max_length=20, unique=True, blank=True)
    proveedor = models.ForeignKey(
        Proveedor, on_delete=models.PROTECT, related_name='lotes_servicio'
    )
    tipo = models.CharField(max_length=20, choices=ServicioExterno.TIPO_CHOICES)
    fecha_apertura = models.DateTimeField(auto_now_add=True)
    fecha_cierre = models.DateTimeField(null=True, blank=True)
    fecha_pago = models.DateTimeField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='ABIERTO')
    notas = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Lote de servicio'
        verbose_name_plural = 'Lotes de servicio'
        ordering = ['-fecha_apertura']

    def __str__(self):
        return f"Lote {self.numero} - {self.get_tipo_display()} ({self.servicios.count()} servicios)"

    def save(self, *args, **kwargs):
        if not self.numero:
            from django.utils import timezone
            prefijo = timezone.now().strftime('%Y%m%d')
            ultimo = LoteServicio.objects.filter(numero__startswith=f"LOTE-{prefijo}").order_by('-id').first()
            secuencia = 1
            if ultimo:
                try:
                    secuencia = int(ultimo.numero.split('-')[-1]) + 1
                except (ValueError, IndexError):
                    secuencia = 1
            self.numero = f"LOTE-{prefijo}-{secuencia:03d}"
        super().save(*args, **kwargs)

    @property
    def cantidad_servicios(self):
        return self.servicios.count()

    @property
    def costo_total(self):
        return self.servicios.aggregate(t=Sum('monto'))['t'] or 0

    @property
    def pedidos_ids(self):
        return list(self.servicios.values_list('pedido_id', flat=True))
    
