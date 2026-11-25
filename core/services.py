import re
import unicodedata
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Avg, Count, F, Max, Min, OuterRef, Q, Subquery, Sum
from django.db.models.functions import Coalesce, ExtractHour, ExtractWeekDay, TruncMonth, TruncWeek
from django.utils import timezone

from clientes.models import Cliente, EventoFidelidad, Lead, TarjetaFidelidad
from clientes.services import ServicioFidelidad
from finanzas.models import ActivoFijo, LoteDivisa, MovimientoCaja
from inventario.models import Material, MovimientoInventario
from pedidos.models import Estado, HistorialEstado, Pedido, ServicioExterno
from pedidos.services import CosteadorPedido, obtener_ganancia_promedio


FECHA_CORTE_FINANCIERO = date(2026, 8, 2)
REFERENCIA_CORTE_FINANCIERO = 487
DIAS_ESTANCAMIENTO = 5
DIAS_CAPACIDAD_TALLER = 30
LIMITE_TOP_IA = 30
CONCEPTOS_PRODUCCION_GASTO = (
    'guillotinado',
    'encuadernacion',
    'encuadernación',
    'portada',
    'canto',
    'impresion',
    'impresión',
    'material',
    'papel',
    'tinta',
    'pegamento',
    'scotch',
    'esquinero',
    'cartulina',
)

CATEGORIAS_TRANSFERENCIA = ['COMPRA_DIVISA', 'VENTA_DIVISA', 'TRANSFERENCIA']
CATEGORIA_VUELTO_CLIENTE = 'VUELTO_CLIENTE'
CATEGORIAS_NO_INGRESO = [
    'COMPRA_DIVISA',
    'VENTA_DIVISA',
    'TRANSFERENCIA',
    'SALDO_INICIAL',
    'APERTURA',
]
CATEGORIAS_NO_EGRESO_OPERATIVO = [
    'COMPRA_DIVISA',
    'VENTA_DIVISA',
    'TRANSFERENCIA',
    'RETIRO_UTILIDADES',
    'COMPRA_ACTIVO',
    CATEGORIA_VUELTO_CLIENTE,
]

CATEGORIAS_NO_GASTO_OPERATIVO = [
    *CATEGORIAS_NO_EGRESO_OPERATIVO,
    'COMPRA_MATERIAL',
]

CATEGORIA_ANTICIPO_CLIENTE = 'ANTICIPO_CLIENTE'

Q_APERTURA = (
    Q(categoria__in=['SALDO_INICIAL', 'APERTURA'])
    | Q(categoria='OTRO', concepto__icontains='saldo inicial')
    | Q(categoria='OTRO', concepto__icontains='capital de trabajo')
)
Q_TRANSFERENCIA = Q(categoria__in=CATEGORIAS_TRANSFERENCIA)
Q_NO_INGRESO_OPERATIVO = Q(categoria__in=CATEGORIAS_NO_INGRESO) | Q_APERTURA
Q_NO_EGRESO_OPERATIVO = Q(categoria__in=CATEGORIAS_NO_EGRESO_OPERATIVO)
Q_NO_GASTO_OPERATIVO = Q(categoria__in=CATEGORIAS_NO_GASTO_OPERATIVO)
# Los anticipos de pedidos no son ingreso hasta que el pedido se entrega.
Q_INGRESO_DIFERIDO = Q(
    categoria=CATEGORIA_ANTICIPO_CLIENTE,
    pedido__isnull=False,
)

ESTADOS_PEDIDO_INACTIVO = ['Borrador', 'Cancelado', 'En Stock']

ESTADOS_ANTES_CARATULA = [
    'Pendiente a impresión',
    'Impreso',
    'Pegado',
    'Pendiente a Cantos Pintados',
    'Pendiente a Portada',
    'Pendiente a Carátula',
]
ESTADOS_ANTES_ENCUADERNADO = ESTADOS_ANTES_CARATULA + ['Pendiente a Encuadernado']
ESTADOS_ANTES_CANTOS = [
    'Pendiente a impresión',
    'Impreso',
    'Pegado',
    'Pendiente a Cantos Pintados',
]

ESTADOS_TIEMPO_ORDEN = [
    'Pendiente a impresión',
    'Impreso',
    'Pegado',
    'Pendiente a Cantos Pintados',
    'Pendiente a Portada',
    'Pendiente a Carátula',
    'Pendiente a Encuadernado',
]


def parse_fecha(valor):
    if not valor:
        return None
    try:
        return date.fromisoformat(str(valor)[:10])
    except (TypeError, ValueError):
        return None


def rango_fechas(desde_str=None, hasta_str=None):
    return parse_fecha(desde_str), parse_fecha(hasta_str)


def tasa_cambio():
    """CUP por 1 USD. Parametro editable, con fallback al ultimo lote."""
    from core.models import Parametro

    valor = Parametro.get('Tasa_cambio')
    try:
        valor = Decimal(str(valor)) if valor is not None else None
    except Exception:
        valor = None

    if valor is None or valor <= 0:
        valor = (
            LoteDivisa.objects.order_by('-fecha_compra')
            .values_list('precio_compra', flat=True)
            .first()
        )

    if valor is None or valor <= 0:
        return Decimal('1'), True

    return Decimal(str(valor)), valor <= 1


def _parametros_para_costeador():
    from core.models import Parametro

    return dict(Parametro.objects.values_list('clave', 'valor'))


def convertir_cup_a_usd(monto, tasa=None):
    tasa = tasa or tasa_cambio()[0]
    if not tasa or tasa <= 0:
        return Decimal('0')
    return Decimal(str(monto)) / tasa


def convertir_usd_a_cup(monto, tasa=None):
    tasa = tasa or tasa_cambio()[0]
    return Decimal(str(monto)) * tasa


def movimientos_caja(desde=None, hasta=None, moneda=None):
    qs = MovimientoCaja.objects.all()
    if desde:
        qs = qs.filter(fecha__date__gte=desde)
    if hasta:
        qs = qs.filter(fecha__date__lte=hasta)
    if moneda:
        qs = qs.filter(moneda=moneda)
    return qs


def movimientos_financieros(desde=None, hasta=None, moneda=None):
    inicio = max(FECHA_CORTE_FINANCIERO, desde) if desde else FECHA_CORTE_FINANCIERO
    return movimientos_caja(inicio, hasta, moneda)


def _id_o_none(valor):
    if valor in (None, ''):
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


def _texto_sin_acentos(valor):
    texto = str(valor or '').strip().lower()
    return ''.join(
        caracter
        for caracter in unicodedata.normalize('NFKD', texto)
        if not unicodedata.combining(caracter)
    )


def _coincide_concepto(fila, termino):
    termino = _texto_sin_acentos(termino)
    if not termino:
        return True

    texto = _texto_sin_acentos(' | '.join(
        str(fila.get(campo) or '')
        for campo in (
            'concepto',
            'categoria_label',
            'proveedor_nombre',
            'material_nombre',
        )
    ))
    palabras_texto = re.findall(r'[a-z0-9]+', texto)

    return all(
        palabra in texto
        or (
            len(palabra) >= 5
            and any(value.startswith(palabra[:5]) for value in palabras_texto)
        )
        for palabra in termino.split()
    )


def consumos_inventario(desde=None, hasta=None, material_id=None):
    """Salidas de inventario del período: gasto por consumo, no flujo de caja."""
    qs = MovimientoInventario.objects.filter(tipo='SALIDA')
    inicio = max(FECHA_CORTE_FINANCIERO, desde) if desde else FECHA_CORTE_FINANCIERO
    qs = qs.filter(fecha__date__gte=inicio)
    if hasta:
        qs = qs.filter(fecha__date__lte=hasta)
    material_id = _id_o_none(material_id)
    if material_id:
        qs = qs.filter(material_id=material_id)
    return qs


def anticipos_reconocidos(desde=None, hasta=None):
    """Anticipos que pasan a ingreso porque el pedido ya fue entregado."""
    inicio = max(FECHA_CORTE_FINANCIERO, desde) if desde else FECHA_CORTE_FINANCIERO
    qs = MovimientoCaja.objects.filter(
        tipo='INGRESO',
        categoria=CATEGORIA_ANTICIPO_CLIENTE,
        pedido__isnull=False,
        pedido__fecha_entrega_real__date__gte=inicio,
    ).exclude(pedido__estado__nombre__in=['Cancelado', 'Borrador'])
    if hasta:
        qs = qs.filter(pedido__fecha_entrega_real__date__lte=hasta)
    return qs


def _fila_kpi_movimiento(
    movimiento,
    fecha=None,
    categoria_label=None,
    concepto=None,
    material_id=None,
    material_nombre='',
):
    proveedor = movimiento.proveedor if movimiento.proveedor_id else None
    return {
        'id': movimiento.pk,
        'tipo': movimiento.tipo,
        'tipo_label': movimiento.get_tipo_display(),
        'categoria': movimiento.categoria,
        'categoria_label': categoria_label or movimiento.get_categoria_display(),
        'monto': float(movimiento.monto),
        'moneda': movimiento.moneda,
        'moneda_label': movimiento.get_moneda_display(),
        'metodo': movimiento.metodo,
        'metodo_label': movimiento.get_metodo_display(),
        'concepto': concepto if concepto is not None else movimiento.concepto,
        'fecha': fecha or movimiento.fecha,
        'pedido_id': movimiento.pedido_id,
        'proveedor_id': movimiento.proveedor_id,
        'proveedor_nombre': proveedor.nombre if proveedor else '',
        'material_id': material_id,
        'material_nombre': material_nombre,
    }


def movimientos_para_kpi(
    tipo,
    desde=None,
    hasta=None,
    moneda=None,
    material_id=None,
    filtro_concepto=None,
):
    """Filas que componen exactamente el KPI de ingresos o gastos."""
    desde = parse_fecha(desde)
    hasta = parse_fecha(hasta)
    if desde and hasta and desde > hasta:
        desde, hasta = hasta, desde
    material_id = _id_o_none(material_id)

    if tipo not in ('ingresos', 'gastos'):
        raise ValueError("Tipo de KPI no válido")

    movs = movimientos_financieros(desde, hasta)
    filas = []

    if tipo == 'ingresos':
        ingresos = (
            movs.filter(tipo='INGRESO')
            .exclude(Q_NO_INGRESO_OPERATIVO | Q_INGRESO_DIFERIDO)
            .select_related('pedido', 'proveedor', 'cliente')
        )
        vueltos = (
            movs.filter(tipo='EGRESO', categoria=CATEGORIA_VUELTO_CLIENTE)
            .select_related('pedido', 'proveedor', 'cliente')
        )
        anticipos = (
            anticipos_reconocidos(desde, hasta)
            .select_related('pedido', 'proveedor', 'cliente', 'pedido__cliente')
        )

        if moneda in ('CUP', 'USD'):
            ingresos = ingresos.filter(moneda=moneda)
            vueltos = vueltos.filter(moneda=moneda)
            anticipos = anticipos.filter(moneda=moneda)

        for movimiento in ingresos:
            filas.append(_fila_kpi_movimiento(movimiento))
        for movimiento in anticipos:
            filas.append(
                _fila_kpi_movimiento(
                    movimiento,
                    fecha=movimiento.pedido.fecha_entrega_real or movimiento.fecha,
                    categoria_label='Anticipos reconocidos al entregar',
                    concepto=(
                        f'Anticipo reconocido al entregar Pedido #{movimiento.pedido_id}'
                    ),
                )
            )
        for movimiento in vueltos:
            filas.append(_fila_kpi_movimiento(movimiento))
    else:
        if not material_id:
            egresos = (
                movs.filter(tipo='EGRESO')
                .exclude(Q_NO_GASTO_OPERATIVO)
                .select_related('pedido', 'proveedor', 'cliente')
            )
            if moneda in ('CUP', 'USD'):
                egresos = egresos.filter(moneda=moneda)
            for movimiento in egresos:
                filas.append(_fila_kpi_movimiento(movimiento))

        if moneda != 'USD':
            consumos = (
                consumos_inventario(desde, hasta, material_id)
                .select_related('material', 'pedido')
                .order_by('-fecha', '-id')
            )
            for consumo in consumos:
                total = Decimal(str(consumo.costo_total or 0))
                if total <= 0:
                    continue
                material = consumo.material
                concepto = (
                    f"Consumo de material: {material.nombre} "
                    f"({consumo.cantidad} {material.unidad_medida} "
                    f"× ${consumo.costo_unitario})"
                )
                if consumo.motivo:
                    concepto = f"{concepto} · {consumo.motivo}"
                filas.append({
                    'id': -(1000000 + consumo.pk),
                    'tipo': 'EGRESO',
                    'tipo_label': 'Egreso',
                    'categoria': 'CONSUMO_MATERIAL',
                    'categoria_label': 'Consumo de material',
                    'monto': float(total),
                    'moneda': 'CUP',
                    'moneda_label': 'CUP',
                    'metodo': 'INVENTARIO',
                    'metodo_label': 'Inventario',
                    'concepto': concepto,
                    'fecha': consumo.fecha,
                    'pedido_id': consumo.pedido_id,
                    'proveedor_id': None,
                    'proveedor_nombre': '',
                    'material_id': material.pk,
                    'material_nombre': material.nombre,
                })

    if filtro_concepto:
        filas = [
            fila for fila in filas if _coincide_concepto(fila, filtro_concepto)
        ]

    filas.sort(key=lambda fila: fila['fecha'], reverse=True)
    return filas


