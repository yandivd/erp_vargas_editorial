from django.shortcuts import render
from django.db.models import Sum, Count, Avg, Q, F
from django.db.models.functions import TruncMonth, TruncWeek, ExtractMonth, ExtractYear
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
import json

from pedidos.models import Pedido, Estado, Book
from clientes.models import Cliente
from finanzas.models import MovimientoCaja, GastoOperativo, Depreciacion
from inventario.models import Material, MovimientoInventario
from proveedores.models import Proveedor


def dashboard(request):
    # ==========================================
    # FILTROS
    # ==========================================
    hoy = timezone.now().date()
    desde_str = request.GET.get('desde', (hoy - timedelta(days=180)).strftime('%Y-%m-%d'))
    hasta_str = request.GET.get('hasta', hoy.strftime('%Y-%m-%d'))

    desde = datetime.strptime(desde_str, '%Y-%m-%d').date()
    hasta = datetime.strptime(hasta_str, '%Y-%m-%d').date()

    # ==========================================
    # 1. KPIs PRINCIPALES
    # ==========================================
    movimientos = MovimientoCaja.objects.filter(fecha__date__gte=desde, fecha__date__lte=hasta)

    CATEGORIAS_TRANSFERENCIA = ['COMPRA_DIVISA', 'VENTA_DIVISA']

    ingresos = movimientos.filter(tipo='INGRESO').exclude(
        categoria__in=CATEGORIAS_TRANSFERENCIA
    ).aggregate(t=Sum('monto'))['t'] or 0

    gastos = movimientos.filter(tipo='EGRESO').exclude(
        categoria__in=CATEGORIAS_TRANSFERENCIA
    ).aggregate(t=Sum('monto'))['t'] or 0

    saldo_neto = ingresos - gastos
    margen = (saldo_neto / ingresos * 100) if ingresos > 0 else 0

    pedidos_qs = Pedido.objects.filter(fecha_pedido__date__gte=desde, fecha_pedido__date__lte=hasta)
    total_pedidos = pedidos_qs.count()
    clientes_unicos = pedidos_qs.values('cliente').distinct().count()

    ventas = pedidos_qs.aggregate(t=Sum('precio_venta'))['t'] or 0
    ganancia_promedio = (saldo_neto / total_pedidos) if total_pedidos > 0 else 0

    # ==========================================
    # 2. DESGLOSE POR TIPO DE INGRESO
    # ==========================================
    desglose_ingresos = movimientos.filter(tipo='INGRESO').exclude(
        categoria__in=CATEGORIAS_TRANSFERENCIA
    ).values('categoria').annotate(total=Sum('monto')).order_by('-total')

    desglose_ingresos_data = [
        {'categoria': dict(MovimientoCaja.CATEGORIA_CHOICES).get(d['categoria'], d['categoria']), 'total': float(d['total'])}
        for d in desglose_ingresos
    ]

    # ==========================================
    # 3. COSTO UNITARIO POR CONSUMO (materiales)
    # ==========================================
    consumos = MovimientoInventario.objects.filter(
        tipo='SALIDA',
        fecha__date__gte=desde,
        fecha__date__lte=hasta
    ).values('material__nombre', 'material__unidad_medida').annotate(
        cantidad=Sum('cantidad'),
        costo_total=Sum('costo_total'),
    ).order_by('-costo_total')

    costo_unitario_data = [
        {
            'material': c['material__nombre'],
            'unidad': c['material__unidad_medida'],
            'cantidad': float(c['cantidad'] or 0),
            'costo_total': float(c['costo_total'] or 0),
            'costo_unitario': float((c['costo_total'] or 0) / c['cantidad']) if c['cantidad'] else 0,
        }
        for c in consumos
    ]

    # ==========================================
    # 4. TENDENCIA MENSUAL Y PROYECCIÓN (6 meses)
    # ==========================================
    tendencia = movimientos.annotate(
        mes=TruncMonth('fecha')
    ).values('mes').annotate(
        ingresos=Sum('monto', filter=Q(tipo='INGRESO')),
        gastos=Sum('monto', filter=Q(tipo='EGRESO')),
    ).order_by('mes')

    tendencia_data = []
    for t in tendencia:
        if t['mes']:
            tendencia_data.append({
                'mes': t['mes'].strftime('%b %Y'),
                'ingresos': float(t['ingresos'] or 0),
                'gastos': float(t['gastos'] or 0),
            })

    # Proyección simple: promedio de los últimos 3 meses
    ultimos = tendencia_data[-3:] if len(tendencia_data) >= 3 else tendencia_data
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

    # ==========================================
    # 5. INGRESOS VS GASTOS POR SEMANA
    # ==========================================
    semanal = movimientos.annotate(
        semana=TruncWeek('fecha')
    ).values('semana').annotate(
        ingresos=Sum('monto', filter=Q(tipo='INGRESO')),
        gastos=Sum('monto', filter=Q(tipo='EGRESO')),
    ).order_by('semana')

    semanal_data = [
        {
            'semana': s['semana'].strftime('%d/%m') if s['semana'] else '',
            'ingresos': float(s['ingresos'] or 0),
            'gastos': float(s['gastos'] or 0),
        }
        for s in semanal
    ]

    # ==========================================
    # 6. CATEGORÍAS DE INGRESO (pastel)
    # ==========================================
    categorias_ingreso = desglose_ingresos_data  # reutilizamos
    
    # ==========================================
    # 7. MAPA DE CALOR POR ACTIVIDAD (día de la semana × hora)
    # ==========================================
    from django.db.models.functions import ExtractWeekDay, ExtractHour

    calor = movimientos.annotate(
        dia=ExtractWeekDay('fecha'),
        hora=ExtractHour('fecha'),
    ).values('dia', 'hora').annotate(total=Count('id')).order_by('dia', 'hora')

    dias_semana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    horas = list(range(0, 24))
    matriz = [[0 for _ in horas] for _ in dias_semana]
    max_valor = 0

    for c in calor:
        if c['dia'] and c['hora'] is not None:
            valor = c['total']
            matriz[c['dia'] - 1][c['hora']] = valor
            if valor > max_valor:
                max_valor = valor

    calor_data = {
        'horas': [f'{h:02d}' for h in horas],
        'filas': [
            {'dia': dias_semana[i], 'valores': matriz[i]}
            for i in range(len(dias_semana))
        ],
        'max': max_valor,
    }

    # ==========================================
    # 8. LISTADO DE TRANSACCIONES (últimas 20)
    # ==========================================
    transacciones = movimientos.select_related('pedido', 'proveedor', 'cliente').order_by('-fecha')[:20]

    # ==========================================
    # 9. ANÁLISIS EXHAUSTIVO POR CATEGORÍA
    # ==========================================
    analisis_categorias = movimientos.values('categoria', 'tipo').annotate(
        total=Sum('monto'),
        cantidad=Count('id'),
    ).order_by('-total')

    analisis_data = [
        {
            'categoria': dict(MovimientoCaja.CATEGORIA_CHOICES).get(a['categoria'], a['categoria']),
            'tipo': a['tipo'],
            'total': float(a['total'] or 0),
            'cantidad': a['cantidad'],
        }
        for a in analisis_categorias
    ]

    # ==========================================
    # 10. CONSEJOS PERSONALIZADOS
    # ==========================================
    consejos = []

    # Consejo 1: margen bajo
    if margen < 20:
        consejos.append({
            'tipo': 'danger',
            'titulo': 'Margen bajo',
            'texto': f'Tu margen neto es {margen:.1f}%. Revisa tus costos o aumenta precios.',
        })
    elif margen > 50:
        consejos.append({
            'tipo': 'success',
            'titulo': 'Margen saludable',
            'texto': f'Tu margen neto es {margen:.1f}%. Vas por buen camino.',
        })

    # Consejo 2: gastos altos
    if ingresos > 0 and (gastos / ingresos) > 0.7:
        consejos.append({
            'tipo': 'warning',
            'titulo': 'Gastos elevados',
            'texto': f'Tus gastos representan el {(gastos/ingresos*100):.1f}% de los ingresos. Revisa gastos operativos.',
        })

    # Consejo 3: pedidos atrasados
    atrasados = Pedido.objects.filter(
        fecha_entrega_prometida__lt=hoy,
        estado__es_final=False
    ).exclude(estado__nombre__in=['Entregado', 'Cancelado']).count()

    if atrasados > 0:
        consejos.append({
            'tipo': 'danger',
            'titulo': f'{atrasados} pedidos atrasados',
            'texto': 'Tienes pedidos con fecha de entrega vencida. Prioriza su producción.',
        })

    # Consejo 4: stock bajo
    materiales_bajos = Material.objects.filter(
        activo=True, stock_actual__lte=F('stock_minimo')
    ).count()

    if materiales_bajos > 0:
        consejos.append({
            'tipo': 'warning',
            'titulo': f'{materiales_bajos} materiales con stock bajo',
            'texto': 'Revisa el inventario y repón los materiales antes de quedarte sin stock.',
        })

    # Consejo 5: clientes únicos
    if clientes_unicos > 0 and total_pedidos / clientes_unicos < 1.5:
        consejos.append({
            'tipo': 'info',
            'titulo': 'Clientes recurrentes bajos',
            'texto': 'La mayoría de tus clientes compran una sola vez. Considera estrategias de fidelización.',
        })

    # ==========================================
    # CONTEXTO
    # ==========================================
    context = {
        'desde': desde_str,
        'hasta': hasta_str,

        # KPIs
        'ingresos': ingresos,
        'gastos': gastos,
        'saldo_neto': saldo_neto,
        'margen': margen,
        'total_pedidos': total_pedidos,
        'clientes_unicos': clientes_unicos,
        'ventas': ventas,
        'ganancia_promedio': ganancia_promedio,

        # Desgloses
        'desglose_ingresos': desglose_ingresos_data,
        'costo_unitario': costo_unitario_data,
        'categorias_ingreso': categorias_ingreso,
        'analisis_categorias': analisis_data,

        # Tendencias
        'tendencia': tendencia_data,
        'proyeccion': proyeccion,
        'semanal': semanal_data,

        # Mapa de calor
        'calor': calor_data,

        # Transacciones
        'transacciones': transacciones,

        # Consejos
        'consejos': consejos,
    }

    return render(request, 'dashboard.html', context)