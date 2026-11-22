import logging
import re
import unicodedata
from decimal import Decimal, InvalidOperation, ROUND_FLOOR, ROUND_HALF_UP
from clientes.models import Cliente
from django.utils import timezone
from django.db import transaction
from core.models import Parametro
from core.ubicaciones import MUNICIPIOS_POR_PROVINCIA
from .models import Book, Entrega, HistorialEstado, LoteServicio, Pedido, ServicioExterno, Estado
from proveedores.models import Proveedor
from datetime import date, timedelta
from django.utils import timezone


FECHA_CORTE_GANANCIA_PROMEDIO = date(2026, 8, 2)

logger = logging.getLogger(__name__)

INCREMENTO_CANTOS_TINTADOS = {
    'bajo': Decimal('3000'),
    'medio': Decimal('4000'),
    'alto': Decimal('5000'),
}
INCREMENTO_ESQUINEROS = {
    'bajo': Decimal('300'),
    'medio': Decimal('500'),
    'alto': Decimal('800'),
}

# ============================================================
# MENSAJERÍA
# ============================================================
ARTEMISA_COSTO = Decimal('0')

MUNICIPIOS_ARTEMISA = MUNICIPIOS_POR_PROVINCIA['Artemisa']

COSTOS_MENSAJERIA_LA_HABANA = {
    'Arroyo Naranjo': Decimal('1500'),
    'Boyeros': Decimal('2375'),
    'Centro Habana': Decimal('1250'),
    'Cerro': Decimal('1250'),
    'Cotorro': Decimal('1000'),
    'Diez de Octubre': Decimal('1250'),
    'Guanabacoa': Decimal('2000'),
    'Habana del Este': Decimal('2500'),
    'Habana Vieja': Decimal('1250'),
    'La Habana Vieja': Decimal('1250'),
    'La Lisa': Decimal('2625'),
    'Marianao': Decimal('2000'),
    'Playa': Decimal('2125'),
    'Plaza': Decimal('1500'),
    'Plaza de la Revolución': Decimal('1500'),
    'Regla': Decimal('1500'),
    'San Miguel del Padrón': Decimal('1000'),
}

COSTOS_MENSAJERIA = {
    **COSTOS_MENSAJERIA_LA_HABANA,
    **{municipio: ARTEMISA_COSTO for municipio in MUNICIPIOS_ARTEMISA},
    'Artemisa': Decimal('0'),
}


def normalizar_municipio(valor):
    """Normaliza un municipio para comparar sin mayúsculas, tildes ni signos."""
    if valor is None:
        return ''
    texto = unicodedata.normalize('NFKD', str(valor))
    texto = ''.join(
        caracter for caracter in texto
        if not unicodedata.combining(caracter)
    )
    texto = re.sub(r'[^a-z0-9]+', ' ', texto.lower())
    return ' '.join(texto.split())


_COSTOS_NORMALIZADOS = {}
_NOMBRES_NORMALIZADOS = {}
for _municipio, _costo in COSTOS_MENSAJERIA.items():
    _clave = normalizar_municipio(_municipio)
    _COSTOS_NORMALIZADOS[_clave] = _costo
    _NOMBRES_NORMALIZADOS[_clave] = _municipio

_PROVINCIA_POR_MUNICIPIO = {}
for _provincia, _municipios in MUNICIPIOS_POR_PROVINCIA.items():
    for _municipio in _municipios:
        _PROVINCIA_POR_MUNICIPIO[normalizar_municipio(_municipio)] = _provincia
_PROVINCIA_POR_MUNICIPIO[normalizar_municipio('Habana Vieja')] = 'La Habana'
_PROVINCIA_POR_MUNICIPIO[normalizar_municipio('Plaza')] = 'La Habana'

_PROVINCIAS_NORMALIZADAS = {
    normalizar_municipio(provincia)
    for provincia in MUNICIPIOS_POR_PROVINCIA
}


