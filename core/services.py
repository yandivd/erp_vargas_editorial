from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Avg, Count, F, Max, Min, OuterRef, Q, Subquery, Sum
from django.db.models.functions import ExtractHour, ExtractWeekDay, TruncMonth, TruncWeek
from django.utils import timezone

from clientes.models import Cliente, EventoFidelidad, TarjetaFidelidad
from clientes.services import ServicioFidelidad
from finanzas.models import ActivoFijo, LoteDivisa, MovimientoCaja
from inventario.models import Material, MovimientoInventario
from pedidos.models import Estado, HistorialEstado, Pedido, ServicioExterno
from pedidos.services import CosteadorPedido, obtener_ganancia_promedio


FECHA_CORTE_FINANCIERO = date(2026, 8, 2)
REFERENCIA_CORTE_FINANCIERO = 487

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


def consumos_inventario(desde=None, hasta=None):
    """Salidas de inventario del período: gasto por consumo, no flujo de caja."""
    qs = MovimientoInventario.objects.filter(tipo='SALIDA')
    inicio = max(FECHA_CORTE_FINANCIERO, desde) if desde else FECHA_CORTE_FINANCIERO
    qs = qs.filter(fecha__date__gte=inicio)
    if hasta:
        qs = qs.filter(fecha__date__lte=hasta)
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

    pedidos = pedidos_financieros(desde, hasta)
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

    costo_produccion_entregados = Decimal('0')
    ganancia_entregados = Decimal('0')
    for pedido in pedidos_entregados:
        costo = Decimal(
            str(CosteadorPedido(pedido).calcular()['costo_total'])
        )
        costo_produccion_entregados += costo
        ganancia_entregados += Decimal(str(pedido.precio_venta)) - costo
    ganancia_promedio_pedido = (
        ganancia_entregados / len(pedidos_entregados)
        if pedidos_entregados
        else Decimal('0')
    )

    saldo_operativo_cup = Decimal(str(monedas['equivalente']['saldo_neto_cup']))
    gastos_equiv_cup = Decimal(str(monedas['equivalente']['gastos_cup']))
    depreciacion_activos_cup = depreciacion_activos_mensual()
    saldo_contable_cup = saldo_operativo_cup - depreciacion_activos_cup
    ganancia_promedio_cup = obtener_ganancia_promedio()
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
        },
        'top10_data': top10_data,
        'ranking_data': ranking_data,
        'recientes_data': recientes_data,
        'comportamiento_pedidos_mes': comportamiento_data,
        'tiempos_por_estado': tiempos_data,
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


