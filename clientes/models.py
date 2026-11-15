import uuid

from django.db import models
from django.utils import timezone
from django.db.models import Sum
from datetime import timedelta


class Cliente(models.Model):
    nombre = models.CharField(max_length=200)
    telefono = models.CharField(max_length=50, blank=True)
    direccion = models.TextField(blank=True)
    notas = models.TextField(blank=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre

    # --- PROPIEDADES FINANCIERAS ---
    @property
    def total_pedidos(self):
        """Total de pedidos realizados, excluyendo los cancelados."""
        return self.pedidos.exclude(estado__nombre='Cancelado').count()

    @property
    def total_facturado(self):
        return self.pedidos.aggregate(total=Sum('precio_venta'))['total'] or 0

    @property
    def saldo_pendiente_total(self):
        """Suma el saldo de todos los pedidos que no estén entregados ni cancelados."""
        return self.pedidos.exclude(estado__nombre__in=['Entregado', 'Cancelado']).aggregate(total=Sum('saldo_pendiente'))['total'] or 0

    # --- PROPIEDADES PARA LOS BADGES (SEGMENTACIÓN) ---
    @property
    def total_libros(self):
        """Cuenta cuántos libros ha comprado en total (pedidos no cancelados)."""
        return self.pedidos.exclude(estado__nombre='Cancelado').aggregate(
            total=Sum('cantidad')
        )['total'] or 0

    @property
    def fecha_ultimo_pedido(self):
        """Fecha del último pedido no cancelado."""
        ultimo = (
            self.pedidos.exclude(estado__nombre='Cancelado')
            .order_by('-fecha_pedido')
            .first()
        )
        return ultimo.fecha_pedido if ultimo else None

    @property
    def dias_sin_comprar(self):
        """Días desde su último pedido no cancelado (por fecha de pedido)."""
        ultima = self.fecha_ultimo_pedido
        if not ultima:
            return 999
        ultima_fecha = timezone.localtime(ultima).date()
        return (timezone.localdate() - ultima_fecha).days

    @property
    def badge(self):
        """Calcula el badge del cliente según sus pedidos no cancelados."""
        pedidos = self.pedidos.exclude(estado__nombre='Cancelado')
        total_pedidos = pedidos.count()

        if total_pedidos == 0:
            return {'label': 'Sin Pedidos', 'emoji': '📭', 'color': 'secondary'}

        hoy = timezone.localdate()
        ultimo = pedidos.order_by('-fecha_pedido').first()
        dias = (hoy - timezone.localtime(ultimo.fecha_pedido).date()).days

        # 1. En Riesgo
        if dias > 120:
            return {'label': 'En Riesgo', 'emoji': '🚨', 'color': 'danger'}

        # 2. Inactivo
        if dias > 60:
            return {'label': 'Inactivo', 'emoji': '🥶', 'color': 'secondary'}

        # 3. VIP
        if total_pedidos > 10:
            return {'label': 'Cliente VIP', 'emoji': '👑', 'color': 'warning'}

        # 4. Recurrente Activo (5 a 9 pedidos, mayoría en los últimos 60 días)
        if 5 <= total_pedidos <= 9:
            recientes = pedidos.filter(
                fecha_pedido__date__gte=hoy - timedelta(days=60)
            ).count()
            if recientes * 2 > total_pedidos:
                return {
                    'label': 'Recurrente Activo',
                    'emoji': '🔥',
                    'color': 'success',
                }

        # 5. Alto Valor (promedio de libros por mes >= 2)
        total_libros = pedidos.aggregate(total=Sum('cantidad'))['total'] or 0
        primer = pedidos.order_by('fecha_pedido').first()
        primer_fecha = timezone.localtime(primer.fecha_pedido)
        meses = max(
            1,
            (hoy.year - primer_fecha.year) * 12
            + (hoy.month - primer_fecha.month),
        )
        if total_libros / meses >= 2:
            return {'label': 'Alto Valor', 'emoji': '💎', 'color': 'info'}

        # 6. Cliente Nuevo (exactamente 1 pedido, hace menos de 60 días)
        if total_pedidos == 1 and dias <= 60:
            return {'label': 'Cliente Nuevo', 'emoji': '🆕', 'color': 'primary'}

        return None


class TarjetaFidelidad(models.Model):
    cliente = models.OneToOneField(
        Cliente,
        on_delete=models.CASCADE,
        related_name='tarjeta_fidelidad',
        verbose_name='Cliente',
    )
    sellos = models.PositiveIntegerField(default=0, verbose_name='Sellos')
    bono_saldo = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Saldo del bono',
    )
    token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        verbose_name='Token público',
    )
    fecha_ultima_compra = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Última compra',
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tarjeta de fidelidad'
        verbose_name_plural = 'Tarjetas de fidelidad'
        ordering = ['cliente__nombre']

    def __str__(self):
        return f'{self.cliente.nombre} - {self.sellos} sellos'


class EventoFidelidad(models.Model):
    class Tipo(models.TextChoices):
        OTORGAMIENTO = 'OTORGAMIENTO', 'Bono otorgado'
        CANJE = 'CANJE', 'Bono canjeado'
        EXPIRACION = 'EXPIRACION', 'Sellos expirados'

    tarjeta = models.ForeignKey(
        TarjetaFidelidad,
        on_delete=models.CASCADE,
        related_name='eventos',
        verbose_name='Tarjeta',
    )
    tipo = models.CharField(
        max_length=20,
        choices=Tipo.choices,
        verbose_name='Tipo',
    )
    cantidad = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Cantidad',
    )
    pedido = models.ForeignKey(
        'pedidos.Pedido',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='eventos_fidelidad',
        verbose_name='Pedido',
    )
    fecha = models.DateTimeField(auto_now_add=True, verbose_name='Fecha')

    class Meta:
        verbose_name = 'Evento de fidelidad'
        verbose_name_plural = 'Eventos de fidelidad'
        ordering = ['-fecha', '-id']

    def __str__(self):
        return (
            f'{self.tarjeta.cliente.nombre} - {self.get_tipo_display()} '
            f'({self.cantidad})'
        )