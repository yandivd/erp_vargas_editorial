from core.api_utils import payload_paginacion, paginar, respuesta_ok
from inventario.models import LoteConsumo, Material


def api_materiales(request):
    materiales = Material.objects.filter(activo=True).order_by('nombre')
    paginator, page_obj = paginar(request, materiales, per_page=request.GET.get('per_page'))

    data = [
        {
            'id': m.id,
            'nombre': m.nombre,
            'unidad_medida': m.unidad_medida,
            'stock_actual': float(m.stock_actual),
            'stock_minimo': float(m.stock_minimo),
            'stock_bajo': m.stock_bajo,
            'costo_promedio': float(m.costo_promedio),
            'valor_inventario': float(m.valor_inventario),
            'unidad_consumo': m.unidad_consumo or '',
            'cantidad_por_unidad': float(m.cantidad_por_unidad),
            'stock_consumo': float(m.stock_consumo),
        }
        for m in page_obj
    ]

    return respuesta_ok(
        data={'materiales': data},
        pagination=payload_paginacion(paginator, page_obj),
        meta={'total_materiales': paginator.count},
    )


def api_lotes(request):
    lotes = LoteConsumo.objects.all().order_by('estado', 'fecha_apertura')
    paginator, page_obj = paginar(request, lotes, per_page=request.GET.get('per_page'))

    data = [
        {
            'id': l.id,
            'material': l.material.nombre,
            'codigo': l.codigo,
            'cantidad_inicial': float(l.cantidad_inicial),
            'cantidad_actual': float(l.cantidad_actual),
            'costo_total': float(l.costo_total),
            'estado': l.estado,
            'fecha_apertura': l.fecha_apertura.strftime('%d/%m/%Y') if l.fecha_apertura else None,
        }
        for l in page_obj
    ]

    return respuesta_ok(
        data={'lotes': data},
        pagination=payload_paginacion(paginator, page_obj),
        meta={'total_lotes': paginator.count},
    )
