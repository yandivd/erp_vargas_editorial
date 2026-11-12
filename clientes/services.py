from decimal import Decimal, InvalidOperation

from django.db import transaction

from core.models import Parametro

from .models import TarjetaFidelidad


class ServicioFidelidad:
    META_DEFAULT = 10
    BONO_DEFAULT = Decimal('5000.00')

    @classmethod
    def _meta(cls):
        try:
            return max(1, int(Parametro.get('fidelidad_sellos_meta', cls.META_DEFAULT)))
        except (TypeError, ValueError):
            return cls.META_DEFAULT

    @classmethod
    def _bono(cls):
        try:
            return Decimal(str(Parametro.get('fidelidad_bono_monto', cls.BONO_DEFAULT)))
        except (InvalidOperation, TypeError, ValueError):
            return cls.BONO_DEFAULT

    @classmethod
    def obtener_tarjeta(cls, cliente, crear=True):
        if cliente is None:
            return None

        try:
            return cliente.tarjeta_fidelidad
        except TarjetaFidelidad.DoesNotExist:
            if not crear:
                return None
            return TarjetaFidelidad.objects.create(cliente=cliente)

    @classmethod
    def estado(cls, cliente):
        tarjeta = cls.obtener_tarjeta(cliente)
        if tarjeta is None:
            return None

        meta = cls._meta()
        faltantes = max(0, meta - tarjeta.sellos)
        porcentaje = min(100, round((tarjeta.sellos / meta) * 100, 1))

        return {
            'sellos': tarjeta.sellos,
            'bono_saldo': float(tarjeta.bono_saldo),
            'meta': meta,
            'faltantes': faltantes,
            'tiene_bono': tarjeta.bono_saldo > 0,
            'token': str(tarjeta.token),
            'porcentaje': porcentaje,
        }

    @classmethod
    def registrar_compra(cls, pedido):
        if pedido.cliente_id is None:
            return None
        if getattr(pedido, 'sellos_fidelidad_otorgados', False):
            return None

        meta = cls._meta()
        bono = cls._bono()
        cantidad = max(1, int(pedido.cantidad or 1))

        with transaction.atomic():
            tarjeta, _ = TarjetaFidelidad.objects.select_for_update().get_or_create(
                cliente_id=pedido.cliente_id,
            )

            if tarjeta.sellos < meta:
                tarjeta.sellos = min(meta, tarjeta.sellos + cantidad)
                if tarjeta.sellos >= meta:
                    tarjeta.bono_saldo = tarjeta.bono_saldo + bono
                tarjeta.save(
                    update_fields=['sellos', 'bono_saldo', 'fecha_actualizacion'],
                )

            pedido.sellos_fidelidad_otorgados = True
            pedido.save(update_fields=['sellos_fidelidad_otorgados'])

        return tarjeta

    @classmethod
    def aplicar_bono(cls, cliente, monto):
        try:
            monto = Decimal(str(monto or 0))
        except (InvalidOperation, TypeError, ValueError):
            return Decimal('0')

        if monto <= 0:
            return Decimal('0')

        with transaction.atomic():
            tarjeta, _ = TarjetaFidelidad.objects.select_for_update().get_or_create(
                cliente=cliente,
            )
            descuento = min(monto, tarjeta.bono_saldo)

            if descuento <= 0:
                return Decimal('0')

            tarjeta.bono_saldo -= descuento
            tarjeta.sellos = 0
            tarjeta.save(
                update_fields=['bono_saldo', 'sellos', 'fecha_actualizacion'],
            )

        return descuento

    @classmethod
    def ajustar(cls, cliente, sellos=None, bono_saldo=None):
        meta = cls._meta()

        with transaction.atomic():
            tarjeta, _ = TarjetaFidelidad.objects.select_for_update().get_or_create(
                cliente=cliente,
            )

            if sellos is not None:
                tarjeta.sellos = max(0, min(meta, int(sellos)))
            if bono_saldo is not None:
                tarjeta.bono_saldo = max(Decimal('0'), Decimal(str(bono_saldo)))

            tarjeta.save(
                update_fields=['sellos', 'bono_saldo', 'fecha_actualizacion'],
            )

        return tarjeta
