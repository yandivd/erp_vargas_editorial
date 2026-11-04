from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from finanzas.services import ServicioFinanzas
from pedidos.models import Pedido
from pedidos.services import CosteadorPedido


CATEGORIAS_TRANSFERENCIA = ['COMPRA_DIVISA', 'VENTA_DIVISA']
ESTADOS_EXCLUIDOS_RENTABILIDAD = ['Cancelado', 'Borrador']


def _parse_fecha(valor):
    if valor in (None, ''):
        return None
    if isinstance(valor, datetime):
        if timezone.is_aware(valor):
            return timezone.localtime(valor).date()
        return valor.date()
    if isinstance(valor, date):
        return valor
    try:
        return date.fromisoformat(str(valor)[:10])
    except (TypeError, ValueError) as exc:
        raise ValueError(f'Fecha inválida: {valor}. Usa el formato YYYY-MM-DD.') from exc


def _parse_periodo(desde, hasta):
    desde_fecha = _parse_fecha(desde)
    hasta_fecha = _parse_fecha(hasta)
    if desde_fecha and hasta_fecha and desde_fecha > hasta_fecha:
        raise ValueError('La fecha "desde" no puede ser posterior a la fecha "hasta".')
    return desde_fecha, hasta_fecha


def _parse_limite(valor, por_defecto=10):
    if valor in (None, ''):
        return por_defecto
    try:
        limite = int(valor)
    except (TypeError, ValueError) as exc:
        raise ValueError('El límite debe ser un número entero.') from exc
    return max(1, min(limite, 100))


def _pedidos_rentabilidad(desde=None, hasta=None, solo_con_cliente=True):
    pedidos = (
        Pedido.objects.filter(es_historico=False)
        .exclude(estado__nombre__in=ESTADOS_EXCLUIDOS_RENTABILIDAD)
        .select_related('cliente', 'libro', 'estado')
    )
    if solo_con_cliente:
        pedidos = pedidos.filter(cliente__isnull=False)
    if desde:
        pedidos = pedidos.filter(fecha_pedido__date__gte=desde)
    if hasta:
        pedidos = pedidos.filter(fecha_pedido__date__lte=hasta)
    return pedidos


def _fecha_iso(valor):
    if not valor:
        return ''
    if timezone.is_aware(valor):
        valor = timezone.localtime(valor)
    return valor.date().isoformat()


def _mes_iso(valor):
    if not valor:
        return ''
    if timezone.is_aware(valor):
        valor = timezone.localtime(valor)
    return valor.strftime('%Y-%m')


def _margen_porcentaje(ganancia, ingreso):
    if ingreso <= 0:
        return 0.0
    return round(float(ganancia / ingreso * Decimal('100')), 1)


def _rentabilidad_pedido(pedido):
    ingreso = Decimal(str(pedido.precio_venta or 0)) - Decimal(str(pedido.descuento_aplicado or 0))
    costo = Decimal(str(CosteadorPedido(pedido).calcular()['costo_total']))
    ganancia = ingreso - costo
    return ingreso, costo, ganancia


def _datos_pedido(pedido, ingreso, costo, ganancia):
    return {
        'pedido_id': pedido.id,
        'cliente': pedido.cliente.nombre if pedido.cliente else '',
        'libro': pedido.libro.titulo,
        'cantidad': pedido.cantidad,
        'estado': pedido.estado.nombre,
        'fecha_pedido': _fecha_iso(pedido.fecha_pedido),
        'ingreso': round(float(ingreso), 2),
        'costo': round(float(costo), 2),
        'ganancia': round(float(ganancia), 2),
        'margen_porcentaje': _margen_porcentaje(ganancia, ingreso),
    }


