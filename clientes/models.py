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
        return self.pedidos.count()

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
        """Cuenta cuántos libros ha comprado en total (solo entregados)."""
        return self.pedidos.filter(estado__nombre='Entregado').aggregate(total=Sum('cantidad'))['total'] or 0

    @property
    def dias_sin_comprar(self):
        """Días desde su último pedido entregado."""
        ultimo = self.pedidos.filter(estado__nombre='Entregado').order_by('-fecha_entrega_real').first()
        if not ultimo or not ultimo.fecha_entrega_real:
            return 999 # Si nunca ha comprado, lo tratamos como inactivo total
        return (timezone.now().date() - ultimo.fecha_entrega_real.date()).days

    @property
    def badge(self):
        """Calcula el badge que le corresponde al cliente basado en las reglas."""
        libros = self.total_libros
        dias = self.dias_sin_comprar

        # 1. Reglas de inactividad (Prioridad alta)
        if dias >= 90:
            return {'label': 'En riesgo (90+ días)', 'emoji': '👑', 'color': 'danger'}
        elif dias >= 60:
            return {'label': 'Inactivo 60 días', 'emoji': '🥶', 'color': 'secondary'}
        elif dias >= 30:
            return {'label': 'Inactivo 30 días', 'emoji': '😴', 'color': 'warning'}
        
        # 2. Reglas de valor (Si está activo, menos de 30 días)
        if libros > 10:
            return {'label': 'Cliente VIP', 'emoji': '👑', 'color': 'primary'}
        elif libros > 5:
            return {'label': 'Alto valor', 'emoji': '💎', 'color': 'info'}
        elif self.pedidos.count() >= 2:
            return {'label': 'Recurrente activo', 'emoji': '🔥', 'color': 'success'}
        elif self.pedidos.count() == 1:
            return {'label': 'Cliente nuevo', 'emoji': '🆕', 'color': 'dark'}
        
        return None # Si no tiene pedidos, no tiene badge