def total_para_kpi(
    tipo,
    desde=None,
    hasta=None,
    moneda=None,
    material_id=None,
    filtro_concepto=None,
):
    """Total del KPI, en equivalente CUP salvo que se pida una moneda."""
    tasa, _ = tasa_cambio()
    totales = {'CUP': Decimal('0'), 'USD': Decimal('0')}

    for fila in movimientos_para_kpi(
        tipo, desde, hasta, moneda, material_id, filtro_concepto
    ):
        monto = Decimal(str(fila['monto']))
        if tipo == 'ingresos' and fila['tipo'] == 'EGRESO':
            monto = -monto
        totales[fila['moneda']] += monto

    if moneda in ('CUP', 'USD'):
        return totales[moneda]
    return totales['CUP'] + convertir_usd_a_cup(totales['USD'], tasa)


def pedidos_financieros(desde=None, hasta=None):
    inicio = max(FECHA_CORTE_FINANCIERO, desde) if desde else FECHA_CORTE_FINANCIERO
    qs = Pedido.objects.filter(
        cliente__isnull=False,
        fecha_pedido__date__gte=inicio,
    ).exclude(estado__nombre__in=['Cancelado', 'Borrador'])
    if hasta:
        qs = qs.filter(fecha_pedido__date__lte=hasta)
    return qs


def pedidos_activos():
    return Pedido.objects.filter(
        cliente__isnull=False,
        estado__es_final=False,
    ).exclude(estado__nombre__in=ESTADOS_PEDIDO_INACTIVO)


def pasivos_operativos():
    activos = pedidos_activos()
    anticipos = activos.aggregate(t=Sum('anticipo_recibido'))['t'] or Decimal('0')
    servicios = (
        ServicioExterno.objects.filter(
            pedido__in=activos,
            estado__in=['SOLICITADO', 'RECIBIDO'],
        ).aggregate(t=Sum('monto'))['t']
        or Decimal('0')
    )
    return {
        'anticipos': float(anticipos),
        'servicios_impagos': float(servicios),
        'total': float(anticipos + servicios),
        'pedidos_activos': activos.count(),
    }


def _sumar(qs, tipo, excluir=None):
    consulta = qs.filter(tipo=tipo)
    if excluir is not None:
        consulta = consulta.exclude(excluir)
    return consulta.aggregate(t=Sum('monto'))['t'] or Decimal('0')


def _saldo_caja(moneda):
    from finanzas.services import ServicioFinanzas

    return ServicioFinanzas.saldo_caja(moneda)


def depreciacion_activos_mensual():
    """Gasto contable virtual del mes, sin crear MovimientoCaja."""
    total = Decimal('0')
    for activo in ActivoFijo.objects.filter(activo=True):
        pendiente = (
            activo.total_depreciable
            - activo.depreciacion_acumulada_calculada
        )
        if pendiente <= 0:
            continue
        total += min(activo.depreciacion_mensual, pendiente)
    return total.quantize(Decimal('0.01'))


def _sumar_vuelto(qs):
    return (
        qs.filter(tipo='EGRESO', categoria=CATEGORIA_VUELTO_CLIENTE)
        .aggregate(t=Sum('monto'))['t']
        or Decimal('0')
    )


def resumen_monedas(
    desde=None,
    hasta=None,
    consumo_cup=Decimal('0'),
    anticipos_diferidos_cup=Decimal('0'),
    anticipos_diferidos_usd=Decimal('0'),
):
    tasa, advertencia = tasa_cambio()
    movs = movimientos_financieros(desde, hasta)
    consumo_cup = Decimal(str(consumo_cup or 0))
    anticipos_diferidos = {
        'CUP': Decimal(str(anticipos_diferidos_cup or 0)),
        'USD': Decimal(str(anticipos_diferidos_usd or 0)),
    }

    datos = {}
    for moneda in ('CUP', 'USD'):
        movs_moneda = movs.filter(moneda=moneda)
        ingresos_brutos = _sumar(
            movs_moneda,
            'INGRESO',
            Q_NO_INGRESO_OPERATIVO | Q_INGRESO_DIFERIDO,
        )
        ingresos_brutos += anticipos_diferidos[moneda]
        vuelto_clientes = _sumar_vuelto(movs_moneda)
        ingresos = ingresos_brutos - vuelto_clientes
        gastos = _sumar(movs_moneda, 'EGRESO', Q_NO_GASTO_OPERATIVO)
        if moneda == 'CUP':
            gastos += consumo_cup
        flujo_ingresos = _sumar(movs_moneda, 'INGRESO', Q_TRANSFERENCIA | Q_APERTURA)
        flujo_egresos = _sumar(movs_moneda, 'EGRESO', Q_TRANSFERENCIA)
        datos[moneda] = {
            'ingresos_brutos': float(ingresos_brutos),
            'vuelto_clientes': float(vuelto_clientes),
            'ingresos': float(ingresos),
            'gastos': float(gastos),
            'saldo_neto_operativo': float(ingresos - gastos),
            'flujo_ingresos': float(flujo_ingresos),
            'flujo_egresos': float(flujo_egresos),
            'flujo_neto': float(flujo_ingresos - flujo_egresos),
            'saldo_caja': float(_saldo_caja(moneda)),
        }

    ingresos_brutos_equiv_cup = Decimal(
        str(datos['CUP']['ingresos_brutos'])
    ) + convertir_usd_a_cup(datos['USD']['ingresos_brutos'], tasa)
    vuelto_equiv_cup = Decimal(
        str(datos['CUP']['vuelto_clientes'])
    ) + convertir_usd_a_cup(datos['USD']['vuelto_clientes'], tasa)
    ingresos_equiv_cup = ingresos_brutos_equiv_cup - vuelto_equiv_cup
    gastos_equiv_cup = Decimal(str(datos['CUP']['gastos'])) + convertir_usd_a_cup(
        datos['USD']['gastos'], tasa
    )
    saldo_neto_equiv_cup = ingresos_equiv_cup - gastos_equiv_cup

    datos['equivalente'] = {
        'tasa': float(tasa),
        'advertencia_tasa': advertencia,
        'ingresos_brutos_cup': float(ingresos_brutos_equiv_cup),
        'vuelto_clientes_cup': float(vuelto_equiv_cup),
        'ingresos_cup': float(ingresos_equiv_cup),
        'gastos_cup': float(gastos_equiv_cup),
        'saldo_neto_cup': float(saldo_neto_equiv_cup),
        'saldo_neto_usd': float(convertir_cup_a_usd(saldo_neto_equiv_cup, tasa)),
        'saldo_caja_cup': float(
            Decimal(str(datos['CUP']['saldo_caja']))
            + convertir_usd_a_cup(datos['USD']['saldo_caja'], tasa)
        ),
        'saldo_caja_usd': float(
            Decimal(str(datos['USD']['saldo_caja']))
            + convertir_cup_a_usd(datos['CUP']['saldo_caja'], tasa)
        ),
    }
    return datos


