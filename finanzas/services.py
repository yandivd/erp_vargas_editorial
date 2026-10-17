from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum
from .models import MovimientoCaja


class ServicioFinanzas:
    
    @staticmethod
    def registrar_anticipo(pedido, monto, metodo='EFECTIVO'):
        """Registra el anticipo del cliente."""
        monto = Decimal(str(monto))
        
        mov = MovimientoCaja.objects.create(
            tipo='INGRESO',
            categoria='ANTICIPO_CLIENTE',
            monto=monto,
            metodo=metodo,
            concepto=f'Anticipo pedido #{pedido.id} - {pedido.libro.titulo}',
            pedido=pedido,
            cliente=pedido.cliente
        )
        
        # Actualizar anticipo del pedido
        pedido.anticipo_recibido = (pedido.anticipo_recibido or 0) + monto
        pedido.saldo_pendiente = pedido.precio_venta - pedido.anticipo_recibido
        
        # Solo calculamos la fecha de entrega la primera vez que paga el anticipo
        if mov and pedido.anticipo_recibido > 0 and not pedido.fecha_entrega_prometida:
            from django.utils import timezone
            from datetime import timedelta
            pedido.fecha_entrega_prometida = timezone.now().date() + timedelta(days=28)
            
        pedido.save()
        
        return mov
    
    @staticmethod
    def registrar_saldo(pedido, monto=None, metodo='EFECTIVO'):
        """Registra el pago del saldo final."""
        if monto is None:
            monto = pedido.saldo_pendiente
            
        monto = Decimal(str(monto))
        if monto <= 0:
            return None

        mov = MovimientoCaja.objects.create(
            tipo='INGRESO',
            categoria='SALDO_CLIENTE',
            monto=monto,
            metodo=metodo,
            concepto=f'Saldo pedido #{pedido.id} - {pedido.libro.titulo}',
            pedido=pedido,
            cliente=pedido.cliente
        )
        
        # Actualizar el pedido
        pedido.anticipo_recibido += monto
        pedido.saldo_pendiente -= monto
        pedido.save() # <-- ESTO ES VITAL PARA QUE SE GUARDE
        
        return mov
    
    @staticmethod
    def pagar_proveedor(servicio_externo, metodo='EFECTIVO'):
        """Paga un servicio externo (portada, encuadernado)."""
        mov = MovimientoCaja.objects.create(
            tipo='EGRESO',
            categoria='PAGO_PROVEEDOR',
            monto=servicio_externo.monto,
            metodo=metodo,
            concepto=f'{servicio_externo.get_tipo_display()} - {servicio_externo.pedido.libro.titulo}',
            pedido=servicio_externo.pedido,
            proveedor=servicio_externo.proveedor
        )
        
        servicio_externo.estado = 'PAGADO'
        servicio_externo.fecha_pago = timezone.now()
        servicio_externo.save()
        
        return mov
    
    @staticmethod
    def saldo_caja():
        """Devuelve el saldo actual de caja."""
        ingresos = MovimientoCaja.objects.filter(tipo='INGRESO').aggregate(t=Sum('monto'))['t'] or 0
        egresos = MovimientoCaja.objects.filter(tipo='EGRESO').aggregate(t=Sum('monto'))['t'] or 0
        return ingresos - egresos