from core.api_utils import payload_paginacion, paginar, respuesta_ok
from compras.models import OrdenCompra


def api_compras(request):
    compras = OrdenCompra.objects.select_related('proveedor').all().order_by('-fecha', '-id')

    estado = request.GET.get('estado', '')
    if estado:
        compras = compras.filter(estado=estado)

    paginator, page_obj = paginar(request, compras, per_page=request.GET.get('per_page'))

    data = [
        {
            'id': c.id,
            'codigo': f"OC-{c.id:05d}",
            'fecha': c.fecha.strftime('%d/%m/%Y'),
            'proveedor_nombre': c.proveedor.nombre,
            'total': float(c.total),
            'estado': c.estado,
            'estado_label': c.get_estado_display(),
        }
        for c in page_obj
    ]

    return respuesta_ok(
        data={'compras': data},
        pagination=payload_paginacion(paginator, page_obj),
        meta={'total_compras': paginator.count},
    )