def dashboard_resumen(desde=None, hasta=None):
    hoy = timezone.localdate()
    tasa, advertencia = tasa_cambio()
    parametros = _parametros_para_costeador()
    consumos = consumos_inventario(desde, hasta)
    costo_consumo_cup = (
        consumos.aggregate(t=Sum('costo_total'))['t'] or Decimal('0')
    )
    anticipos_dif = anticipos_reconocidos(desde, hasta)
    anticipos_dif_cup = (
        anticipos_dif.filter(moneda='CUP').aggregate(t=Sum('monto'))['t']
        or Decimal('0')
    )
    anticipos_dif_usd = (
        anticipos_dif.filter(moneda='USD').aggregate(t=Sum('monto'))['t']
        or Decimal('0')
    )
    monedas = resumen_monedas(
        desde,
        hasta,
        costo_consumo_cup,
        anticipos_dif_cup,
        anticipos_dif_usd,
    )
    pasivos = pasivos_operativos()

    pedidos = pedidos_financieros(desde, hasta).select_related('libro')
    total_pedidos = pedidos.count()
    clientes_unicos = pedidos.values('cliente').distinct().count()
    ventas = pedidos.aggregate(t=Sum('precio_venta'))['t'] or Decimal('0')

    pedidos_entregados = list(
        pedidos.filter(estado__nombre='Entregado').select_related('libro', 'estado')
    )
    anticipos_total = Decimal(
        str(pedidos.aggregate(t=Sum('anticipo_recibido'))['t'] or 0)
    )
    saldo_entregados = sum(
        (
            Decimal(str(pedido.precio_venta))
            - Decimal(str(pedido.anticipo_recibido or 0))
        )
        for pedido in pedidos_entregados
    )
    total_recaudado_ventas = anticipos_total + saldo_entregados

    ids_entregados = {pedido.id for pedido in pedidos_entregados}
    costo_produccion_entregados = Decimal('0')
    ganancia_entregados = Decimal('0')
    contribucion_periodo = Decimal('0')
    precio_libro_rangos = {
        'Económico': {'total': Decimal('0'), 'cantidad': 0, 'precio_libro': Decimal('0')},
        'Estándar': {'total': Decimal('0'), 'cantidad': 0, 'precio_libro': Decimal('0')},
        'Premium': {'total': Decimal('0'), 'cantidad': 0, 'precio_libro': Decimal('0')},
    }
    for pedido in pedidos:
        costo = Decimal(
            str(
                CosteadorPedido(
                    pedido, tasa_cambio=tasa, parametros=parametros
                ).calcular()['costo_total']
            )
        )
        precio_venta = Decimal(str(pedido.precio_venta or 0))
        contribucion_periodo += precio_venta - costo
        if pedido.id in ids_entregados:
            costo_produccion_entregados += costo
            ganancia_entregados += precio_venta - costo

        precio_libro = (
            Decimal(str(pedido.libro.precio_cup_referencia or 0))
            if pedido.libro_id
            else Decimal('0')
        )
        if precio_libro < 5000:
            categoria = 'Económico'
        elif precio_libro <= 8000:
            categoria = 'Estándar'
        else:
            categoria = 'Premium'
        rango = precio_libro_rangos[categoria]
        rango['total'] += precio_venta
        rango['cantidad'] += 1
        rango['precio_libro'] += precio_libro

    ganancia_promedio_pedido = (
        ganancia_entregados / len(pedidos_entregados)
        if pedidos_entregados
        else Decimal('0')
    )
    margen_contribucion = (
        contribucion_periodo / ventas if ventas > 0 else Decimal('0')
    )
    ticket_por_categoria = [
        {
            'categoria': categoria,
            'pedidos': datos['cantidad'],
            'ticket_promedio': float(datos['total'] / datos['cantidad']) if datos['cantidad'] else 0.0,
            'precio_libro_promedio': float(datos['precio_libro'] / datos['cantidad']) if datos['cantidad'] else 0.0,
        }
        for categoria, datos in precio_libro_rangos.items()
    ]

    saldo_operativo_cup = Decimal(str(monedas['equivalente']['saldo_neto_cup']))
    gastos_equiv_cup = Decimal(str(monedas['equivalente']['gastos_cup']))
    depreciacion_activos_cup = depreciacion_activos_mensual()
    saldo_contable_cup = saldo_operativo_cup - depreciacion_activos_cup
    ganancia_promedio_cup = obtener_ganancia_promedio(
        parametros=parametros, tasa_cambio=tasa
    )
    ingresos_equiv = Decimal(str(monedas['equivalente']['ingresos_cup']))
    margen_operativo = (
        saldo_operativo_cup / ingresos_equiv * 100
        if ingresos_equiv > 0
        else Decimal('0')
    )
    margen = (
        saldo_contable_cup / ingresos_equiv * 100
        if ingresos_equiv > 0
        else Decimal('0')
    )

    try:
        sueldo_dueno = Decimal(
            str(parametros.get('sueldo_dueno', Decimal('0')) or 0)
        )
    except Exception:
        sueldo_dueno = Decimal('0')
    gastos_break_even = gastos_equiv_cup + sueldo_dueno
    punto_equilibrio = (
        gastos_break_even / margen_contribucion
        if margen_contribucion > 0
        else Decimal('0')
    )

    inicio_mes = hoy.replace(day=1)
    caja_mes = {}
    for moneda in ('CUP', 'USD'):
        movs_mes = movimientos_caja(inicio_mes, hoy, moneda)
        caja_mes[moneda] = {
            'ingresos': _sumar(movs_mes, 'INGRESO', Q_NO_INGRESO_OPERATIVO),
            'egresos': _sumar(movs_mes, 'EGRESO', Q_TRANSFERENCIA),
        }
    ingresos_caja_mes = caja_mes['CUP']['ingresos'] + convertir_usd_a_cup(
        caja_mes['USD']['ingresos'], tasa
    )
    egresos_caja_mes = caja_mes['CUP']['egresos'] + convertir_usd_a_cup(
        caja_mes['USD']['egresos'], tasa
    )
    flujo_caja_neto_mes = ingresos_caja_mes - egresos_caja_mes

    movs = movimientos_financieros(desde, hasta)

    desglose = (
        movs.filter(tipo='INGRESO', moneda='CUP')
        .exclude(Q_NO_INGRESO_OPERATIVO | Q_INGRESO_DIFERIDO)
        .values('categoria')
        .annotate(total=Sum('monto'))
        .order_by('-total')
    )
    desglose_data = [
        {
            'categoria': dict(MovimientoCaja.CATEGORIA_CHOICES).get(d['categoria'], d['categoria']),
            'total': float(d['total'] or 0),
        }
        for d in desglose
    ]
    if anticipos_dif_cup > 0:
        desglose_data.append({
            'categoria': 'Anticipos reconocidos al entregar',
            'total': float(anticipos_dif_cup),
        })
        desglose_data.sort(key=lambda item: item['total'], reverse=True)

    gastos_desglose = (
        movs.filter(tipo='EGRESO', moneda='CUP')
        .exclude(Q_NO_GASTO_OPERATIVO)
        .values('categoria')
        .annotate(total=Sum('monto'))
        .order_by('-total')
    )
    categorias_gastos_data = [
        {
            'categoria': dict(MovimientoCaja.CATEGORIA_CHOICES).get(
                d['categoria'], d['categoria']
            ),
            'total': float(d['total'] or 0),
        }
        for d in gastos_desglose
    ]
    if costo_consumo_cup > 0:
        categorias_gastos_data.append({
            'categoria': 'Consumo de material',
            'total': float(costo_consumo_cup),
        })
        categorias_gastos_data.sort(
            key=lambda item: item['total'], reverse=True
        )

    consumos_agrupados = (
        consumos.values('material__nombre', 'material__unidad_medida')
        .annotate(cantidad=Sum('cantidad'), costo_total=Sum('costo_total'))
        .order_by('-costo_total')
    )
    costo_unitario = [
        {
            'material': c['material__nombre'],
            'unidad': c['material__unidad_medida'],
            'cantidad': float(c['cantidad'] or 0),
            'costo_total': float(c['costo_total'] or 0),
            'costo_unitario': float((c['costo_total'] or 0) / c['cantidad']) if c['cantidad'] else 0,
        }
        for c in consumos_agrupados
    ]

    tendencia = (
        movs.filter(moneda='CUP')
        .annotate(mes=TruncMonth('fecha'))
        .values('mes')
        .annotate(
            ingresos_brutos=Sum(
                'monto',
                filter=Q(tipo='INGRESO')
                & ~Q_NO_INGRESO_OPERATIVO
                & ~Q_INGRESO_DIFERIDO,
            ),
            vuelto_clientes=Sum(
                'monto',
                filter=Q(tipo='EGRESO')
                & Q(categoria=CATEGORIA_VUELTO_CLIENTE),
            ),
            gastos=Sum(
                'monto',
                filter=Q(tipo='EGRESO') & ~Q_NO_GASTO_OPERATIVO,
            ),
        )
        .order_by('mes')
    )
    consumo_mensual = (
        consumos.annotate(mes=TruncMonth('fecha'))
        .values('mes')
        .annotate(total=Sum('costo_total'))
    )
    consumo_por_mes = {
        item['mes']: item['total'] or Decimal('0')
        for item in consumo_mensual
        if item['mes']
    }
    anticipo_mensual = (
        anticipos_dif.filter(moneda='CUP')
        .annotate(mes=TruncMonth('pedido__fecha_entrega_real'))
        .values('mes')
        .annotate(total=Sum('monto'))
    )
    anticipo_por_mes = {
        item['mes']: item['total'] or Decimal('0')
        for item in anticipo_mensual
        if item['mes']
    }
    tendencia_por_mes = {
        item['mes']: item for item in tendencia if item['mes']
    }
    for mes in set(consumo_por_mes) | set(anticipo_por_mes):
        if mes not in tendencia_por_mes:
            tendencia_por_mes[mes] = {
                'mes': mes,
                'ingresos_brutos': Decimal('0'),
                'vuelto_clientes': Decimal('0'),
                'gastos': Decimal('0'),
            }
    tendencia_data = [
        {
            'mes': item['mes'].strftime('%b %Y'),
            'ingresos_brutos': float(
                (item['ingresos_brutos'] or 0)
                + anticipo_por_mes.get(item['mes'], Decimal('0'))
            ),
            'vuelto_clientes': float(item['vuelto_clientes'] or 0),
            'ingresos': float(
                (item['ingresos_brutos'] or 0)
                + anticipo_por_mes.get(item['mes'], Decimal('0'))
                - (item['vuelto_clientes'] or 0)
            ),
            'gastos': float(
                (item['gastos'] or 0)
                + consumo_por_mes.get(item['mes'], Decimal('0'))
            ),
        }
        for item in sorted(
            tendencia_por_mes.values(), key=lambda x: x['mes']
        )
        if item['mes']
    ]

    ultimos = tendencia_data[-3:]
    promedio_ingresos = sum(m['ingresos'] for m in ultimos) / len(ultimos) if ultimos else 0
    promedio_gastos = sum(m['gastos'] for m in ultimos) / len(ultimos) if ultimos else 0
    proyeccion = []
    for i in range(1, 7):
        mes_futuro = (hoy.replace(day=1) + timedelta(days=30 * i)).strftime('%b %Y')
        proyeccion.append({
            'mes': mes_futuro,
            'ingresos': round(promedio_ingresos * (1 + 0.05 * i), 2),
            'gastos': round(promedio_gastos * (1 + 0.03 * i), 2),
        })

    ingresos_vs_gastos_data = [
        {
            'mes': t['mes'],
            'ingresos': t['ingresos'],
            'gastos': t['gastos'],
        }
        for t in tendencia_data
    ]

    real_por_mes = {t['mes']: t for t in tendencia_data}
    proyeccion_por_mes = {p['mes']: p for p in proyeccion}
    tendencia_mensual_data = []
    for mes_num in range(1, 13):
        etiqueta = date(hoy.year, mes_num, 1).strftime('%b %Y')
        if etiqueta in real_por_mes:
            item = real_por_mes[etiqueta]
            tendencia_mensual_data.append({
                'mes': etiqueta,
                'ingresos': item['ingresos'],
                'gastos': item['gastos'],
                'tipo': 'real',
            })
        elif etiqueta in proyeccion_por_mes:
            item = proyeccion_por_mes[etiqueta]
            tendencia_mensual_data.append({
                'mes': etiqueta,
                'ingresos': item['ingresos'],
                'gastos': item['gastos'],
                'tipo': 'proyeccion',
            })
        else:
            tendencia_mensual_data.append({
                'mes': etiqueta,
                'ingresos': 0,
                'gastos': 0,
                'tipo': 'sin_datos',
            })

    etiquetas_tendencia = {t['mes'] for t in tendencia_mensual_data}
    for item in proyeccion:
        if item['mes'] not in etiquetas_tendencia:
            tendencia_mensual_data.append({
                'mes': item['mes'],
                'ingresos': item['ingresos'],
                'gastos': item['gastos'],
                'tipo': 'proyeccion',
            })

    semanal = (
        movs.filter(moneda='CUP')
        .annotate(semana=TruncWeek('fecha'))
        .values('semana')
        .annotate(
            ingresos_brutos=Sum(
                'monto',
                filter=Q(tipo='INGRESO')
                & ~Q_NO_INGRESO_OPERATIVO
                & ~Q_INGRESO_DIFERIDO,
            ),
            vuelto_clientes=Sum(
                'monto',
                filter=Q(tipo='EGRESO')
                & Q(categoria=CATEGORIA_VUELTO_CLIENTE),
            ),
            gastos=Sum(
                'monto',
                filter=Q(tipo='EGRESO') & ~Q_NO_GASTO_OPERATIVO,
            ),
        )
        .order_by('semana')
    )
    consumo_semanal = (
        consumos.annotate(semana=TruncWeek('fecha'))
        .values('semana')
        .annotate(total=Sum('costo_total'))
    )
    consumo_por_semana = {
        item['semana']: item['total'] or Decimal('0')
        for item in consumo_semanal
        if item['semana']
    }
    anticipo_semanal = (
        anticipos_dif.filter(moneda='CUP')
        .annotate(semana=TruncWeek('pedido__fecha_entrega_real'))
        .values('semana')
        .annotate(total=Sum('monto'))
    )
    anticipo_por_semana = {
        item['semana']: item['total'] or Decimal('0')
        for item in anticipo_semanal
        if item['semana']
    }
    semanal_por_semana = {
        item['semana']: item for item in semanal if item['semana']
    }
    for semana in set(consumo_por_semana) | set(anticipo_por_semana):
        if semana not in semanal_por_semana:
            semanal_por_semana[semana] = {
                'semana': semana,
                'ingresos_brutos': Decimal('0'),
                'vuelto_clientes': Decimal('0'),
                'gastos': Decimal('0'),
            }
    semanal_data = [
        {
            'semana': item['semana'].strftime('%d/%m') if item['semana'] else '',
            'ingresos_brutos': float(
                (item['ingresos_brutos'] or 0)
                + anticipo_por_semana.get(item['semana'], Decimal('0'))
            ),
            'vuelto_clientes': float(item['vuelto_clientes'] or 0),
            'ingresos': float(
                (item['ingresos_brutos'] or 0)
                + anticipo_por_semana.get(item['semana'], Decimal('0'))
                - (item['vuelto_clientes'] or 0)
            ),
            'gastos': float(
                (item['gastos'] or 0)
                + consumo_por_semana.get(item['semana'], Decimal('0'))
            ),
        }
        for item in sorted(
            semanal_por_semana.values(), key=lambda x: x['semana']
        )
        if item['semana']
    ]

    ingresos_por_dia = (
        movs.filter(moneda='CUP', tipo='INGRESO')
        .exclude(Q_NO_INGRESO_OPERATIVO | Q_INGRESO_DIFERIDO)
        .annotate(dia=ExtractWeekDay('fecha'))
        .values('dia')
        .annotate(total=Sum('monto'))
    )
    totales_por_dia = {
        fila['dia']: float(fila['total'] or 0)
        for fila in ingresos_por_dia
    }
    anticipos_por_dia = (
        anticipos_dif.filter(moneda='CUP')
        .annotate(dia=ExtractWeekDay('pedido__fecha_entrega_real'))
        .values('dia')
        .annotate(total=Sum('monto'))
    )
    for fila in anticipos_por_dia:
        totales_por_dia[fila['dia']] = (
            totales_por_dia.get(fila['dia'], 0)
            + float(fila['total'] or 0)
        )
    mapa_calor_dias_data = [
        {'dia': nombre, 'total': totales_por_dia.get(numero, 0)}
        for nombre, numero in (
            ('Lun', 2),
            ('Mar', 3),
            ('Mié', 4),
            ('Jue', 5),
            ('Vie', 6),
            ('Sáb', 7),
            ('Dom', 1),
        )
    ]

    calor = (
        movs.annotate(dia=ExtractWeekDay('fecha'), hora=ExtractHour('fecha'))
        .values('dia', 'hora')
        .annotate(total=Count('id'))
        .order_by('dia', 'hora')
    )
    dias_semana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    horas = list(range(0, 24))
    matriz = [[0 for _ in horas] for _ in dias_semana]
    max_valor = 0
    for c in calor:
        if c['dia'] and c['hora'] is not None:
            valor = c['total']
            matriz[c['dia'] - 1][c['hora']] = valor
            max_valor = max(max_valor, valor)
    calor_data = {
        'horas': [f'{h:02d}' for h in horas],
        'filas': [
            {'dia': dias_semana[i], 'valores': matriz[i]}
            for i in range(len(dias_semana))
        ],
        'max': max_valor,
    }

    transacciones = movs.select_related('pedido', 'proveedor', 'cliente').order_by('-fecha')[:20]
    transacciones_data = [
        {
            'fecha': t.fecha.strftime('%d/%m/%Y'),
            'tipo': t.tipo,
            'concepto': t.concepto,
            'categoria': t.get_categoria_display(),
            'monto': float(t.monto),
            'moneda': t.moneda,
        }
        for t in transacciones
    ]

    analisis = (
        movs.values('categoria', 'tipo', 'moneda')
        .annotate(total=Sum('monto'), cantidad=Count('id'))
        .order_by('-total')
    )
    analisis_data = [
        {
            'categoria': dict(MovimientoCaja.CATEGORIA_CHOICES).get(a['categoria'], a['categoria']),
            'tipo': a['tipo'],
            'moneda': a['moneda'],
            'total': float(a['total'] or 0),
            'cantidad': a['cantidad'],
        }
        for a in analisis
    ]

    consejos = []
    if margen < 20:
        consejos.append({
            'tipo': 'danger',
            'titulo': 'Margen bajo',
            'texto': f'Tu margen operativo es {margen:.1f}%. Revisa costos o precios.',
        })
    elif margen > 50:
        consejos.append({
            'tipo': 'success',
            'titulo': 'Margen saludable',
            'texto': f'Tu margen operativo es {margen:.1f}%. Vas por buen camino.',
        })
    gastos_totales_equiv = gastos_equiv_cup + depreciacion_activos_cup
    if (
        ingresos_equiv > 0
        and gastos_totales_equiv / ingresos_equiv > Decimal('0.7')
    ):
        consejos.append({
            'tipo': 'warning',
            'titulo': 'Gastos elevados',
            'texto': (
                'Tus gastos totales representan el '
                f'{(gastos_totales_equiv / ingresos_equiv * 100):.1f}% '
                'de los ingresos netos.'
            ),
        })

    deuda_clientes = (
        Pedido.objects.filter(cliente__isnull=False, saldo_pendiente__gt=0)
        .exclude(estado__nombre__in=['Cancelado', 'Borrador'])
        .aggregate(t=Sum('saldo_pendiente'))['t']
        or Decimal('0')
    )
    cantidad_caratula = Pedido.objects.filter(
        estado__nombre__in=ESTADOS_ANTES_CARATULA
    ).count()
    cantidad_encuadernado = Pedido.objects.filter(
        estado__nombre__in=ESTADOS_ANTES_ENCUADERNADO
    ).count()
    cantidad_cantos = Pedido.objects.filter(
        estado__nombre__in=ESTADOS_ANTES_CANTOS,
        lleva_cantos_tintados=True,
    ).count()
    deuda_caratula = cantidad_caratula * 1080
    deuda_encuadernado = cantidad_encuadernado * 480
    deuda_cantos = cantidad_cantos * 2500
    deudas_proveedores_proyectadas = (
        deuda_caratula + deuda_encuadernado + deuda_cantos
    )
    dinero_proyectado = (
        Decimal(str(monedas['equivalente']['saldo_caja_cup']))
        + deuda_clientes
        - Decimal(str(deudas_proveedores_proyectadas))
    )

    atrasados = Pedido.objects.filter(
        fecha_entrega_prometida__lt=hoy,
        estado__es_final=False,
        cliente__isnull=False,
    ).exclude(estado__nombre__in=['Entregado', 'Cancelado']).count()
    if atrasados > 0:
        consejos.append({
            'tipo': 'danger',
            'titulo': f'{atrasados} pedidos atrasados',
            'texto': 'Tienes pedidos con fecha de entrega vencida.',
        })

    materiales_bajos = Material.objects.filter(
        activo=True, stock_actual__lte=F('stock_minimo')
    ).count()
    if materiales_bajos > 0:
        consejos.append({
            'tipo': 'warning',
            'titulo': f'{materiales_bajos} materiales con stock bajo',
            'texto': 'Revisa el inventario y repón los materiales.',
        })

    if clientes_unicos > 0 and total_pedidos / clientes_unicos < 1.5:
        consejos.append({
            'tipo': 'info',
            'titulo': 'Clientes recurrentes bajos',
            'texto': 'La mayoría de tus clientes compran una sola vez.',
        })

    kpis = {
        'ingresos_brutos_cup': monedas['CUP']['ingresos_brutos'],
        'vuelto_clientes_cup': monedas['CUP']['vuelto_clientes'],
        'ingresos_cup': monedas['CUP']['ingresos'],
        'gastos_cup': monedas['CUP']['gastos'],
        'gastos_totales_cup': float(
            Decimal(str(monedas['CUP']['gastos'])) + depreciacion_activos_cup
        ),
        'saldo_neto_cup': monedas['CUP']['saldo_neto_operativo'],
        'flujo_neto_cup': monedas['CUP']['flujo_neto'],
        'ingresos_brutos_usd': monedas['USD']['ingresos_brutos'],
        'vuelto_clientes_usd': monedas['USD']['vuelto_clientes'],
        'ingresos_usd': monedas['USD']['ingresos'],
        'gastos_usd': monedas['USD']['gastos'],
        'saldo_neto_usd': monedas['USD']['saldo_neto_operativo'],
        'flujo_neto_usd': monedas['USD']['flujo_neto'],
        'ingresos_brutos_equiv_cup': monedas['equivalente']['ingresos_brutos_cup'],
        'vuelto_clientes_equiv_cup': monedas['equivalente']['vuelto_clientes_cup'],
        'ingresos_equiv_cup': monedas['equivalente']['ingresos_cup'],
        'gastos_equiv_cup': monedas['equivalente']['gastos_cup'],
        'gastos_totales_equiv_cup': float(
            gastos_equiv_cup + depreciacion_activos_cup
        ),
        'depreciacion_activos_cup': float(depreciacion_activos_cup),
        'saldo_neto_equiv_cup': monedas['equivalente']['saldo_neto_cup'],
        'saldo_neto_contable_cup': float(saldo_contable_cup),
        'saldo_neto_equiv_usd': monedas['equivalente']['saldo_neto_usd'],
        'saldo_caja_cup': monedas['CUP']['saldo_caja'],
        'saldo_caja_usd': monedas['USD']['saldo_caja'],
        'saldo_caja_equiv_cup': monedas['equivalente']['saldo_caja_cup'],
        'saldo_caja_equiv_usd': monedas['equivalente']['saldo_caja_usd'],
        'margen': float(margen),
        'margen_operativo': float(margen_operativo),
        'total_ingresos': float(ingresos_equiv),
        'total_gastos_operativos': float(gastos_equiv_cup),
        'utilidades': float(saldo_operativo_cup),
        'total_recaudado_ventas': float(total_recaudado_ventas),
        'ganancia_promedio_pedido': float(ganancia_promedio_pedido),
        'total_pedidos': total_pedidos,
        'clientes_unicos': clientes_unicos,
        'ventas': float(ventas),
        'ganancia_promedio_cup': float(ganancia_promedio_cup),
        'ganancia_promedio_usd': float(convertir_cup_a_usd(ganancia_promedio_cup, tasa)),
        'pasivos_cup': pasivos['total'],
        'pasivos_activos': pasivos['total'],
        'anticipos_cup': pasivos['anticipos'],
        'servicios_impagos_cup': pasivos['servicios_impagos'],
        'pedidos_activos': pasivos['pedidos_activos'],
        'deuda_clientes': float(deuda_clientes),
        'dinero_proyectado': float(dinero_proyectado),
        'punto_equilibrio': float(punto_equilibrio),
        'margen_contribucion': float(margen_contribucion * 100),
        'sueldo_dueno': float(sueldo_dueno),
        'flujo_caja_neto_mes': float(flujo_caja_neto_mes),
        'ingresos_caja_mes': float(ingresos_caja_mes),
        'egresos_caja_mes': float(egresos_caja_mes),
    }

    return {
        'meta': {
            'desde': desde.isoformat() if desde else '',
            'hasta': hasta.isoformat() if hasta else '',
            'corte_financiero': FECHA_CORTE_FINANCIERO.isoformat(),
            'referencia_corte': REFERENCIA_CORTE_FINANCIERO,
            'tasa_cambio': float(tasa),
            'advertencia_tasa': advertencia,
            'formula_ganancia': 'sum(precio_venta - costo_total) / pedidos Entregados desde 2026-08-02',
            'formula_punto_equilibrio': '(gastos_operativos + sueldo_dueno) / margen_contribucion',
        },
        'kpis': kpis,
        'desglose_ingresos': desglose_data,
        'categorias_ingreso': desglose_data,
        'categorias_ingresos': desglose_data,
        'categorias_gastos': categorias_gastos_data,
        'costo_unitario': costo_unitario,
        'tendencia': tendencia_data,
        'ingresos_vs_gastos': ingresos_vs_gastos_data,
        'tendencia_mensual': tendencia_mensual_data,
        'proyeccion': proyeccion,
        'semanal': semanal_data,
        'mapa_calor_dias': mapa_calor_dias_data,
        'calor': calor_data,
        'transacciones': transacciones_data,
        'analisis_categorias': analisis_data,
        'consejos': consejos,
        'ticket_por_categoria': ticket_por_categoria,
    }


