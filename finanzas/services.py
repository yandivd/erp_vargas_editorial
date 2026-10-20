from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum
from .models import MovimientoCaja, LoteDivisa, DetalleVentaDivisa
from django.db import transaction


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
    def saldo_caja(moneda='CUP'):
        """Devuelve el saldo actual de caja según la moneda."""
        from django.db.models import Sum
        ingresos = MovimientoCaja.objects.filter(tipo='INGRESO', moneda=moneda).aggregate(t=Sum('monto'))['t'] or 0
        egresos = MovimientoCaja.objects.filter(tipo='EGRESO', moneda=moneda).aggregate(t=Sum('monto'))['t'] or 0
        return ingresos - egresos

    @staticmethod
    def calcular_utilidad_disponible(fondo_reserva=50000, porcentaje_seguridad=0.5):
        """
        Calcula cuánto dinero puede retirar el dueño sin comprometer la operación.
        """
        from django.db.models import Sum
        from pedidos.models import ServicioExterno
        from core.models import Parametro
        
        # 1. Saldo actual en caja
        saldo_caja = ServicioFinanzas.saldo_caja()
        
        # 2. Deudas con proveedores (Servicios externos no pagados)
        deudas = ServicioExterno.objects.filter(estado__in=['SOLICITADO', 'RECIBIDO']).aggregate(t=Sum('monto'))['t'] or 0
        
        # 3. Dinero comprometido (Saldo pendiente de pedidos en producción)
        # Si tienes un anticipo, ese dinero no es tuyo aún, es para pagar materiales de ese libro.
        # Para simplificar, tomamos el 50% de los saldos de pedidos activos como dinero comprometido.
        from pedidos.models import Pedido
        pedidos_activos = Pedido.objects.exclude(estado__nombre__in=['Borrador', 'Entregado', 'Cancelado'])
        costo_estimado_pedidos = pedidos_activos.count() * 2500 # Estimado promedio de costo por libro
        comprometido = deudas + costo_estimado_pedidos
        
        # 4. Caja Libre = Saldo - Deudas - Costos Estimados - Fondo de Reserva
        caja_libre = saldo_caja - comprometido - fondo_reserva
        
        if caja_libre <= 0:
            return {
                'saldo_caja': saldo_caja,
                'deudas': deudas,
                'comprometido': comprometido,
                'fondo_reserva': fondo_reserva,
                'caja_libre': 0,
                'retiro_sugerido': 0,
                'mensaje': 'No hay excedente para retirar. Deja que la caja crezca.'
            }
            
        # 5. Sugerimos retirar un porcentaje de la caja libre (para dejar colchón)
        retiro_sugerido = caja_libre * Decimal(str(porcentaje_seguridad))
        
        return {
            'saldo_caja': saldo_caja,
            'deudas': deudas,
            'comprometido': comprometido,
            'fondo_reserva': fondo_reserva,
            'caja_libre': caja_libre,
            'retiro_sugerido': retiro_sugerido,
            'mensaje': 'Puedes retirar esta cantidad de forma segura.'
        }

    @staticmethod
    def comprar_divisa(monto_usd, tasa_cambio):
        monto_usd = Decimal(str(monto_usd))
        tasa_cambio = Decimal(str(tasa_cambio))
        costo_cup = monto_usd * tasa_cambio

        with transaction.atomic():
            # 1. Sale CUP de caja
            MovimientoCaja.objects.create(
                tipo='EGRESO',
                categoria='COMPRA_DIVISA',  # nueva categoría
                moneda='CUP',
                monto=costo_cup,
                concepto=f'Compra de {monto_usd} USD a {tasa_cambio} CUP/USD'
            )
            # 2. Entra USD a caja
            MovimientoCaja.objects.create(
                tipo='INGRESO',
                categoria='COMPRA_DIVISA',
                moneda='USD',
                monto=monto_usd,
                concepto=f'Compra de divisa a {tasa_cambio} CUP/USD'
            )
            # 3. Se crea el lote con el costo real
            lote = LoteDivisa.objects.create(
                cantidad_usd=monto_usd,
                precio_compra=tasa_cambio,
                cantidad_disponible=monto_usd
            )
        return lote

    @staticmethod
    def vender_divisa(monto_usd, tasa_cambio):
        monto_usd = Decimal(str(monto_usd))
        tasa_cambio = Decimal(str(tasa_cambio))
        ingreso_cup = monto_usd * tasa_cambio

        with transaction.atomic():
            # 1. Verificar stock suficiente
            stock = LoteDivisa.objects.filter(
                cantidad_disponible__gt=0
            ).aggregate(t=Sum('cantidad_disponible'))['t'] or 0
            if stock < monto_usd:
                raise ValueError(f'No hay suficiente USD. Disponible: {stock}')

            # 2. Registrar salida de USD de caja (transferencia)
            mov_venta = MovimientoCaja.objects.create(
                tipo='EGRESO',
                categoria='VENTA_DIVISA',
                moneda='USD',
                monto=monto_usd,
                concepto=f'Venta de {monto_usd} USD a {tasa_cambio} CUP/USD'
            )

            # 3. Consumir lotes FIFO y calcular costo real
            restante = monto_usd
            costo_total = Decimal('0')
            lotes = LoteDivisa.objects.filter(
                cantidad_disponible__gt=0
            ).order_by('fecha_compra')

            for lote in lotes:
                if restante <= 0:
                    break
                usar = min(lote.cantidad_disponible, restante)
                costo_lote = usar * lote.precio_compra
                DetalleVentaDivisa.objects.create(
                    movimiento_venta=mov_venta,
                    lote=lote,
                    cantidad_usd=usar,
                    costo_unitario=lote.precio_compra,
                    costo_total=costo_lote
                )
                lote.cantidad_disponible -= usar
                lote.save()
                costo_total += costo_lote
                restante -= usar

            # 4. Entra CUP a caja por el ingreso total (transferencia)
            MovimientoCaja.objects.create(
                tipo='INGRESO',
                categoria='VENTA_DIVISA',
                moneda='CUP',
                monto=ingreso_cup,
                concepto=f'Venta de {monto_usd} USD a {tasa_cambio} CUP/USD'
            )

            # 5. Registrar ganancia o pérdida cambiaria como movimiento aparte
            ganancia = ingreso_cup - costo_total
            if ganancia > 0:
                MovimientoCaja.objects.create(
                    tipo='INGRESO',
                    categoria='GANANCIA_CAMBIARIA',
                    moneda='CUP',
                    monto=ganancia,
                    concepto=(
                        f'Ganancia cambiaria: {monto_usd} USD '
                        f'comprados a {costo_total / monto_usd:.2f} '
                        f'y vendidos a {tasa_cambio:.2f}'
                    )
                )
            elif ganancia < 0:
                MovimientoCaja.objects.create(
                    tipo='EGRESO',
                    categoria='PERDIDA_CAMBIARIA',
                    moneda='CUP',
                    monto=abs(ganancia),
                    concepto=(
                        f'Pérdida cambiaria: {monto_usd} USD '
                        f'comprados a {costo_total / monto_usd:.2f} '
                        f'y vendidos a {tasa_cambio:.2f}'
                    )
                )

            # Actualizar concepto de la venta con el detalle
            mov_venta.concepto += (
                f' | Costo: {costo_total:.2f} | Ganancia: {ganancia:.2f}'
            )
            mov_venta.save()

        return ganancia