def obtener_resumen_rentabilidad(desde=None, hasta=None):
    desde_fecha, hasta_fecha = _parse_periodo(desde, hasta)
    pedidos = _pedidos_rentabilidad(desde_fecha, hasta_fecha)

    total_ingreso = Decimal('0')
    total_costo = Decimal('0')
    total_ganancia = Decimal('0')
    cantidad_pedidos = 0

    for pedido in pedidos:
        ingreso, costo, ganancia = _rentabilidad_pedido(pedido)
        total_ingreso += ingreso
        total_costo += costo
        total_ganancia += ganancia
        cantidad_pedidos += 1

    return {
        'desde': desde_fecha.isoformat() if desde_fecha else None,
        'hasta': hasta_fecha.isoformat() if hasta_fecha else None,
        'total_pedidos': cantidad_pedidos,
        'ingreso_total': round(float(total_ingreso), 2),
        'costo_total': round(float(total_costo), 2),
        'ganancia_total': round(float(total_ganancia), 2),
        'margen_porcentaje': _margen_porcentaje(total_ganancia, total_ingreso),
    }


def obtener_rentabilidad_por_mes(desde=None, hasta=None):
    desde_fecha, hasta_fecha = _parse_periodo(desde, hasta)
    pedidos = (
        _pedidos_rentabilidad(desde_fecha, hasta_fecha)
        .annotate(mes=TruncMonth('fecha_pedido'))
        .order_by('mes')
    )

    agrupado = defaultdict(lambda: {
        'pedidos': 0,
        'ingreso': Decimal('0'),
        'costo': Decimal('0'),
        'ganancia': Decimal('0'),
    })

    for pedido in pedidos:
        clave = _mes_iso(pedido.mes)
        ingreso, costo, ganancia = _rentabilidad_pedido(pedido)
        agrupado[clave]['pedidos'] += 1
        agrupado[clave]['ingreso'] += ingreso
        agrupado[clave]['costo'] += costo
        agrupado[clave]['ganancia'] += ganancia

    resultado = []
    for mes in sorted(agrupado):
        datos = agrupado[mes]
        resultado.append({
            'mes': mes,
            'pedidos': datos['pedidos'],
            'ingreso': round(float(datos['ingreso']), 2),
            'costo': round(float(datos['costo']), 2),
            'ganancia': round(float(datos['ganancia']), 2),
            'margen_porcentaje': _margen_porcentaje(datos['ganancia'], datos['ingreso']),
        })
    return resultado


def obtener_top_clientes(limite=10):
    limite = _parse_limite(limite, 10)
    agrupado = defaultdict(lambda: {
        'cliente_id': None,
        'cliente': '',
        'pedidos': 0,
        'ingreso': Decimal('0'),
        'costo': Decimal('0'),
        'ganancia': Decimal('0'),
    })

    for pedido in _pedidos_rentabilidad():
        ingreso, costo, ganancia = _rentabilidad_pedido(pedido)
        datos = agrupado[pedido.cliente_id]
        datos['cliente_id'] = pedido.cliente_id
        datos['cliente'] = pedido.cliente.nombre
        datos['pedidos'] += 1
        datos['ingreso'] += ingreso
        datos['costo'] += costo
        datos['ganancia'] += ganancia

    clientes = []
    for datos in agrupado.values():
        clientes.append({
            'cliente_id': datos['cliente_id'],
            'cliente': datos['cliente'],
            'pedidos': datos['pedidos'],
            'ingreso': round(float(datos['ingreso']), 2),
            'costo': round(float(datos['costo']), 2),
            'ganancia': round(float(datos['ganancia']), 2),
            'margen_porcentaje': _margen_porcentaje(datos['ganancia'], datos['ingreso']),
        })

    clientes.sort(key=lambda item: (-item['ganancia'], item['cliente']))
    return clientes[:limite]


def obtener_pedidos_por_estado():
    filas = (
        Pedido.objects.filter(es_historico=False)
        .values('estado__nombre', 'estado__orden', 'estado__es_final')
        .annotate(
            cantidad=Count('id'),
            ingreso_bruto=Sum('precio_venta'),
            descuentos=Sum('descuento_aplicado'),
        )
        .order_by('estado__orden', 'estado__nombre')
    )

    resultado = []
    for fila in filas:
        ingreso_bruto = Decimal(str(fila['ingreso_bruto'] or 0))
        descuentos = Decimal(str(fila['descuentos'] or 0))
        resultado.append({
            'estado': fila['estado__nombre'],
            'orden': fila['estado__orden'],
            'es_final': fila['estado__es_final'],
            'cantidad': fila['cantidad'],
            'ingreso_neto': round(float(ingreso_bruto - descuentos), 2),
        })
    return resultado