def dashboard_produccion(desde=None, hasta=None):
    pedidos = Pedido.objects.filter(cliente__isnull=False, es_historico=False)
    if desde:
        pedidos = pedidos.filter(fecha_pedido__date__gte=desde)
    if hasta:
        pedidos = pedidos.filter(fecha_pedido__date__lte=hasta)

    pedidos_totales = pedidos.count()
    libros_unicos = pedidos.values('libro').distinct().count()
    libros_con_pedidos = pedidos.values('libro').annotate(total=Count('id'))
    libros_con_un_pedido = libros_con_pedidos.filter(total=1).count()
    libros_repetidos = libros_con_pedidos.filter(total__gt=1).count()

    top10 = (
        pedidos.values('libro__titulo', 'libro__autor')
        .annotate(total_pedidos=Count('id'))
        .order_by('-total_pedidos')[:10]
    )
    top10_data = [
        {
            'titulo': l['libro__titulo'],
            'autor': l['libro__autor'] or '',
            'total': l['total_pedidos'],
        }
        for l in top10
    ]

    ranking = (
        pedidos.values('libro__titulo', 'libro__autor', 'libro__paginas')
        .annotate(
            total_pedidos=Count('id'),
            total_clientes=Count('cliente', distinct=True),
            total_ventas=Sum('precio_venta'),
        )
        .order_by('-total_pedidos')[:30]
    )
    ranking_data = [
        {
            'titulo': l['libro__titulo'],
            'autor': l['libro__autor'] or '',
            'paginas': l['libro__paginas'],
            'pedidos': l['total_pedidos'],
            'clientes': l['total_clientes'],
            'ventas': float(l['total_ventas'] or 0),
        }
        for l in ranking
    ]

    recientes = (
        pedidos.values('libro', 'libro__titulo', 'libro__autor')
        .annotate(
            fecha_reciente=Max('fecha_pedido'),
            total_pedidos=Count('id'),
            total_clientes=Count('cliente', distinct=True),
        )
        .order_by('-fecha_reciente')[:10]
    )
    recientes_data = [
        {
            'id': l['libro'],
            'titulo': l['libro__titulo'],
            'autor': l['libro__autor'] or '',
            'fecha': l['fecha_reciente'].strftime('%d/%m/%Y') if l['fecha_reciente'] else '—',
            'pedidos': l['total_pedidos'],
            'clientes': l['total_clientes'],
        }
        for l in recientes
    ]

    comportamiento = (
        pedidos.annotate(mes=TruncMonth('fecha_pedido'))
        .values('mes')
        .annotate(
            total_pedidos=Count('id'),
            entregados=Count('id', filter=Q(estado__nombre='Entregado')),
            ventas=Sum('precio_venta'),
        )
        .order_by('mes')
    )
    comportamiento_data = [
        {
            'mes': c['mes'].strftime('%b %Y'),
            'pedidos': c['total_pedidos'],
            'entregados': c['entregados'],
            'ventas': float(c['ventas'] or 0),
        }
        for c in comportamiento
        if c['mes']
    ]

    fechas_pedido = dict(pedidos.values_list('id', 'fecha_pedido'))
    fechas_entrega = dict(pedidos.values_list('id', 'fecha_entrega_real'))
    historial = (
        HistorialEstado.objects.filter(pedido__in=pedidos)
        .select_related('estado_nuevo')
        .order_by('pedido_id', 'fecha')
    )
    historial_por_pedido = {}
    for evento in historial:
        historial_por_pedido.setdefault(evento.pedido_id, []).append(evento)

    lead_time_muestras = []
    for eventos in historial_por_pedido.values():
        t_impreso = next(
            (e.fecha for e in eventos if e.estado_nuevo.nombre == 'Impreso'),
            None,
        )
        if not t_impreso:
            continue
        t_listo = next(
            (
                e.fecha
                for e in eventos
                if e.estado_nuevo.nombre == 'Listo para Entregar'
                and e.fecha >= t_impreso
            ),
            None,
        )
        if not t_listo:
            continue
        lead_time_muestras.append((t_listo - t_impreso).total_seconds() / 86400)
    lead_time_promedio = (
        round(sum(lead_time_muestras) / len(lead_time_muestras), 1)
        if lead_time_muestras
        else 0
    )

    ahora = timezone.now()
    limite_estancamiento = ahora - timedelta(days=DIAS_ESTANCAMIENTO)
    ultimo_estado = (
        HistorialEstado.objects.filter(pedido=OuterRef('pk'))
        .order_by('-fecha')
        .values('fecha')[:1]
    )
    estancados = (
        pedidos_activos()
        .filter(es_historico=False)
        .annotate(fecha_ultimo_estado=Coalesce(Subquery(ultimo_estado), 'fecha_pedido'))
        .filter(fecha_ultimo_estado__lt=limite_estancamiento)
        .select_related('libro', 'estado', 'cliente')
        .order_by('fecha_ultimo_estado')
    )
    pedidos_estancados_data = [
        {
            'id': pedido.id,
            'referencia': (
                f'#{pedido.id}'
                if pedido.referencia_externa is None
                else str(pedido.referencia_externa)
            ),
            'cliente': pedido.cliente.nombre if pedido.cliente_id else '—',
            'libro': pedido.libro.titulo if pedido.libro_id else '—',
            'estado': pedido.estado.nombre if pedido.estado_id else '—',
            'dias': max(0, (ahora - pedido.fecha_ultimo_estado).days),
            'fecha_estado': (
                timezone.localtime(pedido.fecha_ultimo_estado).strftime('%d/%m/%Y')
                if pedido.fecha_ultimo_estado
                else '—'
            ),
        }
        for pedido in estancados
    ]

    hace_30_dias = ahora - timedelta(days=DIAS_CAPACIDAD_TALLER)
    libros_producidos_30d = (
        Pedido.objects.filter(
            id__in=HistorialEstado.objects.filter(
                estado_nuevo__nombre='Listo para Entregar',
                fecha__gte=hace_30_dias,
            ).values('pedido_id'),
            es_historico=False,
        )
        .exclude(estado__nombre='Cancelado')
        .aggregate(t=Sum('cantidad'))['t']
        or 0
    )
    capacidad_semanal = round(
        float(libros_producidos_30d) * 7 / DIAS_CAPACIDAD_TALLER, 1
    )

    colores_estado = {
        e.nombre: e.color
        for e in Estado.objects.filter(nombre__in=ESTADOS_TIEMPO_ORDEN)
    }
    tiempos_acumulados = {}

    def _acumular_tiempo(nombre_estado, horas):
        if horas <= 0:
            return
        acumulado = tiempos_acumulados.setdefault(
            nombre_estado,
            {
                'estado': nombre_estado,
                'color': colores_estado.get(nombre_estado, '#6c757d'),
                'total_horas': 0.0,
                'pedidos': 0,
            },
        )
        acumulado['total_horas'] += horas
        acumulado['pedidos'] += 1

    for pedido_id, eventos in historial_por_pedido.items():
        inicio_pedido = fechas_pedido.get(pedido_id)
        t_impreso = next(
            (e.fecha for e in eventos if e.estado_nuevo.nombre == 'Impreso'),
            None,
        )
        if inicio_pedido and t_impreso:
            _acumular_tiempo(
                'Pendiente a impresión',
                (t_impreso - inicio_pedido).total_seconds() / 3600,
            )

        for indice, evento in enumerate(eventos):
            nombre = evento.estado_nuevo.nombre
            if nombre not in ESTADOS_TIEMPO_ORDEN or nombre == 'Pendiente a impresión':
                continue
            if indice + 1 < len(eventos):
                siguiente = eventos[indice + 1].fecha
            else:
                siguiente = fechas_entrega.get(pedido_id)
            if not siguiente:
                continue
            _acumular_tiempo(
                nombre,
                (siguiente - evento.fecha).total_seconds() / 3600,
            )

    tiempos_data = []
    for nombre in ESTADOS_TIEMPO_ORDEN:
        item = tiempos_acumulados.get(nombre)
        if not item:
            continue
        tiempos_data.append({
            'estado': item['estado'],
            'color': item['color'],
            'promedio_horas': round(
                item['total_horas'] / item['pedidos'], 1
            ) if item['pedidos'] else 0,
            'pedidos': item['pedidos'],
        })

    top10_ids = [
        l['libro']
        for l in pedidos.values('libro').annotate(total=Count('id')).order_by('-total')[:10]
    ]
    por_mes = (
        pedidos.filter(libro__id__in=top10_ids)
        .annotate(mes=TruncMonth('fecha_pedido'))
        .values('mes', 'libro__titulo')
        .annotate(total=Count('id'))
        .order_by('mes', '-total')
    )
    meses = sorted({p['mes'] for p in por_mes if p['mes']})
    series = {}
    for p in por_mes:
        if not p['mes']:
            continue
        titulo = p['libro__titulo']
        series.setdefault(titulo, {m: 0 for m in meses})
        series[titulo][p['mes']] = p['total']

    return {
        'kpis': {
            'pedidos_totales': pedidos_totales,
            'libros_unicos': libros_unicos,
            'libros_con_un_pedido': libros_con_un_pedido,
            'libros_repetidos': libros_repetidos,
            'lead_time_dias': lead_time_promedio,
            'pedidos_estancados': len(pedidos_estancados_data),
            'capacidad_semanal': capacidad_semanal,
            'libros_producidos_30d': libros_producidos_30d,
        },
        'top10_data': top10_data,
        'ranking_data': ranking_data,
        'recientes_data': recientes_data,
        'comportamiento_pedidos_mes': comportamiento_data,
        'tiempos_por_estado': tiempos_data,
        'pedidos_estancados_data': pedidos_estancados_data,
        'pedidos_mes_data': {
            'labels': [m.strftime('%b %Y') for m in meses],
            'series': [
                {
                    'label': titulo,
                    'data': [series[titulo].get(m, 0) for m in meses],
                }
                for titulo in series
            ],
        },
    }