def exportar_rentabilidad_para_ia():
    desde = FECHA_CORTE_FINANCIERO
    movimientos = movimientos_financieros(desde, None, None)
    ingresos_movimientos = movimientos.filter(tipo='INGRESO').exclude(Q_NO_INGRESO_OPERATIVO)
    pedidos = (
        Pedido.objects.filter(cliente__isnull=False, fecha_pedido__date__gte=desde)
        .exclude(estado__nombre__in=['Cancelado', 'Borrador'])
        .select_related('cliente', 'libro', 'estado')
        .order_by('fecha_pedido')
    )

    rentabilidad = []
    clientes_agrupados = {}

    for pedido in pedidos:
        ingreso = Decimal(str(pedido.precio_venta)) - Decimal(str(pedido.descuento_aplicado or 0))
        costo = Decimal(str(CosteadorPedido(pedido).calcular()['costo_total']))
        ganancia = ingreso - costo
        cliente_nombre = pedido.cliente.nombre if pedido.cliente else ''

        rentabilidad.append({
            'pedido_id': pedido.id,
            'cliente': cliente_nombre,
            'estado': pedido.estado.nombre,
            'fecha_pedido': pedido.fecha_pedido.date().isoformat() if pedido.fecha_pedido else '',
            'ingreso': float(ingreso),
            'costo': float(costo),
            'ganancia': float(ganancia),
        })

        if cliente_nombre:
            cliente_data = clientes_agrupados.setdefault(
                cliente_nombre,
                {
                    'cliente': cliente_nombre,
                    'total_pedidos': 0,
                    'ingreso_total': 0.0,
                    'ganancia_total': 0.0,
                },
            )
            cliente_data['total_pedidos'] += 1
            cliente_data['ingreso_total'] += float(ingreso)
            cliente_data['ganancia_total'] += float(ganancia)

    clientes = [clientes_agrupados[cliente] for cliente in sorted(clientes_agrupados)]
    ingresos_caja = [
        {
            'movimiento_id': movimiento.id,
            'fecha': movimiento.fecha.date().isoformat() if movimiento.fecha else '',
            'tipo': movimiento.tipo,
            'categoria': movimiento.get_categoria_display() if hasattr(movimiento, 'get_categoria_display') else movimiento.categoria,
            'monto': float(movimiento.monto),
            'moneda': movimiento.moneda,
            'pedido_id': movimiento.pedido_id,
            'cliente_id': movimiento.cliente_id,
            'cliente': movimiento.cliente.nombre if movimiento.cliente else '',
            'concepto': movimiento.concepto,
        }
        for movimiento in ingresos_movimientos.select_related('pedido', 'cliente').order_by('-fecha')[:200]
    ]

    return {
        'meta': {
            'endpoint': '/exportar/rentabilidad/',
            'fecha_corte': FECHA_CORTE_FINANCIERO.isoformat(),
            'periodo': {'desde': FECHA_CORTE_FINANCIERO.isoformat(), 'hasta': None},
            'formato': 'json-para_ia',
        },
        'rentabilidad': rentabilidad,
        'resumen': {
            'total_pedidos': len(rentabilidad),
            'ingreso_total': float(sum(item['ingreso'] for item in rentabilidad)),
            'costo_total': float(sum(item['costo'] for item in rentabilidad)),
            'ganancia_total': float(sum(item['ganancia'] for item in rentabilidad)),
        },
        'clientes': clientes,
        'ingresos_caja': ingresos_caja,
    }


def secciones_rentabilidad_ia(desde=None, hasta=None):
    """Secciones adicionales del export de IA enfocadas en rentabilidad.

    Calcula el margen real por pedido y por libro usando ``CosteadorPedido``
    con los parámetros y la tasa de cambio precargados (una sola consulta),
    y agrega nómina, servicios externos, mejores clientes, deudores, flujo por
    moneda y KPIs de fidelidad.
    """
    from core.models import Parametro
    from empleados.models import PagoNomina
    from proveedores.models import Proveedor

    tasa, _ = tasa_cambio()
    parametros = {param.clave: param.valor for param in Parametro.objects.all()}

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
    rentabilidad_pedidos = []
    for pedido in pedidos_qs.order_by('fecha_pedido'):
        ingreso = Decimal(str(pedido.precio_venta or 0)) - Decimal(
            str(pedido.descuento_aplicado or 0)
        )
        costo = Decimal(
            str(
                CosteadorPedido(
                    pedido, parametros=parametros, tasa_cambio=tasa
                ).calcular()['costo_total']
            )
        )
        ganancia = ingreso - costo
        margen = (ganancia / ingreso * 100) if ingreso else Decimal('0')
        titulo = pedido.libro.titulo if pedido.libro else 'Sin libro'

        rentabilidad_pedidos.append({
            'pedido_id': pedido.id,
            'cliente': pedido.cliente.nombre if pedido.cliente else '',
            'libro': titulo,
            'fecha': pedido.fecha_pedido.date().isoformat() if pedido.fecha_pedido else '',
            'ingreso': float(ingreso),
            'costo': float(costo),
            'ganancia': float(ganancia),
            'margen_%': round(float(margen), 2),
        })

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
        'rentabilidad_por_pedido': rentabilidad_pedidos,
        'margenes_por_libro': margenes_libro,
        'top_clientes': top_clientes,
        'deudores': deudores,
        'nomina': nomina,
        'servicios_externos': servicios,
        'flujo_por_moneda': flujo_monedas,
        'fidelidad': fidelidad,
    }
