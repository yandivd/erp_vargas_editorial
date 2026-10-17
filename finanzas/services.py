from decimal import Decimal
from .models import MovimientoCaja


class ServicioFinanzas:
    
    @staticmethod
    def registrar_anticipo(pedido, monto, metodo='EFECTIVO'):
        """Registra el anticipo del clientes."""
        mov = MovimientoCaja.objects.create(
            tipo='INGRESO',
            categoria='ANTICIPO_clientes',
            monto=monto,
            metodo=metodo,
            concepto=f'Anticipo pedido #{pedido.id} - {pedido.titulo_libro}',
            pedido=pedido,
            clientes=pedido.clientes
        )
        
        # Actualizar anticipo del pedido
        pedido.anticipo_recibido = (pedido.anticipo_recibido or 0) + Decimal(str(monto))
        pedido.saldo_pendiente = pedido.precio_venta - pedido.anticipo_recibido
        pedido.save()
        
        return mov
    
    @staticmethod
    def registrar_saldo(pedido, monto, metodo='EFECTIVO'):
        """Registra el pago del saldo final."""
        return MovimientoCaja.objects.create(
            tipo='INGRESO',
            categoria='SALDO_clientes',
            monto=monto,
            metodo=metodo,
            concepto=f'Saldo pedido #{pedido.id} - {pedido.titulo_libro}',
            pedido=pedido,
            clientes=pedido.clientes
        )
    
    @staticmethod
    def pagar_proveedor(servicio_externo, metodo='EFECTIVO'):
        """Paga un servicio externo (portada, encuadernado)."""
        from django.utils import timezone
        
        mov = MovimientoCaja.objects.create(
            tipo='EGRESO',
            categoria='PAGO_PROVEEDOR',
            monto=servicio_externo.monto,
            metodo=metodo,
            concepto=f'{servicio_externo.get_tipo_display()} - {servicio_externo.pedido.titulo_libro}',
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
        from django.db.models import Sum
        ingresos = MovimientoCaja.objects.filter(tipo='INGRESO').aggregate(t=Sum('monto'))['t'] or 0
        egresos = MovimientoCaja.objects.filter(tipo='EGRESO').aggregate(t=Sum('monto'))['t'] or 0
        return ingresos - egresos