def dashboard_clientes(desde=None, hasta=None):
    hoy = timezone.localdate()
    ultimo_pedido_subquery = (
        Pedido.objects.filter(cliente=OuterRef('pk'))
        .order_by('-fecha_pedido')
        .values('fecha_pedido')[:1]
    )
    clientes_qs = Cliente.objects.annotate(
        total_pedidos_db=Count('pedidos', filter=~Q(pedidos__estado__nombre='Cancelado')),
        total_gastado_db=Sum(
            'pedidos__precio_venta', filter=~Q(pedidos__estado__nombre='Cancelado')
        ),
        fecha_ultimo_db=Subquery(ultimo_pedido_subquery),
    )

    clientes_data = []
    for c in clientes_qs:
        total_pedidos_c = c.total_pedidos_db or 0
        total_gastado = c.total_gastado_db or 0
        fecha_ultimo = None
        dias_sin_comprar = 9999
        if c.fecha_ultimo_db:
            fecha_ultimo = c.fecha_ultimo_db.date()
            dias_sin_comprar = (hoy - fecha_ultimo).days

        if total_pedidos_c == 0:
            tipo = 'sin_pedidos'
        elif total_pedidos_c == 1:
            tipo = 'nuevo'
        elif dias_sin_comprar > 90:
            tipo = 'en_riesgo'
        elif total_pedidos_c > 10:
            tipo = 'vip'
        else:
            tipo = 'recurrente'

        clientes_data.append({
            'id': c.id,
            'nombre': c.nombre,
            'telefono': c.telefono or '',
            'pedidos': total_pedidos_c,
            'total_gastado': float(total_gastado),
            'ultimo_pedido': fecha_ultimo.strftime('%d/%m/%Y') if fecha_ultimo else '—',
            'dias_sin_comprar': dias_sin_comprar if fecha_ultimo else None,
            'tipo': tipo,
        })

    total = len(clientes_data)
    nuevos = sum(1 for c in clientes_data if c['tipo'] == 'nuevo')
    recurrentes = sum(1 for c in clientes_data if c['tipo'] == 'recurrente')
    vip = sum(1 for c in clientes_data if c['tipo'] == 'vip')
    riesgo = sum(1 for c in clientes_data if c['tipo'] == 'en_riesgo')
    promedio = sum(c['pedidos'] for c in clientes_data) / total if total else 0

    vip_lista = sorted(
        [c for c in clientes_data if c['tipo'] == 'vip'],
        key=lambda x: x['total_gastado'],
        reverse=True,
    )
    riesgo_lista = sorted(
        [c for c in clientes_data if c['tipo'] == 'en_riesgo'],
        key=lambda x: x['dias_sin_comprar'],
        reverse=True,
    )

    frecuencia = {}
    for c in clientes_data:
        if c['pedidos'] > 0:
            frecuencia[c['pedidos']] = frecuencia.get(c['pedidos'], 0) + 1

    return {
        'kpis': {
            'clientes_unicos_total': total,
            'clientes_nuevos': nuevos,
            'clientes_recurrentes': recurrentes,
            'clientes_vip': vip,
            'clientes_en_riesgo': riesgo,
            'promedio_pedidos': promedio,
        },
        'tipo_cliente_data': [
            {'tipo': 'Nuevos', 'total': nuevos},
            {'tipo': 'Recurrentes', 'total': recurrentes},
            {'tipo': 'VIP', 'total': vip},
        ],
        'frecuencia_data': {
            'labels': [str(k) for k in sorted(frecuencia)],
            'data': [frecuencia[k] for k in sorted(frecuencia)],
        },
        'clientes_vip_lista': vip_lista,
        'clientes_riesgo_lista': riesgo_lista,
    }


def dashboard_leads(desde=None, hasta=None):
    from clientes.models import Lead
    from clientes.services import ServicioLeads
    from django.db.models import Count, Q
    from django.db.models.functions import TruncDate

    try:
        ServicioLeads.marcar_perdidos_por_antiguedad(30)
    except Exception:
        pass

    qs = Lead.objects.all()
    if desde:
        qs = qs.filter(fecha_creacion__date__gte=desde)
    if hasta:
        qs = qs.filter(fecha_creacion__date__lte=hasta)

    total = qs.count()
    por_estado = {k: qs.filter(estado=k).count() for k, _ in Lead.ESTADO_CHOICES}
    por_via = {k: qs.filter(via_contacto=k).count() for k, _ in Lead.VIA_CHOICES}
    convertidos = por_estado.get(Lead.ESTADO_CONVERTIDO, 0)
    tasa_conversion = round((convertidos / total * 100), 1) if total else 0
    hoy = timezone.localdate()
    inicio_mes = hoy.replace(day=1)
    base_mes = Lead.objects.all()
    mes_total = base_mes.filter(fecha_creacion__date__gte=inicio_mes).count()
    mes_convertidos = base_mes.filter(estado=Lead.ESTADO_CONVERTIDO, fecha_conversion__date__gte=inicio_mes).count()
    from datetime import timedelta
    ultimos_30 = base_mes.filter(fecha_creacion__date__gte=hoy - timedelta(days=30)).count()

    from django.db.models.functions import TruncMonth
    tendencia_qs = qs.annotate(dia=TruncDate('fecha_creacion')).values('dia').annotate(total=Count('id')).order_by('dia')
    tendencia = [{'dia': str(x['dia']), 'total': x['total']} for x in tendencia_qs]

    tendencia_mes_qs = qs.annotate(mes=TruncMonth('fecha_creacion')).values('mes').annotate(
        total=Count('id'),
        convertidos=Count('id', filter=Q(estado=Lead.ESTADO_CONVERTIDO)),
        perdidos=Count('id', filter=Q(estado=Lead.ESTADO_PERDIDO)),
    ).order_by('mes')
    tendencia_mensual = []
    for x in tendencia_mes_qs:
        t = x['total'] or 0
        c = x['convertidos'] or 0
        tendencia_mensual.append({
            'mes': x['mes'].strftime('%Y-%m') if x['mes'] else '',
            'total': t, 'convertidos': c, 'perdidos': x['perdidos'] or 0,
            'tasa_conversion': round(c / t * 100, 1) if t else 0,
        })

    conversion_por_via = []
    for k, l in Lead.VIA_CHOICES:
        tv = por_via.get(k, 0)
        cv = qs.filter(via_contacto=k, estado=Lead.ESTADO_CONVERTIDO).count()
        if tv > 0:
            conversion_por_via.append({'via': k, 'label': l, 'total': tv, 'convertidos': cv, 'tasa': round(cv/tv*100,1) if tv else 0})

    recientes = list(qs.select_related('cliente').order_by('-fecha_creacion')[:20].values(
        'id', 'nombre', 'telefono', 'via_contacto', 'estado', 'interes', 'fecha_creacion', 'cliente__nombre'
    ))
    for r in recientes:
        r['fecha_creacion'] = r['fecha_creacion'].isoformat() if r['fecha_creacion'] else None
        r['cliente_nombre'] = r.pop('cliente__nombre')

    embudo = [
        {'etapa': 'Nuevos', 'total': por_estado.get(Lead.ESTADO_NUEVO, 0)},
        {'etapa': 'Contactados', 'total': por_estado.get(Lead.ESTADO_CONTACTADO, 0)},
        {'etapa': 'Interesados', 'total': por_estado.get(Lead.ESTADO_INTERESADO, 0)},
        {'etapa': 'Convertidos', 'total': por_estado.get(Lead.ESTADO_CONVERTIDO, 0)},
    ]

    return {
        'kpis': {
            'total': total, 'convertidos': convertidos, 'tasa_conversion': tasa_conversion,
            'nuevos': por_estado.get(Lead.ESTADO_NUEVO, 0), 'contactados': por_estado.get(Lead.ESTADO_CONTACTADO, 0),
            'interesados': por_estado.get(Lead.ESTADO_INTERESADO, 0), 'perdidos': por_estado.get(Lead.ESTADO_PERDIDO, 0),
            'mes_total': mes_total, 'mes_convertidos': mes_convertidos, 'ultimos_30': ultimos_30,
        },
        'por_estado': [{'estado': k, 'label': l, 'total': por_estado.get(k, 0)} for k, l in Lead.ESTADO_CHOICES],
        'por_via': [{'via': k, 'label': l, 'total': por_via.get(k, 0)} for k, l in Lead.VIA_CHOICES],
        'tendencia': tendencia,
        'tendencia_mensual': tendencia_mensual,
        'conversion_por_via': conversion_por_via,
        'embudo': embudo,
        'recientes': recientes,
    }


