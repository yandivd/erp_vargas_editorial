from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, F, Max, OuterRef, Q, Subquery, Sum
from django.db.models.functions import ExtractHour, ExtractWeekDay, TruncMonth, TruncWeek
from django.utils import timezone

from clientes.models import Cliente
from finanzas.models import ActivoFijo, LoteDivisa, MovimientoCaja
from inventario.models import Material, MovimientoInventario
from pedidos.models import HistorialEstado, Pedido, ServicioExterno
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

Q_APERTURA = (
    Q(categoria__in=['SALDO_INICIAL', 'APERTURA'])
    | Q(categoria='OTRO', concepto__icontains='saldo inicial')
    | Q(categoria='OTRO', concepto__icontains='capital de trabajo')
)
Q_TRANSFERENCIA = Q(categoria__in=CATEGORIAS_TRANSFERENCIA)
Q_NO_INGRESO_OPERATIVO = Q(categoria__in=CATEGORIAS_NO_INGRESO) | Q_APERTURA
Q_NO_EGRESO_OPERATIVO = Q(categoria__in=CATEGORIAS_NO_EGRESO_OPERATIVO)

ESTADOS_PEDIDO_INACTIVO = ['Borrador', 'Cancelado', 'En Stock']

ESTADOS_TIEMPO_ORDEN = [
    'Impreso',
    'Pegado',
    'Pendiente a Portada',
    'Pendiente a Carátula',
    'Pendiente a Encuadernado',
    'Listo para Entregar',
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


def resumen_monedas(desde=None, hasta=None):
    tasa, advertencia = tasa_cambio()
    movs = movimientos_financieros(desde, hasta)

    datos = {}
    for moneda in ('CUP', 'USD'):
        movs_moneda = movs.filter(moneda=moneda)
        ingresos_brutos = _sumar(movs_moneda, 'INGRESO', Q_NO_INGRESO_OPERATIVO)
        vuelto_clientes = _sumar_vuelto(movs_moneda)
        ingresos = ingresos_brutos - vuelto_clientes
        gastos = _sumar(movs_moneda, 'EGRESO', Q_NO_EGRESO_OPERATIVO)
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
    monedas = resumen_monedas(desde, hasta)
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
        .exclude(Q_NO_INGRESO_OPERATIVO)
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

    gastos_desglose = (
        movs.filter(tipo='EGRESO', moneda='CUP')
        .exclude(Q_NO_EGRESO_OPERATIVO)
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

    consumos = MovimientoInventario.objects.filter(tipo='SALIDA')
    if desde:
        consumos = consumos.filter(fecha__date__gte=max(FECHA_CORTE_FINANCIERO, desde))
    else:
        consumos = consumos.filter(fecha__date__gte=FECHA_CORTE_FINANCIERO)
    if hasta:
        consumos = consumos.filter(fecha__date__lte=hasta)
    consumos = (
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
        for c in consumos
    ]

    tendencia = (
        movs.filter(moneda='CUP')
        .annotate(mes=TruncMonth('fecha'))
        .values('mes')
        .annotate(
            ingresos_brutos=Sum(
                'monto', filter=Q(tipo='INGRESO') & ~Q_NO_INGRESO_OPERATIVO
            ),
            vuelto_clientes=Sum(
                'monto',
                filter=Q(tipo='EGRESO')
                & Q(categoria=CATEGORIA_VUELTO_CLIENTE),
            ),
            gastos=Sum(
                'monto',
                filter=Q(tipo='EGRESO') & ~Q_NO_EGRESO_OPERATIVO,
            ),
        )
        .order_by('mes')
    )
    tendencia_data = [
        {
            'mes': t['mes'].strftime('%b %Y'),
            'ingresos_brutos': float(t['ingresos_brutos'] or 0),
            'vuelto_clientes': float(t['vuelto_clientes'] or 0),
            'ingresos': float(
                (t['ingresos_brutos'] or 0) - (t['vuelto_clientes'] or 0)
            ),
            'gastos': float(t['gastos'] or 0),
        }
        for t in tendencia
        if t['mes']
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
                'monto', filter=Q(tipo='INGRESO') & ~Q_NO_INGRESO_OPERATIVO
            ),
            vuelto_clientes=Sum(
                'monto',
                filter=Q(tipo='EGRESO')
                & Q(categoria=CATEGORIA_VUELTO_CLIENTE),
            ),
            gastos=Sum(
                'monto',
                filter=Q(tipo='EGRESO') & ~Q_NO_EGRESO_OPERATIVO,
            ),
        )
        .order_by('semana')
    )
    semanal_data = [
        {
            'semana': s['semana'].strftime('%d/%m') if s['semana'] else '',
            'ingresos_brutos': float(s['ingresos_brutos'] or 0),
            'vuelto_clientes': float(s['vuelto_clientes'] or 0),
            'ingresos': float(
                (s['ingresos_brutos'] or 0) - (s['vuelto_clientes'] or 0)
            ),
            'gastos': float(s['gastos'] or 0),
        }
        for s in semanal
    ]

    ingresos_por_dia = (
        movs.filter(moneda='CUP', tipo='INGRESO')
        .exclude(Q_NO_INGRESO_OPERATIVO)
        .annotate(dia=ExtractWeekDay('fecha'))
        .values('dia')
        .annotate(total=Sum('monto'))
    )
    totales_por_dia = {
        fila['dia']: float(fila['total'] or 0)
        for fila in ingresos_por_dia
    }
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

    fechas_entrega = dict(pedidos.values_list('id', 'fecha_entrega_real'))
    historial = (
        HistorialEstado.objects.filter(pedido__in=pedidos)
        .select_related('estado_nuevo')
        .order_by('pedido_id', 'fecha')
    )
    historial_por_pedido = {}
    for evento in historial:
        historial_por_pedido.setdefault(evento.pedido_id, []).append(evento)

    tiempos_acumulados = {}
    for pedido_id, eventos in historial_por_pedido.items():
        for indice, evento in enumerate(eventos):
            if indice + 1 < len(eventos):
                siguiente = eventos[indice + 1].fecha
            else:
                siguiente = fechas_entrega.get(pedido_id)
            if not siguiente:
                continue
            horas = (siguiente - evento.fecha).total_seconds() / 3600
            if horas <= 0:
                continue
            estado = evento.estado_nuevo
            if estado.nombre not in ESTADOS_TIEMPO_ORDEN:
                continue
            acumulado = tiempos_acumulados.setdefault(
                estado.nombre,
                {
                    'estado': estado.nombre,
                    'color': estado.color,
                    'total_horas': 0.0,
                    'pedidos': 0,
                },
            )
            acumulado['total_horas'] += horas
            acumulado['pedidos'] += 1

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
        elif total_pedidos_c >= 5 or total_gastado >= 20000:
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
