from django.shortcuts import render
from django.db.models import Sum, Count, Q, F, Max, OuterRef, Subquery
from django.db.models.functions import TruncMonth, TruncWeek, ExtractWeekDay, ExtractHour
from django.utils import timezone
from datetime import datetime, timedelta
from django.core.cache import cache
import json

from pedidos.models import Pedido
from clientes.models import Cliente
from finanzas.models import MovimientoCaja
from inventario.models import Material, MovimientoInventario


def dashboard(request):
    # ==========================================
    # FILTROS Y CACHÉ
    # ==========================================
    hoy = timezone.now().date()
    desde_str = request.GET.get('desde', (hoy - timedelta(days=180)).strftime('%Y-%m-%d'))
    hasta_str = request.GET.get('hasta', hoy.strftime('%Y-%m-%d'))

    desde = datetime.strptime(desde_str, '%Y-%m-%d').date()
    hasta = datetime.strptime(hasta_str, '%Y-%m-%d').date()

    # Clave de caché única basada en las fechas
    cache_key = f'dashboard_{desde_str}_{hasta_str}'
    context = cache.get(cache_key)

    if context is None:
        # ==========================================
        # 1. KPIs PRINCIPALES
        # ==========================================
        movimientos = MovimientoCaja.objects.filter(fecha__date__gte=desde, fecha__date__lte=hasta)
        CATEGORIAS_TRANSFERENCIA = ['COMPRA_DIVISA', 'VENTA_DIVISA']
        CATEGORIAS_EXCLUIDAS = ['COMPRA_DIVISA', 'VENTA_DIVISA', 'SALDO_INICIAL', 'APERTURA']

        ingresos = movimientos.filter(tipo='INGRESO').exclude(
            categoria__in=CATEGORIAS_EXCLUIDAS
        ).aggregate(t=Sum('monto'))['t'] or 0

        gastos = movimientos.filter(tipo='EGRESO').exclude(
            categoria__in=CATEGORIAS_TRANSFERENCIA
        ).aggregate(t=Sum('monto'))['t'] or 0

        saldo_neto = ingresos - gastos
        margen = (saldo_neto / ingresos * 100) if ingresos > 0 else 0

        # Pedidos con cliente (demanda real)
        pedidos_qs = Pedido.objects.filter(
            fecha_pedido__date__gte=desde,
            fecha_pedido__date__lte=hasta,
            cliente__isnull=False,
        )
        total_pedidos = pedidos_qs.count()
        clientes_unicos = pedidos_qs.values('cliente').distinct().count()

        # Ventas totales
        pedidos_todos = Pedido.objects.filter(
            fecha_pedido__date__gte=desde,
            fecha_pedido__date__lte=hasta,
        )
        ventas = pedidos_todos.aggregate(t=Sum('precio_venta'))['t'] or 0
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
        # 3. COSTO UNITARIO POR CONSUMO
        # ==========================================
        consumos = MovimientoInventario.objects.filter(
            tipo='SALIDA', fecha__date__gte=desde, fecha__date__lte=hasta
        ).values('material__nombre', 'material__unidad_medida').annotate(
            cantidad=Sum('cantidad'), costo_total=Sum('costo_total'),
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
        # 4. TENDENCIA MENSUAL Y PROYECCIÓN
        # ==========================================
        tendencia = movimientos.annotate(mes=TruncMonth('fecha')).values('mes').annotate(
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
        semanal = movimientos.annotate(semana=TruncWeek('fecha')).values('semana').annotate(
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
        # 6. MAPA DE CALOR
        # ==========================================
        calor = movimientos.annotate(
            dia=ExtractWeekDay('fecha'), hora=ExtractHour('fecha'),
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
            'filas': [{'dia': dias_semana[i], 'valores': matriz[i]} for i in range(len(dias_semana))],
            'max': max_valor,
        }

        # ==========================================
        # 7. TRANSACCIONES Y ANÁLISIS POR CATEGORÍA
        # ==========================================
        transacciones = movimientos.select_related('pedido', 'proveedor', 'cliente').order_by('-fecha')[:20]

        analisis_categorias = movimientos.values('categoria', 'tipo').annotate(
            total=Sum('monto'), cantidad=Count('id'),
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
        # 8. CONSEJOS
        # ==========================================
        consejos = []
        if margen < 20:
            consejos.append({'tipo': 'danger', 'titulo': 'Margen bajo', 'texto': f'Tu margen neto es {margen:.1f}%. Revisa tus costos o aumenta precios.'})
        elif margen > 50:
            consejos.append({'tipo': 'success', 'titulo': 'Margen saludable', 'texto': f'Tu margen neto es {margen:.1f}%. Vas por buen camino.'})

        if ingresos > 0 and (gastos / ingresos) > 0.7:
            consejos.append({'tipo': 'warning', 'titulo': 'Gastos elevados', 'texto': f'Tus gastos representan el {(gastos/ingresos*100):.1f}% de los ingresos.'})

        atrasados = Pedido.objects.filter(
            fecha_entrega_prometida__lt=hoy, estado__es_final=False, cliente__isnull=False,
        ).exclude(estado__nombre__in=['Entregado', 'Cancelado']).count()

        if atrasados > 0:
            consejos.append({'tipo': 'danger', 'titulo': f'{atrasados} pedidos atrasados', 'texto': 'Tienes pedidos con fecha de entrega vencida.'})

        materiales_bajos = Material.objects.filter(activo=True, stock_actual__lte=F('stock_minimo')).count()
        if materiales_bajos > 0:
            consejos.append({'tipo': 'warning', 'titulo': f'{materiales_bajos} materiales con stock bajo', 'texto': 'Revisa el inventario y repón los materiales.'})

        if clientes_unicos > 0 and total_pedidos / clientes_unicos < 1.5:
            consejos.append({'tipo': 'info', 'titulo': 'Clientes recurrentes bajos', 'texto': 'La mayoría de tus clientes compran una sola vez.'})

        # ==========================================
        # 9. DATOS PARA LA PESTAÑA PRODUCCIÓN
        # ==========================================
        pedidos_prod = Pedido.objects.filter(
            fecha_pedido__date__gte=desde,
            fecha_pedido__date__lte=hasta,
            cliente__isnull=False,
            es_historico=False
        )

        pedidos_totales = pedidos_prod.count()
        libros_unicos = pedidos_prod.values('libro').distinct().count()

        libros_con_pedidos = pedidos_prod.values('libro').annotate(total=Count('id'))
        libros_con_un_pedido = libros_con_pedidos.filter(total=1).count()
        libros_repetidos = libros_con_pedidos.filter(total__gt=1).count()

        top10_libros = pedidos_prod.values('libro__titulo', 'libro__autor').annotate(
            total_pedidos=Count('id')
        ).order_by('-total_pedidos')[:10]

        top10_data = [{'titulo': l['libro__titulo'], 'autor': l['libro__autor'] or '', 'total': l['total_pedidos']} for l in top10_libros]

        ranking_libros = pedidos_prod.values('libro__titulo', 'libro__autor', 'libro__paginas').annotate(
            total_pedidos=Count('id'),
            total_clientes=Count('cliente', distinct=True),
            total_ventas=Sum('precio_venta'),
        ).order_by('-total_pedidos')[:30]

        ranking_data = [{
            'titulo': l['libro__titulo'], 'autor': l['libro__autor'] or '', 'paginas': l['libro__paginas'],
            'pedidos': l['total_pedidos'], 'clientes': l['total_clientes'], 'ventas': float(l['total_ventas'] or 0),
        } for l in ranking_libros]

        libros_recientes = pedidos_prod.values('libro', 'libro__titulo', 'libro__autor').annotate(
            fecha_reciente=Max('fecha_pedido'),
            total_pedidos=Count('id'),
            total_clientes=Count('cliente', distinct=True),
        ).order_by('-fecha_reciente')[:10]

        recientes_data = [{
            'id': l['libro'], 'titulo': l['libro__titulo'], 'autor': l['libro__autor'] or '',
            'fecha': l['fecha_reciente'].strftime('%d/%m/%Y') if l['fecha_reciente'] else '—',
            'pedidos': l['total_pedidos'], 'clientes': l['total_clientes'],
        } for l in libros_recientes]

        top10_ids = [l['libro'] for l in pedidos_prod.values('libro').annotate(total=Count('id')).order_by('-total')[:10]]

        pedidos_por_mes_top10 = pedidos_prod.filter(libro__id__in=top10_ids).annotate(
            mes=TruncMonth('fecha_pedido')
        ).values('mes', 'libro__titulo').annotate(total=Count('id')).order_by('mes', '-total')

        meses = sorted(set(p['mes'] for p in pedidos_por_mes_top10 if p['mes']))
        meses_labels = [m.strftime('%b %Y') for m in meses]

        series_libros = {}
        for p in pedidos_por_mes_top10:
            if not p['mes']: continue
            titulo = p['libro__titulo']
            if titulo not in series_libros:
                series_libros[titulo] = {m: 0 for m in meses}
            series_libros[titulo][p['mes']] = p['total']

        pedidos_mes_data = {
            'labels': meses_labels,
            'series': [{'label': titulo, 'data': [series_libros[titulo].get(m, 0) for m in meses]} for titulo in series_libros]
        }

        # ==========================================
        # 10. DATOS PARA LA PESTAÑA CLIENTES (Optimizado)
        # ==========================================
        # En lugar de hacer un bucle con consultas, usamos annotate
        ultimo_pedido_subquery = Pedido.objects.filter(
            cliente=OuterRef('pk')
        ).order_by('-fecha_pedido').values('fecha_pedido')[:1]

        clientes_qs = Cliente.objects.annotate(
            total_pedidos_db=Count('pedidos', filter=~Q(pedidos__estado__nombre='Cancelado')),
            total_gastado_db=Sum('pedidos__precio_venta', filter=~Q(pedidos__estado__nombre='Cancelado')),
            fecha_ultimo_db=Subquery(ultimo_pedido_subquery)
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

        clientes_unicos_total = len(clientes_data)
        clientes_nuevos = sum(1 for c in clientes_data if c['tipo'] == 'nuevo')
        clientes_recurrentes = sum(1 for c in clientes_data if c['tipo'] == 'recurrente')
        clientes_vip = sum(1 for c in clientes_data if c['tipo'] == 'vip')
        clientes_en_riesgo = sum(1 for c in clientes_data if c['tipo'] == 'en_riesgo')
        
        promedio_pedidos = (
            sum(c['pedidos'] for c in clientes_data) / clientes_unicos_total
            if clientes_unicos_total > 0 else 0
        )

        clientes_vip_lista = sorted([c for c in clientes_data if c['tipo'] == 'vip'], key=lambda x: x['total_gastado'], reverse=True)
        clientes_riesgo_lista = sorted([c for c in clientes_data if c['tipo'] == 'en_riesgo'], key=lambda x: x['dias_sin_comprar'], reverse=True)

        tipo_cliente_data = [
            {'tipo': 'Nuevos', 'total': clientes_nuevos},
            {'tipo': 'Recurrentes', 'total': clientes_recurrentes},
            {'tipo': 'VIP', 'total': clientes_vip},
        ]

        frecuencia = {}
        for c in clientes_data:
            if c['pedidos'] > 0:
                frecuencia[c['pedidos']] = frecuencia.get(c['pedidos'], 0) + 1

        frecuencia_data = {
            'labels': [str(k) for k in sorted(frecuencia.keys())],
            'data': [frecuencia[k] for k in sorted(frecuencia.keys())],
        }

        # ==========================================
        # GUARDAR EN CACHÉ
        # ==========================================
        context = {
            'desde': desde_str, 'hasta': hasta_str,
            'ingresos': ingresos, 'gastos': gastos, 'saldo_neto': saldo_neto, 'margen': margen,
            'total_pedidos': total_pedidos, 'clientes_unicos': clientes_unicos, 'ventas': ventas, 'ganancia_promedio': ganancia_promedio,
            'desglose_ingresos': desglose_ingresos_data, 'costo_unitario': costo_unitario_data, 'categorias_ingreso': desglose_ingresos_data,
            'analisis_categorias': analisis_data, 'tendencia': tendencia_data, 'proyeccion': proyeccion, 'semanal': semanal_data,
            'calor': calor_data, 'transacciones': transacciones, 'consejos': consejos,
            'pedidos_totales': pedidos_totales, 'libros_unicos': libros_unicos, 'libros_con_un_pedido': libros_con_un_pedido, 'libros_repetidos': libros_repetidos,
            'top10_data': top10_data, 'ranking_data': ranking_data, 'recientes_data': recientes_data, 'pedidos_mes_data': pedidos_mes_data,
            'clientes_unicos_total': clientes_unicos_total, 'clientes_nuevos': clientes_nuevos, 'clientes_recurrentes': clientes_recurrentes,
            'clientes_vip': clientes_vip, 'clientes_en_riesgo': clientes_en_riesgo, 'promedio_pedidos': promedio_pedidos,
            'clientes_vip_lista': clientes_vip_lista, 'clientes_riesgo_lista': clientes_riesgo_lista,
            'tipo_cliente_data': tipo_cliente_data, 'frecuencia_data': frecuencia_data,
        }
        
        # Guardar en caché por 5 minutos (300 segundos)
        cache.set(cache_key, context, 300)

    return render(request, 'dashboard.html', context)