def dashboard_fidelidad(desde=None, hasta=None):
    """KPIs de fidelidad. Las tarjetas son una foto actual; los pedidos respetan el filtro."""
    hoy = timezone.localdate()
    ahora = timezone.now()
    meta = ServicioFidelidad._meta()
    bono_monto = ServicioFidelidad._bono()
    dias_expiracion = ServicioFidelidad._dias_expiracion()

    total_clientes = Cliente.objects.count()
    tarjetas_qs = TarjetaFidelidad.objects.all()
    tarjetas_total = tarjetas_qs.count()

    agregados = tarjetas_qs.aggregate(
        sellos_promedio=Avg('sellos'),
        sellos_totales=Sum('sellos'),
        bono_pendiente=Sum('bono_saldo'),
    )
    sellos_promedio = agregados['sellos_promedio'] or 0
    sellos_totales = agregados['sellos_totales'] or 0
    bono_pendiente = agregados['bono_pendiente'] or 0

    tarjetas_activas = tarjetas_qs.filter(
        Q(sellos__gt=0) | Q(bono_saldo__gt=0)
    ).count()
    tarjetas_completas = tarjetas_qs.filter(sellos__gte=meta).count()
    clientes_con_bono = tarjetas_qs.filter(bono_saldo__gt=0).count()

    conteo_sellos = {
        fila['sellos']: fila['cantidad']
        for fila in tarjetas_qs.values('sellos').annotate(cantidad=Count('id'))
    }
    max_sellos = max([meta, *conteo_sellos.keys()], default=meta)
    distribucion_sellos = [
        {'sellos': sello, 'cantidad': conteo_sellos.get(sello, 0)}
        for sello in range(0, max_sellos + 1)
    ]

    limite_riesgo = ahora - timedelta(days=max(0, dias_expiracion - 7))
    limite_por_expirar = ahora - timedelta(days=max(0, dias_expiracion - 15))
    riesgo_qs = tarjetas_qs.filter(
        sellos__gt=0,
        fecha_ultima_compra__isnull=False,
        fecha_ultima_compra__lte=limite_riesgo,
    )
    clientes_en_riesgo = riesgo_qs.count()
    por_expirar_total = tarjetas_qs.filter(
        sellos__gt=0,
        fecha_ultima_compra__isnull=False,
        fecha_ultima_compra__lte=limite_por_expirar,
    ).count()
    clientes_por_expirar = max(0, por_expirar_total - clientes_en_riesgo)

    lista_riesgo_qs = (
        tarjetas_qs.select_related('cliente')
        .filter(
            sellos__gt=0,
            fecha_ultima_compra__isnull=False,
            fecha_ultima_compra__lte=limite_por_expirar,
        )
        .order_by('fecha_ultima_compra')
    )
    clientes_riesgo_lista = []
    for tarjeta in lista_riesgo_qs[:10]:
        vence = tarjeta.fecha_ultima_compra + timedelta(days=dias_expiracion)
        dias_restantes = max(0, (vence - ahora).days)
        if dias_restantes <= 7:
            urgencia = 'alta'
        elif dias_restantes <= 15:
            urgencia = 'media'
        else:
            urgencia = 'baja'
        clientes_riesgo_lista.append({
            'id': tarjeta.cliente_id,
            'nombre': tarjeta.cliente.nombre,
            'telefono': tarjeta.cliente.telefono or '',
            'sellos': tarjeta.sellos,
            'ultima_compra': (
                tarjeta.fecha_ultima_compra.date().isoformat()
                if tarjeta.fecha_ultima_compra
                else ''
            ),
            'dias_restantes': dias_restantes,
            'urgencia': urgencia,
        })

    pedidos_base = Pedido.objects.filter(cliente__isnull=False).exclude(
        estado__nombre='Cancelado'
    )
    if desde:
        pedidos_base = pedidos_base.filter(fecha_pedido__date__gte=desde)
    if hasta:
        pedidos_base = pedidos_base.filter(fecha_pedido__date__lte=hasta)

    q_clientes_activos = (
        Q(cliente__tarjeta_fidelidad__sellos__gt=0)
        | Q(cliente__tarjeta_fidelidad__bono_saldo__gt=0)
    )
    pedidos_activos = pedidos_base.filter(q_clientes_activos)
    pedidos_inactivos = pedidos_base.exclude(q_clientes_activos)

    ticket_activo = (
        pedidos_activos.aggregate(total=Avg('precio_venta'))['total'] or 0
    )
    ticket_inactivo = (
        pedidos_inactivos.aggregate(total=Avg('precio_venta'))['total'] or 0
    )
    ingresos_activos = (
        pedidos_activos.aggregate(total=Sum('precio_venta'))['total'] or 0
    )
    ingresos_inactivos = (
        pedidos_inactivos.aggregate(total=Sum('precio_venta'))['total'] or 0
    )
    bono_canjeado = (
        pedidos_base.aggregate(total=Sum('bono_fidelidad_aplicado'))['total'] or 0
    )
    pedidos_con_bono = pedidos_base.filter(bono_fidelidad_aplicado__gt=0).count()
    total_pedidos_activos = pedidos_activos.count()
    total_pedidos_inactivos = pedidos_inactivos.count()

    eventos_qs = EventoFidelidad.objects.all()
    tarjetas_convertidas = (
        eventos_qs.filter(tipo=EventoFidelidad.Tipo.OTORGAMIENTO)
        .values('tarjeta_id')
        .distinct()
        .count()
    )
    tasa_conversion_bono = (
        (tarjetas_convertidas / tarjetas_total * 100) if tarjetas_total else 0
    )

    monto_bono_otorgado = (
        eventos_qs.filter(tipo=EventoFidelidad.Tipo.OTORGAMIENTO)
        .aggregate(total=Sum('cantidad'))['total'] or 0
    )
    monto_bono_canjeado = (
        eventos_qs.filter(tipo=EventoFidelidad.Tipo.CANJE)
        .aggregate(total=Sum('cantidad'))['total'] or 0
    )
    tasa_canje = (
        (monto_bono_canjeado / monto_bono_otorgado * 100)
        if monto_bono_otorgado
        else 0
    )

    primeros_bonos = (
        eventos_qs.filter(tipo=EventoFidelidad.Tipo.OTORGAMIENTO)
        .values('tarjeta_id')
        .annotate(primera=Min('fecha'))
    )
    fechas_creacion = dict(
        TarjetaFidelidad.objects.values_list('id', 'fecha_creacion')
    )
    dias_hasta_bono = [
        (fila['primera'] - fechas_creacion[fila['tarjeta_id']]).total_seconds()
        / 86400
        for fila in primeros_bonos
        if fila['primera'] and fila['tarjeta_id'] in fechas_creacion
    ]
    tiempo_medio_bono = (
        sum(dias_hasta_bono) / len(dias_hasta_bono) if dias_hasta_bono else 0
    )

    bonos_otorgados = eventos_qs.filter(
        tipo=EventoFidelidad.Tipo.OTORGAMIENTO
    ).count()
    eventos_expiracion = eventos_qs.filter(
        tipo=EventoFidelidad.Tipo.EXPIRACION
    ).count()
    sellos_expirados = (
        eventos_qs.filter(tipo=EventoFidelidad.Tipo.EXPIRACION)
        .aggregate(total=Sum('cantidad'))['total'] or 0
    )

    def _ingresos_ultimos(dias):
        inicio = hoy - timedelta(days=dias)
        return (
            Pedido.objects.filter(
                q_clientes_activos,
                cliente__isnull=False,
                fecha_pedido__date__gte=inicio,
            )
            .exclude(estado__nombre='Cancelado')
            .aggregate(total=Sum('precio_venta'))['total'] or 0
        )

    ingresos_activos_30d = _ingresos_ultimos(30)
    ingresos_activos_90d = _ingresos_ultimos(90)

    def _serie_ingresos(queryset):
        filas = (
            queryset.annotate(mes=TruncMonth('fecha_pedido'))
            .values('mes')
            .annotate(ingresos=Sum('precio_venta'), pedidos=Count('id'))
            .order_by('mes')
        )
        return {
            fila['mes'].strftime('%Y-%m'): {
                'ingresos': float(fila['ingresos'] or 0),
                'pedidos': fila['pedidos'],
            }
            for fila in filas
            if fila['mes']
        }

    serie_activos = _serie_ingresos(pedidos_activos)
    serie_inactivos = _serie_ingresos(pedidos_inactivos)
    meses = sorted(set(serie_activos) | set(serie_inactivos))
    tendencia_mensual = [
        {
            'mes': mes,
            'activos': serie_activos.get(mes, {}).get('ingresos', 0.0),
            'inactivos': serie_inactivos.get(mes, {}).get('ingresos', 0.0),
        }
        for mes in meses
    ]

    def _tarjeta_data(tarjeta):
        return {
            'id': tarjeta.cliente_id,
            'nombre': tarjeta.cliente.nombre,
            'telefono': tarjeta.cliente.telefono or '',
            'sellos': tarjeta.sellos,
            'bono_saldo': float(tarjeta.bono_saldo),
            'ultima_compra': (
                tarjeta.fecha_ultima_compra.date().isoformat()
                if tarjeta.fecha_ultima_compra
                else ''
            ),
            'meta': meta,
        }

    tarjetas_destacadas = [
        _tarjeta_data(tarjeta)
        for tarjeta in (
            tarjetas_qs.select_related('cliente')
            .order_by('-sellos', '-bono_saldo', 'cliente__nombre')[:10]
        )
    ]
    bonos_pendientes_lista = [
        _tarjeta_data(tarjeta)
        for tarjeta in (
            tarjetas_qs.select_related('cliente')
            .filter(bono_saldo__gt=0)
            .order_by('-bono_saldo', 'cliente__nombre')[:10]
        )
    ]

    adopcion = (tarjetas_total / total_clientes * 100) if total_clientes else 0

    return {
        'kpis': {
            'total_clientes': total_clientes,
            'tarjetas_total': tarjetas_total,
            'adopcion_tarjeta': round(adopcion, 1),
            'tarjetas_activas': tarjetas_activas,
            'tarjetas_completas': tarjetas_completas,
            'clientes_con_bono': clientes_con_bono,
            'bono_pendiente_total': float(bono_pendiente),
            'sellos_promedio': round(float(sellos_promedio), 2),
            'sellos_totales': int(sellos_totales),
            'meta_sellos': meta,
            'bono_monto': float(bono_monto),
            'dias_expiracion': dias_expiracion,
            'ticket_medio_activo': float(ticket_activo),
            'ticket_medio_inactivo': float(ticket_inactivo),
            'pedidos_activos': total_pedidos_activos,
            'pedidos_inactivos': total_pedidos_inactivos,
            'ingresos_activos': float(ingresos_activos),
            'ingresos_inactivos': float(ingresos_inactivos),
            'ingresos_activos_30d': float(ingresos_activos_30d),
            'ingresos_activos_90d': float(ingresos_activos_90d),
            'bono_canjeado_total': float(bono_canjeado),
            'pedidos_con_bono': pedidos_con_bono,
            'clientes_en_riesgo': clientes_en_riesgo,
            'clientes_por_expirar': clientes_por_expirar,
            'tasa_conversion_bono': round(tasa_conversion_bono, 1),
            'tarjetas_convertidas': tarjetas_convertidas,
            'tasa_canje': round(tasa_canje, 1),
            'monto_bono_otorgado': float(monto_bono_otorgado),
            'monto_bono_canjeado': float(monto_bono_canjeado),
            'tiempo_medio_bono': round(tiempo_medio_bono, 1),
            'bonos_otorgados': bonos_otorgados,
            'sellos_expirados': int(sellos_expirados),
            'eventos_expiracion': eventos_expiracion,
        },
        'distribucion_sellos': distribucion_sellos,
        'composicion_ingresos': [
            {'tipo': 'Activos', 'total': float(ingresos_activos)},
            {'tipo': 'Inactivos', 'total': float(ingresos_inactivos)},
        ],
        'ticket_medio_data': [
            {
                'tipo': 'Activos',
                'ticket': float(ticket_activo),
                'pedidos': total_pedidos_activos,
            },
            {
                'tipo': 'Inactivos',
                'ticket': float(ticket_inactivo),
                'pedidos': total_pedidos_inactivos,
            },
        ],
        'tendencia_mensual': tendencia_mensual,
        'clientes_riesgo_lista': clientes_riesgo_lista,
        'tarjetas_destacadas': tarjetas_destacadas,
        'bonos_pendientes_lista': bonos_pendientes_lista,
    }