def obtener_pedidos_con_perdida(limite=100):
    limite = _parse_limite(limite, 100)
    perdidas = []

    for pedido in _pedidos_rentabilidad():
        ingreso, costo, ganancia = _rentabilidad_pedido(pedido)
        if ganancia < 0:
            perdidas.append(_datos_pedido(pedido, ingreso, costo, ganancia))

    perdidas.sort(key=lambda item: (item['ganancia'], item['pedido_id']))
    return perdidas[:limite]


def obtener_saldo_caja(moneda='CUP'):
    moneda = str(moneda or 'CUP').upper()
    if moneda not in ('CUP', 'USD'):
        raise ValueError('La moneda debe ser CUP o USD.')

    saldo = ServicioFinanzas.saldo_caja(
        moneda,
        excluir_categorias=CATEGORIAS_TRANSFERENCIA,
    )
    return {
        'moneda': moneda,
        'saldo': round(float(saldo), 2),
        'categorias_excluidas': CATEGORIAS_TRANSFERENCIA,
        'fecha_calculo': timezone.localtime(timezone.now()).isoformat(),
    }


TOOLS = [
    {
        'type': 'function',
        'function': {
            'name': 'obtener_resumen_rentabilidad',
            'description': (
                'Devuelve ingreso, costo, ganancia y margen de los pedidos no históricos '
                'en un rango de fechas. Si no se envían fechas, analiza todo el período disponible.'
            ),
            'parameters': {
                'type': 'object',
                'properties': {
                    'desde': {'type': 'string', 'description': 'Fecha inicial en formato YYYY-MM-DD.'},
                    'hasta': {'type': 'string', 'description': 'Fecha final en formato YYYY-MM-DD.'},
                },
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'obtener_rentabilidad_por_mes',
            'description': 'Devuelve ingreso, costo, ganancia y margen agrupados por mes.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'desde': {'type': 'string', 'description': 'Fecha inicial en formato YYYY-MM-DD.'},
                    'hasta': {'type': 'string', 'description': 'Fecha final en formato YYYY-MM-DD.'},
                },
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'obtener_top_clientes',
            'description': 'Devuelve los clientes ordenados por ganancia total descendente.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'limite': {
                        'type': 'integer',
                        'description': 'Cantidad máxima de clientes a devolver. Por defecto 10.',
                    },
                },
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'obtener_pedidos_por_estado',
            'description': 'Devuelve la cantidad de pedidos y el ingreso neto agrupados por el nombre exacto del estado.',
            'parameters': {'type': 'object', 'properties': {}},
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'obtener_pedidos_con_perdida',
            'description': 'Devuelve los pedidos cuya ganancia calculada es menor que cero.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'limite': {
                        'type': 'integer',
                        'description': 'Cantidad máxima de pedidos a devolver. Por defecto 100.',
                    },
                },
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'obtener_saldo_caja',
            'description': (
                'Devuelve el saldo actual de caja en CUP o USD, excluyendo las operaciones '
                'de transferencia COMPRA_DIVISA y VENTA_DIVISA.'
            ),
            'parameters': {
                'type': 'object',
                'properties': {
                    'moneda': {
                        'type': 'string',
                        'enum': ['CUP', 'USD'],
                        'description': 'Moneda del saldo. Por defecto CUP.',
                    },
                },
            },
        },
    },
]


HERRAMIENTAS = {
    'obtener_resumen_rentabilidad': obtener_resumen_rentabilidad,
    'obtener_rentabilidad_por_mes': obtener_rentabilidad_por_mes,
    'obtener_top_clientes': obtener_top_clientes,
    'obtener_pedidos_por_estado': obtener_pedidos_por_estado,
    'obtener_pedidos_con_perdida': obtener_pedidos_con_perdida,
    'obtener_saldo_caja': obtener_saldo_caja,
}


def ejecutar_herramienta(nombre, argumentos=None):
    funcion = HERRAMIENTAS.get(nombre)
    if not funcion:
        raise ValueError(f'Herramienta desconocida: {nombre}')
    if argumentos is None:
        argumentos = {}
    if not isinstance(argumentos, dict):
        raise ValueError('Los argumentos de la herramienta deben ser un objeto JSON.')
    return funcion(**argumentos)
