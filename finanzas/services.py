from datetime import timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import MovimientoCaja, LoteDivisa, DetalleVentaDivisa


class ServicioFinanzas:

    @staticmethod
    def normalizar_pago(monto, moneda_pago='CUP', tasa_cambio_aplicada=None):
        """Valida el pago y devuelve (monto real, equivalente CUP, moneda, tasa)."""
        moneda_pago = (moneda_pago or 'CUP').upper()
        if moneda_pago not in ('CUP', 'USD'):
            raise ValueError('La moneda del pago debe ser CUP o USD.')

        try:
            monto = Decimal(str(monto))
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise ValueError('El monto del pago no es válido.') from exc

        if monto <= 0:
            raise ValueError('El monto del pago debe ser mayor que cero.')

        tasa = None
        if moneda_pago == 'USD':
            if monto != monto.to_integral_value():
                raise ValueError(
                    'Los pagos en USD deben ser un monto entero, sin centavos.'
                )

            if tasa_cambio_aplicada in (None, ''):
                tasa = ServicioFinanzas.obtener_tasa_usd_cup()
            else:
                try:
                    tasa = Decimal(str(tasa_cambio_aplicada))
                except (InvalidOperation, TypeError, ValueError) as exc:
                    raise ValueError('La tasa de cambio no es válida.') from exc

            if tasa <= 0:
                raise ValueError('La tasa de cambio debe ser mayor que cero.')

            monto_cup = (monto * tasa).quantize(
                Decimal('0.01'),
                rounding=ROUND_HALF_UP,
            )
        else:
            monto = monto.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            monto_cup = monto

        return monto, monto_cup, moneda_pago, tasa

    @staticmethod
    def normalizar_pago_mixto(
        monto_cup=0,
        monto_usd=0,
        tasa_aplicada=None,
    ):
        """Valida un pago combinado y devuelve (CUP, USD, total CUP, tasa)."""
        try:
            cup = Decimal(str(monto_cup if monto_cup not in (None, '') else 0))
            usd = Decimal(str(monto_usd if monto_usd not in (None, '') else 0))
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise ValueError('El monto del pago no es válido.') from exc

        if cup < 0 or usd < 0:
            raise ValueError('Los montos del pago no pueden ser negativos.')

        cup = cup.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        if usd != usd.to_integral_value():
            raise ValueError(
                'Los pagos en USD deben ser un monto entero, sin centavos.'
            )
        usd = usd.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        tasa = None
        usd_en_cup = Decimal('0')
        if usd > 0:
            if tasa_aplicada in (None, ''):
                tasa = ServicioFinanzas.obtener_tasa_usd_cup()
            else:
                try:
                    tasa = Decimal(str(tasa_aplicada))
                except (InvalidOperation, TypeError, ValueError) as exc:
                    raise ValueError('La tasa de cambio no es válida.') from exc

            if tasa <= 0:
                raise ValueError('La tasa de cambio debe ser mayor que cero.')

            usd_en_cup = (usd * tasa).quantize(
                Decimal('0.01'),
                rounding=ROUND_HALF_UP,
            )

        total_cup = (cup + usd_en_cup).quantize(
            Decimal('0.01'),
            rounding=ROUND_HALF_UP,
        )
        if total_cup <= 0:
            raise ValueError('Debes indicar un monto mayor que cero.')

        return cup, usd, total_cup, tasa

    @staticmethod
    def registrar_pago_pedido(
        pedido,
        monto,
        metodo='EFECTIVO',
        moneda_pago='CUP',
        tasa_cambio_aplicada=None,
        categoria='ANTICIPO_CLIENTE',
        concepto=None,
    ):
        """Registra un pago del pedido y actualiza su saldo en CUP."""
        from pedidos.models import Pedido

        monto, monto_cup, moneda_pago, tasa = ServicioFinanzas.normalizar_pago(
            monto,
            moneda_pago=moneda_pago,
            tasa_cambio_aplicada=tasa_cambio_aplicada,
        )

        with transaction.atomic():
            pedido_bloqueado = (
                Pedido.objects.select_for_update()
                .select_related('libro', 'cliente')
                .get(pk=pedido.pk)
            )
            saldo = Decimal(str(pedido_bloqueado.saldo_pendiente or 0)).quantize(
                Decimal('0.01')
            )

            if monto_cup > saldo:
                raise ValueError(
                    'El pago equivale a '
                    f'{monto_cup} CUP y supera el saldo pendiente '
                    f'({saldo} CUP).'
                )

            detalle_tasa = (
                f' @ {tasa.normalize():f} CUP/USD' if moneda_pago == 'USD' else ''
            )
            if concepto is None:
                concepto = (
                    f'Anticipo pedido #{pedido_bloqueado.id} - '
                    f'{pedido_bloqueado.libro.titulo}{detalle_tasa}'
                )

            movimiento = MovimientoCaja.objects.create(
                tipo='INGRESO',
                categoria=categoria,
                monto=monto,
                metodo=metodo,
                moneda=moneda_pago,
                concepto=concepto[:200],
                pedido=pedido_bloqueado,
                cliente=pedido_bloqueado.cliente,
            )

            pedido_bloqueado.anticipo_recibido = (
                Decimal(str(pedido_bloqueado.anticipo_recibido or 0)) + monto_cup
            )
            pedido_bloqueado.saldo_pendiente = (
                Decimal(str(pedido_bloqueado.precio_venta))
                - pedido_bloqueado.anticipo_recibido
            )

            if not pedido_bloqueado.fecha_entrega_prometida:
                pedido_bloqueado.fecha_entrega_prometida = (
                    timezone.now().date() + timedelta(days=28)
                )

            pedido_bloqueado.save(
                update_fields=[
                    'anticipo_recibido',
                    'saldo_pendiente',
                    'fecha_entrega_prometida',
                ]
            )

        pedido.anticipo_recibido = pedido_bloqueado.anticipo_recibido
        pedido.saldo_pendiente = pedido_bloqueado.saldo_pendiente
        pedido.fecha_entrega_prometida = pedido_bloqueado.fecha_entrega_prometida

        return movimiento

    @staticmethod
    def registrar_pago_mixto(
        pedido,
        monto_cup=0,
        monto_usd=0,
        tasa_aplicada=None,
        metodo='EFECTIVO',
        categoria='ANTICIPO_CLIENTE',
        concepto=None,
        permitir_vuelto=True,
        exigir_saldo_exacto=False,
    ):
        """Registra un pago CUP/USD y devuelve el detalle del cobro."""
        from pedidos.models import Pedido

        monto_cup, monto_usd, total_cup, tasa = (
            ServicioFinanzas.normalizar_pago_mixto(
                monto_cup=monto_cup,
                monto_usd=monto_usd,
                tasa_aplicada=tasa_aplicada,
            )
        )

        with transaction.atomic():
            pedido_bloqueado = (
                Pedido.objects.select_for_update()
                .select_related('libro', 'cliente')
                .get(pk=pedido.pk)
            )
            saldo = Decimal(str(pedido_bloqueado.saldo_pendiente or 0)).quantize(
                Decimal('0.01')
            )

            if saldo <= 0:
                raise ValueError('Este pedido ya está pagado en su totalidad.')

            if exigir_saldo_exacto and total_cup < saldo:
                faltante = (saldo - total_cup).quantize(Decimal('0.01'))
                raise ValueError(
                    f'Faltan {faltante} CUP para poder entregar el pedido.'
                )

            if not permitir_vuelto and total_cup > saldo:
                raise ValueError(
                    'El pago equivale a '
                    f'{total_cup} CUP y supera el saldo pendiente '
                    f'({saldo} CUP).'
                )

            aplicado_cup = min(total_cup, saldo)
            vuelto_cup = (total_cup - aplicado_cup).quantize(Decimal('0.01'))

            cliente_nombre = (
                pedido_bloqueado.cliente.nombre
                if pedido_bloqueado.cliente
                else 'Sin cliente'
            )
            if concepto is None:
                concepto = (
                    f'Abono pedido #{pedido_bloqueado.id} - '
                    f'{pedido_bloqueado.libro.titulo}'
                )

            movimientos = []
            if monto_cup > 0:
                movimientos.append(
                    MovimientoCaja.objects.create(
                        tipo='INGRESO',
                        categoria=categoria,
                        monto=monto_cup,
                        metodo=metodo,
                        moneda='CUP',
                        concepto=f'{concepto} (CUP)'[:200],
                        pedido=pedido_bloqueado,
                        cliente=pedido_bloqueado.cliente,
                    )
                )

            if monto_usd > 0:
                movimientos.append(
                    MovimientoCaja.objects.create(
                        tipo='INGRESO',
                        categoria=categoria,
                        monto=monto_usd,
                        metodo=metodo,
                        moneda='USD',
                        concepto=(
                            f'{concepto} (USD @ {tasa.normalize():f} CUP/USD)'
                        )[:200],
                        pedido=pedido_bloqueado,
                        cliente=pedido_bloqueado.cliente,
                    )
                )

            if vuelto_cup > 0:
                movimientos.append(
                    MovimientoCaja.objects.create(
                        tipo='EGRESO',
                        categoria='VUELTO_CLIENTE',
                        monto=vuelto_cup,
                        metodo=metodo,
                        moneda='CUP',
                        concepto=(
                            f'Vuelto pedido #{pedido_bloqueado.id} - '
                            f'{cliente_nombre} (entregado en CUP)'
                        )[:200],
                        pedido=pedido_bloqueado,
                        cliente=pedido_bloqueado.cliente,
                    )
                )

            pedido_bloqueado.anticipo_recibido = (
                Decimal(str(pedido_bloqueado.anticipo_recibido or 0))
                + aplicado_cup
            )
            pedido_bloqueado.saldo_pendiente = (
                Decimal(str(pedido_bloqueado.precio_venta))
                - pedido_bloqueado.anticipo_recibido
            )

            if not pedido_bloqueado.fecha_entrega_prometida:
                pedido_bloqueado.fecha_entrega_prometida = (
                    timezone.now().date() + timedelta(days=28)
                )

            pedido_bloqueado.save(
                update_fields=[
                    'anticipo_recibido',
                    'saldo_pendiente',
                    'fecha_entrega_prometida',
                ]
            )

        pedido.anticipo_recibido = pedido_bloqueado.anticipo_recibido
        pedido.saldo_pendiente = pedido_bloqueado.saldo_pendiente
        pedido.fecha_entrega_prometida = pedido_bloqueado.fecha_entrega_prometida

        return {
            'movimientos': movimientos,
            'movimiento': movimientos[0] if movimientos else None,
            'monto_cup': monto_cup,
            'monto_usd': monto_usd,
            'total_cup': total_cup,
            'aplicado_cup': aplicado_cup,
            'vuelto_cup': vuelto_cup,
            'tasa': tasa,
        }

    @staticmethod
    def registrar_pago_entrega(
        entrega,
        monto_cup=0,
        monto_usd=0,
        tasa_aplicada=None,
        metodo='EFECTIVO',
    ):
        """Cobra el saldo completo de una entrega y registra los movimientos."""
        from pedidos.models import Entrega

        with transaction.atomic():
            entrega_bloqueada = (
                Entrega.objects.select_for_update()
                .select_related('cliente')
                .get(pk=entrega.pk)
            )
            pedidos = list(
                entrega_bloqueada.pedidos.select_for_update()
                .select_related('libro', 'cliente', 'estado')
                .order_by('id')
            )
            if not pedidos:
                raise ValueError('La entrega no tiene pedidos asociados.')

            saldo_pedidos = sum(
                (
                    Decimal(str(pedido.saldo_pendiente or 0))
                    for pedido in pedidos
                ),
                Decimal('0'),
            ).quantize(Decimal('0.01'))
            costo_mensajeria = Decimal(
                str(entrega_bloqueada.costo_mensajeria or 0)
            ).quantize(Decimal('0.01'))
            total_a_cobrar = (
                saldo_pedidos + costo_mensajeria
            ).quantize(Decimal('0.01'))

            if total_a_cobrar <= 0:
                return {
                    'movimientos': [],
                    'movimiento': None,
                    'monto_cup': Decimal('0'),
                    'monto_usd': Decimal('0'),
                    'total_cup': Decimal('0'),
                    'aplicado_cup': Decimal('0'),
                    'excedente_cup': Decimal('0'),
                    'vuelto_cup': Decimal('0'),
                    'propina_cup': Decimal('0'),
                    'tasa': None,
                    'saldo_pedidos': saldo_pedidos,
                    'costo_mensajeria': costo_mensajeria,
                    'total_a_cobrar': total_a_cobrar,
                }

            monto_cup, monto_usd, total_cup, tasa = (
                ServicioFinanzas.normalizar_pago_mixto(
                    monto_cup=monto_cup,
                    monto_usd=monto_usd,
                    tasa_aplicada=tasa_aplicada,
                )
            )

            if total_cup + Decimal('0.005') < total_a_cobrar:
                faltante = (total_a_cobrar - total_cup).quantize(
                    Decimal('0.01')
                )
                raise ValueError(
                    f'Faltan {faltante} CUP para saldar la entrega.'
                )

            aplicado_cup = min(total_cup, total_a_cobrar).quantize(
                Decimal('0.01')
            )
            excedente_cup = (total_cup - aplicado_cup).quantize(
                Decimal('0.01')
            )
            pago_solo_cup = monto_cup > 0 and monto_usd == 0
            propina_cup = (
                excedente_cup if pago_solo_cup else Decimal('0')
            ).quantize(Decimal('0.01'))
            vuelto_cup = (
                Decimal('0') if pago_solo_cup else excedente_cup
            ).quantize(Decimal('0.01'))
            saldo_aplicado = min(aplicado_cup, saldo_pedidos).quantize(
                Decimal('0.01')
            )
            mensajeria_aplicada = (
                aplicado_cup - saldo_aplicado
            ).quantize(Decimal('0.01'))

            cliente = entrega_bloqueada.cliente
            cliente_nombre = cliente.nombre if cliente else 'Sin cliente'
            concepto_base = (
                f'Entrega #{entrega_bloqueada.id} - {cliente_nombre}'
            )
            tasa_concepto = (
                f' @ {tasa.normalize():f} CUP/USD' if tasa else ''
            )
            movimientos = []

            def registrar_movimiento(
                tipo,
                categoria,
                monto,
                moneda,
                concepto,
            ):
                monto = Decimal(str(monto)).quantize(Decimal('0.01'))
                if monto <= 0:
                    return
                movimientos.append(
                    MovimientoCaja.objects.create(
                        tipo=tipo,
                        categoria=categoria,
                        monto=monto,
                        metodo=metodo,
                        moneda=moneda,
                        concepto=concepto[:200],
                        cliente=cliente,
                    )
                )

            cup_saldo = min(monto_cup, saldo_aplicado).quantize(
                Decimal('0.01')
            )
            cup_restante = (monto_cup - cup_saldo).quantize(
                Decimal('0.01')
            )
            cup_mensajeria = min(
                cup_restante,
                mensajeria_aplicada,
            ).quantize(Decimal('0.01'))
            cup_extra = (cup_restante - cup_mensajeria).quantize(
                Decimal('0.01')
            )

            usd_en_cup = (
                (monto_usd * tasa).quantize(Decimal('0.01'))
                if monto_usd > 0 and tasa
                else Decimal('0')
            )
            usd_saldo_cup = min(
                usd_en_cup,
                saldo_aplicado - cup_saldo,
            ).quantize(Decimal('0.01'))
            usd_restante_cup = (usd_en_cup - usd_saldo_cup).quantize(
                Decimal('0.01')
            )
            usd_mensajeria_cup = min(
                usd_restante_cup,
                mensajeria_aplicada - cup_mensajeria,
            ).quantize(Decimal('0.01'))
            usd_extra_cup = (
                usd_restante_cup - usd_mensajeria_cup
            ).quantize(Decimal('0.01'))

            def cup_a_usd(valor):
                if not tasa or tasa <= 0:
                    return Decimal('0')
                return (valor / tasa).quantize(
                    Decimal('0.01'),
                    rounding=ROUND_HALF_UP,
                )

            usd_saldo = min(
                cup_a_usd(usd_saldo_cup),
                monto_usd,
            ).quantize(Decimal('0.01'))
            usd_mensajeria = min(
                cup_a_usd(usd_mensajeria_cup),
                monto_usd - usd_saldo,
            ).quantize(Decimal('0.01'))
            usd_extra = (
                monto_usd - usd_saldo - usd_mensajeria
            ).quantize(Decimal('0.01'))

            registrar_movimiento(
                'INGRESO',
                'SALDO_CLIENTE',
                cup_saldo,
                'CUP',
                f'{concepto_base} - saldo (CUP)',
            )
            registrar_movimiento(
                'INGRESO',
                'MENSAJERIA',
                cup_mensajeria,
                'CUP',
                f'{concepto_base} - mensajería (CUP)',
            )
            if propina_cup > 0:
                registrar_movimiento(
                    'INGRESO',
                    'PROPINA',
                    propina_cup,
                    'CUP',
                    f'{concepto_base} - propina (CUP)',
                )
            else:
                registrar_movimiento(
                    'INGRESO',
                    'SALDO_CLIENTE',
                    cup_extra,
                    'CUP',
                    f'{concepto_base} - pago (CUP)',
                )
            registrar_movimiento(
                'INGRESO',
                'SALDO_CLIENTE',
                usd_saldo,
                'USD',
                f'{concepto_base} - saldo (USD{tasa_concepto})',
            )
            registrar_movimiento(
                'INGRESO',
                'MENSAJERIA',
                usd_mensajeria,
                'USD',
                f'{concepto_base} - mensajería (USD{tasa_concepto})',
            )
            registrar_movimiento(
                'INGRESO',
                'SALDO_CLIENTE',
                usd_extra,
                'USD',
                f'{concepto_base} - pago (USD{tasa_concepto})',
            )
            registrar_movimiento(
                'EGRESO',
                'VUELTO_CLIENTE',
                vuelto_cup,
                'CUP',
                f'{concepto_base} - vuelto',
            )

            for pedido in pedidos:
                if Decimal(str(pedido.saldo_pendiente or 0)) != 0:
                    pedido.anticipo_recibido = pedido.precio_venta
                    pedido.saldo_pendiente = Decimal('0')
                    pedido.save(
                        update_fields=[
                            'anticipo_recibido',
                            'saldo_pendiente',
                        ]
                    )

        return {
            'movimientos': movimientos,
            'movimiento': movimientos[0] if movimientos else None,
            'monto_cup': monto_cup,
            'monto_usd': monto_usd,
            'total_cup': total_cup,
            'aplicado_cup': aplicado_cup,
            'excedente_cup': excedente_cup,
            'vuelto_cup': vuelto_cup,
            'propina_cup': propina_cup,
            'tasa': tasa,
            'saldo_pedidos': saldo_pedidos,
            'costo_mensajeria': costo_mensajeria,
            'total_a_cobrar': total_a_cobrar,
        }

    @staticmethod
    def registrar_anticipo(
        pedido,
        monto,
        metodo='EFECTIVO',
        moneda_pago='CUP',
        tasa_cambio_aplicada=None,
    ):
        """Registra un anticipo o abono del cliente."""
        return ServicioFinanzas.registrar_pago_pedido(
            pedido,
            monto=monto,
            metodo=metodo,
            moneda_pago=moneda_pago,
            tasa_cambio_aplicada=tasa_cambio_aplicada,
            categoria='ANTICIPO_CLIENTE',
        )

    @staticmethod
    def registrar_saldo(
        pedido,
        monto=None,
        metodo='EFECTIVO',
        moneda=None,
        concepto=None,
        tasa_cambio_aplicada=None,
    ):
        """Registra el pago del saldo final."""
        if monto is None:
            monto = pedido.saldo_pendiente

        try:
            monto_decimal = Decimal(str(monto))
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise ValueError('El monto del pago no es válido.') from exc

        if monto_decimal <= 0:
            return None

        return ServicioFinanzas.registrar_pago_pedido(
            pedido,
            monto=monto_decimal,
            metodo=metodo,
            moneda_pago=moneda or 'CUP',
            tasa_cambio_aplicada=tasa_cambio_aplicada,
            categoria='SALDO_CLIENTE',
            concepto=concepto or f'Saldo pedido #{pedido.id} - {pedido.libro.titulo}',
        )
    
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
    def saldo_caja(moneda='CUP', excluir_categorias=None):
        """Devuelve el saldo actual de caja según la moneda."""
        movimientos = MovimientoCaja.objects.filter(moneda=moneda)
        if excluir_categorias:
            movimientos = movimientos.exclude(categoria__in=excluir_categorias)

        ingresos = movimientos.filter(tipo='INGRESO').aggregate(t=Sum('monto'))['t'] or 0
        egresos = movimientos.filter(tipo='EGRESO').aggregate(t=Sum('monto'))['t'] or 0
        return ingresos - egresos

    @staticmethod
    def obtener_tasa_usd_cup():
        """Devuelve CUP por 1 USD desde Parametro, con fallback al sistema."""
        from core.models import Parametro
        from core.services import tasa_cambio

        tasa = Parametro.get('Tasa_cambio')
        try:
            tasa = Decimal(str(tasa)) if tasa is not None else None
        except (TypeError, ValueError):
            tasa = None

        if tasa is None or tasa <= 0:
            tasa, _ = tasa_cambio()

        return Decimal(str(tasa))

    @staticmethod
    def calcular_utilidad_disponible(fondo_reserva=50000, porcentaje_seguridad=0.5):
        """
        Calcula cuánto dinero puede retirar el dueño sin comprometer la operación.
        Incluye el saldo en USD convertido a CUP a la tasa de cambio actual.
        """
        from django.db.models import Sum
        from pedidos.models import Pedido, ServicioExterno

        # 1. Saldos reales por moneda. Las transferencias COMPRA_DIVISA /
        # VENTA_DIVISA no se suman como ingresos/gastos operativos para no
        # duplicar el mismo dinero entre CUP y USD.
        saldo_cup = Decimal(str(ServicioFinanzas.saldo_caja('CUP')))
        saldo_usd = Decimal(str(ServicioFinanzas.saldo_caja('USD')))
        tasa_usd = ServicioFinanzas.obtener_tasa_usd_cup()
        saldo_usd_en_cup = saldo_usd * tasa_usd
        saldo_caja = saldo_cup + saldo_usd_en_cup

        # 2. Deudas con proveedores (servicios externos no pagados)
        deudas = ServicioExterno.objects.filter(
            estado__in=['SOLICITADO', 'RECIBIDO']
        ).aggregate(t=Sum('monto'))['t'] or 0
        deudas = Decimal(str(deudas))

        # 3. Dinero comprometido (saldo pendiente de pedidos en producción)
        # Si tienes un anticipo, ese dinero no es tuyo aún, es para pagar materiales de ese libro.
        # Para simplificar, tomamos el 50% de los saldos de pedidos activos como dinero comprometido.
        pedidos_activos = Pedido.objects.exclude(
            estado__nombre__in=['Borrador', 'Entregado', 'Cancelado']
        )
        costo_estimado_pedidos = Decimal(str(pedidos_activos.count() * 2500))
        comprometido = deudas + costo_estimado_pedidos
        fondo_reserva = Decimal(str(fondo_reserva))

        # 4. Caja Libre = Saldo CUP + Saldo USD convertido - Deudas - Costos Estimados - Fondo de Reserva
        caja_libre = saldo_caja - comprometido - fondo_reserva

        resultado = {
            'saldo_caja': saldo_caja,
            'saldo_cup': saldo_cup,
            'saldo_usd': saldo_usd,
            'tasa_usd': tasa_usd,
            'saldo_usd_en_cup': saldo_usd_en_cup,
            'deudas': deudas,
            'comprometido': comprometido,
            'fondo_reserva': fondo_reserva,
            'fecha_calculo': timezone.localtime(timezone.now()),
        }

        if caja_libre <= 0:
            resultado.update({
                'caja_libre': Decimal('0'),
                'retiro_sugerido': Decimal('0'),
                'mensaje': 'No hay excedente para retirar. Deja que la caja crezca.'
            })
            return resultado

        # 5. Sugerimos retirar un porcentaje de la caja libre (para dejar colchón)
        resultado.update({
            'caja_libre': caja_libre,
            'retiro_sugerido': caja_libre * Decimal(str(porcentaje_seguridad)),
            'mensaje': 'Puedes retirar esta cantidad de forma segura.'
        })
        return resultado

    @staticmethod
    def calcular_utilidades_disponibles(fondo_reserva=50000, porcentaje_seguridad=0.5):
        """
        Devuelve el máximo retirable por moneda según el efectivo real en caja.

        - CUP: saldo físico CUP menos pasivos operativos (anticipos y deudas).
        - USD: saldo físico USD, sin convertir CUP ni descontar pasivos.
        """
        from core.services import pasivos_operativos

        saldo_cup = Decimal(str(ServicioFinanzas.saldo_caja('CUP')))
        saldo_usd = Decimal(str(ServicioFinanzas.saldo_caja('USD')))
        pasivos_data = pasivos_operativos()
        anticipos = Decimal(str(pasivos_data['anticipos']))
        deudas = Decimal(str(pasivos_data['servicios_impagos']))
        pasivos = Decimal(str(pasivos_data['total']))

        disponible_cup = max(Decimal('0'), saldo_cup - pasivos)
        disponible_cup = disponible_cup.quantize(Decimal('0.01'))

        # Los pagos en USD se registran en enteros, por eso el máximo retirable
        # en esa moneda también se expresa sin centavos.
        disponible_usd = Decimal(int(max(Decimal('0'), saldo_usd)))

        return {
            'saldo_caja': saldo_cup,
            'saldo_cup': saldo_cup,
            'saldo_usd': saldo_usd,
            'tasa_actual': ServicioFinanzas.obtener_tasa_usd_cup(),
            'anticipos': anticipos,
            'deudas': deudas,
            'pasivos': pasivos,
            'disponible_cup': disponible_cup,
            'disponible_usd': disponible_usd,
            'mensaje': (
                'El disponible en CUP descuenta los pasivos operativos. '
                'El disponible en USD es el efectivo físico en esa moneda.'
            ),
            'fecha_calculo': timezone.localtime(timezone.now()),
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