def _plan_por_precio_cup(precio_cup):
    if precio_cup < 5000:
        return 'Base'
    if precio_cup <= 8000:
        return 'Medio'
    return 'Premium'


def _es_concepto_produccion(texto):
    texto = str(texto or '').lower()
    return any(clave in texto for clave in CONCEPTOS_PRODUCCION_GASTO)


def _tipo_gasto(movimiento):
    texto = f'{movimiento.categoria} {movimiento.concepto}'.lower()
    fijos = (
        'alquiler',
        'renta',
        'internet',
        'luz',
        'electricidad',
        'telefono',
        'teléfono',
        'nomina',
        'nómina',
        'salario',
        'seguro',
        'software',
        'suscripcion',
        'suscripción',
        'agua',
    )
    variables = (
        'humidificador',
        'insumo',
        'mensajeria',
        'mensajería',
        'envio',
        'envío',
        'comision',
        'comisión',
        *CONCEPTOS_PRODUCCION_GASTO,
    )
    if any(clave in texto for clave in fijos):
        return 'Fijo'
    if any(clave in texto for clave in variables):
        return 'Variable'
    if movimiento.categoria == 'PAGO_NOMINA':
        return 'Fijo'
    if movimiento.categoria in ('MENSAJERIA', 'PAGO_PROVEEDOR', 'COMPRA_MATERIAL'):
        return 'Variable'
    return 'Fijo'


def _monto_en_cup(movimiento, tasa):
    monto = Decimal(str(movimiento.monto or 0))
    if movimiento.moneda == 'CUP':
        return monto
    return monto * tasa


def _grupo_rentabilidad_ia():
    return {
        'pedidos': 0,
        'unidades': 0,
        'ingreso_total': Decimal('0'),
        'descuento_total': Decimal('0'),
        'costo_total': Decimal('0'),
        'ganancia_total': Decimal('0'),
    }


def _sumar_grupo_rentabilidad_ia(grupo, cantidad, ingreso, descuento, costo, ganancia):
    grupo['pedidos'] += 1
    grupo['unidades'] += int(cantidad or 0)
    grupo['ingreso_total'] += ingreso
    grupo['descuento_total'] += descuento
    grupo['costo_total'] += costo
    grupo['ganancia_total'] += ganancia


def _serializar_grupos_rentabilidad_ia(grupos, clave, por_ganancia=False):
    filas = []
    for nombre, grupo in grupos.items():
        filas.append({
            clave: nombre,
            'pedidos': grupo['pedidos'],
            'unidades': grupo['unidades'],
            'ingreso_total': float(grupo['ingreso_total']),
            'descuento_total': float(grupo['descuento_total']),
            'costo_total': float(grupo['costo_total']),
            'ganancia_total': float(grupo['ganancia_total']),
            'margen_%': (
                round(float(grupo['ganancia_total'] / grupo['ingreso_total'] * 100), 2)
                if grupo['ingreso_total']
                else 0.0
            ),
        })
    if por_ganancia:
        filas.sort(key=lambda fila: fila['ganancia_total'], reverse=True)
    else:
        filas.sort(key=lambda fila: fila[clave])
    return filas


def _serializar_grupos_gastos_ia(grupos, clave):
    filas = [
        {
            clave: nombre,
            'movimientos': grupo['movimientos'],
            'monto_cup': float(grupo['monto_cup']),
        }
        for nombre, grupo in grupos.items()
    ]
    filas.sort(key=lambda fila: fila['monto_cup'], reverse=True)
    return filas


def _limitar_top_ia(filas, clave, etiqueta='Otros'):
    if len(filas) <= LIMITE_TOP_IA:
        return filas
    campos = [
        campo
        for campo in (
            'pedidos',
            'unidades',
            'ingreso_total',
            'descuento_total',
            'costo_total',
            'ganancia_total',
        )
        if campo in filas[0]
    ]
    otros = {clave: etiqueta}
    otros.update({campo: 0 for campo in campos})
    for fila in filas[LIMITE_TOP_IA:]:
        for campo in campos:
            otros[campo] += fila[campo]
    if otros.get('ingreso_total'):
        otros['margen_%'] = round(
            otros['ganancia_total'] / otros['ingreso_total'] * 100,
            2,
        )
    elif 'margen_%' in filas[0]:
        otros['margen_%'] = 0.0
    return filas[:LIMITE_TOP_IA] + [otros]


def exportar_rentabilidad_para_ia(desde=None, hasta=None):
    parametros = _parametros_para_costeador()
    tasa, advertencia_tasa = tasa_cambio()
    desde = desde or FECHA_CORTE_FINANCIERO
    ahora = timezone.now()

    pedidos_qs = (
        Pedido.objects.filter(
            cliente__isnull=False,
            es_historico=False,
            fecha_pedido__date__gte=desde,
        )
        .exclude(estado__nombre__in=['Cancelado', 'Borrador'])
        .select_related('cliente', 'libro', 'estado')
        .order_by('fecha_pedido')
    )
    if hasta:
        pedidos_qs = pedidos_qs.filter(fecha_pedido__date__lte=hasta)
    pedidos = list(pedidos_qs)

    grupos_pedidos = {
        'por_mes': {},
        'por_estado': {},
        'por_plan': {},
        'por_libro': {},
    }
    ingresos_pedidos = Decimal('0')
    costos_produccion = Decimal('0')
    contribucion = Decimal('0')
    for pedido in pedidos:
        ingreso = Decimal(str(pedido.precio_venta or 0))
        descuento = Decimal(str(pedido.descuento_aplicado or 0))
        costo = Decimal(
            str(
                CosteadorPedido(
                    pedido, tasa_cambio=tasa, parametros=parametros
                ).calcular()['costo_total']
            )
        )
        ganancia = ingreso - costo
        precio_libro = (
            Decimal(str(pedido.libro.precio_cup_referencia or 0))
            if pedido.libro_id
            else Decimal('0')
        )
        mes = (
            pedido.fecha_pedido.strftime('%Y-%m')
            if pedido.fecha_pedido
            else 'sin_fecha'
        )
        estado = pedido.estado.nombre if pedido.estado_id else 'Sin estado'
        plan = _plan_por_precio_cup(precio_libro)
        libro = pedido.libro.titulo if pedido.libro_id else 'Sin libro'
        for clave, nombre in (
            ('por_mes', mes),
            ('por_estado', estado),
            ('por_plan', plan),
            ('por_libro', libro),
        ):
            grupo = grupos_pedidos[clave].setdefault(nombre, _grupo_rentabilidad_ia())
            _sumar_grupo_rentabilidad_ia(
                grupo, pedido.cantidad, ingreso, descuento, costo, ganancia
            )
        ingresos_pedidos += ingreso
        costos_produccion += costo
        contribucion += ganancia

    pedidos_agrupados = {
        'total_pedidos': len(pedidos),
        'por_mes': _serializar_grupos_rentabilidad_ia(
            grupos_pedidos['por_mes'], 'mes'
        ),
        'por_estado': _serializar_grupos_rentabilidad_ia(
            grupos_pedidos['por_estado'], 'estado', por_ganancia=True
        ),
        'por_plan': _serializar_grupos_rentabilidad_ia(
            grupos_pedidos['por_plan'], 'plan', por_ganancia=True
        ),
        'por_libro': _limitar_top_ia(
            _serializar_grupos_rentabilidad_ia(
                grupos_pedidos['por_libro'], 'libro', por_ganancia=True
            ),
            'libro',
            'Otros libros',
        ),
    }

    margen_contribucion = (
        contribucion / ingresos_pedidos if ingresos_pedidos > 0 else Decimal('0')
    )

    movimientos = movimientos_financieros(desde, hasta, None)
    ingresos_caja = sum(
        (
            _monto_en_cup(movimiento, tasa)
            for movimiento in movimientos.filter(tipo='INGRESO').exclude(
                Q_NO_INGRESO_OPERATIVO
            )
        ),
        Decimal('0'),
    )

    gastos_qs = (
        movimientos.filter(tipo='EGRESO')
        .exclude(
            Q_TRANSFERENCIA
            | Q(
                categoria__in=[
                    'RETIRO_UTILIDADES',
                    'COMPRA_ACTIVO',
                    CATEGORIA_VUELTO_CLIENTE,
                    'COMPRA_MATERIAL',
                ]
            )
        )
        .select_related('cliente', 'proveedor', 'pedido')
        .order_by('-fecha')
    )
    grupos_gastos = {
        'por_mes': {},
        'por_categoria': {},
        'por_tipo_gasto': {},
        'por_concepto': {},
        'por_moneda': {},
    }
    total_gastos = Decimal('0')
    total_gastos_fijos = Decimal('0')
    total_movimientos = 0
    for movimiento in gastos_qs:
        if _es_concepto_produccion(f'{movimiento.categoria} {movimiento.concepto}'):
            continue
        monto_cup = _monto_en_cup(movimiento, tasa)
        tipo_gasto = _tipo_gasto(movimiento)
        categoria = (
            movimiento.get_categoria_display()
            if hasattr(movimiento, 'get_categoria_display')
            else movimiento.categoria
        )
        mes = (
            movimiento.fecha.strftime('%Y-%m')
            if movimiento.fecha
            else 'sin_fecha'
        )
        concepto = movimiento.concepto or '(sin concepto)'
        moneda = movimiento.moneda or 'CUP'
        for clave, nombre in (
            ('por_mes', mes),
            ('por_categoria', categoria),
            ('por_tipo_gasto', tipo_gasto),
            ('por_concepto', concepto),
            ('por_moneda', moneda),
        ):
            grupo = grupos_gastos[clave].setdefault(
                nombre,
                {'movimientos': 0, 'monto_cup': Decimal('0')},
            )
            grupo['movimientos'] += 1
            grupo['monto_cup'] += monto_cup
        total_movimientos += 1
        total_gastos += monto_cup
        if tipo_gasto == 'Fijo':
            total_gastos_fijos += monto_cup

    gastos_agrupados = {
        'total_movimientos': total_movimientos,
        'total_cup': float(total_gastos),
        'por_mes': _serializar_grupos_gastos_ia(
            grupos_gastos['por_mes'], 'mes'
        ),
        'por_categoria': _serializar_grupos_gastos_ia(
            grupos_gastos['por_categoria'], 'categoria'
        ),
        'por_tipo_gasto': _serializar_grupos_gastos_ia(
            grupos_gastos['por_tipo_gasto'], 'tipo_gasto'
        ),
        'por_concepto': _serializar_grupos_gastos_ia(
            grupos_gastos['por_concepto'], 'concepto'
        ),
        'por_moneda': _serializar_grupos_gastos_ia(
            grupos_gastos['por_moneda'], 'moneda'
        ),
    }

    try:
        sueldo_dueno = Decimal(
            str(parametros.get('sueldo_dueno', Decimal('0')) or 0)
        )
    except Exception:
        sueldo_dueno = Decimal('0')

    base_equilibrio = total_gastos_fijos + sueldo_dueno
    punto_equilibrio = (
        base_equilibrio / margen_contribucion if margen_contribucion > 0 else Decimal('0')
    )
    utilidad_bruta = ingresos_pedidos - costos_produccion
    utilidad_neta = utilidad_bruta - total_gastos - sueldo_dueno

    produccion = dashboard_produccion(desde, hasta)
    metricas_produccion = {
        'lead_time_promedio': produccion['kpis']['lead_time_dias'],
        'tiempos_por_etapa': {
            item['estado']: round(item['promedio_horas'] / 24, 2)
            for item in produccion['tiempos_por_estado']
        },
        'pedidos_estancados': [
            item['id'] for item in produccion['pedidos_estancados_data']
        ],
        'capacidad_taller': produccion['kpis']['capacidad_semanal'],
    }

    historico_qs = (
        Pedido.objects.filter(cliente__isnull=False, es_historico=False)
        .exclude(estado__nombre__in=['Cancelado', 'Borrador'])
    )
    if hasta:
        historico_qs = historico_qs.filter(fecha_pedido__date__lte=hasta)
    historico = list(
        historico_qs.values('cliente_id', 'cliente__nombre')
        .annotate(
            total_pedidos=Count('id'),
            ingreso_total=Sum('precio_venta'),
            ultima_compra=Max('fecha_pedido'),
        )
        .order_by('cliente__nombre')
    )
    detalle_clientes = []
    ingresos_historicos = Decimal('0')
    clientes_con_recompra = 0
    for fila in historico:
        ingreso_cliente = Decimal(str(fila['ingreso_total'] or 0))
        ingresos_historicos += ingreso_cliente
        if fila['total_pedidos'] >= 2:
            clientes_con_recompra += 1
        ultima = fila['ultima_compra']
        dias_desde_ultima = max(0, (ahora - ultima).days) if ultima else None
        if dias_desde_ultima is None or dias_desde_ultima > 180:
            estado_cliente = 'Inactivo'
        elif dias_desde_ultima > 90:
            estado_cliente = 'En Riesgo'
        else:
            estado_cliente = 'Activo'
        detalle_clientes.append({
            'cliente_id': fila['cliente_id'],
            'cliente': fila['cliente__nombre'],
            'pedidos_totales': fila['total_pedidos'],
            'ingreso_total': float(ingreso_cliente),
            'ultima_compra': ultima.date().isoformat() if ultima else None,
            'dias_desde_ultima_compra': dias_desde_ultima,
            'estado_cliente': estado_cliente,
        })
    total_clientes = len(historico)
    ltv = ingresos_historicos / total_clientes if total_clientes else Decimal('0')
    tasa_recompra = (
        Decimal(clientes_con_recompra) / Decimal(total_clientes) * 100
        if total_clientes
        else Decimal('0')
    )

    leads_qs = Lead.objects.all()
    if desde:
        leads_qs = leads_qs.filter(fecha_creacion__date__gte=desde)
    if hasta:
        leads_qs = leads_qs.filter(fecha_creacion__date__lte=hasta)
    total_leads = leads_qs.count()
    leads_convertidos = leads_qs.filter(estado=Lead.ESTADO_CONVERTIDO).count()
    leads_por_origen = []
    for valor, etiqueta in Lead.VIA_CHOICES:
        origen_qs = leads_qs.filter(via_contacto=valor)
        total_origen = origen_qs.count()
        convertidos_origen = origen_qs.filter(estado=Lead.ESTADO_CONVERTIDO).count()
        leads_por_origen.append({
            'source': etiqueta,
            'total': total_origen,
            'convertidos': convertidos_origen,
            'tasa_conversion': (
                round(convertidos_origen / total_origen * 100, 1)
                if total_origen
                else 0
            ),
        })
    leads = {
        'total': total_leads,
        'convertidos': leads_convertidos,
        'tasa_conversion': (
            round(leads_convertidos / total_leads * 100, 1) if total_leads else 0
        ),
        'por_origen': leads_por_origen,
    }

    return {
        'meta': {
            'endpoint': '/exportar/rentabilidad/',
            'fecha_corte': FECHA_CORTE_FINANCIERO.isoformat(),
            'periodo': {
                'desde': desde.isoformat(),
                'hasta': hasta.isoformat() if hasta else None,
            },
            'moneda_base': 'CUP',
            'tasa_cambio': float(tasa),
            'advertencia_tasa': advertencia_tasa,
            'generado_en': ahora.isoformat(),
            'formato': 'json-para_ia-v3-agrupado',
        },
        'resumen_financiero': {
            'total_ingresos': float(ingresos_caja),
            'ingreso_total_pedidos': float(ingresos_pedidos),
            'total_costos_produccion': float(costos_produccion),
            'total_gastos_operativos': float(total_gastos),
            'gastos_fijos': float(total_gastos_fijos),
            'gastos_variables': float(total_gastos - total_gastos_fijos),
            'utilidad_bruta': float(utilidad_bruta),
            'utilidad_neta': float(utilidad_neta),
            'sueldo_dueno': float(sueldo_dueno),
            'punto_equilibrio': float(punto_equilibrio),
            'margen_contribucion': float(margen_contribucion * 100),
        },
        'pedidos_agrupados': pedidos_agrupados,
        'metricas_produccion': metricas_produccion,
        'clientes': {
            'ltv': float(ltv),
            'tasa_recompra': float(tasa_recompra),
            'total_clientes': total_clientes,
            'detalle': detalle_clientes,
        },
        'leads': leads,
        'gastos_operativos': gastos_agrupados,
    }


