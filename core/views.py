from django.shortcuts import render
from django.db.models import Sum, Count, Q, F, Max, OuterRef, Subquery, Avg
from django.db.models.functions import TruncMonth, TruncWeek, ExtractWeekDay, ExtractHour
from django.utils import timezone
from datetime import datetime, timedelta
from django.core.cache import cache
from django.http import JsonResponse
import json

from pedidos.models import Pedido, CodigoDescuento
from clientes.models import Cliente
from inventario.models import Material, MovimientoInventario
from finanzas.models import MovimientoCaja


def dashboard(request):
    # ==========================================
    # FILTROS (Si no hay fechas, mostramos TODO)
    # ==========================================
    hoy = timezone.now().date()
    desde_str = request.GET.get('desde', '')
    hasta_str = request.GET.get('hasta', '')

    # Clave de caché: si no hay fechas, la clave es "todo"
    cache_key = f'dashboard_{desde_str or "todo"}_{hasta_str or "todo"}'
    context = cache.get(cache_key)

    if context is None:
        # Querysets base
        movimientos = MovimientoCaja.objects.all()
        pedidos_qs = Pedido.objects.filter(cliente__isnull=False)
        pedidos_todos = Pedido.objects.all()
        pedidos_prod = Pedido.objects.filter(cliente__isnull=False, es_historico=False)

        # Aplicar filtros solo si el usuario envió fechas
        if desde_str and hasta_str:
            desde = datetime.strptime(desde_str, '%Y-%m-%d').date()
            hasta = datetime.strptime(hasta_str, '%Y-%m-%d').date()
            
            movimientos = movimientos.filter(fecha__date__gte=desde, fecha__date__lte=hasta)
            pedidos_qs = pedidos_qs.filter(fecha_pedido__date__gte=desde, fecha_pedido__date__lte=hasta)
            pedidos_todos = pedidos_todos.filter(fecha_pedido__date__gte=desde, fecha_pedido__date__lte=hasta)
            pedidos_prod = pedidos_prod.filter(fecha_pedido__date__gte=desde, fecha_pedido__date__lte=hasta)

        # ==========================================
        # 1. KPIs PRINCIPALES
        # ==========================================
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

        total_pedidos = pedidos_qs.count()
        clientes_unicos = pedidos_qs.values('cliente').distinct().count()

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
        consumos = MovimientoInventario.objects.filter(tipo='SALIDA')
        if desde_str and hasta_str:
            consumos = consumos.filter(fecha__date__gte=desde, fecha__date__lte=hasta)
            
        consumos = consumos.values('material__nombre', 'material__unidad_medida').annotate(
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
        # 10. DATOS PARA LA PESTAÑA CLIENTES
        # ==========================================
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
        
        cache.set(cache_key, context, 300)

    return render(request, 'dashboard.html', context)


def exportar_datos_ia(request):
    # ==========================================
    # LÓGICA DE FECHAS (Si no hay, exporta todo)
    # ==========================================
    hoy = timezone.now().date()
    desde_str = request.GET.get('desde', '')
    hasta_str = request.GET.get('hasta', '')
    
    movimientos = MovimientoCaja.objects.all()
    pedidos = Pedido.objects.filter(cliente__isnull=False)
    consumos = MovimientoInventario.objects.filter(tipo='SALIDA')

    if desde_str and hasta_str:
        desde = datetime.strptime(desde_str, '%Y-%m-%d').date()
        hasta = datetime.strptime(hasta_str, '%Y-%m-%d').date()
        movimientos = movimientos.filter(fecha__date__gte=desde, fecha__date__lte=hasta)
        pedidos = pedidos.filter(fecha_pedido__date__gte=desde, fecha_pedido__date__lte=hasta)
        consumos = consumos.filter(fecha__date__gte=desde, fecha__date__lte=hasta)
        periodo_texto = f"{desde_str} al {hasta_str}"
        dias = (hasta - desde).days
    else:
        periodo_texto = "Historial completo"
        dias = "N/A"

    # 1. FINANZAS
    ingresos = movimientos.filter(tipo='INGRESO').exclude(categoria__in=['COMPRA_DIVISA', 'VENTA_DIVISA', 'SALDO_INICIAL']).aggregate(t=Sum('monto'))['t'] or 0
    gastos = movimientos.filter(tipo='EGRESO').exclude(categoria__in=['COMPRA_DIVISA', 'VENTA_DIVISA']).aggregate(t=Sum('monto'))['t'] or 0
    
    gastos_por_categoria = movimientos.filter(tipo='EGRESO').values('categoria').annotate(total=Sum('monto')).order_by('-total')
    gastos_detallados = {dict(MovimientoCaja.CATEGORIA_CHOICES).get(g['categoria'], g['categoria']): float(g['total']) for g in gastos_por_categoria}

    tendencia_mensual = movimientos.annotate(mes=TruncMonth('fecha')).values('mes').annotate(
        ingresos=Sum('monto', filter=Q(tipo='INGRESO')),
        gastos=Sum('monto', filter=Q(tipo='EGRESO'))
    ).order_by('mes')
    
    historial_mensual = [{
        'mes': t['mes'].strftime('%Y-%m'),
        'ingresos': float(t['ingresos'] or 0),
        'gastos': float(t['gastos'] or 0)
    } for t in tendencia_mensual if t['mes']]

    # 2. PRODUCCIÓN
    total_pedidos = pedidos.count()
    ventas_totales = pedidos.aggregate(t=Sum('precio_venta'))['t'] or 0
    
    top_libros = pedidos.values('libro__titulo').annotate(
        cantidad=Count('id'), 
        ingresos=Sum('precio_venta'),
        margen_bruto=Sum(F('precio_venta') - F('descuento_aplicado'))
    ).order_by('-cantidad')[:5]
    
    horas_totales = pedidos.aggregate(t=Sum('horas_invertidas'))['t'] or 0
    promedio_horas = pedidos.aggregate(p=Avg('horas_invertidas'))['p'] or 0

    # 3. CLIENTES
    clientes_unicos = pedidos.values('cliente').distinct().count()
    clientes_nuevos = Cliente.objects.filter(fecha_registro__date__gte=desde, fecha_registro__date__lte=hasta).count() if desde_str and hasta_str else Cliente.objects.count()
    clientes_con_deuda = pedidos.filter(saldo_pendiente__gt=0).values('cliente').distinct().count()
    deuda_total = pedidos.filter(saldo_pendiente__gt=0).aggregate(t=Sum('saldo_pendiente'))['t'] or 0

    # 4. MARKETING
    pedidos_con_descuento = pedidos.filter(codigo_descuento__isnull=False)
    descuentos_otorgados = pedidos_con_descuento.aggregate(t=Sum('descuento_aplicado'))['t'] or 0
    facturacion_con_descuento = pedidos_con_descuento.aggregate(t=Sum('precio_venta'))['t'] or 0
    campanas = pedidos_con_descuento.values('codigo_descuento__codigo').annotate(
        veces_usado=Count('id'),
        descuento_total=Sum('descuento_aplicado'),
        ingresos_generados=Sum('precio_venta')
    )

    # 5. INVENTARIO
    materiales_bajos = Material.objects.filter(activo=True, stock_actual__lte=F('stock_minimo')).values('nombre', 'stock_actual', 'unidad_medida')
    valor_inventario = Material.objects.filter(activo=True).aggregate(t=Sum(F('stock_actual') * F('costo_promedio')))['t'] or 0
    
    materiales_mas_consumidos = consumos.values('material__nombre').annotate(cantidad=Sum('cantidad')).order_by('-cantidad')[:5]

    data = {
        "periodo": {"rango": periodo_texto, "dias": dias},
        "finanzas": {
            "ingresos": float(ingresos),
            "gastos": float(gastos),
            "utilidad": float(ingresos - gastos),
            "margen_%": round(float((ingresos - gastos) / ingresos * 100), 2) if ingresos > 0 else 0,
            "desglose_gastos": gastos_detallados,
            "evolucion_mensual": historial_mensual
        },
        "produccion": {
            "total_pedidos": total_pedidos,
            "facturacion": float(ventas_totales),
            "ticket_promedio": round(float(ventas_totales / total_pedidos), 2) if total_pedidos > 0 else 0,
            "horas_totales_invertidas": float(horas_totales),
            "promedio_horas_por_pedido": round(float(promedio_horas), 2),
            "top_5_libros": list(top_libros)
        },
        "clientes": {
            "total_activos": clientes_unicos,
            "nuevos_registrados": clientes_nuevos,
            "clientes_con_deuda": clientes_con_deuda,
            "dinero_pendiente_cobro": float(deuda_total)
        },
        "marketing": {
            "descuentos_otorgados": float(descuentos_otorgados),
            "facturacion_con_descuento": float(facturacion_con_descuento),
            "desempeno_campanas": list(campanas)
        },
        "inventario": {
            "valor_total_parado": float(valor_inventario),
            "materiales_bajos": list(materiales_bajos),
            "top_consumo": list(materiales_mas_consumidos)
        }
    }

    response = JsonResponse(data, json_dumps_params={'indent': 2, 'ensure_ascii': False})
    filename = f'data_ia_{desde_str}_{hasta_str}.json' if desde_str and hasta_str else 'data_ia_completo.json'
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response