def _municipio_coincidente(texto_normalizado):
    """Devuelve la clave normalizada del municipio más específico del texto."""
    if not texto_normalizado:
        return None

    coincidencias = [
        clave
        for clave in sorted(_COSTOS_NORMALIZADOS, key=len, reverse=True)
        if re.search(
            r'(?<!\w)' + re.escape(clave) + r'(?!\w)',
            texto_normalizado,
        )
    ]

    for clave in coincidencias:
        if clave not in _PROVINCIAS_NORMALIZADAS:
            return clave

    return coincidencias[0] if coincidencias else None


def municipio_en_texto(texto):
    """Busca un municipio dentro de un texto libre (por ejemplo, una dirección)."""
    clave = _municipio_coincidente(normalizar_municipio(texto))
    return _NOMBRES_NORMALIZADOS.get(clave) if clave else None


def provincia_para_municipio(municipio):
    """Devuelve la provincia de un municipio (vacío si no se reconoce)."""
    clave = normalizar_municipio(municipio)
    if not clave:
        return ''

    provincia = _PROVINCIA_POR_MUNICIPIO.get(clave)
    if provincia:
        return provincia

    coincidente = _municipio_coincidente(clave)
    if coincidente:
        return _PROVINCIA_POR_MUNICIPIO.get(coincidente, '')

    return ''


def ubicacion_para_cliente(cliente):
    """Devuelve (provincia, municipio) del cliente, infiriéndolos si hace falta."""
    if cliente is None:
        return '', ''

    provincia = (getattr(cliente, 'provincia', '') or '').strip()
    municipio = (getattr(cliente, 'municipio', '') or '').strip()

    if municipio:
        if not provincia:
            provincia = provincia_para_municipio(municipio)
        return provincia, municipio

    for texto in (
        getattr(cliente, 'direccion', '') or '',
        getattr(cliente, 'notas', '') or '',
    ):
        municipio_detectado = municipio_en_texto(texto)
        if municipio_detectado:
            return provincia_para_municipio(municipio_detectado), municipio_detectado

    return provincia, ''


def costo_mensajeria_para_municipio(municipio, provincia=None):
    """Devuelve el costo de mensajería de un municipio (0 si no se reconoce)."""
    clave = normalizar_municipio(municipio)
    if not clave:
        return Decimal('0')

    if clave in _COSTOS_NORMALIZADOS:
        return _COSTOS_NORMALIZADOS[clave]

    coincidente = _municipio_coincidente(clave)
    if coincidente:
        return _COSTOS_NORMALIZADOS[coincidente]

    if normalizar_municipio(provincia) == 'artemisa':
        return ARTEMISA_COSTO

    return Decimal('0')


def costo_mensajeria_para_cliente(cliente):
    """Sugiere el costo de mensajería a partir del municipio/dirección del cliente."""
    provincia, municipio = ubicacion_para_cliente(cliente)
    if not municipio:
        return Decimal('0')
    return costo_mensajeria_para_municipio(municipio, provincia)


def _incremento_por_precio_base(precio_base, incrementos):
    if precio_base < Decimal('5000'):
        return incrementos['bajo']
    if precio_base < Decimal('8000'):
        return incrementos['medio']
    return incrementos['alto']


# ============================================================
# COSTEADOR
# ============================================================
def redondear_cup_50(valor):
    valor = Decimal(str(valor or 0))
    return int((valor / Decimal('50')).quantize(Decimal('1'), rounding=ROUND_HALF_UP) * 50)