def secciones_rentabilidad_ia(desde=None, hasta=None):
    """Secciones adicionales del export de IA enfocadas en rentabilidad.

    Calcula el margen real por pedido y por libro usando ``CosteadorPedido``
    con los parámetros y la tasa de cambio precargados (una sola consulta),
    y agrega nómina, servicios externos, mejores clientes, deudores, flujo por
    moneda y KPIs de fidelidad.
    """
    from empleados.models import PagoNomina
    from proveedores.models import Proveedor

    parametros = _parametros_para_costeador()
    tasa, _ = tasa_cambio()

    pedidos_qs = (
        Pedido.objects.filter(cliente__isnull=False)
        .exclude(estado__nombre__in=['Cancelado', 'Borrador'])
        .select_related('cliente', 'libro')
    )
    if desde:
        pedidos_qs = pedidos_qs.filter(fecha_pedido__date__gte=desde)
    if hasta:
        pedidos_qs = pedidos_qs.filter(fecha_pedido__date__lte=hasta)

    por_libro = {}
    grupos_rentabilidad = {
        'por_mes': {},
        'por_estado': {},
        'por_plan': {},
    }
    estados = dict(Estado.objects.values_list('id', 'nombre'))
    total_pedidos = 0
    for pedido in pedidos_qs.order_by('fecha_pedido'):
        descuento = Decimal(str(pedido.descuento_aplicado or 0))
        ingreso = Decimal(str(pedido.precio_venta or 0)) - descuento
        costo = Decimal(
            str(
                CosteadorPedido(
                    pedido, tasa_cambio=tasa, parametros=parametros
                ).calcular()['costo_total']
            )
        )
        ganancia = ingreso - costo
        titulo = pedido.libro.titulo if pedido.libro else 'Sin libro'
        mes = (
            pedido.fecha_pedido.strftime('%Y-%m')
            if pedido.fecha_pedido
            else 'sin_fecha'
        )
        estado = estados.get(pedido.estado_id, 'Sin estado')
        precio_libro = (
            Decimal(str(pedido.libro.precio_cup_referencia or 0))
            if pedido.libro_id
            else Decimal('0')
        )
        plan = _plan_por_precio_cup(precio_libro)
        for clave, nombre in (
            ('por_mes', mes),
            ('por_estado', estado),
            ('por_plan', plan),
        ):
            grupo = grupos_rentabilidad[clave].setdefault(
                nombre, _grupo_rentabilidad_ia()
            )
            _sumar_grupo_rentabilidad_ia(
                grupo, pedido.cantidad, ingreso, descuento, costo, ganancia
            )
        total_pedidos += 1

        libro_data = por_libro.setdefault(
            titulo,
            {
                'libro': titulo,
                'pedidos': 0,
                'ingreso_total': 0.0,
                'costo_total': 0.0,
                'ganancia_total': 0.0,
            },
        )
        libro_data['pedidos'] += 1
        libro_data['ingreso_total'] += float(ingreso)
        libro_data['costo_total'] += float(costo)
        libro_data['ganancia_total'] += float(ganancia)

    margenes_libro = []
    for data in por_libro.values():
        ingreso_total = data['ingreso_total']
        data['margen_%'] = (
            round(data['ganancia_total'] / ingreso_total * 100, 2)
            if ingreso_total
            else 0
        )
        margenes_libro.append(data)
    margenes_libro.sort(key=lambda item: item['ganancia_total'], reverse=True)
    margenes_libro = _limitar_top_ia(margenes_libro, 'libro', 'Otros libros')

    rentabilidad_agrupada = {
        'total_pedidos': total_pedidos,
        'por_mes': _serializar_grupos_rentabilidad_ia(
            grupos_rentabilidad['por_mes'], 'mes'
        ),
        'por_estado': _serializar_grupos_rentabilidad_ia(
            grupos_rentabilidad['por_estado'], 'estado', por_ganancia=True
        ),
        'por_plan': _serializar_grupos_rentabilidad_ia(
            grupos_rentabilidad['por_plan'], 'plan', por_ganancia=True
        ),
    }

    top_clientes = [
        {
            'cliente': fila['cliente__nombre'],
            'pedidos': fila['pedidos'],
            'ingreso': float(fila['ingreso'] or 0),
        }
        for fila in (
            pedidos_qs.values('cliente__nombre')
            .annotate(pedidos=Count('id'), ingreso=Sum('precio_venta'))
            .order_by('-ingreso')[:10]
        )
    ]

    deudores = [
        {
            'cliente': fila['cliente__nombre'],
            'pedidos_con_deuda': fila['pedidos_con_deuda'],
            'deuda': float(fila['deuda'] or 0),
        }
        for fila in (
            Pedido.objects.filter(cliente__isnull=False, saldo_pendiente__gt=0)
            .values('cliente__nombre')
            .annotate(
                pedidos_con_deuda=Count('id'),
                deuda=Sum('saldo_pendiente'),
            )
            .order_by('-deuda')[:10]
        )
    ]

    nomina_qs = PagoNomina.objects.all()
    if desde:
        nomina_qs = nomina_qs.filter(fecha__gte=desde)
    if hasta:
        nomina_qs = nomina_qs.filter(fecha__lte=hasta)
    nomina = {
        'total_pagado': float(nomina_qs.aggregate(t=Sum('monto_pagado'))['t'] or 0),
        'por_tipo': {
            dict(PagoNomina.TIPO_PAGO).get(fila['tipo'], fila['tipo']): float(
                fila['total'] or 0
            )
            for fila in nomina_qs.values('tipo').annotate(total=Sum('monto_pagado'))
        },
        'por_moneda': {
            fila['moneda']: float(fila['total'] or 0)
            for fila in nomina_qs.values('moneda').annotate(total=Sum('monto_pagado'))
        },
    }

    servicios_qs = ServicioExterno.objects.select_related('proveedor')
    if desde:
        servicios_qs = servicios_qs.filter(fecha_solicitud__date__gte=desde)
    if hasta:
        servicios_qs = servicios_qs.filter(fecha_solicitud__date__lte=hasta)
    servicios = {
        'total': float(servicios_qs.aggregate(t=Sum('monto'))['t'] or 0),
        'por_estado': {
            dict(ServicioExterno.ESTADO_CHOICES).get(fila['estado'], fila['estado']): float(
                fila['total'] or 0
            )
            for fila in servicios_qs.values('estado').annotate(total=Sum('monto'))
        },
        'por_proveedor': [
            {
                'proveedor': fila['proveedor__nombre'],
                'tipo_proveedor': dict(Proveedor.TIPO_CHOICES).get(
                    fila['proveedor__tipo'], fila['proveedor__tipo']
                ),
                'tipo_servicio': dict(ServicioExterno.TIPO_CHOICES).get(
                    fila['tipo'], fila['tipo']
                ),
                'cantidad': fila['cantidad'],
                'monto': float(fila['monto'] or 0),
            }
            for fila in (
                servicios_qs.values('proveedor__nombre', 'proveedor__tipo', 'tipo')
                .annotate(cantidad=Count('id'), monto=Sum('monto'))
                .order_by('-monto')
            )
        ],
    }

    consumo_cup = (
        consumos_inventario(desde, hasta).aggregate(t=Sum('costo_total'))['t']
        or Decimal('0')
    )
    flujo_monedas = resumen_monedas(desde, hasta, consumo_cup=consumo_cup)

    fidelidad = dashboard_fidelidad(desde, hasta)['kpis']

    return {
        'rentabilidad_agrupada': rentabilidad_agrupada,
        'margenes_por_libro': margenes_libro,
        'top_clientes': top_clientes,
        'deudores': deudores,
        'nomina': nomina,
        'servicios_externos': servicios,
        'flujo_por_moneda': flujo_monedas,
        'fidelidad': fidelidad,
    }
