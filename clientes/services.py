from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from core.models import Parametro

from .models import Cliente, EventoFidelidad, Lead, TarjetaFidelidad


class ServicioFidelidad:
    META_DEFAULT = 10
    BONO_DEFAULT = Decimal('5000.00')
    DIAS_EXPIRACION_DEFAULT = 90

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
    def _dias_expiracion(cls):
        try:
            return max(
                1,
                int(
                    Parametro.get(
                        'fidelidad_dias_expiracion',
                        cls.DIAS_EXPIRACION_DEFAULT,
                    )
                ),
            )
        except (TypeError, ValueError):
            return cls.DIAS_EXPIRACION_DEFAULT

    @classmethod
    def _expirar_sellos(cls, tarjeta):
        if tarjeta.sellos <= 0 or tarjeta.fecha_ultima_compra is None:
            return False

        limite = timezone.now() - timedelta(days=cls._dias_expiracion())
        if tarjeta.fecha_ultima_compra > limite:
            return False

        sellos_expirados = tarjeta.sellos
        with transaction.atomic():
            tarjeta.sellos = 0
            tarjeta.save(update_fields=['sellos', 'fecha_actualizacion'])
            EventoFidelidad.objects.create(
                tarjeta=tarjeta,
                tipo=EventoFidelidad.Tipo.EXPIRACION,
                cantidad=sellos_expirados,
            )
        return True

    @classmethod
    def expirar_tarjetas_inactivas(cls):
        limite = timezone.now() - timedelta(days=cls._dias_expiracion())
        tarjetas = list(
            TarjetaFidelidad.objects.filter(
                sellos__gt=0,
                fecha_ultima_compra__isnull=False,
                fecha_ultima_compra__lte=limite,
            )
        )
        return sum(1 for tarjeta in tarjetas if cls._expirar_sellos(tarjeta))

    @classmethod
    def obtener_tarjeta(cls, cliente, crear=False):
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

        cls._expirar_sellos(tarjeta)

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
        if getattr(pedido, 'bono_fidelidad_aplicado', 0) > 0:
            return None

        meta = cls._meta()
        bono = cls._bono()
        cantidad = max(1, int(pedido.cantidad or 1))

        with transaction.atomic():
            tarjeta, _ = TarjetaFidelidad.objects.select_for_update().get_or_create(
                cliente_id=pedido.cliente_id,
            )

            cls._expirar_sellos(tarjeta)

            tarjeta.fecha_ultima_compra = timezone.now()
            bono_otorgado = False
            if tarjeta.sellos < meta:
                tarjeta.sellos = min(meta, tarjeta.sellos + cantidad)
                if tarjeta.sellos >= meta:
                    tarjeta.bono_saldo = tarjeta.bono_saldo + bono
                    bono_otorgado = True
            tarjeta.save(
                update_fields=[
                    'sellos',
                    'bono_saldo',
                    'fecha_ultima_compra',
                    'fecha_actualizacion',
                ],
            )

            if bono_otorgado:
                EventoFidelidad.objects.create(
                    tarjeta=tarjeta,
                    tipo=EventoFidelidad.Tipo.OTORGAMIENTO,
                    cantidad=bono,
                    pedido=pedido,
                )

            pedido.sellos_fidelidad_otorgados = True
            pedido.save(update_fields=['sellos_fidelidad_otorgados'])

        return tarjeta

    @classmethod
    def aplicar_bono(cls, cliente, monto, pedido=None):
        try:
            monto = Decimal(str(monto or 0))
        except (InvalidOperation, TypeError, ValueError):
            return Decimal('0')

        if monto <= 0:
            return Decimal('0')

        with transaction.atomic():
            tarjeta_actual = cls.obtener_tarjeta(cliente)
            if tarjeta_actual is None:
                return Decimal('0')
            tarjeta = TarjetaFidelidad.objects.select_for_update().get(
                pk=tarjeta_actual.pk,
            )
            descuento = min(monto, tarjeta.bono_saldo)

            if descuento <= 0:
                return Decimal('0')

            tarjeta.bono_saldo -= descuento
            tarjeta.sellos = 0
            tarjeta.save(
                update_fields=['bono_saldo', 'sellos', 'fecha_actualizacion'],
            )
            EventoFidelidad.objects.create(
                tarjeta=tarjeta,
                tipo=EventoFidelidad.Tipo.CANJE,
                cantidad=descuento,
                pedido=pedido,
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
                tarjeta.fecha_ultima_compra = timezone.now()
            if bono_saldo is not None:
                tarjeta.bono_saldo = max(Decimal('0'), Decimal(str(bono_saldo)))

            tarjeta.save(
                update_fields=[
                    'sellos',
                    'bono_saldo',
                    'fecha_ultima_compra',
                    'fecha_actualizacion',
                ],
            )

        return tarjeta




class ServicioLeads:
    @staticmethod
    def convertir_por_telefono(cliente):
        """Convierte leads con mismo teléfono en cliente."""
        if cliente is None:
            return 0
        tel = (getattr(cliente, 'telefono', '') or '').strip()
        if not tel:
            return 0
        digits = ''.join(ch for ch in tel if ch.isdigit())
        if len(digits) < 6:
            return 0
        qs = Lead.objects.filter(estado__in=[Lead.ESTADO_NUEVO, Lead.ESTADO_CONTACTADO, Lead.ESTADO_INTERESADO])
        candidatos = qs.filter(telefono__icontains=digits[-8:]) if len(digits) >= 8 else qs.filter(telefono__icontains=digits)
        now = timezone.now()
        count = 0
        for lead in candidatos:
            lead_digits = ''.join(ch for ch in (lead.telefono or '') if ch.isdigit())
            if not lead_digits:
                continue
            if lead_digits == digits or lead_digits.endswith(digits[-8:]) or digits.endswith(lead_digits[-8:]):
                lead.estado = Lead.ESTADO_CONVERTIDO
                lead.cliente = cliente
                lead.fecha_conversion = now
                lead.save(update_fields=['estado', 'cliente', 'fecha_conversion', 'fecha_actualizacion'])
                count += 1
        return count

    @staticmethod
    def marcar_perdidos_por_antiguedad(dias=30):
        """Marca como perdidos los leads activos con más de `dias` sin convertirse."""
        limite = timezone.now() - timedelta(days=dias)
        qs = Lead.objects.filter(
            estado__in=[Lead.ESTADO_NUEVO, Lead.ESTADO_CONTACTADO, Lead.ESTADO_INTERESADO],
            fecha_creacion__lt=limite,
        )
        return qs.update(estado=Lead.ESTADO_PERDIDO, fecha_actualizacion=timezone.now())