class CosteadorPedido:
    """Calcula el costo de producción en CUP (MN)."""

    def __init__(self, pedido, tasa_cambio=None):
        self.pedido = pedido
        self._tasa_override = tasa_cambio

    def _param(self, clave, default=0):
        return Decimal(str(Parametro.get(clave, default)))

    def _tasa_cambio(self):
        if self._tasa_override is not None:
            return Decimal(str(self._tasa_override))
        from core.services import tasa_cambio
        return tasa_cambio()[0]

    def calcular(self):
        p = self.pedido
        paginas = p.paginas
        tasa = self._tasa_cambio()

        paginas_por_hoja = self._param('paginas_por_hoja', 4)
        hojas = (paginas + int(paginas_por_hoja) - 1) // int(paginas_por_hoja)
        precio_paquete = self._param('precio_papel_paquete', 1800)
        hojas_por_paquete = self._param('hojas_por_paquete', 500)
        costo_papel = hojas * (precio_paquete / hojas_por_paquete if hojas_por_paquete else Decimal('0'))

        precio_tinta = self._param('precio_tinta_litro', 17500)
        rinde_tinta = self._param('rinde_tinta_paginas', 35000)
        costo_tinta = paginas * (precio_tinta / rinde_tinta if rinde_tinta else Decimal('0'))

        precio_pegamento = self._param('precio_pegamento', 3500)
        rinde_pegamento = self._param('rinde_pegamento_lomos', 70)
        costo_pegamento = precio_pegamento / rinde_pegamento if rinde_pegamento else Decimal('0')

        lleva_esquineros = p.lleva_esquineros or p.lleva_cantos_tintados
        costo_esquineros = Decimal('0')
        if lleva_esquineros:
            precio_paquete_usd = self._param('precio_esquineros_paquete_usd', 6)
            piezas_por_paquete = self._param('esquineros_por_paquete', 100)
            piezas_por_libro = self._param('esquineros_por_libro', 4)
            costo_pieza_usd = precio_paquete_usd / piezas_por_paquete if piezas_por_paquete else Decimal('0')
            costo_esquineros = costo_pieza_usd * piezas_por_libro * Decimal(str(tasa))

        costo_scotch = self._param('precio_cantos_pintados', 2500) if p.lleva_cantos_tintados else Decimal('0')
        costo_portada = self._param('precio_portada', 1000)
        paginas_grueso = self._param('paginas_para_grueso', 300)
        precio_enc_normal = self._param('precio_encuadernacion', 500)
        precio_enc_grueso = self._param('precio_encuadernacion_grueso', 500)
        costo_encuadernacion = precio_enc_grueso if paginas > paginas_grueso else precio_enc_normal
        electricidad = self._param('electricidad_mensual', 1000)
        libros_mes = self._param('libros_por_mes_estimado', 30)
        costo_electricidad = electricidad / libros_mes if libros_mes else Decimal('0')
        costo_diseno = self._param('precio_diseno', 500)

        total = (
            costo_papel + costo_tinta + costo_pegamento + costo_scotch + costo_esquineros +
            costo_portada + costo_encuadernacion + costo_electricidad + costo_diseno
        )
        return {
            'hojas': hojas,
            'costo_papel': round(costo_papel, 2),
            'costo_tinta': round(costo_tinta, 2),
            'costo_pegamento': round(costo_pegamento, 2),
            'costo_scotch': round(costo_scotch, 2),
            'costo_portada': round(costo_portada, 2),
            'costo_esquineros': round(costo_esquineros, 2),
            'costo_encuadernacion': round(costo_encuadernacion, 2),
            'costo_electricidad': round(costo_electricidad, 2),
            'costo_diseno': round(costo_diseno, 2),
            'costo_total': round(total, 2),
            'tasa_cambio': float(tasa),
        }

    def calcular_precio_sugerido(self):
        costo = self.calcular()
        costo_total = Decimal(str(costo['costo_total']))
        costo_base = costo_total - Decimal(str(costo['costo_scotch'])) - Decimal(str(costo['costo_esquineros']))
        paginas = Decimal(str(self.pedido.paginas))
        pag_min = Decimal(str(Parametro.get('paginas_min', 100)))
        pag_max = Decimal(str(Parametro.get('paginas_max', 1000)))
        margen_min = Decimal(str(Parametro.get('margen_min', 0.8)))
        margen_max = Decimal(str(Parametro.get('margen_max', 2.0)))
        if pag_max == pag_min:
            pag_max = pag_min + 1
        proporcion = (min(max(paginas, pag_min), pag_max) - pag_min) / (pag_max - pag_min)
        margen = margen_min + (proporcion * (margen_max - margen_min))
        import math
        precio_base = Decimal(str(math.ceil((costo_base * (Decimal('1') + margen)) / 100) * 100))
        if self.pedido.lleva_cantos_tintados:
            incremento = _incremento_por_precio_base(precio_base, INCREMENTO_CANTOS_TINTADOS)
        elif self.pedido.lleva_esquineros or self.pedido.lleva_cantos_tintados:
            incremento = _incremento_por_precio_base(precio_base, INCREMENTO_ESQUINEROS)
        else:
            incremento = Decimal('0')
        return precio_base + incremento



def obtener_ganancia_promedio():
    """
    Promedio de ganancia (precio_venta - costo_total) de los pedidos entregados
    desde el 02/08/2026. Usa la fecha real de entrega o, si falta, la creación.
    """
    from django.db.models.functions import Coalesce

    pedidos = (
        Pedido.objects.filter(estado__nombre='Entregado')
        .annotate(fecha_referencia=Coalesce('fecha_entrega_real', 'fecha_pedido'))
        .filter(fecha_referencia__date__gte=FECHA_CORTE_GANANCIA_PROMEDIO)
        .select_related('libro')
    )

    ganancia_total = Decimal('0')
    cantidad_pedidos = 0

    for pedido in pedidos:
        costo = CosteadorPedido(pedido).calcular()
        ganancia_total += Decimal(str(pedido.precio_venta)) - Decimal(str(costo['costo_total']))
        cantidad_pedidos += 1

    if cantidad_pedidos == 0:
        return Decimal('0')

    return (ganancia_total / cantidad_pedidos).quantize(Decimal('0.01'))


# ============================================================
# SERVICIO DE PEDIDOS
# ============================================================
class ServicioPedido:

    @staticmethod
    def _estado(nombre):
        return Estado.objects.get(nombre=nombre)

    @staticmethod
    def vender_stock(
        pedido,
        monto_cup=0,
        monto_usd=0,
        tasa_aplicada=None,
        metodo='EFECTIVO',
        usuario='',
        notas='',
        cliente_id=None,
    ):
        from finanzas.services import ServicioFinanzas

        with transaction.atomic():
            pedido_bloqueado = (
                Pedido.objects.select_for_update()
                .select_related('libro', 'cliente', 'estado')
                .get(pk=pedido.pk)
            )

            if pedido_bloqueado.estado is None or pedido_bloqueado.estado.nombre != 'En Stock':
                raise ValueError('El pedido no está disponible para venta en tienda.')

            if pedido_bloqueado.cliente_id is not None:
                raise ValueError('El pedido de tienda ya tiene cliente asignado.')

            if cliente_id:
                cliente = Cliente.objects.get(pk=cliente_id)
            else:
                cliente = Cliente.objects.filter(nombre='Cliente en Tienda').first()
                if cliente is None:
                    cliente = Cliente.objects.create(nombre='Cliente en Tienda')

            pedido_bloqueado.cliente = cliente

            resultado = ServicioFinanzas.registrar_pago_mixto(
                pedido=pedido_bloqueado,
                monto_cup=monto_cup,
                monto_usd=monto_usd,
                tasa_aplicada=tasa_aplicada,
                metodo=metodo,
                categoria='VENTA_DIRECTA',
                concepto=f'Venta en tienda - pedido #{pedido_bloqueado.id} - {pedido_bloqueado.libro.titulo}',
                permitir_vuelto=True,
            )

            pedido = ServicioPedido.cambiar_estado(
                pedido_bloqueado,
                'Entregado',
                usuario=usuario,
                notas=notas or 'Venta en tienda',
            )

            from clientes.services import ServicioFidelidad

            ServicioFidelidad.registrar_compra(pedido)

        return resultado

    @staticmethod
    def confirmar_entrega(
        entrega,
        monto_cup=0,
        monto_usd=0,
        tasa_aplicada=None,
        metodo='EFECTIVO',
        usuario='',
        notas='',
    ):
        from finanzas.services import ServicioFinanzas

        with transaction.atomic():
            entrega_bloqueada = (
                Entrega.objects.select_for_update()
                .select_related('cliente')
                .get(pk=entrega.pk)
            )

            if entrega_bloqueada.entregado:
                raise ValueError('Esta entrega ya fue confirmada.')

            resultado = ServicioFinanzas.registrar_pago_entrega(
                entrega_bloqueada,
                monto_cup=monto_cup,
                monto_usd=monto_usd,
                tasa_aplicada=tasa_aplicada,
                metodo=metodo,
            )

            entrega_bloqueada.entregado = True
            entrega_bloqueada.fecha_entrega_real = timezone.now()
            entrega_bloqueada.save(
                update_fields=['entregado', 'fecha_entrega_real']
            )

            pedidos = list(
                Pedido.objects.select_for_update()
                .select_related('libro', 'cliente', 'estado')
                .filter(entregas=entrega_bloqueada)
                .order_by('id')
            )

            for pedido in pedidos:
                if pedido.estado is None or pedido.estado.nombre != 'Entregado':
                    ServicioPedido.cambiar_estado(
                        pedido,
                        'Entregado',
                        usuario=usuario,
                        notas=notas or f'Entrega #{entrega_bloqueada.id} confirmada',
                    )

        return resultado

    @staticmethod
    def cambiar_estado(pedido, nombre_nuevo_estado, usuario='', notas=''):
        estado_anterior = pedido.estado
        nuevo_estado = Estado.objects.get(nombre=nombre_nuevo_estado)

        if estado_anterior and estado_anterior.id == nuevo_estado.id:
            return pedido

        pedido.estado = nuevo_estado
        if nuevo_estado.nombre == 'Entregado':
            pedido.fecha_entrega_real = timezone.now()
        pedido.save()

        HistorialEstado.objects.create(
            pedido=pedido,
            estado_anterior=estado_anterior,
            estado_nuevo=nuevo_estado,
            usuario=usuario,
            notas=notas
        )

        # Acciones automáticas
        if nuevo_estado.nombre == 'Pendiente a Cantos Pintados':
            ServicioPedido.crear_servicio_cantos_pintados(pedido)

        elif nuevo_estado.nombre == 'Pendiente a Carátula':
            ServicioPedido.crear_servicio_portada(pedido)

        elif nuevo_estado.nombre == 'Pendiente a Encuadernado':
            ServicioPedido.crear_servicio_encuadernado(pedido)

        elif nuevo_estado.nombre == 'Listo para Entregar':
            ServicioPedido.consumir_materiales(pedido, momento='ENTREGA')

        elif nuevo_estado.nombre == 'Entregado':
            entrega = pedido.entregas.select_related('cliente').order_by('id').first()

            with transaction.atomic():
                if entrega and not entrega.entregado:
                    entrega.pedidos.remove(pedido)

                ServicioPedido.cobrar_saldo(pedido)

        return pedido

    @staticmethod
    def _obtener_o_crear_lote(proveedor, tipo):
        """Devuelve el lote ABIERTO del proveedor+tipo creado en las últimas 2 horas, o crea uno nuevo."""
        hace_dos_horas = timezone.now() - timedelta(hours=2)
        
        # Buscamos un lote abierto que se haya creado recientemente
        lote = LoteServicio.objects.filter(
            proveedor=proveedor,
            tipo=tipo,
            estado='ABIERTO',
            fecha_apertura__gte=hace_dos_horas  # <-- La clave está aquí
        ).order_by('-fecha_apertura').first()
        
        if not lote:
            # Si no hay ninguno reciente, creamos uno nuevo
            lote = LoteServicio.objects.create(
                proveedor=proveedor,
                tipo=tipo
            )
        return lote

    @staticmethod
    def consumir_materiales(pedido, momento='ENTREGA'):
        from inventario.services import ServicioInventario
        return ServicioInventario.consumir_materiales_pedido(pedido, momento)

    @staticmethod
    def crear_servicio_portada(pedido):
        proveedor = Proveedor.objects.filter(tipo='IMPRENTA_PORTADA', activo=True).first()
        if not proveedor:
            return
        monto = Parametro.get('precio_portada', 1080)
        if not ServicioExterno.objects.filter(pedido=pedido, tipo='PORTADA').exists():
            lote = ServicioPedido._obtener_o_crear_lote(proveedor, 'PORTADA')
            ServicioExterno.objects.create(
                pedido=pedido,
                proveedor=proveedor,
                tipo='PORTADA',
                monto=monto,
                estado='SOLICITADO',
                lote=lote
            )

    @staticmethod
    def crear_servicio_encuadernado(pedido):
        proveedor = Proveedor.objects.filter(tipo='ENCUADERNADOR', activo=True).first()
        if not proveedor:
            return
        paginas_grueso = int(Parametro.get('paginas_para_grueso', 300) or 300)
        if pedido.paginas > paginas_grueso:
            monto = Parametro.get('precio_encuadernacion_grueso', 500)
        else:
            monto = Parametro.get('precio_encuadernacion', 500)
        if not ServicioExterno.objects.filter(pedido=pedido, tipo='ENCUADERNADO').exists():
            lote = ServicioPedido._obtener_o_crear_lote(proveedor, 'ENCUADERNADO')
            ServicioExterno.objects.create(
                pedido=pedido,
                proveedor=proveedor,
                tipo='ENCUADERNADO',
                monto=monto,
                estado='SOLICITADO',
                lote=lote
            )

    @staticmethod
    def crear_servicio_cantos_pintados(pedido):
        proveedor = Proveedor.objects.filter(tipo='CANTOS_PINTADOS', activo=True).first()
        if not proveedor:
            return
        monto = Parametro.get('precio_cantos_pintados', 2500)
        if not ServicioExterno.objects.filter(pedido=pedido, tipo='CANTOS_PINTADOS').exists():
            lote = ServicioPedido._obtener_o_crear_lote(proveedor, 'CANTOS_PINTADOS')
            ServicioExterno.objects.create(
                pedido=pedido,
                proveedor=proveedor,
                tipo='CANTOS_PINTADOS',
                monto=monto,
                estado='SOLICITADO',
                lote=lote
            )

    @staticmethod
    def cobrar_saldo(pedido):
        """Al entregar, registra el cobro del saldo en caja si queda pendiente."""
        from finanzas.services import ServicioFinanzas

        if pedido.saldo_pendiente > 0:
            ServicioFinanzas.registrar_saldo(pedido, monto=pedido.saldo_pendiente)

    @staticmethod
    def verificar_y_cerrar_lote(lote):
        """Si todos los servicios del lote están PAGADOS, cierra el lote como PAGADO."""
        if not lote:
            return False
        if lote.estado == 'PAGADO':
            return False
        total = lote.servicios.count()
        pagados = lote.servicios.filter(estado='PAGADO').count()
        if total > 0 and total == pagados:
            lote.estado = 'PAGADO'
            lote.fecha_pago = timezone.now()
            if not lote.fecha_cierre:
                lote.fecha_cierre = timezone.now()
            lote.save()
            return True
        return False


def cobrar_saldo_anticipado(
    pedido,
    monto=None,
    usuario=None,
    notas="",
    moneda_pago='CUP',
    tasa_cambio_aplicada=None,
):
    """
    Registra el cobro del saldo pendiente de un pedido antes de que esté entregado.
    - pedido: instancia de Pedido
    - monto: si es None, cobra todo el saldo_pendiente (o el mayor entero en USD).
    - moneda_pago: CUP o USD.
    - tasa_cambio_aplicada: obligatoria para pagos en USD; si falta se usa la actual.
    - Devuelve el MovimientoCaja creado.
    - Lanza ValueError si el pedido ya está pagado, está entregado, es histórico,
      o el monto es inválido.
    """
    from finanzas.services import ServicioFinanzas

    pedido_original = pedido

    with transaction.atomic():
        pedido = (
            Pedido.objects.select_for_update()
            .select_related('cliente', 'libro', 'estado')
            .get(pk=pedido.pk)
        )

        if pedido.es_historico:
            raise ValueError('No se puede cobrar el saldo de un pedido histórico.')

        if pedido.estado and pedido.estado.nombre == 'Entregado':
            raise ValueError('No se puede cobrar el saldo de un pedido entregado.')

        saldo = Decimal(str(pedido.saldo_pendiente or 0)).quantize(Decimal('0.01'))
        if saldo <= 0:
            raise ValueError('Este pedido ya está pagado en su totalidad')

        moneda = (moneda_pago or 'CUP').upper()

        if monto is None:
            if moneda == 'USD':
                tasa = (
                    Decimal(str(tasa_cambio_aplicada))
                    if tasa_cambio_aplicada not in (None, '')
                    else ServicioFinanzas.obtener_tasa_usd_cup()
                )
                if tasa <= 0:
                    raise ValueError('La tasa de cambio debe ser mayor que cero.')
                monto_cobro = (saldo / tasa).to_integral_value(
                    rounding=ROUND_FLOOR
                )
                if monto_cobro <= 0:
                    raise ValueError(
                        'El saldo pendiente es menor a 1 USD; cobra el resto en CUP.'
                    )
            else:
                monto_cobro = saldo
        else:
            try:
                monto_cobro = Decimal(str(monto))
            except (InvalidOperation, TypeError, ValueError) as exc:
                raise ValueError('El monto a cobrar no es válido.') from exc

        monto_cobro, monto_cup, moneda, tasa = ServicioFinanzas.normalizar_pago(
            monto_cobro,
            moneda_pago=moneda,
            tasa_cambio_aplicada=tasa_cambio_aplicada,
        )

        if monto_cup > saldo:
            raise ValueError('El monto a cobrar no puede superar el saldo pendiente.')

        cliente = pedido.cliente.nombre if pedido.cliente else 'Sin cliente'
        concepto = f'Saldo pedido #{pedido.id} - {cliente} - {pedido.libro.titulo}'
        if moneda == 'USD':
            concepto = f'{concepto} @ {tasa.normalize():f} CUP/USD'
        concepto = concepto[:200]

        movimiento = ServicioFinanzas.registrar_saldo(
            pedido,
            monto=monto_cobro,
            moneda=moneda,
            tasa_cambio_aplicada=tasa,
            concepto=concepto,
        )
        if movimiento is None:
            raise ValueError('No se pudo registrar el cobro del saldo.')

        logger.info(
            'Cobro anticipado de saldo registrado: pedido=%s monto=%s moneda=%s tasa=%s usuario=%s notas=%s',
            pedido.id,
            monto_cobro,
            moneda,
            tasa,
            usuario,
            notas,
        )

    pedido_original.anticipo_recibido = pedido.anticipo_recibido
    pedido_original.saldo_pendiente = pedido.saldo_pendiente

    return movimiento


# ============================================================
# CATÁLOGO DE LIBROS (PDF)
# ============================================================
class ServicioCatalogo:
    """Prepara el catálogo de libros y lo renderiza como PDF."""

    @staticmethod
    def obtener_contexto():
        libros = list(Book.objects.all().order_by('titulo'))
        return {
            'libros': [
                {
                    'titulo': libro.titulo,
                    'autor': libro.autor or '—',
                    'precio_formateado': f"${libro.precio:,.2f}",
                }
                for libro in libros
            ],
            'total_libros': len(libros),
            'fecha_generacion': timezone.localtime(timezone.now()),
        }

    @staticmethod
    def generar_pdf():
        from django.template.loader import render_to_string
        from weasyprint import HTML

        contexto = ServicioCatalogo.obtener_contexto()
        html = render_to_string('pedidos/catalogo_pdf.html', contexto)
        return HTML(string=html).write_pdf()